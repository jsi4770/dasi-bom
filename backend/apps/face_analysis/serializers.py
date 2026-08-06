from rest_framework import serializers

from .models import FaceAnalysis


class FaceAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaceAnalysis
        fields = ['id', 'image', 'redness_score', 'severity', 'region_scores', 'created_at']
        read_only_fields = ['redness_score', 'severity', 'region_scores', 'created_at']


class FaceAnalysisUploadSerializer(serializers.Serializer):
    image = serializers.ImageField()
