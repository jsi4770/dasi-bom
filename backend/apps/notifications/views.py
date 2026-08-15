from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, mixins, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MindfulnessSession, Reminder, ReminderCompletion
from .serializers import (
    MindfulnessSessionSerializer,
    ReminderCompletionSerializer,
    ReminderSerializer,
    TodayReminderSerializer,
)


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
