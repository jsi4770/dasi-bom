from django.conf import settings
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, mixins, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MindfulnessSession, PushSubscription, Reminder, ReminderCompletion
from .serializers import (
    MindfulnessSessionSerializer,
    PushSubscriptionSerializer,
    ReminderCompletionSerializer,
    ReminderSerializer,
    TodayReminderSerializer,
)
from .services import send_reminder_push


class MindfulnessSessionListView(generics.ListAPIView):
    """명상·스트레칭 콘텐츠 목록. 앱이 그대로 받아 단계별 타이머로 진행시킨다."""

    serializer_class = MindfulnessSessionSerializer
    pagination_class = None
    queryset = MindfulnessSession.objects.filter(is_active=True)


class ReminderListCreateView(generics.ListCreateAPIView):
    serializer_class = ReminderSerializer
    pagination_class = None

    def get_queryset(self):
        return Reminder.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ReminderDetailView(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    generics.GenericAPIView,
):
    """PUT은 안 열어둔다 — 시간/활성화 여부만 부분 수정하면 되니 PATCH만 지원."""

    serializer_class = ReminderSerializer

    def get_queryset(self):
        return Reminder.objects.filter(user=self.request.user)

    def get(self, request, *args, **kwargs):
        return self.retrieve(request, *args, **kwargs)

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        return self.destroy(request, *args, **kwargs)


class ReminderCompleteView(APIView):
    """오늘 날짜 기준 완료 토글.

    완료 기록이 없으면 만들고(완료 처리), 이미 있으면 지운다(취소). (reminder, date)
    유니크 제약이 있어서 이 토글 방식으로는 제약 위반 상황 자체가 생기지 않는다.
    """

    def post(self, request, pk):
        reminder = get_object_or_404(Reminder, pk=pk, user=request.user, is_active=True)
        today = timezone.localdate()
        completion = ReminderCompletion.objects.filter(reminder=reminder, date=today).first()

        if completion:
            completion.delete()
            return Response({'completed': False, 'completion': None})

        completion = ReminderCompletion.objects.create(reminder=reminder, date=today)
        return Response(
            {'completed': True, 'completion': ReminderCompletionSerializer(completion).data},
            status=status.HTTP_201_CREATED,
        )


class ReminderSendNowView(APIView):
    """시연용 즉시 발송 — 시간 조건 무시하고 해당 리마인더를 즉시 발송합니다.
    복약(medication) 타입만 허용."""

    def post(self, request, pk):
        reminder = get_object_or_404(Reminder, pk=pk, user=request.user)

        if reminder.type != Reminder.Type.MEDICATION:
            return Response(
                {'error': '즉시 발송은 복약 알림만 지원합니다'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subscriptions = list(request.user.push_subscriptions.all())
        if not subscriptions:
            return Response(
                {'error': '구독된 기기가 없습니다. 브라우저에서 알림을 허용해주세요.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sent = failed = expired = 0
        for subscription in subscriptions:
            outcome = send_reminder_push(reminder, subscription)
            if outcome is True:
                sent += 1
            elif outcome == 'expired':
                expired += 1
            else:
                failed += 1

        return Response({
            'sent': sent,
            'failed': failed,
            'expired': expired,
            'reminder': {
                'id': reminder.id,
                'label': reminder.label,
                'type': reminder.type,
            },
        })


class TodayRemindersView(generics.ListAPIView):
    """오늘 표시할 활성 리마인더 + 완료 여부. 하나도 없어도 빈 배열로 200을 준다."""

    serializer_class = TodayReminderSerializer
    pagination_class = None

    def get_queryset(self):
        today = timezone.localdate()
        return (
            Reminder.objects
            .filter(user=self.request.user, is_active=True)
            .prefetch_related(
                Prefetch(
                    'completions',
                    queryset=ReminderCompletion.objects.filter(date=today),
                    to_attr='today_completions',
                )
            )
        )


class PushSubscribeView(APIView):
    """Web Push 구독 등록/갱신. 같은 endpoint로 다시 호출하면 upsert된다."""

    def post(self, request):
        serializer = PushSubscriptionSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        existed = PushSubscription.objects.filter(endpoint=serializer.validated_data['endpoint']).exists()
        subscription = serializer.save()

        return Response(
            PushSubscriptionSerializer(subscription).data,
            status=status.HTTP_200_OK if existed else status.HTTP_201_CREATED,
        )


class PushUnsubscribeView(APIView):
    """Web Push 구독 해제. 본인 소유의 endpoint만 지울 수 있다."""

    def delete(self, request):
        subscription = get_object_or_404(
            PushSubscription, endpoint=request.data.get('endpoint'), user=request.user
        )
        subscription.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VapidPublicKeyView(APIView):
    """VAPID public key 조회. 로그인 전에도 프론트가 구독 준비를 위해 이 값을 가져와야
    하므로 의도적으로 인증 예외 처리함 — 이 앱에 있는 다른 AllowAny 없앴던 사례와
    달리 여기는 필요한 경우임."""

    permission_classes = [AllowAny]

    def get(self, request):
        if not settings.VAPID_PUBLIC_KEY:
            return Response({'error': 'VAPID key not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({'publicKey': settings.VAPID_PUBLIC_KEY})
