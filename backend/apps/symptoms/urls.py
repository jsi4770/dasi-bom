from django.urls import path

from .views import (
    DailyCheckInListView,
    StreakView,
    SymptomLogDetailView,
    SymptomLogListCreateView,
    SymptomTypeListView,
    TodayCheckInView,
    WeeklyReportView,
)

app_name = 'symptoms'

urlpatterns = [
    path('types/', SymptomTypeListView.as_view(), name='type-list'),
    path('logs/', SymptomLogListCreateView.as_view(), name='log-list-create'),
    path('logs/<int:pk>/', SymptomLogDetailView.as_view(), name='log-detail'),
    path('checkins/', DailyCheckInListView.as_view(), name='checkin-list'),
    path('checkins/today/', TodayCheckInView.as_view(), name='checkin-today'),
    path('reports/weekly/', WeeklyReportView.as_view(), name='report-weekly'),
    path('streak/', StreakView.as_view(), name='streak'),
]
