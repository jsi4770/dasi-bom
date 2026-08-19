from django.conf import settings
from django.db import models


class MenopauseSurveyResponse(models.Model):
    """완경 단계 자가 설문. 문항 하나(보기 4개)의 답이 곧 단계라 판정 로직이랄 게 없다 —
    CHOICE_TO_STAGE 매핑 하나면 끝난다."""

    class Choice(models.IntegerChoices):
        IRREGULAR = 0, '생리 주기가 불규칙해지기 시작했어요'
        STOPPED_OVER_YEAR = 1, '생리가 완전히 멈춘 지 1년이 넘었어요'
        YEARS_SINCE = 2, '완경 이후 몇 년이 지났어요'
        UNSURE = 3, '잘 모르겠어요 / 해당 사항 없음'

    class Stage(models.TextChoices):
        PERI = 'peri', '완경 이행기'
        MENOPAUSE = 'menopause', '완경'
        POST = 'post', '완경 후기'
        UNKNOWN = 'unknown', '판정 불가'

    CHOICE_TO_STAGE = {
        Choice.IRREGULAR: Stage.PERI,
        Choice.STOPPED_OVER_YEAR: Stage.MENOPAUSE,
        Choice.YEARS_SINCE: Stage.POST,
        Choice.UNSURE: Stage.UNKNOWN,
    }

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='menopause_survey',
    )
    choice = models.PositiveSmallIntegerField(choices=Choice.choices)
    stage = models.CharField(max_length=16, choices=Stage.choices)
    answered_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.user} - {self.stage}'


class UserConsent(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='consent',
    )
    face_analysis_consent = models.BooleanField(default=False)
    face_analysis_consented_at = models.DateTimeField(null=True, blank=True)
    health_data_consent = models.BooleanField(default=False)
    health_data_consented_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'{self.user} - face:{self.face_analysis_consent} health:{self.health_data_consent}'
