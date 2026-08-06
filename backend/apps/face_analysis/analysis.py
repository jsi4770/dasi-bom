"""Rule-based facial redness (erythema) scoring for the face_analysis MVP.

Pipeline: MediaPipe FaceLandmarker locates a handful of well-known face
landmarks (nose tip, forehead, chin, eye corners) -> those anchor small
square ROIs over forehead / cheeks / nose, plus two temple ROIs used only
as a gray-world white-balance reference (cancels the photo's lighting
color cast without self-canceling the very regions being scored) -> each
scored ROI's median CIE Lab a* channel is used as a redness index (the
same channel used in dermatology colorimetry for erythema, e.g.
Mexameter/Chromameter-style measurements).

No training is involved yet, so this is intentionally simple and
explainable. The calibration constants below are placeholders based on
published a*-channel ranges for skin erythema, not our own data -- whoever
owns this feature should recalibrate SEVERITY_THRESHOLDS / A_CHANNEL_LOW /
A_CHANNEL_HIGH against real labeled photos, or swap analyze_face_redness()
for a fine-tuned classifier later without touching the calling views.
"""

import cv2
import mediapipe as mp
import numpy as np
from django.conf import settings
from PIL import Image as PILImage

_BaseOptions = mp.tasks.BaseOptions
_FaceLandmarker = mp.tasks.vision.FaceLandmarker
_FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
_VisionRunningMode = mp.tasks.vision.RunningMode

# Well-known MediaPipe FaceMesh (468-point) landmark indices used as anchors.
NOSE_TIP = 1
FOREHEAD_TOP = 10
CHIN = 152
EYE_A_OUTER = 33
EYE_B_OUTER = 263

# After gray-world correction against the temple reference, 0 means "as red
# as the subject's own temples in this photo". Placeholder calibration for
# how far above that a region needs to be to count as mild/severe redness --
# recalibrate once real labeled photos are available.
A_CHANNEL_LOW = 0.0
A_CHANNEL_HIGH = 15.0

SEVERITY_BINS = (
    (20, 'normal'),
    (40, 'mild'),
    (65, 'moderate'),
)

_landmarker = None


class NoFaceDetectedError(Exception):
    """Raised when no face (or no usable skin ROI) is found in the photo."""


def _get_landmarker():
    global _landmarker
    if _landmarker is None:
        options = _FaceLandmarkerOptions(
            base_options=_BaseOptions(
                model_asset_path=str(settings.FACE_LANDMARKER_MODEL_PATH)
            ),
            running_mode=_VisionRunningMode.IMAGE,
            num_faces=1,
        )
        _landmarker = _FaceLandmarker.create_from_options(options)
    return _landmarker


def _to_rgb_array(image_file):
    image_file.seek(0)
    pil_image = PILImage.open(image_file).convert('RGB')
    return np.array(pil_image)


def _landmark_px(landmark, width, height):
    return np.array([landmark.x * width, landmark.y * height])


def _crop_square(rgb_array, center, half_size):
    height, width, _ = rgb_array.shape
    cx, cy = center
    x0, x1 = int(max(cx - half_size, 0)), int(min(cx + half_size, width))
    y0, y1 = int(max(cy - half_size, 0)), int(min(cy + half_size, height))
    if x1 <= x0 or y1 <= y0:
        return None
    return rgb_array[y0:y1, x0:x1]


def _gray_world_white_balance(rgb_array, reference_pixels):
    """Cancel the ambient light's color cast (gray-world assumption) using
    a reference patch that is NOT one of the regions we later score.

    Without this, indoor lighting alone (warm bulbs, and the nose/forehead
    simply catching more direct light than the cheeks) reads as "redness"
    since it skews the whole face toward higher R relative to G/B -- the
    forehead/nose being closer to the light source made them score highest
    even on faces with no visible flushing.

    The reference MUST be disjoint from the scored ROIs: gray-world forces
    the reference patch's own average to become neutral, so if the
    reference were the same pixels (or the whole photo, which is mostly
    face) we're scoring, every score collapses to ~0 by construction.
    """
    means = reference_pixels.reshape(-1, 3).astype(np.float32).mean(axis=0)
    gray = means.mean()
    scale = gray / np.clip(means, 1.0, None)
    balanced = rgb_array.astype(np.float32) * scale
    return np.clip(balanced, 0, 255).astype(np.uint8)


