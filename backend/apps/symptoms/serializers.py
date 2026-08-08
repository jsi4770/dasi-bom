from django.utils import timezone
from rest_framework import serializers

from .models import DailyCheckIn, SymptomLog, SymptomType


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
            'occurred_at', 'memo', 'source', 'created_at',
        ]
        # source 는 어느 엔드포인트로 들어왔는지에 따라 서버가 정한다 (앱이 못 바꿈).
        read_only_fields = ['source', 'created_at']

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
