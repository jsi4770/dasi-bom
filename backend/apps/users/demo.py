"""TODO(PRD 향후 개선 과제): 실제 인증(Token/JWT) 붙으면 이 헬퍼 대신 request.user 로 교체.

지금은 인증이 없어서 모든 앱(챗봇/얼굴분석)이 같은 데모 계정으로 고정 — symptoms/notifications
시드 커맨드와도 같은 계정을 재사용해서 한 사용자로 데이터가 모이게 한다.
"""
from django.contrib.auth import get_user_model

DEMO_USERNAME = 'demo'
DEMO_PASSWORD = 'demo1234'


def get_demo_user():
    user, created = get_user_model().objects.get_or_create(
        username=DEMO_USERNAME, defaults={'first_name': '데모'}
    )
    if created:
        user.set_password(DEMO_PASSWORD)
        user.save(update_fields=['password'])
    return user
