from django.conf import settings
from django.db import models


class FaceAnalysis(models.Model):
    class Severity(models.TextChoices):
        NORMAL = 'normal', '정상'
        MILD = 'mild', '경미'
        MODERATE = 'moderate', '중등도'
        SEVERE = 'severe', '심함'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='face_analyses',
    )
    image = models.ImageField(upload_to='face_analysis/%Y/%m/%d/')
    redness_score = models.FloatField(help_text='0~100, 높을수록 홍조가 심함')
    severity = models.CharField(max_length=10, choices=Severity.choices)
    region_scores = models.JSONField(
        default=dict,
        help_text='부위별 홍조 점수 (forehead / left_cheek / right_cheek / nose)',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} - {self.created_at:%Y-%m-%d} ({self.severity})'
