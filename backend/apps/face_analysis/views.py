from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.users.demo import get_demo_user
from .analysis import NoFaceDetectedError, analyze_face_redness
from .models import FaceAnalysis
from .serializers import FaceAnalysisSerializer, FaceAnalysisUploadSerializer


class FaceAnalysisListCreateView(generics.ListCreateAPIView):
    """GenericAPIView (not a bare APIView) so DRF's browsable API can
    introspect get_serializer_class() and render the image upload form."""

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser]
    queryset = FaceAnalysis.objects.all()

    def get_queryset(self):
        return FaceAnalysis.objects.filter(user=get_demo_user())

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return FaceAnalysisUploadSerializer
        return FaceAnalysisSerializer

    def create(self, request, *args, **kwargs):
        upload = self.get_serializer(data=request.data)
        upload.is_valid(raise_exception=True)
        image = upload.validated_data['image']

        try:
            result = analyze_face_redness(image)
        except NoFaceDetectedError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        analysis = FaceAnalysis.objects.create(
            user=get_demo_user(),
            image=image,
            redness_score=result['redness_score'],
            severity=result['severity'],
            region_scores=result['region_scores'],
        )
        output = FaceAnalysisSerializer(analysis, context=self.get_serializer_context())
        payload = {
            **output.data,
            'lighting_corrected': result['lighting_corrected'],
            'excluded_regions': result['excluded_regions'],
        }
        return Response(payload, status=status.HTTP_201_CREATED)
