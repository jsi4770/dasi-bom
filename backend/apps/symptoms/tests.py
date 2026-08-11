from datetime import date, datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .analysis import build_streak, week_bounds
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


@override_settings(GEMINI_API_KEY='')  # 문장은 템플릿 폴백으로 — 테스트가 외부 API에 기대지 않게
class WeeklyReportTests(SymptomApiTestCase):
    """집계 숫자가 맞는지만 본다. 문장 자체는 검증 대상이 아니다."""

    def setUp(self):
        super().setUp()
        self.url = reverse('symptoms:report-weekly')
        self.monday, _ = week_bounds(timezone.localdate())

    def _log(self, day, hour, code='hot_flash'):
        SymptomLog.objects.create(
            user=self.user,
            symptom_type=SymptomType.objects.get(code=code),
            occurred_at=timezone.make_aware(datetime.combine(day, time(hour, 0))),
        )

    def _check_in(self, day, sleep_quality=3, mood=3):
        DailyCheckIn.objects.create(user=self.user, date=day, sleep_quality=sleep_quality, mood=mood)

    def test_counts_symptoms_and_finds_peak_time_slot(self):
        for hour in (19, 20, 21, 14):
            self._log(self.monday, hour)

        stats = self.client.get(self.url).data['stats']

        top = stats['symptoms'][0]
        self.assertEqual(top['count'], 4)
        self.assertEqual(top['peak_slot'], 'evening')
        self.assertEqual(top['peak_ratio'], 0.75)

    def test_does_not_claim_a_peak_when_evenly_spread(self):
        for hour in (3, 9, 14, 20):  # 네 시간대에 하나씩
            self._log(self.monday, hour)

        top = self.client.get(self.url).data['stats']['symptoms'][0]

        self.assertIsNone(top['peak_slot'])

    def test_compares_with_previous_week(self):
        self._log(self.monday, 20)
        self._log(self.monday - timedelta(days=7), 20)
        self._log(self.monday - timedelta(days=6), 20)

        top = self.client.get(self.url).data['stats']['symptoms'][0]

        self.assertEqual(top['prev_count'], 2)
        self.assertEqual(top['delta'], -1)

    def test_links_poor_sleep_to_same_day_symptoms(self):
        for offset, sleep, count in [(0, 2, 3), (1, 2, 3), (2, 5, 1), (3, 5, 1)]:
            day = self.monday + timedelta(days=offset)
            self._check_in(day, sleep_quality=sleep)
            for i in range(count):
                self._log(day, 19 + i)

        link = self.client.get(self.url).data['stats']['sleep_link']

        self.assertEqual(link['symptoms_after_poor_sleep'], 3.0)
        self.assertEqual(link['symptoms_after_good_sleep'], 1.0)

    def test_averages_include_actual_sleep_hours(self):
        """프론트 리포트 화면이 '평균 수면 시간'을 쓰기 때문에 1~5 점수와 별개로 나가야 한다."""
        DailyCheckIn.objects.create(
            user=self.user, date=self.monday, sleep_quality=2, mood=3, sleep_hours=5,
        )
        DailyCheckIn.objects.create(
            user=self.user, date=self.monday + timedelta(days=1), sleep_quality=4, mood=4, sleep_hours=7,
        )

        averages = self.client.get(self.url).data['stats']['check_in_averages']

        self.assertEqual(averages['sleep_hours'], 6.0)
        self.assertEqual(averages['sleep_quality'], 3.0)

    def test_sleep_hours_is_none_when_nobody_filled_it_in(self):
        self._check_in(self.monday)

        self.assertIsNone(self.client.get(self.url).data['stats']['check_in_averages']['sleep_hours'])

    def test_skips_sleep_link_when_sample_is_too_small(self):
        self._check_in(self.monday, sleep_quality=2)
        self._check_in(self.monday + timedelta(days=1), sleep_quality=5)

        self.assertIsNone(self.client.get(self.url).data['stats']['sleep_link'])

    def test_reuses_the_sentence_while_the_numbers_are_unchanged(self):
        self._log(self.monday, 20)

        first = self.client.get(self.url).data
        second = self.client.get(self.url).data

        self.assertEqual(first['summary_source'], 'template')
        self.assertEqual(second['summary_source'], 'cached')
        self.assertEqual(first['summary_text'], second['summary_text'])

    def test_regenerates_when_a_new_record_arrives(self):
        self._log(self.monday, 20)
        self.client.get(self.url)

        self._log(self.monday, 21)

        self.assertEqual(self.client.get(self.url).data['summary_source'], 'template')

    def test_refresh_forces_regeneration(self):
        self._log(self.monday, 20)
        self.client.get(self.url)

        self.assertEqual(self.client.get(self.url, {'refresh': '1'}).data['summary_source'], 'template')

    def test_empty_week_still_returns_a_report(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stats']['total_logs'], 0)
        self.assertTrue(response.data['summary_text'])

    def test_rejects_malformed_week_param(self):
        response = self.client.get(self.url, {'week': '이번주'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_another_users_records_do_not_leak(self):
        SymptomLog.objects.create(
            user=self.other,
            symptom_type=self.hot_flash,
            occurred_at=timezone.make_aware(datetime.combine(self.monday, time(20, 0))),
        )

        self.assertEqual(self.client.get(self.url).data['stats']['total_logs'], 0)


class StreakTests(SymptomApiTestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse('symptoms:streak')

    def test_counts_consecutive_days_backwards(self):
        today = timezone.localdate()
        for days_ago in (0, 1, 2, 4):  # 3일 전은 비어 있음
            DailyCheckIn.objects.create(
                user=self.user, date=today - timedelta(days=days_ago), sleep_quality=3, mood=3,
            )

        self.assertEqual(self.client.get(self.url).data['current_streak'], 3)

    def test_today_being_empty_does_not_break_the_streak(self):
        """저녁 체크인 전에는 오늘이 비어 있는 게 정상이다."""
        today = timezone.localdate()
        for days_ago in (1, 2):
            DailyCheckIn.objects.create(
                user=self.user, date=today - timedelta(days=days_ago), sleep_quality=3, mood=3,
            )

        self.assertEqual(self.client.get(self.url).data['current_streak'], 2)

    def test_reports_two_week_goal(self):
        """주가 다 지난 시점을 기준으로 봐야 해서, 엔드포인트 대신 기준일을 고정해 호출한다."""
        sunday = date(2026, 8, 16)
        monday = sunday - timedelta(days=6)
        for offset in range(5):
            DailyCheckIn.objects.create(
                user=self.user, date=monday + timedelta(days=offset), sleep_quality=3, mood=3,
            )
            DailyCheckIn.objects.create(
                user=self.user, date=monday - timedelta(days=7 - offset), sleep_quality=3, mood=3,
            )

        data = build_streak(self.user, today=sunday)

        self.assertEqual(data['this_week_days'], 5)
        self.assertEqual(data['last_week_days'], 5)
        self.assertTrue(data['two_weeks_sustained'])
