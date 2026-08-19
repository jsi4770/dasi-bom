from django.urls import path

from .views import (
    BackfillView,
    DailyCheckInListView,
    MissedDaysView,
    StreakView,
    SymptomLogDetailView,
    SymptomLogListCreateView,
    SymptomTypeListView,
    TodayCheckInView,
    TodaySummaryView,
    WeeklyReportView,
)

app_name = 'symptoms'

urlpatterns = [
    path('types/', SymptomTypeListView.as_view(), name='type-list'),
    path('logs/', SymptomLogListCreateView.as_view(), name='log-list-create'),
    path('logs/<int:pk>/', SymptomLogDetailView.as_view(), name='log-detail'),
    path('logs/backfill/', BackfillView.as_view(), name='log-backfill'),
    path('checkins/', DailyCheckInListView.as_view(), name='checkin-list'),
    path('checkins/today/', TodayCheckInView.as_view(), name='checkin-today'),
    path('today-summary/', TodaySummaryView.as_view(), name='today-summary'),
    path('reports/weekly/', WeeklyReportView.as_view(), name='report-weekly'),
    path('missed-days/', MissedDaysView.as_view(), name='missed-days'),
    path('streak/', StreakView.as_view(), name='streak'),
]
