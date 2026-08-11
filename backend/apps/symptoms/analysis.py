"""주간 패턴 집계.

리포트에 나가는 **숫자는 전부 여기서 규칙 기반으로 계산한다.** Gemini 는 이 결과를
받아 문장으로 옮기는 역할만 한다(`summary.py`) — 시연에서 매번 같은 숫자가 나와야 하고,
없는 수치를 지어내면 안 되기 때문이다.
"""

from collections import Counter, defaultdict
from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

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


def week_bounds(day):
    """그 날짜가 속한 주의 (월요일, 일요일)."""
    start = day - timedelta(days=day.weekday())
    return start, start + timedelta(days=6)


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
    check_ins = list(DailyCheckIn.objects.filter(user=user, date__gte=week_start, date__lte=week_end))

    return {
        'week_start': week_start.isoformat(),
        'week_end': week_end.isoformat(),
        'total_logs': len(logs),
        'days_recorded': len(check_ins),
        'goal_days': GOAL_DAYS_PER_WEEK,
        'goal_met': len(check_ins) >= GOAL_DAYS_PER_WEEK,
        'symptoms': _symptom_breakdown(logs, prev_counts),
        'time_slots': _slot_totals(logs),
        'check_in_averages': _check_in_averages(check_ins),
        'sleep_link': _sleep_link(logs, check_ins),
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
        slots = Counter(slot_of(timezone.localtime(log.occurred_at).hour)[0] for log in group)
        top_slot, top_n = slots.most_common(1)[0]
        ratio = top_n / len(group)
        prev = prev_counts.get(code, 0)

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
    counts = Counter(slot_of(timezone.localtime(log.occurred_at).hour)[0] for log in logs)
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

    poor = [logs_per_day.get(c.date, 0) for c in check_ins if c.sleep_quality <= POOR_SLEEP_MAX]
    good = [logs_per_day.get(c.date, 0) for c in check_ins if c.sleep_quality >= GOOD_SLEEP_MIN]

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


def _missed_dates(week_start, week_end, check_ins):
    """그 주에서 체크인이 없는 날. 오늘은 아직 저녁이 안 왔을 수 있어 빼둔다."""
    recorded = {c.date for c in check_ins}
    today = timezone.localdate()
    last_day = min(week_end, today - timedelta(days=1))

    missed, day = [], week_start
    while day <= last_day:
        if day not in recorded:
            missed.append(day.isoformat())
        day += timedelta(days=1)
    return missed


def build_streak(user, today=None):
    """기록 지속 현황. 성공 지표(2주 연속 주 5일)를 앱에서 보여주기 위한 값."""
    today = today or timezone.localdate()
    recorded = set(
        DailyCheckIn.objects
        .filter(user=user, date__gte=today - timedelta(days=27), date__lte=today)
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
