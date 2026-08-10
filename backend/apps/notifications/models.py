from django.conf import settings
from django.db import models


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
