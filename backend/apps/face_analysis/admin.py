from django.contrib import admin

from .models import FaceAnalysis


@admin.register(FaceAnalysis)
class FaceAnalysisAdmin(admin.ModelAdmin):
    list_display = ['user', 'severity', 'redness_score', 'created_at']
    list_filter = ['severity']
    readonly_fields = ['redness_score', 'severity', 'region_scores', 'created_at']
