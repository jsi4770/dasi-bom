from datetime import datetime, time, timedelta

from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .analysis import (
    MISSED_DAYS_LOOKBACK,
    build_missed_days,
    build_streak,
    build_weekly_stats,
    week_bounds,
)
from .models import DailyCheckIn, SymptomLog, SymptomType, WeeklyReport
from .serializers import (
    BackfillSerializer,
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


class MissedDaysView(APIView):
    """챗봇이 "그날은 어떠셨어요?" 하고 먼저 물어볼 날들 (PRD 기능 1).

    가까운 날부터 나간다. 챗봇이 2주 전 일을 먼저 묻는 건 어색하다.
    """

    def get(self, request):
        raw_days = request.query_params.get('days')
        if raw_days is None:
            days = MISSED_DAYS_LOOKBACK
        else:
            try:
                days = int(raw_days)
            except ValueError:
                raise ValidationError({'days': '숫자여야 합니다.'})
            if not 1 <= days <= 30:
                raise ValidationError({'days': '1에서 30 사이여야 합니다.'})

        return Response(build_missed_days(request.user, days=days))


class BackfillView(APIView):
    """챗봇이 대화로 받아낸 지난 날 증상을 저장한다.

    직접 누른 기록과 섞이면 리포트가 "사용자가 스스로 남긴 기록"을 셀 수 없으므로
    `source` 를 서버가 정한다. 시각을 모르면 `time_estimated` 로 표시해 시간대
    집계에서 빠지게 한다 — 채워 넣은 시각이 "주로 저녁 시간대"를 흔들면 안 된다.
    """

    # 시각을 모를 때 넣는 값. 시간대 집계에서는 빠지지만 어딘가에는 놓여야 한다.
    UNKNOWN_HOUR = 12
    SLOT_HOURS = {'dawn': 3, 'morning': 9, 'afternoon': 14, 'evening': 20}

    def post(self, request):
        serializer = BackfillSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        day = serializer.validated_data['date']
        entries = serializer.validated_data['symptoms']

        today = timezone.localdate()
        source = SymptomLog.Source.CHAT if day == today else SymptomLog.Source.BACKFILL
        tz = timezone.get_current_timezone()

        logs = []
        for entry in entries:
            slot = entry.get('time_slot')
            hour = self.SLOT_HOURS[slot] if slot else self.UNKNOWN_HOUR
            logs.append(SymptomLog(
                user=request.user,
                symptom_type=entry['code'],
                severity=entry['severity'],
                occurred_at=timezone.make_aware(datetime.combine(day, time(hour)), tz),
                memo=entry.get('memo', ''),
                source=source,
                time_estimated=slot is None,
            ))
        SymptomLog.objects.bulk_create(logs)

        created = SymptomLog.objects.filter(pk__in=[log.pk for log in logs]).select_related('symptom_type')
        return Response(
            {'created': SymptomLogSerializer(created, many=True).data},
            status=status.HTTP_201_CREATED,
        )


class StreakView(APIView):
    """기록 지속 현황 — 홈 화면과 성공 지표(2주 연속 주 5일) 확인용."""

    def get(self, request):
        return Response(build_streak(request.user))
