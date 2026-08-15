from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import MindfulnessSession, Reminder, ReminderCompletion


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
