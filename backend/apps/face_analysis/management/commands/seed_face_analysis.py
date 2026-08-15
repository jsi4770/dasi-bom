"""시연용 얼굴 분석 목업 데이터 생성.

    python manage.py seed_symptoms --reset   # 먼저
    python manage.py seed_face_analysis --reset

symptoms 앱의 `seed_symptoms`가 만든 날짜에 맞춰 같은 날짜에 얼굴 분석 기록을 붙인다.
seed_symptoms는 "오늘 기준 N일 전"으로 날짜를 잡기 때문에 돌리는 날마다 달력 날짜가
바뀐다 — 그래서 날짜를 하드코딩하지 않고, 이 유저의 DailyCheckIn 날짜를 그대로
"심어진 날짜 목록"으로 읽는다. seed_symptoms의 미기록일(SKIP_DAYS)엔 체크인도 안
만들어지므로 자동으로 제외된다(챗봇이 먼저 물어보는 시연 재료라 사진도 비워야 함).

의도적으로 심어 둔 패턴 — `skin_link`(주간 리포트)는 상관을 계산/주장하지 않지만,
시연 화면에서 "이날은 이랬다"가 눈에 보이라고 그날 홍조 기록 횟수가 많을수록
redness_score도 높게 잡는다.

analyze_face_redness()는 태우지 않는다. 실사진 없이 MediaPipe 얼굴 인식을 통과시키긴
어렵고, 배포 서버(release phase)에서도 돌아가야 해서 로컬에만 있는 Kaggle 데이터셋 같은
외부 파일에 의존할 수 없다 — PIL로 만든 placeholder 이미지 + 직접 계산한 점수로 심는다.
실제 사용자가 찍어서 올리는 라이브 업로드 경로는 이 커맨드와 무관하게 그대로
analyze_face_redness()를 탄다.
"""

import io
import random
from collections import Counter
from datetime import datetime, time

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from PIL import Image as PILImage

from apps.face_analysis.analysis import _severity_from_score
from apps.face_analysis.models import FaceAnalysis
from apps.symptoms.models import DailyCheckIn, SymptomLog

RANDOM_SEED = 20260815
REGION_NAMES = ('forehead', 'nose', 'left_cheek', 'right_cheek')


class Command(BaseCommand):
    help = '얼굴 분석 목업 데이터를 생성합니다 (시연용). seed_symptoms 를 먼저 실행해야 합니다.'

    def add_arguments(self, parser):
        parser.add_argument('--user', default='demo', help='대상 사용자명')
        parser.add_argument('--reset', action='store_true', help='해당 사용자의 기존 기록을 지우고 다시 만듦')

    @transaction.atomic
    def handle(self, *args, **options):
        username = options['user']
        User = get_user_model()
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stderr.write(self.style.ERROR(
                f'{username} 사용자가 없습니다. '
                f'`python manage.py seed_symptoms --user {username}` 를 먼저 실행하세요.'
            ))
            return

        if options['reset']:
            deleted, _ = FaceAnalysis.objects.filter(user=user).delete()
            self.stdout.write(f'기존 얼굴 분석 기록 삭제: {deleted}건')
        elif FaceAnalysis.objects.filter(user=user).exists():
            self.stderr.write(self.style.WARNING(
                f'{username} 에게 이미 얼굴 분석 기록이 있습니다. 다시 만들려면 --reset 을 붙이세요.'
            ))
            return

        # seed_symptoms 가 만든 DailyCheckIn 이 곧 "그날 기록이 있다"는 뜻 -- 미기록일엔
        # 체크인도 없어서 자동으로 빠진다.
        checkin_dates = list(
            DailyCheckIn.objects.filter(user=user).order_by('date').values_list('date', flat=True)
        )
        if not checkin_dates:
            self.stderr.write(self.style.ERROR(
                f'{username} 에게 체크인 기록이 없습니다. '
                f'`python manage.py seed_symptoms --user {username}` 를 먼저 실행하세요.'
            ))
            return

        hot_flash_counts = Counter(
            timezone.localtime(log.occurred_at).date()
            for log in SymptomLog.objects.filter(user=user, symptom_type__code='hot_flash')
        )

        rng = random.Random(RANDOM_SEED)
        tz = timezone.get_current_timezone()
        created = 0

        for day in checkin_dates:
            count = hot_flash_counts.get(day, 0)
            base_score = min(15 + count * 10, 92)
            score = round(_clamp(base_score + rng.uniform(-3, 3), 0, 100), 1)
            severity = _severity_from_score(score)
            region_scores = {
                region: round(_clamp(score + rng.uniform(-4, 4), 0, 100), 1)
                for region in REGION_NAMES
            }

            moment = timezone.make_aware(
                datetime.combine(day, time(rng.randrange(7, 10), rng.randrange(0, 60))), tz,
            )

            analysis = FaceAnalysis.objects.create(
                user=user,
                image=ContentFile(_placeholder_image_bytes(score), name=f'seed_{day}.jpg'),
                redness_score=score,
                severity=severity,
                region_scores=region_scores,
            )
            # created_at 은 auto_now_add 라 create() 에 넘긴 값을 무시한다 -- update() 로만 덮어써진다.
            FaceAnalysis.objects.filter(pk=analysis.pk).update(created_at=moment)
            created += 1

        self.stdout.write(self.style.SUCCESS(
            f'{username}: 얼굴 분석 {created}건 생성 ({checkin_dates[0]} ~ {checkin_dates[-1]})'
        ))


def _clamp(value, low=0.0, high=100.0):
    return max(low, min(high, value))


def _placeholder_image_bytes(score):
    """홍조 점수에 비례해 붉은기가 도는 단색 placeholder 이미지.

    시드는 analyze_face_redness() 를 안 태우므로(모듈 docstring 참고) 실제 얼굴이
    찍힌 사진일 필요가 없다 -- FaceAnalysis.image 필드를 채우기 위한 자리표시자다.
    """
    base = (232, 200, 184)  # 살구빛 베이스
    red_boost = int(_clamp(score) / 100 * 60)
    color = (
        min(base[0] + red_boost, 255),
        max(base[1] - red_boost // 2, 0),
        max(base[2] - red_boost // 3, 0),
    )
    buffer = io.BytesIO()
    PILImage.new('RGB', (256, 256), color).save(buffer, format='JPEG', quality=85)
    return buffer.getvalue()
