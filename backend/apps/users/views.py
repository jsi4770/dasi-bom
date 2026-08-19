from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .demo import get_demo_user
from .models import MenopauseSurveyResponse, UserConsent
from .serializers import MenopauseSurveySerializer, SignupSerializer, UserConsentSerializer, UserSerializer


def _issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


class SignupView(generics.CreateAPIView):
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {**serializer.data, **_issue_tokens(user)},
            status=status.HTTP_201_CREATED,
        )


class DemoLoginView(APIView):
    """바디 없이 호출하는 원클릭 게스트 로그인. demo 계정이 없으면 만든다."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user = get_demo_user()
        return Response({**UserSerializer(user).data, **_issue_tokens(user)})


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class MenopauseSurveyView(APIView):
    """완경 단계 설문 응답 조회/저장. 유저당 하나뿐이라 재설문은 덮어쓴다."""

    def get(self, request):
        response = MenopauseSurveyResponse.objects.filter(user=request.user).first()
        if response is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(MenopauseSurveySerializer(response).data)

    def post(self, request):
        existed = MenopauseSurveyResponse.objects.filter(user=request.user).exists()

        serializer = MenopauseSurveySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response, _ = MenopauseSurveyResponse.objects.update_or_create(
            user=request.user,
            defaults=serializer.validated_data,
        )
        return Response(
            MenopauseSurveySerializer(response).data,
            status=status.HTTP_200_OK if existed else status.HTTP_201_CREATED,
        )


class UserConsentView(APIView):
    """온보딩 정보 활용 동의 조회/저장. 차단 로직은 프론트가 이 값을 보고 판단한다."""

    def get(self, request):
        consent = UserConsent.objects.filter(user=request.user).first()
        if consent is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(UserConsentSerializer(consent).data)

    def post(self, request):
        existed = UserConsent.objects.filter(user=request.user).exists()

        serializer = UserConsentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        consent, _ = UserConsent.objects.update_or_create(
            user=request.user,
            defaults=serializer.validated_data,
        )
        return Response(
            UserConsentSerializer(consent).data,
            status=status.HTTP_200_OK if existed else status.HTTP_201_CREATED,
        )
