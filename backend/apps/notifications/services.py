import json

from django.conf import settings
from django.db.models import Prefetch
from django.utils import timezone
from pywebpush import WebPushException, webpush

from .models import Reminder, ReminderCompletion


def get_due_reminders(now=None):
    """지금(now 미지정 시 timezone.localtime()) 기준으로 발송 대상 리마인더를 판별한다.

    반환값은 (reminder, subscriptions, skip_reason) 튜플 리스트다. skip_reason이 None이면
    발송 대상(subscriptions는 비어있지 않음)이고, 아니면 왜 스킵됐는지가 담겨 있다 —
    send_due_reminders 커맨드의 --verbose 출력과 4단계 실제 발송 로직이 이 결과를 그대로
    가져다 쓸 수 있게 설계했다.

    시:분만 비교하는 이유 — Reminder.time은 "매일 반복"되는 알림 시각이라 초 단위까지
    맞출 이유가 없고, 이 커맨드가 분 단위 cron으로 돌 것이므로 초는 무시한다.
    """
    if now is None:
        now = timezone.localtime()
    today = now.date()

    # completions는 오늘자만 prefetch(to_attr) — TodayRemindersView와 같은 패턴으로
    # "오늘 완료했는지"를 리마인더당 추가 쿼리 없이 판단한다.
    candidates = (
        Reminder.objects
        .filter(is_active=True)
        .select_related('user')
        .prefetch_related(
            Prefetch(
                'completions',
                queryset=ReminderCompletion.objects.filter(date=today),
                to_attr='today_completions',
            ),
            'user__push_subscriptions',
        )
    )

    results = []
    for reminder in candidates:
        if reminder.time.hour != now.hour or reminder.time.minute != now.minute:
            continue

        if reminder.today_completions:
            results.append((reminder, [], '오늘 이미 완료됨'))
            continue

        # prefetch_related로 이미 캐시돼 있으므로 .all()로 접근해야 추가 쿼리가 안 난다
        # (.exists()/.count()를 쓰면 캐시를 무시하고 리마인더마다 새 쿼리를 날린다).
        subscriptions = list(reminder.user.push_subscriptions.all())
        if not subscriptions:
            results.append((reminder, [], '구독 정보 없음'))
            continue

        results.append((reminder, subscriptions, None))

    return results


def send_reminder_push(reminder, subscription):
    """리마인더 하나를 구독 하나에 실제로 발송한다.

    반환값 3종류 — True(발송 성공), False(재시도 대상 실패: 429/5xx/네트워크 에러 등,
    구독은 유지), 'expired'(404/410 — 구독이 만료됐다는 뜻이라 여기서 바로 지움).
    호출부(send_due_reminders 커맨드)는 여러 구독을 순회하며 이 함수를 부르는데, 한 건이
    실패해도 나머지가 계속 처리돼야 하므로 이 함수 밖으로 예외를 던지지 않는다 —
    WebPushException으로 감싸지지 않는 네트워크 레벨 에러(타임아웃 등)까지 포함해서
    전부 여기서 흡수한다.
    """
    payload = {
        'title': f'{reminder.label} 시간이에요',
        'body': '오늘의 루틴을 확인해보세요',
        'icon': '/icons/icon-192.png',
        'data': {
            'reminder_id': reminder.id,
            'type': reminder.type,
        },
    }
    try:
        webpush(
            subscription_info={
                'endpoint': subscription.endpoint,
                'keys': {
                    'p256dh': subscription.p256dh,
                    'auth': subscription.auth,
                },
            },
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            # py_vapid가 sub 값에 mailto: 접두어를 강제한다 — 없으면 VapidException.
            vapid_claims={'sub': f'mailto:{settings.VAPID_CLAIMS_EMAIL}'},
        )
        return True
    except WebPushException as e:
        # 410 Gone / 404 Not Found = 구독 만료, 정리 대상
        status_code = e.response.status_code if e.response else None
        if status_code in (404, 410):
            subscription.delete()
            return 'expired'
        # 그 외 에러(429 rate limit, 5xx 등)는 재시도 대상이니 구독은 유지
        return False
    except Exception:
        # pywebpush가 WebPushException으로 감싸지 않는 에러(requests 타임아웃/연결
        # 실패 등)도 여기서 잡아야 이 구독 하나 때문에 배치 전체가 죽지 않는다.
        return False
