from rest_framework import serializers

from .models import MindfulnessSession, PushSubscription, Reminder, ReminderCompletion


class MindfulnessSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MindfulnessSession
        fields = ['id', 'code', 'title', 'description', 'total_seconds', 'steps']


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


class PushSubscriptionKeysSerializer(serializers.Serializer):
    """브라우저 PushSubscription.toJSON()의 keys 필드 그대로 받는 중첩 시리얼라이저."""

    p256dh = serializers.CharField()
    auth = serializers.CharField()


class PushSubscriptionSerializer(serializers.ModelSerializer):
    # endpoint를 명시적으로 선언해서 ModelSerializer가 모델의 unique=True를 보고 자동으로
    # 붙이는 UniqueValidator를 뺀다 — 이 필드는 "중복이면 에러"가 아니라 "중복이면 upsert"가
    # 의도된 동작이라, 자동 검증기가 있으면 재구독 시 create() 도달 전에 400으로 막힌다.
    endpoint = serializers.URLField(max_length=500)
    keys = PushSubscriptionKeysSerializer(write_only=True)

    class Meta:
        model = PushSubscription
        fields = ['id', 'endpoint', 'keys', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        # endpoint 단독 키로 upsert — (user, endpoint) 조합으로 조회하면 다른 유저가 이미
        # 그 endpoint를 쓰고 있을 때 create()가 시도되어 endpoint의 전역 unique 제약에
        # 걸려 IntegrityError가 난다. endpoint만으로 조회하면 공유 기기에서 다른 계정으로
        # 재구독 시 소유권이 자연스럽게 새 유저로 넘어간다.
        keys = validated_data.pop('keys')
        subscription, _ = PushSubscription.objects.update_or_create(
            endpoint=validated_data['endpoint'],
            defaults={
                'user': self.context['request'].user,
                'p256dh': keys['p256dh'],
                'auth': keys['auth'],
            },
        )
        return subscription
