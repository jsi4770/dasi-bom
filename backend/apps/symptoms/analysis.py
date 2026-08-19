"""주간 패턴 집계.

리포트에 나가는 **숫자는 전부 여기서 규칙 기반으로 계산한다.** Gemini 는 이 결과를
받아 문장으로 옮기는 역할만 한다(`summary.py`) — 시연에서 매번 같은 숫자가 나와야 하고,
없는 수치를 지어내면 안 되기 때문이다.
"""

from collections import Counter, defaultdict
from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from apps.face_analysis.models import FaceAnalysis

from .models import DailyCheckIn, SymptomLog

# (코드, 표시 이름, 시작 시각, 끝 시각) — 끝은 미포함
TIME_SLOTS = [
    ('dawn', '새벽', 0, 6),
    ('morning', '오전', 6, 12),
    ('afternoon', '오후', 12, 18),
    ('evening', '저녁', 18, 24),
]

# 한 시간대에 이 비율 이상 몰려야 "주로 ○○ 시간대"라고 말한다.
PEAK_SLOT_RATIO = 0.4

# 수면-증상 비교는 양쪽 모두 이만큼은 있어야 한다. 하루씩만 비교하면 우연이다.
MIN_DAYS_PER_SLEEP_GROUP = 2

POOR_SLEEP_MAX = 2   # 1~2 를 "잘 못 잔 날"로 본다
GOOD_SLEEP_MIN = 4   # 4~5 를 "잘 잔 날"로 본다

GOAL_DAYS_PER_WEEK = 5  # 성공 지표: 주 5일 이상 기록

# --- 진료 상담 안내 기준 ---
# 아래 숫자는 임상 근거가 아니라 시연용으로 잡은 값이다. "병원에 갈 정도인지 판단할
# 근거가 없다"(PRD 장면 3)는 문제에 답하려는 것이지, 진단하려는 게 아니다.
# 실제 서비스로 가려면 전문가 검토가 필요하다.
CARE_HOT_FLASH_PER_WEEK = 10   # 주당 홍조 기록
CARE_POOR_SLEEP_NIGHTS = 3     # 주당 '잘 못 잤다'고 기록한 날
CARE_LOW_MOOD_DAYS = 3         # 주당 기분 2점 이하인 날


def week_bounds(day):
    """그 날짜가 속한 주의 (월요일, 일요일)."""
    start = day - timedelta(days=day.weekday())
    return start, start + timedelta(days=6)


def latest_week_with_records(user, today=None, max_weeks_back=8):
    """기록이 남아 있는 가장 최근 주의 월요일. 하나도 없으면 None.

    월요일 아침처럼 이번 주가 아직 비어 있을 때 빈 리포트 대신 보여줄 주를 찾는다.
    """
    today = today or timezone.localdate()
    earliest = today - timedelta(weeks=max_weeks_back)

    last_log = (
        SymptomLog.objects
        .filter(user=user, occurred_at__date__gte=earliest, occurred_at__date__lte=today)
        .order_by('-occurred_at').first()
    )
    last_check_in = (
        DailyCheckIn.objects
        .filter(user=user, date__gte=earliest, date__lte=today)
        .order_by('-date').first()
    )

    days = [d for d in (
        timezone.localtime(last_log.occurred_at).date() if last_log else None,
        last_check_in.date if last_check_in else None,
    ) if d]
    return week_bounds(max(days))[0] if days else None


def slot_of(hour):
    for code, label, start, end in TIME_SLOTS:
        if start <= hour < end:
            return code, label
    return 'evening', '저녁'  # 도달하지 않지만 방어적으로


