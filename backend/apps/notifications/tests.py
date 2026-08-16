import io
from datetime import time, timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time
from pywebpush import WebPushException
from rest_framework import status
from rest_framework.test import APITestCase

from .models import MindfulnessSession, PushSubscription, Reminder, ReminderCompletion
from .services import get_due_reminders, send_reminder_push


class ReminderApiTestCase(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='sungjin', password='pw')
        self.other = get_user_model().objects.create_user(username='someone-else', password='pw')
        self.client.force_authenticate(self.user)


class ReminderCrudTests(ReminderApiTestCase):
    def test_create_assigns_the_requesting_user(self):
        # format='json' 명시: 멀티파트 인코딩에선 DRF BooleanField가 값이 없는 필드를
        # 모델 기본값이 아니라 무조건 False로 취급한다(체크박스 미체크와 구분 불가라서).
        # 실제 앱도 JSON으로 호출하니 그 경로를 검증하는 게 맞다.
        response = self.client.post(reverse('notifications:list-create'), {
            'type': Reminder.Type.MEDICATION,
            'label': '칼슘 영양제',
            'time': '08:00:00',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        reminder = Reminder.objects.get()
        self.assertEqual(reminder.user, self.user)
        self.assertTrue(reminder.is_active)

    def test_list_is_scoped_to_the_requesting_user(self):
        Reminder.objects.create(user=self.other, type=Reminder.Type.MEDICATION, label='영양제', time='08:00:00')

        response = self.client.get(reverse('notifications:list-create'))

        self.assertEqual(response.data, [])

    def test_patch_updates_time_and_active_flag(self):
        reminder = Reminder.objects.create(
            user=self.user, type=Reminder.Type.MINDFULNESS, label='스트레칭', time='07:00:00',
        )

        response = self.client.patch(reverse('notifications:detail', args=[reminder.pk]), {
            'time': '07:30:00', 'is_active': False,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        reminder.refresh_from_db()
        self.assertEqual(str(reminder.time), '07:30:00')
        self.assertFalse(reminder.is_active)

    def test_put_is_not_allowed(self):
        # PATCH만 지원 — 시간/활성화만 바꾸면 되니 전체 치환(PUT)은 열어두지 않는다.
        reminder = Reminder.objects.create(
            user=self.user, type=Reminder.Type.MEDICATION, label='영양제', time='08:00:00',
        )

        response = self.client.put(reverse('notifications:detail', args=[reminder.pk]), {
            'type': Reminder.Type.MEDICATION, 'label': '다른 이름', 'time': '09:00:00',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_delete_removes_the_reminder(self):
        reminder = Reminder.objects.create(
            user=self.user, type=Reminder.Type.MEDICATION, label='영양제', time='08:00:00',
        )

        response = self.client.delete(reverse('notifications:detail', args=[reminder.pk]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Reminder.objects.exists())

    def test_cannot_modify_someone_elses_reminder(self):
        reminder = Reminder.objects.create(
            user=self.other, type=Reminder.Type.MEDICATION, label='영양제', time='08:00:00',
        )

        response = self.client.patch(
            reverse('notifications:detail', args=[reminder.pk]), {'is_active': False}, format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_delete_someone_elses_reminder(self):
        reminder = Reminder.objects.create(
            user=self.other, type=Reminder.Type.MEDICATION, label='영양제', time='08:00:00',
        )

        response = self.client.delete(reverse('notifications:detail', args=[reminder.pk]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Reminder.objects.filter(pk=reminder.pk).exists())


class ReminderCompleteTests(ReminderApiTestCase):
    def setUp(self):
        super().setUp()
        self.reminder = Reminder.objects.create(
            user=self.user, type=Reminder.Type.MEDICATION, label='영양제', time='08:00:00',
        )
        self.url = reverse('notifications:complete', args=[self.reminder.pk])

    def test_toggle_on_then_off_then_on_again(self):
        first = self.client.post(self.url)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertTrue(first.data['completed'])
        self.assertEqual(ReminderCompletion.objects.filter(reminder=self.reminder).count(), 1)

        second = self.client.post(self.url)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertFalse(second.data['completed'])
        self.assertIsNone(second.data['completion'])
        self.assertFalse(ReminderCompletion.objects.filter(reminder=self.reminder).exists())

        third = self.client.post(self.url)
        self.assertEqual(third.status_code, status.HTTP_201_CREATED)
        self.assertTrue(third.data['completed'])
        self.assertEqual(ReminderCompletion.objects.filter(reminder=self.reminder).count(), 1)

    def test_returns_404_for_inactive_reminder(self):
        self.reminder.is_active = False
        self.reminder.save(update_fields=['is_active'])

        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_complete_someone_elses_reminder(self):
        other_reminder = Reminder.objects.create(
            user=self.other, type=Reminder.Type.MEDICATION, label='영양제', time='08:00:00',
        )

        response = self.client.post(reverse('notifications:complete', args=[other_reminder.pk]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ReminderSendNowTests(ReminderApiTestCase):
    """시연용 즉시 발송 — get_due_reminders를 거치지 않는 별도 경로 검증."""

    def setUp(self):
        super().setUp()
        self.reminder = Reminder.objects.create(
            user=self.user, type=Reminder.Type.MEDICATION, label='칼슘·마그네슘', time='08:00:00',
        )
        self.subscription = PushSubscription.objects.create(
            user=self.user, endpoint='https://fcm.googleapis.com/fcm/send/token-1',
            p256dh='p256dh', auth='auth',
        )
        self.url = reverse('notifications:reminder-send-now', args=[self.reminder.pk])

    @patch('apps.notifications.services.webpush')
    def test_sends_to_own_medication_reminder_successfully(self, mock_webpush):
        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sent'], 1)
        self.assertEqual(response.data['failed'], 0)
        self.assertEqual(response.data['expired'], 0)
        self.assertEqual(response.data['reminder'], {
            'id': self.reminder.id, 'label': '칼슘·마그네슘', 'type': 'medication',
        })

    def test_rejects_mindfulness_type(self):
        mindful = Reminder.objects.create(
            user=self.user, type=Reminder.Type.MINDFULNESS, label='스트레칭', time='07:00:00',
        )

        response = self.client.post(reverse('notifications:reminder-send-now', args=[mindful.pk]))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], '즉시 발송은 복약 알림만 지원합니다')

    def test_cannot_send_someone_elses_reminder(self):
        other_reminder = Reminder.objects.create(
            user=self.other, type=Reminder.Type.MEDICATION, label='영양제', time='08:00:00',
        )

        response = self.client.post(reverse('notifications:reminder-send-now', args=[other_reminder.pk]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_no_subscription_returns_clear_error(self):
        self.subscription.delete()

        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], '구독된 기기가 없습니다. 브라우저에서 알림을 허용해주세요.')

    def test_requires_authentication(self):
        self.client.force_authenticate(None)

        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('apps.notifications.services.webpush')
    def test_expired_subscription_is_counted_and_removed(self, mock_webpush):
        mock_webpush.side_effect = WebPushException('gone', response=MagicMock(status_code=410))

        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sent'], 0)
        self.assertEqual(response.data['expired'], 1)
        self.assertFalse(PushSubscription.objects.filter(pk=self.subscription.pk).exists())


class MindfulnessSessionListTests(ReminderApiTestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse('notifications:mindfulness-sessions')

    def test_lists_seeded_sessions_ordered(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        codes = [session['code'] for session in response.data]
        self.assertEqual(codes, ['neck_shoulder_stretch', 'breathing_meditation', 'evening_wind_down'])

    def test_steps_sum_to_total_seconds(self):
        response = self.client.get(self.url)

        for session in response.data:
            self.assertEqual(sum(step['seconds'] for step in session['steps']), session['total_seconds'])

    def test_excludes_inactive_sessions(self):
        MindfulnessSession.objects.filter(code='evening_wind_down').update(is_active=False)

        response = self.client.get(self.url)

        codes = [session['code'] for session in response.data]
        self.assertNotIn('evening_wind_down', codes)

    def test_requires_authentication(self):
        self.client.force_authenticate(None)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TodayRemindersTests(ReminderApiTestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse('notifications:today')

    def test_reflects_completed_state(self):
        reminder = Reminder.objects.create(
            user=self.user, type=Reminder.Type.MEDICATION, label='영양제', time='08:00:00',
        )

        before = self.client.get(self.url)
        self.assertFalse(before.data[0]['completed'])

        ReminderCompletion.objects.create(reminder=reminder, date=timezone.localdate())

        after = self.client.get(self.url)
        self.assertTrue(after.data[0]['completed'])

    def test_excludes_inactive_reminders(self):
        Reminder.objects.create(
            user=self.user, type=Reminder.Type.MEDICATION, label='꺼둔 알림', time='08:00:00', is_active=False,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.data, [])

    def test_excludes_other_users_reminders(self):
        Reminder.objects.create(user=self.other, type=Reminder.Type.MEDICATION, label='영양제', time='08:00:00')

        response = self.client.get(self.url)

        self.assertEqual(response.data, [])

    def test_empty_list_is_not_an_error(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])


class PushSubscriptionApiTestCase(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='sungjin', password='pw')
        self.other = get_user_model().objects.create_user(username='someone-else', password='pw')
        self.client.force_authenticate(self.user)


class PushSubscribeTests(PushSubscriptionApiTestCase):
    def _payload(self, endpoint, p256dh='p256dh-key', auth='auth-key'):
        return {'endpoint': endpoint, 'keys': {'p256dh': p256dh, 'auth': auth}}

    def test_creates_new_subscription(self):
        response = self.client.post(
            reverse('push:subscribe'),
            self._payload('https://fcm.googleapis.com/fcm/send/token-1'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        subscription = PushSubscription.objects.get()
        self.assertEqual(subscription.user, self.user)
        self.assertEqual(subscription.endpoint, 'https://fcm.googleapis.com/fcm/send/token-1')
        self.assertEqual(subscription.p256dh, 'p256dh-key')
        self.assertEqual(subscription.auth, 'auth-key')

    def test_resubscribing_same_user_upserts_without_duplicate(self):
        endpoint = 'https://fcm.googleapis.com/fcm/send/token-2'
        self.client.post(reverse('push:subscribe'), self._payload(endpoint), format='json')

        response = self.client.post(
            reverse('push:subscribe'),
            self._payload(endpoint, p256dh='new-p256dh', auth='new-auth'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(PushSubscription.objects.filter(endpoint=endpoint).count(), 1)
        subscription = PushSubscription.objects.get(endpoint=endpoint)
        self.assertEqual(subscription.p256dh, 'new-p256dh')
        self.assertEqual(subscription.auth, 'new-auth')

    def test_resubscribing_as_different_user_transfers_ownership(self):
        # 공유 기기 시나리오 — 같은 브라우저(endpoint)가 다른 계정으로 재구독하면 소유권이
        # 새 유저로 넘어가고, 이전 유저 기준으로는 더 이상 조회되지 않아야 한다(에러 없이).
        endpoint = 'https://fcm.googleapis.com/fcm/send/token-3'
        self.client.post(reverse('push:subscribe'), self._payload(endpoint), format='json')

        self.client.force_authenticate(self.other)
        response = self.client.post(reverse('push:subscribe'), self._payload(endpoint), format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(PushSubscription.objects.filter(endpoint=endpoint).count(), 1)
        subscription = PushSubscription.objects.get(endpoint=endpoint)
        self.assertEqual(subscription.user, self.other)
        self.assertFalse(PushSubscription.objects.filter(endpoint=endpoint, user=self.user).exists())


class PushSubscribeAuthTests(APITestCase):
    def test_requires_authentication(self):
        response = self.client.post(
            reverse('push:subscribe'),
            {'endpoint': 'https://fcm.googleapis.com/fcm/send/token-4', 'keys': {'p256dh': 'x', 'auth': 'y'}},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class PushUnsubscribeTests(PushSubscriptionApiTestCase):
    def setUp(self):
        super().setUp()
        self.subscription = PushSubscription.objects.create(
            user=self.user,
            endpoint='https://fcm.googleapis.com/fcm/send/token-5',
            p256dh='p256dh-key',
            auth='auth-key',
        )

    def test_removes_subscription(self):
        response = self.client.delete(
            reverse('push:unsubscribe'), {'endpoint': self.subscription.endpoint}, format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PushSubscription.objects.filter(pk=self.subscription.pk).exists())

    def test_cannot_unsubscribe_someone_elses_subscription(self):
        other_subscription = PushSubscription.objects.create(
            user=self.other,
            endpoint='https://fcm.googleapis.com/fcm/send/token-6',
            p256dh='p256dh-key',
            auth='auth-key',
        )

        response = self.client.delete(
            reverse('push:unsubscribe'), {'endpoint': other_subscription.endpoint}, format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(PushSubscription.objects.filter(pk=other_subscription.pk).exists())

    def test_unsubscribing_nonexistent_endpoint_returns_404(self):
        response = self.client.delete(
            reverse('push:unsubscribe'),
            {'endpoint': 'https://fcm.googleapis.com/fcm/send/does-not-exist'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class VapidPublicKeyTests(APITestCase):
    @override_settings(VAPID_PUBLIC_KEY='test-public-key')
    def test_returns_the_public_key_when_configured(self):
        response = self.client.get(reverse('push:vapid-public-key'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'publicKey': 'test-public-key'})

    @override_settings(VAPID_PUBLIC_KEY='')
    def test_returns_503_when_not_configured(self):
        response = self.client.get(reverse('push:vapid-public-key'))

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data, {'error': 'VAPID key not configured'})

    @override_settings(VAPID_PUBLIC_KEY='test-public-key')
    def test_does_not_require_authentication(self):
        response = self.client.get(reverse('push:vapid-public-key'))

        self.assertNotEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class GetDueRemindersTests(TestCase):
    """3단계 판별 로직(services.get_due_reminders) 검증.

    freeze_time으로 UTC 00:00을 고정 — Asia/Seoul(UTC+9) 기준 09:00이 되므로
    아래 리마인더들의 time=09:00과 맞아떨어진다.
    """

    NOW_UTC = '2026-08-16 00:00:00'
    LOCAL_TIME = time(9, 0)

    def setUp(self):
        self.user = get_user_model().objects.create_user(username='chasj', password='pw')

    def _reminder(self, user=None, active=True, at=None, label='칼슘·마그네슘'):
        return Reminder.objects.create(
            user=user or self.user,
            type=Reminder.Type.MEDICATION,
            label=label,
            time=at or self.LOCAL_TIME,
            is_active=active,
        )

    def _subscribe(self, user=None, endpoint='https://fcm.googleapis.com/fcm/send/token'):
        return PushSubscription.objects.create(
            user=user or self.user, endpoint=endpoint, p256dh='p256dh', auth='auth',
        )

    def _due_reminder_ids(self, results):
        return [reminder.pk for reminder, _subscriptions, skip_reason in results if skip_reason is None]

    def _skip_reasons(self, results):
        return [(reminder.pk, skip_reason) for reminder, _subscriptions, skip_reason in results if skip_reason]

    @freeze_time(NOW_UTC)
    def test_matching_time_is_included(self):
        reminder = self._reminder()
        self._subscribe()

        results = get_due_reminders()

        self.assertEqual(self._due_reminder_ids(results), [reminder.pk])

    @freeze_time(NOW_UTC)
    def test_non_matching_time_is_excluded(self):
        self._reminder(at=time(9, 1))
        self._subscribe()

        results = get_due_reminders()

        self.assertEqual(results, [])

    @freeze_time(NOW_UTC)
    def test_inactive_reminder_is_excluded_even_if_time_matches(self):
        self._reminder(active=False)
        self._subscribe()

        results = get_due_reminders()

        self.assertEqual(results, [])

    @freeze_time(NOW_UTC)
    def test_already_completed_today_is_excluded_with_reason(self):
        reminder = self._reminder()
        self._subscribe()
        ReminderCompletion.objects.create(reminder=reminder, date=timezone.localdate())

        results = get_due_reminders()

        self.assertEqual(self._due_reminder_ids(results), [])
        self.assertIn((reminder.pk, '오늘 이미 완료됨'), self._skip_reasons(results))

    @freeze_time(NOW_UTC)
    def test_completion_from_yesterday_does_not_exclude_today(self):
        reminder = self._reminder()
        self._subscribe()
        ReminderCompletion.objects.create(
            reminder=reminder, date=timezone.localdate() - timedelta(days=1),
        )

        results = get_due_reminders()

        self.assertEqual(self._due_reminder_ids(results), [reminder.pk])

    @freeze_time(NOW_UTC)
    def test_user_without_subscription_is_excluded_with_reason(self):
        reminder = self._reminder()

        results = get_due_reminders()

        self.assertEqual(self._due_reminder_ids(results), [])
        self.assertIn((reminder.pk, '구독 정보 없음'), self._skip_reasons(results))

    @freeze_time(NOW_UTC)
    def test_all_subscriptions_of_the_user_are_included(self):
        reminder = self._reminder()
        self._subscribe(endpoint='https://fcm.googleapis.com/fcm/send/token-a')
        self._subscribe(endpoint='https://fcm.googleapis.com/fcm/send/token-b')

        results = get_due_reminders()

        due = [(r, subs) for r, subs, reason in results if reason is None]
        self.assertEqual(len(due), 1)
        matched_reminder, subscriptions = due[0]
        self.assertEqual(matched_reminder.pk, reminder.pk)
        self.assertEqual(len(subscriptions), 2)

    @freeze_time(NOW_UTC)
    def test_multiple_users_due_at_once_are_all_included(self):
        other = get_user_model().objects.create_user(username='heosy', password='pw')
        reminder_a = self._reminder(label='칼슘·마그네슘')
        reminder_b = self._reminder(user=other, label='아침 스트레칭')
        self._subscribe()
        self._subscribe(user=other, endpoint='https://fcm.googleapis.com/fcm/send/token-other')

        results = get_due_reminders()

        self.assertCountEqual(self._due_reminder_ids(results), [reminder_a.pk, reminder_b.pk])


@override_settings(VAPID_PUBLIC_KEY='pub', VAPID_PRIVATE_KEY='priv', VAPID_CLAIMS_EMAIL='ops@example.com')
class SendReminderPushTests(TestCase):
    """4단계 실발송 함수(services.send_reminder_push) 검증. webpush()는 항상 mock —
    실제 푸시 서비스로 네트워크가 나가면 안 된다."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(username='chasj', password='pw')
        self.reminder = Reminder.objects.create(
            user=self.user, type=Reminder.Type.MEDICATION, label='칼슘·마그네슘', time=time(9, 0),
        )
        self.subscription = PushSubscription.objects.create(
            user=self.user, endpoint='https://fcm.googleapis.com/fcm/send/token-1',
            p256dh='p256dh', auth='auth',
        )

    @patch('apps.notifications.services.webpush')
    def test_successful_send_returns_true(self, mock_webpush):
        result = send_reminder_push(self.reminder, self.subscription)

        self.assertTrue(result)
        mock_webpush.assert_called_once()
        self.assertTrue(PushSubscription.objects.filter(pk=self.subscription.pk).exists())

    @patch('apps.notifications.services.webpush')
    def test_claims_sub_gets_mailto_prefix(self, mock_webpush):
        # settings.VAPID_CLAIMS_EMAIL엔 순수 이메일만 들어있으므로, py_vapid가 요구하는
        # mailto: 형식으로 여기서 변환해서 넘겨야 한다.
        send_reminder_push(self.reminder, self.subscription)

        _args, kwargs = mock_webpush.call_args
        self.assertEqual(kwargs['vapid_claims']['sub'], 'mailto:ops@example.com')

    @patch('apps.notifications.services.webpush')
    def test_gone_410_deletes_subscription_and_reports_expired(self, mock_webpush):
        mock_webpush.side_effect = WebPushException('gone', response=MagicMock(status_code=410))

        result = send_reminder_push(self.reminder, self.subscription)

        self.assertEqual(result, 'expired')
        self.assertFalse(PushSubscription.objects.filter(pk=self.subscription.pk).exists())

    @patch('apps.notifications.services.webpush')
    def test_not_found_404_deletes_subscription_and_reports_expired(self, mock_webpush):
        mock_webpush.side_effect = WebPushException('not found', response=MagicMock(status_code=404))

        result = send_reminder_push(self.reminder, self.subscription)

        self.assertEqual(result, 'expired')
        self.assertFalse(PushSubscription.objects.filter(pk=self.subscription.pk).exists())

    @patch('apps.notifications.services.webpush')
    def test_other_status_code_keeps_subscription_and_returns_false(self, mock_webpush):
        mock_webpush.side_effect = WebPushException('rate limited', response=MagicMock(status_code=429))

        result = send_reminder_push(self.reminder, self.subscription)

        self.assertFalse(result)
        self.assertTrue(PushSubscription.objects.filter(pk=self.subscription.pk).exists())

    @patch('apps.notifications.services.webpush')
    def test_network_error_is_absorbed_as_false_without_deleting_subscription(self, mock_webpush):
        # pywebpush가 WebPushException으로 감싸지 않는 에러(요청 타임아웃/연결 실패 등)도
        # 이 함수 밖으로 새어나가면 안 된다 — 배치 처리 중 이 구독 하나 때문에 전체가 멎는다.
        mock_webpush.side_effect = ConnectionError('boom')

        result = send_reminder_push(self.reminder, self.subscription)

        self.assertFalse(result)
        self.assertTrue(PushSubscription.objects.filter(pk=self.subscription.pk).exists())


class SendDueRemindersCommandTests(TestCase):
    NOW_UTC = '2026-08-16 00:00:00'  # Asia/Seoul 기준 09:00
    LOCAL_TIME = time(9, 0)

    def setUp(self):
        self.user = get_user_model().objects.create_user(username='chasj', password='pw')
        self.reminder = Reminder.objects.create(
            user=self.user, type=Reminder.Type.MEDICATION, label='칼슘·마그네슘', time=self.LOCAL_TIME,
        )
        self.subscription = PushSubscription.objects.create(
            user=self.user, endpoint='https://fcm.googleapis.com/fcm/send/token-1',
            p256dh='p256dh', auth='auth',
        )

    def test_missing_vapid_settings_raises_command_error(self):
        with override_settings(VAPID_PUBLIC_KEY='', VAPID_PRIVATE_KEY='', VAPID_CLAIMS_EMAIL=''):
            with self.assertRaises(CommandError):
                call_command('send_due_reminders')

    @freeze_time(NOW_UTC)
    @override_settings(VAPID_PUBLIC_KEY='', VAPID_PRIVATE_KEY='', VAPID_CLAIMS_EMAIL='')
    @patch('apps.notifications.services.webpush')
    def test_dry_run_never_calls_webpush_even_without_vapid_settings(self, mock_webpush):
        out = io.StringIO()
        call_command('send_due_reminders', '--dry-run', stdout=out)

        mock_webpush.assert_not_called()
        self.assertIn('발송 대상 1건', out.getvalue())

    @freeze_time(NOW_UTC)
    @override_settings(VAPID_PUBLIC_KEY='pub', VAPID_PRIVATE_KEY='priv', VAPID_CLAIMS_EMAIL='ops@example.com')
    @patch('apps.notifications.services.webpush')
    def test_one_users_failure_does_not_block_another_users_send(self, mock_webpush):
        other = get_user_model().objects.create_user(username='heosy', password='pw')
        Reminder.objects.create(
            user=other, type=Reminder.Type.MINDFULNESS, label='아침 스트레칭', time=self.LOCAL_TIME,
        )
        PushSubscription.objects.create(
            user=other, endpoint='https://fcm.googleapis.com/fcm/send/token-other',
            p256dh='p256dh', auth='auth',
        )
        mock_webpush.side_effect = [ConnectionError('boom'), None]

        out = io.StringIO()
        call_command('send_due_reminders', stdout=out)

        self.assertEqual(mock_webpush.call_count, 2)
        self.assertIn('발송 완료 1건, 실패 1건, 만료 정리 0건', out.getvalue())
