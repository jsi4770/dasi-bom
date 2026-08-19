from django.conf import settings
from django.db import models
from django.utils import timezone


class SymptomType(models.Model):
    """증상 마스터.

    앱의 원터치 기록 버튼 목록을 이 테이블에서 내려주기 때문에, 증상 항목이
    바뀌어도 앱을 다시 배포할 필요가 없다. 초기 12종은 0002 데이터 마이그레이션
    에서 넣는다.
    """

    class Category(models.TextChoices):
        VASOMOTOR = 'vasomotor', '혈관운동'
        SLEEP = 'sleep', '수면'
        MOOD = 'mood', '감정'
        PHYSICAL = 'physical', '신체'

    code = models.SlugField(max_length=32, unique=True)
    label = models.CharField(max_length=32)
    category = models.CharField(max_length=16, choices=Category.choices)
    emoji = models.CharField(max_length=8, blank=True)
    order = models.PositiveSmallIntegerField(default=0, help_text='앱 버튼 정렬 순서')
    is_active = models.BooleanField(
        default=True,
        help_text='끄면 앱 버튼 목록에서 빠짐 (이미 쌓인 기록은 그대로 유지)',
    )

    class Meta:
        ordering = ['order', 'id']
        verbose_name = '증상 종류'
        verbose_name_plural = '증상 종류'

    def __str__(self):
        return self.label


class SymptomLog(models.Model):
    """낮 동안 원터치로 남기는 증상 1건."""

    class Severity(models.IntegerChoices):
        MILD = 1, '가벼움'
        MODERATE = 2, '보통'
        SEVERE = 3, '심함'

    class Source(models.TextChoices):
        MANUAL = 'manual', '앱에서 직접 기록'
        CHAT = 'chat', '챗봇 대화 중 기록'
        BACKFILL = 'backfill', '지난 날 소급 기록'
        SEED = 'seed', '시연용 목업'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='symptom_logs',
    )
    symptom_type = models.ForeignKey(
        SymptomType,
        on_delete=models.PROTECT,
        related_name='logs',
    )
    severity = models.PositiveSmallIntegerField(
        choices=Severity.choices,
        default=Severity.MODERATE,
    )
    occurred_at = models.DateTimeField(
        default=timezone.now,
        help_text='증상이 있었던 시각. 원터치 기록이면 버튼을 누른 시각과 같다.',
    )
    memo = models.TextField(blank=True)
    source = models.CharField(
        max_length=10,
        choices=Source.choices,
        default=Source.MANUAL,
        help_text='사용자가 직접 누른 기록인지, 챗봇이 대화로 받아낸 기록인지 구분',
    )
    time_estimated = models.BooleanField(
        default=False,
        help_text=(
            '시각을 특정하지 못해 채워 넣은 기록(주로 챗봇 소급 입력). '
            '"주로 저녁 시간대" 같은 시간대 집계에서 제외된다.'
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-occurred_at']
        indexes = [models.Index(fields=['user', 'occurred_at'])]
        verbose_name = '증상 기록'
        verbose_name_plural = '증상 기록'

    def __str__(self):
        return f'{self.user} - {self.symptom_type} ({timezone.localtime(self.occurred_at):%m/%d %H:%M})'


class DailyCheckIn(models.Model):
    """저녁 종합 체크인.

    하루 한 건(user + date 유니크)이고, 이 레코드가 있으면 그날은 '기록 완료'로
    센다 (성공 지표: 2주 연속 주 5일 이상).
    """

    class Scale(models.IntegerChoices):
        VERY_LOW = 1, '매우 나쁨'
        LOW = 2, '나쁨'
        NEUTRAL = 3, '보통'
        HIGH = 4, '좋음'
        VERY_HIGH = 5, '매우 좋음'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='check_ins',
    )
    date = models.DateField(help_text='체크인 대상 날짜 (Asia/Seoul 기준)')

    # DB 레벨은 nullable — 수면 단계만 먼저 저장하는 부분 저장(PATCH)을 허용하기 위해서다.
    # 저녁 체크인(PUT)에서는 여전히 필수로 받는다 — DailyCheckInSerializer의 extra_kwargs 참고.
    sleep_quality = models.PositiveSmallIntegerField(
        choices=Scale.choices, null=True, blank=True, help_text='어젯밤 잘 주무셨나요',
    )
    mood = models.PositiveSmallIntegerField(
        choices=Scale.choices, null=True, blank=True, help_text='오늘 기분',
    )
    fatigue = models.PositiveSmallIntegerField(
        choices=Scale.choices, null=True, blank=True, help_text='높을수록 덜 피곤함',
    )
    stress = models.PositiveSmallIntegerField(
        choices=Scale.choices, null=True, blank=True, help_text='높을수록 스트레스가 적음',
    )
    sleep_hours = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    memo = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        constraints = [
            models.UniqueConstraint(fields=['user', 'date'], name='unique_checkin_per_day'),
        ]
        verbose_name = '일일 체크인'
        verbose_name_plural = '일일 체크인'

    def __str__(self):
        return f'{self.user} - {self.date}'


class WeeklyReport(models.Model):
    """주간 패턴 리포트 캐시.

    집계 숫자는 전부 규칙 기반으로 계산해 `stats`에 넣고, `summary_text`는 그
    숫자를 읽어 문장으로 바꾼 결과다. 계산 로직은 다음 단계에서 `analysis.py`에
    들어간다.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='weekly_reports',
    )
    week_start = models.DateField(help_text='해당 주의 월요일')
    stats = models.JSONField(default=dict, help_text='증상별 횟수·시간대 분포·지난주 대비 증감 등')
    summary_text = models.TextField(blank=True)
    generated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-week_start']
        constraints = [
            models.UniqueConstraint(fields=['user', 'week_start'], name='unique_report_per_week'),
        ]
        verbose_name = '주간 리포트'
        verbose_name_plural = '주간 리포트'

    def __str__(self):
        return f'{self.user} - {self.week_start} 주간 리포트'
