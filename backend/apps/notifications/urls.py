from django.urls import path

from .views import (
    ReminderCompleteView,
    ReminderDetailView,
    ReminderListCreateView,
    TodayRemindersView,
)

app_name = 'notifications'

urlpatterns = [
    path('', ReminderListCreateView.as_view(), name='list-create'),
    path('today/', TodayRemindersView.as_view(), name='today'),
    path('<int:pk>/', ReminderDetailView.as_view(), name='detail'),
    path('<int:pk>/complete/', ReminderCompleteView.as_view(), name='complete'),
]
