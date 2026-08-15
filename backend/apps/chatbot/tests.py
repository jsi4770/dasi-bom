from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from . import gemini
from .models import ChatMessage, ChatSession


class ChatbotApiTestCase(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='sojeong', password='pw')
        self.other = get_user_model().objects.create_user(username='someone-else', password='pw')
        self.client.force_authenticate(self.user)

        patcher = patch.object(gemini, 'generate_reply', return_value='안녕하세요, 오늘 기분은 어떠세요?')
        self.mock_generate_reply = patcher.start()
        self.addCleanup(patcher.stop)

    def _create_session(self):
        response = self.client.post(reverse('chatbot:session-list'))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data['id']


class ChatSessionTests(ChatbotApiTestCase):
    def test_requires_authentication(self):
        self.client.force_authenticate(None)

        response = self.client.post(reverse('chatbot:session-list'))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_and_list_sessions_are_scoped_to_the_logged_in_user(self):
        session_id = self._create_session()
        ChatSession.objects.create(user=self.other)

        response = self.client.get(reverse('chatbot:session-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([s['id'] for s in response.data], [session_id])


class ChatMessageTests(ChatbotApiTestCase):
    def test_sending_text_message_creates_user_and_assistant_messages(self):
        session_id = self._create_session()

        response = self.client.post(
            reverse('chatbot:message-list', args=[session_id]), {'text': '요즘 잠을 잘 못 자요'}
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user_message']['text'], '요즘 잠을 잘 못 자요')
        self.assertEqual(response.data['user_message']['role'], ChatMessage.Role.USER)
        self.assertEqual(response.data['assistant_message']['role'], ChatMessage.Role.ASSISTANT)
        self.assertEqual(ChatMessage.objects.filter(session_id=session_id).count(), 2)

    def test_sending_audio_message_transcribes_before_replying(self):
        session_id = self._create_session()
        with patch.object(gemini, 'transcribe_audio', return_value='홍조가 자주 올라와요') as mock_transcribe:
            response = self.client.post(
                reverse('chatbot:message-list', args=[session_id]),
                {'audio': 'aGVsbG8=', 'audio_mime_type': 'audio/m4a'},
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mock_transcribe.assert_called_once()
        self.assertEqual(response.data['user_message']['text'], '홍조가 자주 올라와요')

    def test_requires_text_or_audio(self):
        session_id = self._create_session()

        response = self.client.post(reverse('chatbot:message-list', args=[session_id]), {})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rate_limit_error_returns_503(self):
        session_id = self._create_session()
        self.mock_generate_reply.side_effect = gemini.GeminiRateLimitError('quota exceeded')

        response = self.client.post(
            reverse('chatbot:message-list', args=[session_id]), {'text': '안녕'}
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(ChatMessage.objects.filter(session_id=session_id).count(), 1)

    def test_message_history_is_scoped_to_its_session(self):
        session_id = self._create_session()
        other_session = ChatSession.objects.create(user=self.user)
        ChatMessage.objects.create(session=other_session, role=ChatMessage.Role.USER, text='다른 세션 메시지')

        response = self.client.get(reverse('chatbot:message-list', args=[session_id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_cannot_send_message_to_another_users_session(self):
        other_session = ChatSession.objects.create(user=self.other)

        response = self.client.post(
            reverse('chatbot:message-list', args=[other_session.id]), {'text': '안녕'}
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ChatMessageSpeechTests(ChatbotApiTestCase):
    def test_returns_wav_audio_for_a_message(self):
        session_id = self._create_session()
        self.client.post(reverse('chatbot:message-list', args=[session_id]), {'text': '안녕'})
        message_id = ChatMessage.objects.filter(session_id=session_id, role=ChatMessage.Role.ASSISTANT).get().id

        with patch.object(gemini, 'synthesize_speech', return_value=b'RIFF....WAVEfmt ') as mock_tts:
            response = self.client.get(reverse('chatbot:message-speech', args=[message_id]))

        mock_tts.assert_called_once()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'audio/wav')
        self.assertEqual(response.content, b'RIFF....WAVEfmt ')

    def test_speech_rate_limit_error_returns_503(self):
        session_id = self._create_session()
        self.client.post(reverse('chatbot:message-list', args=[session_id]), {'text': '안녕'})
        message_id = ChatMessage.objects.filter(session_id=session_id, role=ChatMessage.Role.ASSISTANT).get().id

        with patch.object(gemini, 'synthesize_speech', side_effect=gemini.GeminiRateLimitError('quota')):
            response = self.client.get(reverse('chatbot:message-speech', args=[message_id]))

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