def build_weekly_stats(user, week_start):
    """한 주를 집계해 JSON 으로 저장 가능한 dict 를 돌려준다."""
    week_end = week_start + timedelta(days=6)
    prev_start = week_start - timedelta(days=7)

    logs = list(
        SymptomLog.objects
        .filter(user=user, occurred_at__date__gte=week_start, occurred_at__date__lte=week_end)
        .select_related('symptom_type')
    )
    prev_counts = dict(
        SymptomLog.objects
        .filter(user=user, occurred_at__date__gte=prev_start, occurred_at__date__lt=week_start)
        .values_list('symptom_type__code')
        .annotate(n=Count('id'))
    )
    # 이 리스트는 아래 여러 집계 함수가 같이 쓴다 — mood 로 거르지 않고 그 주의 모든
    # DailyCheckIn 을 담아야, 수면만 기록한 날도 sleep_hours 평균/sleep_link 에 들어간다.
    check_ins = list(DailyCheckIn.objects.filter(user=user, date__gte=week_start, date__lte=week_end))
    # "기록한 날"의 기준은 mood 가 채워졌는지다 — 수면만 기록한 날은 목표 일수에 안 들어간다.
    days_recorded = sum(1 for c in check_ins if c.mood is not None)

    return {
        'week_start': week_start.isoformat(),
        'week_end': week_end.isoformat(),
        'total_logs': len(logs),
        'days_recorded': days_recorded,
        'goal_days': GOAL_DAYS_PER_WEEK,
        'goal_met': days_recorded >= GOAL_DAYS_PER_WEEK,
        'symptoms': _symptom_breakdown(logs, prev_counts),
        'time_slots': _slot_totals(logs),
        'check_in_averages': _check_in_averages(check_ins),
        'sleep_link': _sleep_link(logs, check_ins),
        'skin_link': _skin_link(user, week_start, week_end, logs),
        'care_signal': _care_signal(logs, check_ins),
        'missed_dates': _missed_dates(week_start, week_end, check_ins),
    }


def _symptom_breakdown(logs, prev_counts):
    """증상별 횟수 + 지난주 대비 증감 + 몰린 시간대. 많은 순으로 돌려준다."""
    by_code = defaultdict(list)
    for log in logs:
        by_code[log.symptom_type.code].append(log)

    rows = []
    for code, group in by_code.items():
        symptom = group[0].symptom_type
        prev = prev_counts.get(code, 0)

        # 챗봇이 소급 입력한 기록은 시각이 추정값이라 시간대 집계에서 뺀다.
        # 넣으면 "주로 저녁 시간대" 가 채워 넣은 시각 때문에 흔들린다.
        timed = [log for log in group if not log.time_estimated]
        if not timed:
            rows.append({
                'code': code, 'label': symptom.label, 'emoji': symptom.emoji,
                'count': len(group), 'prev_count': prev, 'delta': len(group) - prev,
                'peak_slot': None, 'peak_slot_label': None, 'peak_ratio': None,
            })
            continue

        slots = Counter(slot_of(timezone.localtime(log.occurred_at).hour)[0] for log in timed)
        top_slot, top_n = slots.most_common(1)[0]
        ratio = top_n / len(timed)

        rows.append({
            'code': code,
            'label': symptom.label,
            'emoji': symptom.emoji,
            'count': len(group),
            'prev_count': prev,
            'delta': len(group) - prev,
            # 고르게 흩어져 있으면 시간대를 말하지 않는다 — 없는 패턴을 있다고 하면 안 된다.
            'peak_slot': top_slot if ratio >= PEAK_SLOT_RATIO else None,
            'peak_slot_label': dict((c, l) for c, l, *_ in TIME_SLOTS)[top_slot] if ratio >= PEAK_SLOT_RATIO else None,
            'peak_ratio': round(ratio, 2) if ratio >= PEAK_SLOT_RATIO else None,
        })

    rows.sort(key=lambda r: (-r['count'], r['code']))
    return rows


def _slot_totals(logs):
    counts = Counter(
        slot_of(timezone.localtime(log.occurred_at).hour)[0]
        for log in logs if not log.time_estimated
    )
    return [
        {'code': code, 'label': label, 'count': counts.get(code, 0)}
        for code, label, *_ in TIME_SLOTS
    ]


def _check_in_averages(check_ins):
    def average(field):
        values = [getattr(c, field) for c in check_ins if getattr(c, field) is not None]
        if not values:
            return None
        # sleep_hours 는 Decimal 이라 그대로 두면 JSON 으로 못 나간다.
        return round(float(sum(values)) / len(values), 1)

    return {
        'sleep_quality': average('sleep_quality'),
        'mood': average('mood'),
        'fatigue': average('fatigue'),
        'stress': average('stress'),
        # 1~5 점수가 아니라 실제 수면 시간(예: 6.5). 선택 입력이라 아무도 안 넣으면 None.
        'sleep_hours': average('sleep_hours'),
    }


