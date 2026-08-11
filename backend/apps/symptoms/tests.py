from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import DailyCheckIn, SymptomLog, SymptomType


class SymptomApiTestCase(APITestCase):
    """마이그레이션 0002 가 증상 마스터를 넣어주므로 별도 fixture 는 없다."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(username='seoyoung', password='pw')
        self.other = get_user_model().objects.create_user(username='someone-else', password='pw')
        self.client.force_authenticate(self.user)
        self.hot_flash = SymptomType.objects.get(code='hot_flash')


class SymptomTypeListTests(SymptomApiTestCase):
    def test_returns_active_types_in_display_order(self):
        response = self.client.get(reverse('symptoms:type-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 12)
        self.assertEqual(response.data[0]['code'], 'hot_flash')

    def test_excludes_deactivated_types(self):
        SymptomType.objects.filter(code='dryness').update(is_active=False)

        codes = [t['code'] for t in self.client.get(reverse('symptoms:type-list')).data]

        self.assertNotIn('dryness', codes)

    def test_requires_authentication(self):
        self.client.force_authenticate(None)

        response = self.client.get(reverse('symptoms:type-list'))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class SymptomLogTests(SymptomApiTestCase):
    def test_one_touch_create_needs_only_symptom_type(self):
        response = self.client.post(reverse('symptoms:log-list-create'), {'symptom_type': self.hot_flash.pk})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        log = SymptomLog.objects.get()
        self.assertEqual(log.user, self.user)
        self.assertEqual(log.severity, SymptomLog.Severity.MODERATE)
        # 앱이 아니라 서버가 정한다 — 챗봇 경유 기록과 구분하기 위해서다.
        self.assertEqual(log.source, SymptomLog.Source.MANUAL)

    def test_create_returns_symptom_detail_for_immediate_render(self):
        response = self.client.post(reverse('symptoms:log-list-create'), {'symptom_type': self.hot_flash.pk})

        self.assertEqual(response.data['symptom_type_detail']['label'], '홍조')
        self.assertEqual(response.data['symptom_type_detail']['emoji'], '🔥')

    def test_rejects_future_timestamp(self):
        response = self.client.post(reverse('symptoms:log-list-create'), {
            'symptom_type': self.hot_flash.pk,
            'occurred_at': timezone.now() + timedelta(hours=1),
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('occurred_at', response.data)

    def test_rejects_deactivated_symptom_type(self):
        SymptomType.objects.filter(pk=self.hot_flash.pk).update(is_active=False)

        response = self.client.post(reverse('symptoms:log-list-create'), {'symptom_type': self.hot_flash.pk})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_is_scoped_to_the_requesting_user(self):
        SymptomLog.objects.create(user=self.other, symptom_type=self.hot_flash)

        response = self.client.get(reverse('symptoms:log-list-create'))

        self.assertEqual(response.data, [])

    def test_list_filters_by_single_date(self):
        today = timezone.localdate()
        for days_ago in (0, 5):
            SymptomLog.objects.create(
                user=self.user,
                symptom_type=self.hot_flash,
                occurred_at=timezone.now() - timedelta(days=days_ago),
            )

        response = self.client.get(reverse('symptoms:log-list-create'), {'date': today.isoformat()})

        self.assertEqual(len(response.data), 1)

    def test_list_defaults_to_recent_two_weeks(self):
        SymptomLog.objects.create(
            user=self.user,
            symptom_type=self.hot_flash,
            occurred_at=timezone.now() - timedelta(days=30),
        )
        SymptomLog.objects.create(user=self.user, symptom_type=self.hot_flash)

        response = self.client.get(reverse('symptoms:log-list-create'))

        self.assertEqual(len(response.data), 1)

    def test_rejects_malformed_date_param(self):
        response = self.client.get(reverse('symptoms:log-list-create'), {'date': '8월 8일'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_inverted_range(self):
        response = self.client.get(reverse('symptoms:log-list-create'), {'from': '2026-08-08', 'to': '2026-08-01'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mistap_can_be_deleted(self):
        log = SymptomLog.objects.create(user=self.user, symptom_type=self.hot_flash)

        response = self.client.delete(reverse('symptoms:log-detail', args=[log.pk]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(SymptomLog.objects.exists())

    def test_cannot_delete_someone_elses_log(self):
        log = SymptomLog.objects.create(user=self.other, symptom_type=self.hot_flash)

        response = self.client.delete(reverse('symptoms:log-detail', args=[log.pk]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(SymptomLog.objects.filter(pk=log.pk).exists())


class TodayCheckInTests(SymptomApiTestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse('symptoms:checkin-today')

    def test_not_yet_checked_in_is_not_an_error(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['completed'])
        self.assertIsNone(response.data['check_in'])

    def test_put_creates_then_updates_the_same_day(self):
        created = self.client.put(self.url, {'sleep_quality': 2, 'mood': 3})
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        updated = self.client.put(self.url, {'sleep_quality': 4, 'mood': 4, 'fatigue': 3})
        self.assertEqual(updated.status_code, status.HTTP_200_OK)

        self.assertEqual(DailyCheckIn.objects.filter(user=self.user).count(), 1)
        self.assertEqual(updated.data['check_in']['sleep_quality'], 4)
        self.assertEqual(updated.data['check_in']['fatigue'], 3)

    def test_optional_fields_may_be_skipped(self):
        response = self.client.put(self.url, {'sleep_quality': 3, 'mood': 3})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data['check_in']['stress'])

    def test_sleep_and_mood_are_required(self):
        response = self.client.put(self.url, {'fatigue': 3})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('sleep_quality', response.data)
        self.assertIn('mood', response.data)

    def test_rejects_out_of_scale_value(self):
        response = self.client.put(self.url, {'sleep_quality': 9, 'mood': 3})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_another_users_checkin_does_not_leak(self):
        DailyCheckIn.objects.create(user=self.other, date=timezone.localdate(), sleep_quality=1, mood=1)

        response = self.client.get(self.url)

        self.assertFalse(response.data['completed'])


class DailyCheckInListTests(SymptomApiTestCase):
    def test_lists_only_own_checkins_in_range(self):
        today = timezone.localdate()
        DailyCheckIn.objects.create(user=self.user, date=today, sleep_quality=3, mood=3)
        DailyCheckIn.objects.create(user=self.user, date=today - timedelta(days=30), sleep_quality=3, mood=3)
        DailyCheckIn.objects.create(user=self.other, date=today, sleep_quality=3, mood=3)

        response = self.client.get(reverse('symptoms:checkin-list'))

        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['date'], today.isoformat())
