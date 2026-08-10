from rest_framework import serializers

from .models import Reminder, ReminderCompletion


class ReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reminder
        fields = ['id', 'type', 'label', 'time', 'is_active', 'created_at']
        read_only_fields = ['created_at']


class ReminderCompletionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReminderCompletion
        fields = ['id', 'date', 'completed_at']


class TodayReminderSerializer(serializers.ModelSerializer):
    """/api/reminders/today/ 전용. 오늘 날짜 기준 완료 여부를 같이 내려준다."""

    completed = serializers.SerializerMethodField()

    class Meta:
        model = Reminder
        fields = ['id', 'type', 'label', 'time', 'completed']

    def get_completed(self, obj):
        # view의 get_queryset()이 오늘자 completions만 prefetch(to_attr='today_completions')
        # 해두기 때문에, 여기서 다시 쿼리하지 않고 그 결과만 확인한다 (N+1 방지).
        return bool(obj.today_completions)