def _redness_index(rgb_patch):
    """Median CIE Lab a* (signed, neutral=0) of a skin patch. Higher = redder.

    Median (not mean) so a handful of blown-out specular-highlight pixels
    (oily nose/forehead shine) don't drag the whole ROI's reading around.
    """
    lab = cv2.cvtColor(rgb_patch, cv2.COLOR_RGB2LAB).astype(np.float32)
    a_signed = lab[:, :, 1] - 128.0
    return float(np.median(a_signed))


def _score_from_index(a_signed_mean):
    span = A_CHANNEL_HIGH - A_CHANNEL_LOW
    return float(np.clip((a_signed_mean - A_CHANNEL_LOW) / span * 100, 0, 100))


def _severity_from_score(score):
    for threshold, label in SEVERITY_BINS:
        if score < threshold:
            return label
    return 'severe'


def analyze_face_redness(image_file):
    """Run the MediaPipe-based redness pipeline on an uploaded face photo.

    Returns {'redness_score': float, 'severity': str, 'region_scores': dict}.
    Raises NoFaceDetectedError if no face / usable skin ROI is found.
    """
    rgb_array = _to_rgb_array(image_file)
    height, width, _ = rgb_array.shape

    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_array)
    result = _get_landmarker().detect(mp_image)

    if not result.face_landmarks:
        raise NoFaceDetectedError('얼굴을 인식하지 못했습니다. 다시 촬영해 주세요.')

    landmarks = result.face_landmarks[0]

    nose = _landmark_px(landmarks[NOSE_TIP], width, height)
    forehead_top = _landmark_px(landmarks[FOREHEAD_TOP], width, height)
    chin = _landmark_px(landmarks[CHIN], width, height)
    eye_a = _landmark_px(landmarks[EYE_A_OUTER], width, height)
    eye_b = _landmark_px(landmarks[EYE_B_OUTER], width, height)

    inter_eye_dist = float(np.linalg.norm(eye_a - eye_b))
    roi_half = max(inter_eye_dist * 0.18, 8)

    eye_mid_y = (eye_a[1] + eye_b[1]) / 2
    mid_face_y = (eye_mid_y + chin[1]) / 2

    # Reference candidates for gray-world correction: same photo/lighting,
    # but outside the classic flush pattern (forehead/nose/cheeks) and
    # disjoint from the ROIs scored below. Temples are tried first but are
    # frequently cropped out of tight selfie-style photos, so the chin is
    # kept as a fallback that's almost always still in frame.
    reference_centers = (
        (eye_a[0] - inter_eye_dist * 0.75, eye_mid_y),
        (eye_b[0] + inter_eye_dist * 0.75, eye_mid_y),
        (nose[0], chin[1] - roi_half * 0.5),
    )
    reference_patches = [
        patch.reshape(-1, 3)
        for patch in (_crop_square(rgb_array, c, roi_half) for c in reference_centers)
        if patch is not None and patch.size > 0
    ]
    lighting_corrected = bool(reference_patches)
    balanced = (
        _gray_world_white_balance(rgb_array, np.concatenate(reference_patches))
        if reference_patches
        else rgb_array
    )

    regions = {
        'forehead': (nose[0], (forehead_top[1] + eye_mid_y) / 2),
        'left_cheek': (eye_a[0] - inter_eye_dist * 0.35, mid_face_y),
        'right_cheek': (eye_b[0] + inter_eye_dist * 0.35, mid_face_y),
        'nose': (nose[0], nose[1]),
    }

    region_scores = {}
    for name, center in regions.items():
        patch = _crop_square(balanced, center, roi_half)
        if patch is None or patch.size == 0:
            continue
        region_scores[name] = round(_score_from_index(_redness_index(patch)), 1)

    if not region_scores:
        raise NoFaceDetectedError('피부 영역을 추출하지 못했습니다. 다시 촬영해 주세요.')

    overall_score = round(float(np.mean(list(region_scores.values()))), 1)

    return {
        'redness_score': overall_score,
        'severity': _severity_from_score(overall_score),
        'region_scores': region_scores,
        'lighting_corrected': lighting_corrected,
    }
