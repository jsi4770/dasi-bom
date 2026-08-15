from django.contrib import admin

from .models import MindfulnessSession, PushSubscription, Reminder, ReminderCompletion


@admin.register(MindfulnessSession)
class MindfulnessSessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'code', 'total_seconds', 'order', 'is_active']
    list_display_links = ['title']
    list_editable = ['order', 'is_active']
    search_fields = ['title', 'code']


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


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'short_endpoint', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'endpoint']
    date_hierarchy = 'created_at'

    @admin.display(description='endpoint')
    def short_endpoint(self, obj):
        return obj.endpoint[:50]
