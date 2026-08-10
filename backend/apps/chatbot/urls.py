from django.urls import path

from .views import ChatMessageListCreateView, ChatMessageSpeechView, ChatSessionListCreateView

app_name = 'chatbot'

urlpatterns = [
    path('sessions/', ChatSessionListCreateView.as_view(), name='session-list'),
    path(
        'sessions/<int:session_id>/messages/',
        ChatMessageListCreateView.as_view(),
        name='message-list',
    ),
    path('messages/<int:message_id>/speech/', ChatMessageSpeechView.as_view(), name='message-speech'),
]