def _sleep_link(logs, check_ins):
    """잠을 설쳤다고 기록한 날과 잘 잔 날의 증상 건수를 비교한다.

    `sleep_quality` 는 "어젯밤"을 묻는 값이므로 그 체크인을 남긴 **같은 날**의 증상과 묶는다.
    양쪽 표본이 부족하면 None 을 돌려주고, 리포트는 이 문장을 아예 쓰지 않는다.
    """
    logs_per_day = Counter(timezone.localtime(log.occurred_at).date() for log in logs)

    # sleep_quality 는 이제 선택 입력이라(수면만 따로 기록할 수 있으므로) None 인 체크인이
    # 섞여 있을 수 있다 — 비교 연산 전에 걸러낸다.
    scored = [c for c in check_ins if c.sleep_quality is not None]
    poor = [logs_per_day.get(c.date, 0) for c in scored if c.sleep_quality <= POOR_SLEEP_MAX]
    good = [logs_per_day.get(c.date, 0) for c in scored if c.sleep_quality >= GOOD_SLEEP_MIN]

    if len(poor) < MIN_DAYS_PER_SLEEP_GROUP or len(good) < MIN_DAYS_PER_SLEEP_GROUP:
        return None

    poor_avg = round(sum(poor) / len(poor), 1)
    good_avg = round(sum(good) / len(good), 1)
    return {
        'poor_sleep_days': len(poor),
        'good_sleep_days': len(good),
        'symptoms_after_poor_sleep': poor_avg,
        'symptoms_after_good_sleep': good_avg,
        'difference': round(poor_avg - good_avg, 1),
    }


def _skin_link(user, week_start, week_end, logs):
    """얼굴 사진 분석 점수와 같은 날 증상 기록을 나란히 놓는다.

    **상관을 계산하지 않는다.** 얼굴 분석은 194장 벤치마크에서 Pearson r=0.22 로
    피부 점수와 실제 홍조의 상관이 약하게 나왔고(PRD 향후 개선 과제), 한 주에
    사진이 두세 장뿐이라 어떤 수치를 내도 근거가 되지 못한다. "이날은 이랬다"를
    같이 보여주는 데까지만 한다 — 해석은 사람이 한다.
    """
    analyses = (
        FaceAnalysis.objects
        .filter(user=user, created_at__date__gte=week_start, created_at__date__lte=week_end)
        .order_by('created_at')
    )
    if not analyses:
        return None

    hot_flashes_per_day = Counter(
        timezone.localtime(log.occurred_at).date()
        for log in logs if log.symptom_type.code == 'hot_flash'
    )
    logs_per_day = Counter(timezone.localtime(log.occurred_at).date() for log in logs)

    days = []
    for analysis in analyses:
        day = timezone.localtime(analysis.created_at).date()
        days.append({
            'date': day.isoformat(),
            'redness_score': round(analysis.redness_score, 1),
            'severity': analysis.severity,
            'hot_flash_logs': hot_flashes_per_day.get(day, 0),
            'symptom_logs': logs_per_day.get(day, 0),
        })

    return {
        'photo_days': len(days),
        'average_redness': round(sum(d['redness_score'] for d in days) / len(days), 1),
        'days': days,
    }


def _care_signal(logs, check_ins):
    """"이 정도면 병원 가도 되나"에 답할 근거를 모은다 (PRD 장면 3).

    진단이 아니다. 기준을 넘은 항목을 그대로 보여주고, 진료 때 이 기록을 가져가
    보시라고 안내하는 용도다. 넘은 게 없으면 아무 말도 하지 않는다.
    """
    hot_flashes = sum(1 for log in logs if log.symptom_type.code == 'hot_flash')
    # sleep_quality/mood 둘 다 선택 입력이라(부분 저장) None 일 수 있다 — 걸러내고 센다.
    poor_nights = sum(1 for c in check_ins if c.sleep_quality is not None and c.sleep_quality <= POOR_SLEEP_MAX)
    low_mood_days = sum(1 for c in check_ins if c.mood is not None and c.mood <= 2)

    reasons = []
    if hot_flashes >= CARE_HOT_FLASH_PER_WEEK:
        reasons.append({
            'code': 'hot_flash_frequency',
            'label': f'홍조가 이번 주 {hot_flashes}번 기록됐어요',
            'value': hot_flashes,
            'threshold': CARE_HOT_FLASH_PER_WEEK,
        })
    if poor_nights >= CARE_POOR_SLEEP_NIGHTS:
        reasons.append({
            'code': 'poor_sleep',
            'label': f'잘 못 주무신 날이 {poor_nights}일이었어요',
            'value': poor_nights,
            'threshold': CARE_POOR_SLEEP_NIGHTS,
        })
    if low_mood_days >= CARE_LOW_MOOD_DAYS:
        reasons.append({
            'code': 'low_mood',
            'label': f'기분이 가라앉은 날이 {low_mood_days}일이었어요',
            'value': low_mood_days,
            'threshold': CARE_LOW_MOOD_DAYS,
        })

    return {'suggested': bool(reasons), 'reasons': reasons}


