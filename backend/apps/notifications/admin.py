from django.contrib import admin

from .models import Reminder, ReminderCompletion


@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    list_display = ['label', 'user', 'type', 'time', 'is_active']
    list_display_links = ['label']
    list_editable = ['is_active']
    list_filter = ['type', 'is_active']
    search_fields = ['user__username', 'label']


@admin.register(ReminderCompletion)
class ReminderCompletionAdmin(admin.ModelAdmin):
    list_display = ['date', 'reminder', 'completed_at']
    list_filter = ['date']
    search_fields = ['reminder__user__username', 'reminder__label']
    date_hierarchy = 'date'
    autocomplete_fields = ['reminder']
