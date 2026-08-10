"""시연용 목업 데이터 생성.

    python manage.py seed_reminders --reset

symptoms 쪽 seed_symptoms.py 와 같은 데모 계정(demo / demo1234)을 공유한다. 난수
시드를 고정해 뒀으므로 몇 번을 돌려도 같은 데이터가 나온다 (기준일만 오늘로 옮겨감).

의도적으로 심어 둔 패턴 — 복약은 잘 지키고 명상/스트레칭은 자주 빠뜨리는, 현실적인
습관 형성 실패 사례를 보여준다 (완료율을 리마인더 종류별로 다르게 줌).
"""

import random
from datetime import time, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.notifications.models import Reminder, ReminderCompletion

RANDOM_SEED = 20260810

DEFAULT_PASSWORD = 'demo1234'

REMINDER_SEEDS = [
    {'type': Reminder.Type.MEDICATION, 'label': '칼슘·마그네슘', 'time': time(8, 0)},
    {'type': Reminder.Type.MEDICATION, 'label': '이소플라본 영양제', 'time': time(19, 0)},
    {'type': Reminder.Type.MINDFULNESS, 'label': '아침 스트레칭', 'time': time(7, 30)},
    {'type': Reminder.Type.MINDFULNESS, 'label': '저녁 명상', 'time': time(21, 30)},
]

# 하루 안 빠뜨리진 않되(=1.0 이면 재미없는 시연 데이터), 복약은 꽤 잘 지키고
# 명상·스트레칭은 자주 빠뜨리는 정도로 갈라 둔다.
COMPLETION_RATE = {
    Reminder.Type.MEDICATION: 0.85,
    Reminder.Type.MINDFULNESS: 0.5,
}


class Command(BaseCommand):
    help = '리마인더·완료기록 목업 데이터를 생성합니다 (시연용).'

    def add_arguments(self, parser):
        parser.add_argument('--user', default='demo', help='대상 사용자명 (없으면 새로 만듦)')
        parser.add_argument('--days', type=int, default=7, help='완료 기록을 며칠치 만들지 (기본 7일)')
        parser.add_argument('--password', default=DEFAULT_PASSWORD, help='사용자를 새로 만들 때 쓸 비밀번호')
        parser.add_argument('--reset', action='store_true', help='해당 사용자의 기존 리마인더/완료기록을 지우고 다시 만듦')

    @transaction.atomic
    def handle(self, *args, **options):
        username = options['user']
        days = options['days']

        user, created = get_user_model().objects.get_or_create(
            username=username,
            defaults={'first_name': '데모'},
        )
        if created:
            user.set_password(options['password'])
            user.save(update_fields=['password'])
            self.stdout.write(f'사용자 생성: {username} (비밀번호: {options["password"]})')

        if options['reset']:
            deleted_completions, _ = ReminderCompletion.objects.filter(reminder__user=user).delete()
            deleted_reminders, _ = Reminder.objects.filter(user=user).delete()
            self.stdout.write(f'기존 기록 삭제: 리마인더 {deleted_reminders}건 / 완료기록 {deleted_completions}건')
        elif Reminder.objects.filter(user=user).exists():
            self.stderr.write(self.style.WARNING(
                f'{username} 에게 이미 리마인더가 있습니다. 다시 만들려면 --reset 을 붙이세요.'
            ))
            return

        rng = random.Random(RANDOM_SEED)
        today = timezone.localdate()

        reminders = [Reminder.objects.create(user=user, **spec) for spec in REMINDER_SEEDS]

        completions = []
        for reminder in reminders:
            rate = COMPLETION_RATE[reminder.type]
            for days_ago in range(days):
                if rng.random() < rate:
                    completions.append(ReminderCompletion(
                        reminder=reminder,
                        date=today - timedelta(days=days_ago),
                    ))
        ReminderCompletion.objects.bulk_create(completions)

        self.stdout.write(self.style.SUCCESS(
            f'{username}: 리마인더 {len(reminders)}건 / 완료기록 {len(completions)}건 생성 '
            f'({today - timedelta(days=days - 1)} ~ {today})'
        ))
