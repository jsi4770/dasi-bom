from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .analysis import build_streak, build_weekly_stats, week_bounds
from .models import DailyCheckIn, SymptomLog, SymptomType, WeeklyReport
from .serializers import (
    DailyCheckInSerializer,
    SymptomLogSerializer,
    SymptomTypeSerializer,
    WeeklyReportSerializer,
)
from .summary import build_summary

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
        user = request.user
        today = timezone.localdate()
        existed = DailyCheckIn.objects.filter(user=user, date=today).exists()

        serializer = DailyCheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        check_in, _ = DailyCheckIn.objects.update_or_create(
            user=user,
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


class WeeklyReportView(APIView):
    """주간 패턴 리포트.

    숫자는 요청할 때마다 다시 집계하지만, **문장은 집계가 달라졌을 때만 새로 만든다.**
    시연 도중 같은 주를 여러 번 열어도 매번 다른 문장이 나오면 곤란하고, Gemini
    무료 티어 한도도 아껴야 하기 때문이다. `?refresh=1` 로 강제로 다시 만들 수 있다.
    """

    def get(self, request):
        user = request.user
        raw_week = request.query_params.get('week')
        week_start, _ = week_bounds(_parse_date(raw_week, 'week') if raw_week else timezone.localdate())

        stats = build_weekly_stats(user, week_start)
        report = WeeklyReport.objects.filter(user=user, week_start=week_start).first()

        forced = request.query_params.get('refresh') == '1'
        reusable = report and report.summary_text and report.stats == stats and not forced

        if reusable:
            source = 'cached'
        else:
            summary, source = build_summary(stats)
            report, _ = WeeklyReport.objects.update_or_create(
                user=user,
                week_start=week_start,
                defaults={'stats': stats, 'summary_text': summary},
            )

        return Response({**WeeklyReportSerializer(report).data, 'summary_source': source})


class StreakView(APIView):
    """기록 지속 현황 — 홈 화면과 성공 지표(2주 연속 주 5일) 확인용."""

    def get(self, request):
        return Response(build_streak(request.user))
