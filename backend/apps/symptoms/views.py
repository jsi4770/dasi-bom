from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DailyCheckIn, SymptomLog, SymptomType
from .serializers import DailyCheckInSerializer, SymptomLogSerializer, SymptomTypeSerializer

DEFAULT_RANGE_DAYS = 14


def _parse_date(raw, field_name):
    try:
        return datetime.strptime(raw, '%Y-%m-%d').date()
    except ValueError:
        raise ValidationError({field_name: 'YYYY-MM-DD 형식이어야 합니다.'})


def _date_range(params):
    """`date=` 하루 또는 `from=`/`to=` 기간. 아무것도 없으면 최근 14일."""
    today = timezone.localdate()

    if 'date' in params:
        day = _parse_date(params['date'], 'date')
        return day, day

    end = _parse_date(params['to'], 'to') if 'to' in params else today
    start = _parse_date(params['from'], 'from') if 'from' in params else end - timedelta(days=DEFAULT_RANGE_DAYS - 1)
    if start > end:
        raise ValidationError({'from': 'from 이 to 보다 늦을 수 없습니다.'})
    return start, end


class SymptomTypeListView(generics.ListAPIView):
    """앱의 원터치 기록 버튼 목록. 비활성화된 증상은 빠진다."""

    serializer_class = SymptomTypeSerializer
    pagination_class = None
    queryset = SymptomType.objects.filter(is_active=True)


class SymptomLogListCreateView(generics.ListCreateAPIView):
    serializer_class = SymptomLogSerializer
    pagination_class = None

    def get_queryset(self):
        start, end = _date_range(self.request.query_params)
        return (
            SymptomLog.objects
            .filter(user=self.request.user, occurred_at__date__gte=start, occurred_at__date__lte=end)
            .select_related('symptom_type')
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, source=SymptomLog.Source.MANUAL)


class SymptomLogDetailView(generics.RetrieveDestroyAPIView):
    """원터치 기록은 잘못 누르기 쉬워서 취소(DELETE)가 필수다."""

    serializer_class = SymptomLogSerializer

    def get_queryset(self):
        return SymptomLog.objects.filter(user=self.request.user).select_related('symptom_type')


class DailyCheckInListView(generics.ListAPIView):
    serializer_class = DailyCheckInSerializer
    pagination_class = None

    def get_queryset(self):
        start, end = _date_range(self.request.query_params)
        return DailyCheckIn.objects.filter(user=self.request.user, date__gte=start, date__lte=end)


class TodayCheckInView(APIView):
    """오늘의 종합 체크인 조회/저장.

    아직 안 한 상태는 오류가 아니라 정상적인 하루의 시작이라서, GET 은 404 대신
    `completed: false` 를 200 으로 돌려준다. 앱이 예외 처리 없이 화면을 그릴 수 있다.
    """

    def get(self, request):
        check_in = DailyCheckIn.objects.filter(user=request.user, date=timezone.localdate()).first()
        return Response(self._payload(check_in))

    def put(self, request):
        today = timezone.localdate()
        existed = DailyCheckIn.objects.filter(user=request.user, date=today).exists()

        serializer = DailyCheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        check_in, _ = DailyCheckIn.objects.update_or_create(
            user=request.user,
            date=today,
            defaults=serializer.validated_data,
        )
        return Response(
            self._payload(check_in),
            status=status.HTTP_200_OK if existed else status.HTTP_201_CREATED,
        )

    def _payload(self, check_in):
        return {
            'date': timezone.localdate(),
            'completed': check_in is not None,
            'check_in': DailyCheckInSerializer(check_in).data if check_in else None,
        }
