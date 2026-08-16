from django.urls import path

from .views import (
    MindfulnessSessionListView,
    ReminderCompleteView,
    ReminderDetailView,
    ReminderListCreateView,
    ReminderSendNowView,
    TodayRemindersView,
)

app_name = 'notifications'

urlpatterns = [
    path('', ReminderListCreateView.as_view(), name='list-create'),
    path('today/', TodayRemindersView.as_view(), name='today'),
    path('mindfulness-sessions/', MindfulnessSessionListView.as_view(), name='mindfulness-sessions'),
    path('<int:pk>/', ReminderDetailView.as_view(), name='detail'),
    path('<int:pk>/complete/', ReminderCompleteView.as_view(), name='complete'),
    path('<int:pk>/send-now/', ReminderSendNowView.as_view(), name='reminder-send-now'),
]
