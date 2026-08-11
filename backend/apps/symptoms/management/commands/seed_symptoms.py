"""시연용 목업 데이터 생성.

    python manage.py seed_symptoms --reset

PRD의 "심사위원이 직접 연동하지 않아도 되게" 조건 때문에, 2주간 꾸준히 기록해 온
사용자 한 명을 명령어 하나로 재현할 수 있어야 한다. 난수 시드를 고정해 뒀으므로
몇 번을 돌려도 같은 데이터가 나온다 (기준일만 오늘로 옮겨감).

의도적으로 심어 둔 패턴 — 주간 리포트가 이걸 다시 찾아내야 한다:
  1. 홍조가 저녁(18~22시)에 몰린다        → "주로 저녁 시간대"
  2. 잠을 설쳤다고 기록한 날 홍조가 늘어난다 → 수면-증상 상관
  3. 기록이 빠진 날이 이틀 있다           → 챗봇이 먼저 물어볼 재료 (missed-days)
"""

import random
from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.symptoms.models import DailyCheckIn, SymptomLog, SymptomType, WeeklyReport

RANDOM_SEED = 20260808

# 며칠 전인지로 표기 (0 = 오늘)
POOR_SLEEP_DAYS = {12, 10, 6, 5, 2}
SKIP_DAYS = {9, 3}

DEFAULT_PASSWORD = 'demo1234'


class Command(BaseCommand):
    help = '증상 기록·체크인 목업 데이터를 생성합니다 (시연용).'

    def add_arguments(self, parser):
        parser.add_argument('--user', default='demo', help='대상 사용자명 (없으면 새로 만듦)')
        parser.add_argument('--days', type=int, default=14, help='며칠치를 만들지 (기본 14일)')
        parser.add_argument('--password', default=DEFAULT_PASSWORD, help='사용자를 새로 만들 때 쓸 비밀번호')
        parser.add_argument('--reset', action='store_true', help='해당 사용자의 기존 기록을 지우고 다시 만듦')

    @transaction.atomic
    def handle(self, *args, **options):
        username = options['user']
        days = options['days']

        symptom_types = {t.code: t for t in SymptomType.objects.all()}
        if not symptom_types:
            self.stderr.write(self.style.ERROR(
                '증상 마스터가 비어 있습니다. `python manage.py migrate` 를 먼저 실행하세요.'
            ))
            return

        user, created = get_user_model().objects.get_or_create(
            username=username,
            defaults={'first_name': '데모'},
        )
        if created:
            user.set_password(options['password'])
            user.save(update_fields=['password'])
            self.stdout.write(f'사용자 생성: {username} (비밀번호: {options["password"]})')

        if options['reset']:
            deleted_logs, _ = SymptomLog.objects.filter(user=user).delete()
            deleted_checkins, _ = DailyCheckIn.objects.filter(user=user).delete()
            WeeklyReport.objects.filter(user=user).delete()
            self.stdout.write(f'기존 기록 삭제: 증상 {deleted_logs}건 / 체크인 {deleted_checkins}건')
        elif SymptomLog.objects.filter(user=user).exists():
            self.stderr.write(self.style.WARNING(
                f'{username} 에게 이미 기록이 있습니다. 다시 만들려면 --reset 을 붙이세요.'
            ))
            return

        rng = random.Random(RANDOM_SEED)
        tz = timezone.get_current_timezone()
        today = timezone.localdate()

        logs = []
        checkins = []
        skipped = []

        for days_ago in range(days - 1, -1, -1):
            day = today - timedelta(days=days_ago)

            if days_ago in SKIP_DAYS:
                skipped.append(day)
                continue

            # DailyCheckIn.sleep_quality 는 "어젯밤" 을 묻는 값이라, 못 잔 밤의 영향은
            # 그 체크인을 남긴 날 본인에게 나타난다. 증상도 같은 날에 얹어야
            # 리포트가 같은 날짜끼리 비교해서 상관을 찾아낼 수 있다.
            slept_poorly = days_ago in POOR_SLEEP_DAYS

            def add_log(code, hour_range, severity=SymptomLog.Severity.MODERATE):
                start_hour, end_hour = hour_range
                hour = rng.randrange(start_hour, end_hour)
                moment = timezone.make_aware(
                    datetime.combine(day, time(hour % 24, rng.randrange(0, 60))), tz,
                )
                # 자정 넘어가는 시간대(예: 23~25시)는 다음날로 넘긴다
                if hour >= 24:
                    moment += timedelta(days=1)
                logs.append(SymptomLog(
                    user=user,
                    symptom_type=symptom_types[code],
                    severity=severity,
                    occurred_at=moment,
                    source=SymptomLog.Source.SEED,
                ))

            # 1) 홍조 — 70% 는 저녁(18~22시)에 몰리게
            # +2 는 눈에 보이라고 넣은 값이다. 실제 사용자 데이터가 아니라 시연용이므로,
            # 리포트가 상관을 "찾아냈다"고 말할 수 있을 만큼은 벌어져 있어야 한다.
            hot_flashes = rng.choice([0, 1, 1, 2, 2, 3]) + (2 if slept_poorly else 0)
            for _ in range(hot_flashes):
                evening = rng.random() < 0.7
                add_log(
                    'hot_flash',
                    (18, 22) if evening else (9, 17),
                    SymptomLog.Severity.SEVERE if slept_poorly and evening else SymptomLog.Severity.MODERATE,
                )

            # 2) 수면 관련 — 못 잔 날에 몰아서
            if slept_poorly:
                add_log('insomnia', (23, 25), SymptomLog.Severity.SEVERE)
                if rng.random() < 0.6:
                    add_log('night_waking', (2, 5))
            if slept_poorly or rng.random() < 0.25:
                add_log('night_sweat', (2, 5))

            # 3) 감정·신체 — 낮 시간대에 흩뿌림
            for code, probability in [
                ('low_mood', 0.30 if slept_poorly else 0.15),
                ('irritability', 0.30),
                ('anxiety', 0.20),
                ('joint_pain', 0.25),
                ('headache', 0.20),
                ('fatigue', 0.45 if slept_poorly else 0.25),
                ('dryness', 0.10),
            ]:
                if rng.random() < probability:
                    add_log(code, (10, 20), rng.choice([
                        SymptomLog.Severity.MILD,
                        SymptomLog.Severity.MODERATE,
                    ]))

            # 4) 저녁 종합 체크인 — 수면이 나쁜 날은 기분·피로도 같이 내려간다
            sleep_quality = 2 if slept_poorly else rng.choice([3, 4, 4, 5])
            checkins.append(DailyCheckIn(
                user=user,
                date=day,
                sleep_quality=sleep_quality,
                mood=_clamp(sleep_quality + rng.choice([-1, 0, 0, 1])),
                fatigue=_clamp(sleep_quality + rng.choice([-1, 0, 1])),
                stress=_clamp(sleep_quality + rng.choice([-1, 0, 1])),
                sleep_hours=round(rng.uniform(4.0, 5.5) if slept_poorly else rng.uniform(6.0, 7.5), 1),
            ))

        SymptomLog.objects.bulk_create(logs)
        DailyCheckIn.objects.bulk_create(checkins)

        self.stdout.write(self.style.SUCCESS(
            f'{username}: 증상 {len(logs)}건 / 체크인 {len(checkins)}일 생성 '
            f'({today - timedelta(days=days - 1)} ~ {today})'
        ))
        if skipped:
            self.stdout.write('기록 없는 날(챗봇이 물어볼 날): ' + ', '.join(str(d) for d in skipped))


def _clamp(value, low=1, high=5):
    return max(low, min(high, value))
