from django.conf import settings
from django.db import models


class MindfulnessSession(models.Model):
    """명상·스트레칭 콘텐츠 마스터.

    Reminder(type=mindfulness)는 "언제 알릴지"만 담당하고, 실제로 몸을 움직이는
    콘텐츠(무엇을 몇 초씩 할지)는 여기서 따로 관리한다 — 앱에서 이 목록을 그대로
    받아 단계별 타이머로 진행시키는 걸 전제로 한다. 초기 3종은 0002 데이터
    마이그레이션에서 넣는다(SymptomType과 같은 패턴).
    """

    code = models.SlugField(max_length=32, unique=True)
    title = models.CharField(max_length=32)
    description = models.CharField(max_length=60, blank=True)
    total_seconds = models.PositiveSmallIntegerField(help_text='steps 초 합계 (프론트에서 다시 계산 안 해도 되게)')
    steps = models.JSONField(
        help_text='[{"instruction": "목을 천천히 오른쪽으로 기울여요", "seconds": 20}, ...] 순서대로 진행',
    )
    order = models.PositiveSmallIntegerField(default=0, help_text='목록 정렬 순서')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']
        verbose_name = '명상·스트레칭 세션'
        verbose_name_plural = '명상·스트레칭 세션'

    def __str__(self):
        return self.title


class Reminder(models.Model):
    """복약·영양제 또는 명상·스트레칭 알림 설정. 매일 같은 시각에 반복된다."""

    class Type(models.TextChoices):
        MEDICATION = 'medication', '복약·영양제'
        MINDFULNESS = 'mindfulness', '명상·스트레칭'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reminders',
    )
    type = models.CharField(max_length=12, choices=Type.choices)
    label = models.CharField(max_length=32, help_text='예: 칼슘 영양제, 저녁 스트레칭')
    time = models.TimeField(help_text='매일 반복되는 알림 시각')
    is_active = models.BooleanField(default=True, help_text='끄면 오늘의 알림 목록에서 빠짐')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['time']
        indexes = [models.Index(fields=['user', 'is_active'])]
        verbose_name = '리마인더'
        verbose_name_plural = '리마인더'

    def __str__(self):
        return f'{self.user} - {self.label} ({self.time:%H:%M})'


class ReminderCompletion(models.Model):
    """리마인더를 하루치 완료 처리한 기록.

    (reminder, date) 유니크 — complete 엔드포인트가 토글이라, 레코드가 있으면
    완료 상태이고 같은 날 다시 호출하면 이 레코드를 지우는 취소 동작이 된다.
    """

    reminder = models.ForeignKey(
        Reminder,
        on_delete=models.CASCADE,
        related_name='completions',
    )
    date = models.DateField(help_text='완료 처리한 날짜 (Asia/Seoul 기준)')
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']
        constraints = [
            models.UniqueConstraint(fields=['reminder', 'date'], name='unique_completion_per_day'),
        ]
        verbose_name = '리마인더 완료 기록'
        verbose_name_plural = '리마인더 완료 기록'

    def __str__(self):
        return f'{self.reminder} - {self.date}'
