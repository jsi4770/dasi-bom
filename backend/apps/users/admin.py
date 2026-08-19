from django.contrib import admin

from .models import MenopauseSurveyResponse, UserConsent


@admin.register(MenopauseSurveyResponse)
class MenopauseSurveyResponseAdmin(admin.ModelAdmin):
    list_display = ['user', 'choice', 'stage', 'answered_at']


@admin.register(UserConsent)
class UserConsentAdmin(admin.ModelAdmin):
    list_display = [
        'user', 'face_analysis_consent', 'health_data_consent',
        'face_analysis_consented_at', 'health_data_consented_at',
    ]
