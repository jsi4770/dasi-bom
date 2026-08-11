from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .demo import get_demo_user
from .serializers import SignupSerializer, UserSerializer


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
