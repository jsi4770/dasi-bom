from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import DemoLoginView, MenopauseSurveyView, MeView, SignupView, UserConsentView

app_name = 'users'

urlpatterns = [
    path('auth/signup/', SignupView.as_view(), name='signup'),
    path('auth/login/', TokenObtainPairView.as_view(), name='login'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/demo-login/', DemoLoginView.as_view(), name='demo-login'),
    path('users/me/', MeView.as_view(), name='me'),
    path('users/menopause-survey/', MenopauseSurveyView.as_view(), name='menopause-survey'),
    path('users/consent/', UserConsentView.as_view(), name='user-consent'),
]