def _missed_dates(week_start, week_end, check_ins):
    """그 주에서 저녁 체크인이 없는 날. 오늘은 아직 저녁이 안 왔을 수 있어 빼둔다."""
    # mood 가 없으면(수면만 기록) 저녁 체크인을 한 것으로 안 친다.
    recorded = {c.date for c in check_ins if c.mood is not None}
    today = timezone.localdate()
    last_day = min(week_end, today - timedelta(days=1))

    missed, day = [], week_start
    while day <= last_day:
        if day not in recorded:
            missed.append(day.isoformat())
        day += timedelta(days=1)
    return missed


WEEKDAY_LABELS = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']

MISSED_DAYS_LOOKBACK = 14


def build_missed_days(user, days=MISSED_DAYS_LOOKBACK, today=None):
    """아무 기록도 없는 지난 날들. 챗봇이 "그날은 어떠셨어요?" 하고 물어볼 재료다.

    체크인도 증상 기록도 없는 날만 센다. 둘 중 하나라도 있으면 그날은 이미 말한
    셈이다. 오늘은 아직 저녁이 안 왔을 수 있으니 뺀다 — 하루가 끝나기도 전에
    "오늘 기록이 없네요" 하고 묻는 건 채근이다.
    """
    today = today or timezone.localdate()
    start = today - timedelta(days=days)
    last_day = today - timedelta(days=1)

    # mood 가 없으면(수면만 기록) 저녁 체크인을 한 것으로 안 친다.
    checked = set(
        DailyCheckIn.objects
        .filter(user=user, date__gte=start, date__lte=last_day, mood__isnull=False)
        .values_list('date', flat=True)
    )
    logged = {
        timezone.localtime(moment).date()
        for moment in SymptomLog.objects
        .filter(user=user, occurred_at__date__gte=start, occurred_at__date__lte=last_day)
        .values_list('occurred_at', flat=True)
    }

    missed, day = [], last_day
    while day >= start:
        if day not in checked and day not in logged:
            missed.append({
                'date': day.isoformat(),
                'days_ago': (today - day).days,
                'weekday': WEEKDAY_LABELS[day.weekday()],
            })
        day -= timedelta(days=1)

    # 가까운 날부터. 챗봇이 2주 전 일을 먼저 묻는 건 어색하다.
    return {'lookback_days': days, 'missed_days': missed}


def build_streak(user, today=None):
    """기록 지속 현황. 성공 지표(2주 연속 주 5일)를 앱에서 보여주기 위한 값."""
    today = today or timezone.localdate()
    # mood 가 채워진 날만 "저녁 체크인 완료"로 센다 — 수면만 기록한 날은 스트릭에 안 들어간다.
    recorded = set(
        DailyCheckIn.objects
        .filter(user=user, date__gte=today - timedelta(days=27), date__lte=today, mood__isnull=False)
        .values_list('date', flat=True)
    )

    # 오늘은 아직 저녁 체크인 전일 수 있으므로, 오늘이 비어 있어도 연속이 끊긴 것으로 보지 않는다.
    streak, day = 0, today if today in recorded else today - timedelta(days=1)
    while day in recorded:
        streak += 1
        day -= timedelta(days=1)

    this_week_start, _ = week_bounds(today)
    last_week_start = this_week_start - timedelta(days=7)

    def days_in_week(start):
        return sum(1 for d in recorded if start <= d < start + timedelta(days=7))

    this_week = days_in_week(this_week_start)
    last_week = days_in_week(last_week_start)

    return {
        'current_streak': streak,
        'this_week_days': this_week,
        'last_week_days': last_week,
        'goal_days': GOAL_DAYS_PER_WEEK,
        'goal_met_this_week': this_week >= GOAL_DAYS_PER_WEEK,
        # PRD 성공 지표 — 2주 연속으로 주 5일을 채웠는가
        'two_weeks_sustained': this_week >= GOAL_DAYS_PER_WEEK and last_week >= GOAL_DAYS_PER_WEEK,
    }
