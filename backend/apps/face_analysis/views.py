from rest_framework import permissions, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .analysis import NoFaceDetectedError, analyze_face_redness
from .models import FaceAnalysis
from .serializers import FaceAnalysisSerializer, FaceAnalysisUploadSerializer


class FaceAnalysisListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]

    def get(self, request):
        analyses = FaceAnalysis.objects.filter(user=request.user)
        return Response(FaceAnalysisSerializer(analyses, many=True).data)

    def post(self, request):
        upload = FaceAnalysisUploadSerializer(data=request.data)
        upload.is_valid(raise_exception=True)
        image = upload.validated_data['image']

        try:
            result = analyze_face_redness(image)
        except NoFaceDetectedError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        analysis = FaceAnalysis.objects.create(
            user=request.user,
            image=image,
            redness_score=result['redness_score'],
            severity=result['severity'],
            region_scores=result['region_scores'],
        )
        return Response(FaceAnalysisSerializer(analysis).data, status=status.HTTP_201_CREATED)
