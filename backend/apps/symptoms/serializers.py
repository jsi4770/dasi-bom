from django.utils import timezone
from rest_framework import serializers

from .models import DailyCheckIn, SymptomLog, SymptomType, WeeklyReport


class SymptomTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SymptomType
        fields = ['id', 'code', 'label', 'category', 'emoji', 'order']


class SymptomLogSerializer(serializers.ModelSerializer):
    symptom_type = serializers.PrimaryKeyRelatedField(
        queryset=SymptomType.objects.filter(is_active=True),
    )
    # 앱이 기록 직후 목록을 다시 부르지 않고 바로 그릴 수 있게 증상 정보를 같이 내려준다.
    symptom_type_detail = SymptomTypeSerializer(source='symptom_type', read_only=True)

    class Meta:
        model = SymptomLog
        fields = [
            'id', 'symptom_type', 'symptom_type_detail', 'severity',
            'occurred_at', 'memo', 'source', 'time_estimated', 'created_at',
        ]
        # source / time_estimated 는 어느 엔드포인트로 들어왔는지에 따라 서버가 정한다.
        read_only_fields = ['source', 'time_estimated', 'created_at']

    def validate_occurred_at(self, value):
        if value > timezone.now():
            raise serializers.ValidationError('아직 오지 않은 시각은 기록할 수 없습니다.')
        return value


class DailyCheckInSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyCheckIn
        fields = [
            'id', 'date', 'sleep_quality', 'mood', 'fatigue', 'stress',
            'sleep_hours', 'memo', 'created_at', 'updated_at',
        ]
        read_only_fields = ['date', 'created_at', 'updated_at']


class BackfillEntrySerializer(serializers.Serializer):
    """챗봇이 대화에서 뽑아낸 증상 하나."""

    code = serializers.SlugRelatedField(
        slug_field='code',
        queryset=SymptomType.objects.filter(is_active=True),
        help_text="증상 코드 (예: 'hot_flash'). 목록은 GET /types/ 참고",
    )
    severity = serializers.ChoiceField(
        choices=SymptomLog.Severity.choices,
        required=False,
        default=SymptomLog.Severity.MODERATE,
    )
    time_slot = serializers.ChoiceField(
        choices=['dawn', 'morning', 'afternoon', 'evening'],
        required=False,
        allow_null=True,
        help_text='"언제쯤이었어요?"에 답을 얻었으면 넣어주세요. 없으면 시간대 집계에서 빠집니다.',
    )
    memo = serializers.CharField(required=False, allow_blank=True, default='')


class BackfillSerializer(serializers.Serializer):
    """지난 날 증상을 소급 기록한다 (챗봇 전용)."""

    date = serializers.DateField()
    symptoms = BackfillEntrySerializer(many=True, allow_empty=False)

    def validate_date(self, value):
        today = timezone.localdate()
        if value > today:
            raise serializers.ValidationError('아직 오지 않은 날은 기록할 수 없습니다.')
        if (today - value).days > 30:
            raise serializers.ValidationError('30일보다 오래된 날은 기억이 정확하지 않아 받지 않습니다.')
        return value


class WeeklyReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyReport
        fields = ['week_start', 'stats', 'summary_text', 'generated_at']
