"""지금 발송해야 할 리마인더를 판별해서 실제로 Web Push를 발송한다.

    python manage.py send_due_reminders [--verbose] [--dry-run]

--dry-run을 주면 3단계 때처럼 콘솔 출력만 하고 실제 발송은 하지 않는다(로컬처럼 VAPID
키가 없는 환경에서도 판별 로직만 미리 확인할 수 있게).
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.notifications.services import (
    get_checkin_reminder_targets,
    get_due_reminders,
    send_checkin_reminder_push,
    send_reminder_push,
)

REQUIRED_VAPID_SETTINGS = ('VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_CLAIMS_EMAIL')


class Command(BaseCommand):
    help = '지금 발송해야 할 리마인더를 판별해 Web Push를 발송합니다 (--dry-run이면 콘솔 출력만).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--verbose', action='store_true', help='스킵된 리마인더/개별 발송 결과도 출력',
        )
        parser.add_argument(
            '--dry-run', action='store_true', help='실제 발송 없이 3단계 때처럼 콘솔 출력만 함',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        verbose = options['verbose']

        if not dry_run:
            # 발송 도중 VapidException 등으로 중간에 죽는 것보다, 시작 시점에 명확히
            # 막는 게 낫다 — 세 값 다 pywebpush 호출에 필수라 하나라도 비면 전부 실패한다.
            missing = [name for name in REQUIRED_VAPID_SETTINGS if not getattr(settings, name)]
            if missing:
                raise CommandError(
                    f'VAPID 설정이 비어있습니다: {", ".join(missing)}. '
                    '.env에 값을 채우거나 --dry-run으로 실행하세요.'
                )

        now = timezone.localtime()
        results = get_due_reminders(now=now)
        timestamp = now.strftime('%Y-%m-%d %H:%M')
        due = [(reminder, subscriptions) for reminder, subscriptions, skip_reason in results if skip_reason is None]

        if dry_run:
            self._print_dry_run(timestamp, due)
        else:
            self._send(timestamp, due, verbose)

        if verbose:
            for reminder, _subscriptions, skip_reason in results:
                if skip_reason is not None:
                    self.stdout.write(f'reminder_id={reminder.pk} 스킵 — {skip_reason}')

        # 저녁 체크인 미완료 알림 — Cron이 5분 단위로 도는 틱 중 21:00 정각 한 번에만 발송.
        if now.hour == 21 and now.minute == 0:
            checkin_targets = get_checkin_reminder_targets(today=now.date())
            if dry_run:
                self._print_checkin_dry_run(timestamp, checkin_targets)
            else:
                self._send_checkin_reminders(timestamp, checkin_targets, verbose)

    def _print_dry_run(self, timestamp, due):
        if not due:
            self.stdout.write(f'[{timestamp}] 발송 대상 없음')
            return

        self.stdout.write(f'[{timestamp}] 발송 대상 {len(due)}건')
        for reminder, subscriptions in due:
            self.stdout.write(
                f'- user: {reminder.user.username} (reminder_id={reminder.pk}, '
                f'label="{reminder.label}", type={reminder.type}) → 구독 {len(subscriptions)}개'
            )

    def _send(self, timestamp, due, verbose):
        sent = failed = expired = 0

        for reminder, subscriptions in due:
            for subscription in subscriptions:
                # send_reminder_push는 개별 실패를 내부에서 흡수하고 결과만 돌려주므로,
                # 구독 하나가 실패해도 이 루프는 멈추지 않고 나머지를 계속 처리한다.
                outcome = send_reminder_push(reminder, subscription)
                if outcome is True:
                    sent += 1
                    outcome_label = '발송 완료'
                elif outcome == 'expired':
                    expired += 1
                    outcome_label = '만료 정리'
                else:
                    failed += 1
                    outcome_label = '발송 실패'

                if verbose:
                    self.stdout.write(
                        f'reminder_id={reminder.pk} → {subscription.endpoint[:50]} : {outcome_label}'
                    )

        self.stdout.write(f'[{timestamp}] 발송 완료 {sent}건, 실패 {failed}건, 만료 정리 {expired}건')

    def _print_checkin_dry_run(self, timestamp, targets):
        if not targets:
            self.stdout.write(f'[{timestamp}] [체크인 알림] 발송 대상 없음')
            return

        self.stdout.write(f'[{timestamp}] [체크인 알림] 발송 대상 {len(targets)}명')
        for target in targets:
            self.stdout.write(
                f'- user: {target["user"].username} → 구독 {len(target["subscriptions"])}개'
            )

    def _send_checkin_reminders(self, timestamp, targets, verbose):
        sent = failed = expired = 0

        for target in targets:
            for subscription in target['subscriptions']:
                outcome = send_checkin_reminder_push(subscription)
                if outcome is True:
                    sent += 1
                    outcome_label = '발송 완료'
                elif outcome == 'expired':
                    expired += 1
                    outcome_label = '만료 정리'
                else:
                    failed += 1
                    outcome_label = '발송 실패'

                if verbose:
                    self.stdout.write(
                        f'checkin user={target["user"].username} → {subscription.endpoint[:50]} : {outcome_label}'
                    )

        self.stdout.write(f'[{timestamp}] [체크인 알림] 발송 완료 {sent}건, 실패 {failed}건, 만료 정리 {expired}건')
