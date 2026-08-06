import urllib.request

from django.conf import settings
from django.core.management.base import BaseCommand

MODEL_URL = (
    'https://storage.googleapis.com/mediapipe-models/'
    'face_landmarker/face_landmarker/float16/1/face_landmarker.task'
)


class Command(BaseCommand):
    help = 'Download the MediaPipe FaceLandmarker model used by apps.face_analysis'

    def handle(self, *args, **options):
        model_path = settings.FACE_LANDMARKER_MODEL_PATH
        if model_path.exists():
            self.stdout.write(self.style.SUCCESS(f'Already present: {model_path}'))
            return

        model_path.parent.mkdir(parents=True, exist_ok=True)
        self.stdout.write(f'Downloading {MODEL_URL} -> {model_path}')
        urllib.request.urlretrieve(MODEL_URL, model_path)
        self.stdout.write(self.style.SUCCESS('Done.'))
