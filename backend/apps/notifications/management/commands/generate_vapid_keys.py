"""VAPID(Web Push 서버 인증) 키 쌍을 생성하는 1회성 도구.

    python manage.py generate_vapid_keys

한 번 만든 키는 .env에 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY로 저장해서 계속 재사용해야
한다 — 매번 새로 만들면 이미 구독해둔 브라우저가 전부 무효가 된다(브라우저는 최초 구독
시 받은 public key로 서버를 검증하기 때문). 이미 .env에 값이 있으면 경고와 함께
실행을 막고, --force를 줘야만 새로 만든다.
"""

import base64
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from py_vapid import Vapid01


def _b64url(raw_bytes: bytes) -> str:
    return base64.urlsafe_b64encode(raw_bytes).rstrip(b'=').decode()


def _b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))


def _existing_vapid_public_key(env_path: Path) -> str | None:
    if not env_path.exists():
        return None
    for line in env_path.read_text(encoding='utf-8').splitlines():
        if line.startswith('VAPID_PUBLIC_KEY='):
            value = line.split('=', 1)[1].strip()
            return value or None
    return None


class Command(BaseCommand):
    help = 'Web Push용 VAPID 키 쌍을 생성합니다 (1회성 — 출력값을 .env에 수동으로 저장해서 재사용).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force', action='store_true', help='.env에 이미 VAPID_PUBLIC_KEY가 있어도 새로 생성'
        )

    def handle(self, *args, **options):
        env_path = settings.BASE_DIR / '.env'
        if _existing_vapid_public_key(env_path) and not options['force']:
            raise CommandError(
                '.env에 VAPID_PUBLIC_KEY가 이미 설정돼 있습니다. 새로 만들면 이미 구독한 브라우저가 '
                '전부 무효가 됩니다. 그래도 새로 만들려면 --force를 붙이세요.'
            )

        vapid = Vapid01()
        vapid.generate_keys()

        public_key_b64 = _b64url(vapid.public_key.public_bytes(
            serialization.Encoding.X962,
            serialization.PublicFormat.UncompressedPoint,
        ))
        private_key_b64 = _b64url(vapid.private_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ))

        # 라운드트립 검증 — 저장할 형식(DER + base64url)에서 다시 로드했을 때 같은 public
        # key가 나오는지 확인한다. pywebpush가 나중에 정확히 이 형식으로 private key를
        # 불러올 것이므로, 여기서 안 맞으면 실제 발송 단계(다음 작업)에서야 에러가 난다.
        reloaded_private_key = serialization.load_der_private_key(
            _b64url_decode(private_key_b64), password=None,
        )
        reloaded_public_key_b64 = _b64url(reloaded_private_key.public_key().public_bytes(
            serialization.Encoding.X962,
            serialization.PublicFormat.UncompressedPoint,
        ))

        if reloaded_public_key_b64 != public_key_b64:
            raise CommandError('라운드트립 검증 실패 — 저장 형식이 예상과 다릅니다. 키를 출력하지 않습니다.')

        self.stdout.write(self.style.SUCCESS('라운드트립 검증 통과. 아래 값을 .env에 저장하세요:'))
        self.stdout.write('')
        self.stdout.write(f'VAPID_PUBLIC_KEY={public_key_b64}')
        self.stdout.write(f'VAPID_PRIVATE_KEY={private_key_b64}')
