import base64
import binascii

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.demo import get_demo_user
from . import gemini
from .models import ChatMessage, ChatSession
from .serializers import ChatMessageSerializer, ChatSessionSerializer

GEMINI_ERROR_RESPONSES = {
    gemini.GeminiRateLimitError: (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        '지금 대화 요청이 많아서 잠시 응답이 어려워요. 조금 뒤에 다시 시도해주세요.',
    ),
    gemini.GeminiError: (
        status.HTTP_502_BAD_GATEWAY,
        '챗봇 응답을 만드는 데 실패했어요. 다시 시도해주세요.',
    ),
}


def _current_user():
    return get_demo_user()


def _gemini_error_response(exc):
    for exc_type, (code, message) in GEMINI_ERROR_RESPONSES.items():
        if isinstance(exc, exc_type):
            return Response({'detail': message}, status=code)
    raise exc


class ChatSessionListCreateView(generics.ListCreateAPIView):
    serializer_class = ChatSessionSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return ChatSession.objects.filter(user=_current_user())

    def perform_create(self, serializer):
        serializer.save(user=_current_user())


class ChatMessageListCreateView(generics.ListCreateAPIView):
    """세션의 메시지 목록 조회 + 새 메시지 전송.

    전송은 `text`(텍스트 입력) 또는 `audio`(base64 인코딩된 녹음 파일, `audio_mime_type`과 함께)
    중 하나로 받는다. 음성이면 먼저 Gemini로 전사해 사용자 메시지 텍스트로 저장한 뒤, 같은
    파이프라인(대화 생성)을 그대로 탄다.
    """

    serializer_class = ChatMessageSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_session(self):
        return get_object_or_404(
            ChatSession, pk=self.kwargs['session_id'], user=_current_user()
        )

    def get_queryset(self):
        return self.get_session().messages.all()

    def create(self, request, *args, **kwargs):
        session = self.get_session()
        text = (request.data.get('text') or '').strip()
        audio_b64 = request.data.get('audio')
        audio_mime_type = request.data.get('audio_mime_type', 'audio/m4a')

        if not text and not audio_b64:
            raise ValidationError({'text': 'text 또는 audio 중 하나는 필요합니다.'})

        try:
            if not text:
                try:
                    audio_bytes = base64.b64decode(audio_b64, validate=True)
                except (binascii.Error, ValueError):
                    raise ValidationError({'audio': '올바른 base64 데이터가 아닙니다.'})
                text = gemini.transcribe_audio(audio_bytes, audio_mime_type)
                if not text:
                    raise ValidationError({'audio': '음성에서 내용을 인식하지 못했어요.'})

            history = list(session.messages.all())
            user_message = ChatMessage.objects.create(
                session=session, role=ChatMessage.Role.USER, text=text
            )
            reply_text = gemini.generate_reply(history, text)
        except gemini.GeminiError as exc:
            return _gemini_error_response(exc)

        assistant_message = ChatMessage.objects.create(
            session=session, role=ChatMessage.Role.ASSISTANT, text=reply_text
        )
        session.save(update_fields=['updated_at'])

        return Response(
            {
                'user_message': ChatMessageSerializer(user_message).data,
                'assistant_message': ChatMessageSerializer(assistant_message).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ChatMessageSpeechView(APIView):
    """메시지 텍스트를 음성(WAV)으로 합성해 돌려준다. 오디오는 저장하지 않고 매번 새로 생성한다."""

    permission_classes = [AllowAny]

    def get(self, request, message_id):
        message = get_object_or_404(
            ChatMessage, pk=message_id, session__user=_current_user()
        )
        try:
            wav_bytes = gemini.synthesize_speech(message.text)
        except gemini.GeminiError as exc:
            return _gemini_error_response(exc)

        return HttpResponse(wav_bytes, content_type='audio/wav')
