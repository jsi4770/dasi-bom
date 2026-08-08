from django.contrib import admin

from .models import DailyCheckIn, SymptomLog, SymptomType, WeeklyReport


@admin.register(SymptomType)
class SymptomTypeAdmin(admin.ModelAdmin):
    list_display = ['order', 'emoji', 'label', 'code', 'category', 'is_active']
    list_display_links = ['label']
    list_editable = ['order', 'is_active']
    list_filter = ['category', 'is_active']
    search_fields = ['code', 'label']


@admin.register(SymptomLog)
class SymptomLogAdmin(admin.ModelAdmin):
    list_display = ['occurred_at', 'user', 'symptom_type', 'severity', 'source']
    list_filter = ['symptom_type', 'severity', 'source', 'occurred_at']
    search_fields = ['user__username', 'memo']
    date_hierarchy = 'occurred_at'
    autocomplete_fields = ['symptom_type']


@admin.register(DailyCheckIn)
class DailyCheckInAdmin(admin.ModelAdmin):
    list_display = ['date', 'user', 'sleep_quality', 'mood', 'fatigue', 'stress']
    list_filter = ['date', 'sleep_quality', 'mood']
    search_fields = ['user__username', 'memo']
    date_hierarchy = 'date'


@admin.register(WeeklyReport)
class WeeklyReportAdmin(admin.ModelAdmin):
    list_display = ['week_start', 'user', 'generated_at']
    list_filter = ['week_start']
    search_fields = ['user__username']
