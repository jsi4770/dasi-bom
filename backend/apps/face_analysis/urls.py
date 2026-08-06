from django.urls import path

from .views import FaceAnalysisListCreateView

app_name = 'face_analysis'

urlpatterns = [
    path('', FaceAnalysisListCreateView.as_view(), name='list-create'),
]
