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
explainable. A_CHANNEL_LOW / A_CHANNEL_HIGH were least-squares fit against
7 hand-labeled real photos (see apps/face_analysis/benchmark_labels.json,
`manage.py benchmark_face_analysis`) -- a real but tiny sample, so treat
these as a rough first calibration, not a settled ground truth. Whoever
owns this feature should keep growing the labeled set and refitting, or
swap analyze_face_redness() for a fine-tuned classifier later without
touching the calling views.
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
MOUTH_CORNER_A = 61   # same side as EYE_A_OUTER
MOUTH_CORNER_B = 291  # same side as EYE_B_OUTER

# Below this CIE L* (0-100), a ROI is treated as "probably not skin" (hair,
# deep shadow, background) rather than scored -- this matters most for
# turned/angled faces, where a fixed eye-relative offset can drift onto
# hair for the far cheek instead of skin.
MIN_SKIN_LIGHTNESS = 20.0

# Below this Lab chroma (hypot(a*, b*)), a white-balance *reference* patch
# is rejected as "probably not skin" even if it passes MIN_SKIN_LIGHTNESS.
# Reference patches (temple/chin, see analyze_face_redness) sit outside the
# scored ROIs, so unlike forehead/cheeks they can silently land on hair or
# background instead of skin -- both of which are dark-or-bright but fairly
# neutral (low chroma), while real skin keeps meaningful a*/b* from
# blood/melanin even under harsh lighting. Measured on a real long-hair
# selfie where a temple reference landed on hair: hair chroma 4.2, a
# background window chroma 5.0, actual chin skin chroma 12.7.
MIN_REFERENCE_CHROMA = 6.0

# After gray-world correction against the temple/chin reference, this maps
# raw Lab a* to a 0-100 score. Least-squares fit against 7 hand-labeled
# photos' raw a* (mild: 0.33/0.67/2.25, moderate: 10.0/12.0, severe:
# 12.0/21.25 -- see benchmark_labels.json) so that the SEVERITY_BINS cuts
# below land near each label boundary. n=7 is tiny; refit as more labeled
# photos come in via `manage.py benchmark_face_analysis`.
A_CHANNEL_LOW = -5.0
A_CHANNEL_HIGH = 21.5

SEVERITY_BINS = (
    (20, 'normal'),
    (40, 'mild'),
    (65, 'moderate'),
)
# ^ Kaggle 라벨 점수(0/20/40/60/80/100, 실제 0-100 의미 스케일) -> 정답 등급 매핑
# 전용. `benchmark_redness_severity_dataset.py`가 label_score에만 쓴다 -- 라벨은
# 처음부터 저 6개 값 중 하나라 이 경계가 곧 라벨의 실제 등급 정의다. 모델 예측
# redness_score에는 쓰지 말 것(과거에 여기 썼다가 아래 MODEL_SEVERITY_BINS로
# 분리한 이유는 그 상수 옆 주석 참고).

# Ridge 회귀 redness_score(평균 33.7, 표준편차 5.2로 SEVERITY_BINS를 잡을 때 쓴
# 예전 규칙 기반 점수보다 훨씬 좁게 뭉친 분포) 전용 4단계 경계. SEVERITY_BINS를
# 그대로 썼을 때는 대부분 '경미'에 쏠려 4단계 일치율이 26%까지 떨어졌었다(둘 다
# 같은 상수를 썼기 때문 -- 예측용으로 좁히면 라벨 쪽 정답 매핑까지 같이 틀어지는
# 문제가 있어 분리함). `manage.py recalibrate_severity_bins`로 train split(144장,
# 학습 때 안 쓴 valid와 분리)에서 4구간 정확 탐색(DP)으로 구함, valid(50장,
# 홀드아웃)에서 4단계 일치율 26% -> 36%.
MODEL_SEVERITY_BINS = (
    (18.6, 'normal'),
    (25.1, 'mild'),
    (43.0, 'moderate'),
)

# Overall redness_score: Ridge regression trained on the Kaggle
# skin_type_classification_dataset train split (144 photos, after dedup/
# no-face drops) via `manage.py train_redness_regression`, evaluated on its
# valid split (50 photos, held out from fitting/lambda-selection alike).
# Replaces "average the four region_scores" (which only ever used the a*
# channel) with a linear model over a*/b*/L*/highlight-ratio for all four
# regions -- on valid: Pearson r 0.251 (old, mean-of-region_scores) -> 0.386
# (this model), RMSE 27.1 -> 25.3. Region-level `region_scores` below is
# untouched (still a*-only) so the per-region breakdown stays simple to
# read; only this aggregate switched.
#
# Kaggle labels images by skin type (dry/oily/normal), and that one-hot was
# the single strongest predictor when included -- but there's no path today
# for the app to know a real user's skin type at upload time (no onboarding
# field persists it, see PRD "다음 작업"), so it's deliberately left out here.
# A feature present at training time but unknown at inference time would
# make this benchmark not reproduce in production. Retrain with
# `--include-skin-type` once that field exists.
#
# This model's output distribution gets its own severity cut points --
# see MODEL_SEVERITY_BINS above, fit separately via `manage.py
# recalibrate_severity_bins`.
REDNESS_MODEL_FEATURES = [
    'forehead_a', 'forehead_b', 'forehead_l', 'forehead_highlight',
    'nose_a', 'nose_b', 'nose_l', 'nose_highlight',
    'left_cheek_a', 'left_cheek_b', 'left_cheek_l', 'left_cheek_highlight',
    'right_cheek_a', 'right_cheek_b', 'right_cheek_l', 'right_cheek_highlight',
    'num_excluded', 'lighting_corrected',
]
REDNESS_MODEL_IMPUTE = [
    2.6692, -1.4624, 71.6274, 0.2006,
    5.4514, 1.2778, 64.251, 0.1011,
    4.7797, -0.1329, 69.627, 0.167,
    4.4167, -0.7292, 70.6919, 0.1987,
    0.0833, 0.9861,
]
REDNESS_MODEL_MU = REDNESS_MODEL_IMPUTE  # train-mean-imputed columns, so mean == impute value
REDNESS_MODEL_SIGMA = [
    6.7779, 10.5118, 9.7186, 0.2581,
    6.3888, 9.3752, 9.3342, 0.1439,
    6.9863, 10.6889, 10.7034, 0.2512,
    7.0647, 10.6355, 10.2589, 0.2925,
    0.2764, 0.117,
]
REDNESS_MODEL_WEIGHTS = [
    0.75404, -0.83313, -0.6665, 0.06523,
    0.39226, -1.03218, 0.27598, -0.74714,
    0.93893, -1.03356, -0.73052, -0.54,
    1.48541, -0.78783, -1.39831, -0.43873,
    0.68238, -0.36099,
]
REDNESS_MODEL_INTERCEPT = 33.8889

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


def _cheek_center(nose, eye, mouth, width, height, margin):
    """Cheek ROI center, preferring the eye+mouth-corner midpoint but
    falling back to a nose->mouth-corner extension when the eye landmark
    isn't usably in frame (e.g. a tight crop showing only nose/mouth/chin,
    where the cheek is clearly visible but the eye above it is not).

    The fallback assumes a roughly frontal face -- it's less precise than
    the eye-anchored version -- so it's only used when the eye anchor
    isn't available, not as the default.
    """
    if _fully_in_frame(eye, width, height, margin) and _fully_in_frame(mouth, width, height, margin):
        return (eye[0] + mouth[0]) / 2, (eye[1] + mouth[1]) / 2
    if _fully_in_frame(nose, width, height, margin) and _fully_in_frame(mouth, width, height, margin):
        return mouth[0] + (mouth[0] - nose[0]) * 0.25, mouth[1] + (mouth[1] - nose[1]) * 0.25
    return None


def _fully_in_frame(point, width, height, margin):
    """True if a point sits far enough inside the photo that a roi_half-sized
    square around it wouldn't need clipping.

    MediaPipe still emits a landmark for a side of the face that's mostly
    (or fully) out of frame -- it extrapolates from the visible portion, so
    the coordinate can even land past the image edge. Using such a landmark
    as an ROI anchor doesn't fail loudly: _crop_square just clips it to a
    thin, unrepresentative sliver that can still look skin-toned and pass
    _looks_like_skin. Reject those landmarks before they anchor anything.
    """
    x, y = point
    return margin <= x <= width - margin and margin <= y <= height - margin


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


def _lab_channels(rgb_patch):
    lab = cv2.cvtColor(rgb_patch, cv2.COLOR_RGB2LAB).astype(np.float32)
    lightness = lab[:, :, 0] / 255.0 * 100.0
    a_signed = lab[:, :, 1] - 128.0
    b_signed = lab[:, :, 2] - 128.0
    return lightness, a_signed, b_signed


def _redness_index(rgb_patch):
    """Median CIE Lab a* (signed, neutral=0) of a skin patch. Higher = redder.

    Median (not mean) so a handful of blown-out specular-highlight pixels
    (oily nose/forehead shine) don't drag the whole ROI's reading around.
    """
    _, a_signed, _ = _lab_channels(rgb_patch)
    return float(np.median(a_signed))


def _extra_region_features(rgb_patch):
    """b*/L* medians + specular-highlight ratio, for the regression experiment
    in train_redness_regression.py -- the rule-based score only uses a*."""
    lightness, _, b_signed = _lab_channels(rgb_patch)
    return {
        'b': round(float(np.median(b_signed)), 2),
        'l': round(float(np.median(lightness)), 2),
        'highlight_ratio': round(float(np.mean(lightness > 80)), 3),
    }


def _looks_like_skin(rgb_patch):
    lightness, _, _ = _lab_channels(rgb_patch)
    return float(np.median(lightness)) >= MIN_SKIN_LIGHTNESS


def _looks_like_skin_reference(rgb_patch):
    """Stricter skin check for white-balance reference patches.

    Reference patches sit outside the scored ROIs (see analyze_face_redness),
    so a bare lightness floor isn't enough to keep them off hair/background --
    both can be within the "not too dark" range yet be near-neutral gray,
    unlike real skin which keeps measurable a*/b* chroma. See
    MIN_REFERENCE_CHROMA for the measurements behind the threshold.
    """
    if not _looks_like_skin(rgb_patch):
        return False
    _, a_signed, b_signed = _lab_channels(rgb_patch)
    chroma = float(np.hypot(np.median(a_signed), np.median(b_signed)))
    return chroma >= MIN_REFERENCE_CHROMA


def _score_from_index(a_signed_mean):
    span = A_CHANNEL_HIGH - A_CHANNEL_LOW
    return float(np.clip((a_signed_mean - A_CHANNEL_LOW) / span * 100, 0, 100))


def _ml_redness_score(region_raw_index, region_extra_features, excluded_regions, lighting_corrected):
    """Overall redness_score from REDNESS_MODEL_WEIGHTS -- see the comment
    above REDNESS_MODEL_FEATURES for what this is and why."""
    values = {}
    for region in ('forehead', 'nose', 'left_cheek', 'right_cheek'):
        if region in region_raw_index:
            extra = region_extra_features[region]
            values[f'{region}_a'] = region_raw_index[region]
            values[f'{region}_b'] = extra['b']
            values[f'{region}_l'] = extra['l']
            values[f'{region}_highlight'] = extra['highlight_ratio']
    values['num_excluded'] = float(len(excluded_regions))
    values['lighting_corrected'] = 1.0 if lighting_corrected else 0.0

    total = REDNESS_MODEL_INTERCEPT
    for i, name in enumerate(REDNESS_MODEL_FEATURES):
        x = values.get(name, REDNESS_MODEL_IMPUTE[i])
        total += ((x - REDNESS_MODEL_MU[i]) / REDNESS_MODEL_SIGMA[i]) * REDNESS_MODEL_WEIGHTS[i]
    return float(np.clip(total, 0, 100))


def _severity_from_score(score):
    """Kaggle 라벨 점수(0-100 스케일) -> 등급. 모델 예측에는 쓰지 말 것 -- 아래 참고."""
    for threshold, label in SEVERITY_BINS:
        if score < threshold:
            return label
    return 'severe'


def _severity_from_model_score(score):
    """analyze_face_redness()가 실제로 반환하는 redness_score(Ridge 회귀 출력) -> 등급."""
    for threshold, label in MODEL_SEVERITY_BINS:
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
    mouth_a = _landmark_px(landmarks[MOUTH_CORNER_A], width, height)
    mouth_b = _landmark_px(landmarks[MOUTH_CORNER_B], width, height)

    inter_eye_dist = float(np.linalg.norm(eye_a - eye_b))
    roi_half = max(inter_eye_dist * 0.18, 8)

    eye_mid_y = (eye_a[1] + eye_b[1]) / 2

    # Reference candidates for gray-world correction: same photo/lighting,
    # but outside the classic flush pattern (forehead/nose/cheeks) and
    # disjoint from the ROIs scored below. Temples are tried first but are
    # frequently cropped out of tight selfie-style photos (or, with long
    # hairstyles, land on hair instead), so the chin is kept as a fallback
    # that's almost always still in frame *and* still skin. Each candidate
    # must pass _looks_like_skin_reference -- without this, a temple that
    # lands on hair or background silently pollutes the reference average
    # and skews every scored region's white balance together (see
    # MIN_REFERENCE_CHROMA).
    reference_centers = (
        (eye_a[0] - inter_eye_dist * 0.75, eye_mid_y),
        (eye_b[0] + inter_eye_dist * 0.75, eye_mid_y),
        (nose[0], chin[1] - roi_half * 0.5),
    )
    reference_candidates = [
        patch
        for patch in (_crop_square(rgb_array, c, roi_half) for c in reference_centers)
        if patch is not None and patch.size > 0
    ]
    # Prefer candidates that clearly look like skin (chroma check). But on
    # tight crops all three landmarks can end up partially clipped/shadowed
    # enough that none clear that bar -- falling back to "not obviously
    # hair/deep-shadow" (lightness only) beats skipping correction entirely,
    # which was previously shown to reintroduce the lighting-color-cast bias
    # PR #6 fixed.
    reference_patches = [p.reshape(-1, 3) for p in reference_candidates if _looks_like_skin_reference(p)]
    if not reference_patches:
        reference_patches = [p.reshape(-1, 3) for p in reference_candidates if _looks_like_skin(p)]
    lighting_corrected = bool(reference_patches)
    balanced = (
        _gray_world_white_balance(rgb_array, np.concatenate(reference_patches))
        if reference_patches
        else rgb_array
    )

    # forehead/nose: listed with the anchor landmarks they depend on -- if
    # the face is turned/cropped enough that one of those anchors is barely
    # (or not at all) in the photo, the region is skipped instead of being
    # scored from a clipped, unrepresentative sliver of pixels.
    fixed_regions = {
        'forehead': ((nose[0], (forehead_top[1] + eye_mid_y) / 2), (nose, forehead_top, eye_a, eye_b)),
        'nose': ((nose[0], nose[1]), (nose,)),
    }

    region_scores = {}
    region_raw_index = {}
    region_extra_features = {}
    excluded_regions = []
    for name, (center, anchors) in fixed_regions.items():
        if not all(_fully_in_frame(a, width, height, roi_half) for a in anchors):
            excluded_regions.append(name)
            continue
        patch = _crop_square(balanced, center, roi_half)
        if patch is None or patch.size == 0:
            excluded_regions.append(name)
            continue
        if not _looks_like_skin(patch):
            excluded_regions.append(name)
            continue
        raw = _redness_index(patch)
        region_raw_index[name] = round(raw, 2)
        region_scores[name] = round(_score_from_index(raw), 1)
        region_extra_features[name] = _extra_region_features(patch)

    # Cheeks: eye+mouth-corner midpoint when the eye is usable, else a
    # nose->mouth-corner fallback (see _cheek_center) so a tight crop that
    # shows nose/mouth/cheeks but not the eyes above them still gets scored
    # instead of being excluded just because the eye landmark is missing.
    for name, eye, mouth in (('left_cheek', eye_a, mouth_a), ('right_cheek', eye_b, mouth_b)):
        center = _cheek_center(nose, eye, mouth, width, height, roi_half)
        if center is None:
            excluded_regions.append(name)
            continue
        patch = _crop_square(balanced, center, roi_half)
        if patch is None or patch.size == 0:
            excluded_regions.append(name)
            continue
        if not _looks_like_skin(patch):
            excluded_regions.append(name)
            continue
        raw = _redness_index(patch)
        region_raw_index[name] = round(raw, 2)
        region_scores[name] = round(_score_from_index(raw), 1)
        region_extra_features[name] = _extra_region_features(patch)

    if not region_scores:
        raise NoFaceDetectedError('피부 영역을 추출하지 못했습니다. 다시 촬영해 주세요.')

    overall_score = round(
        _ml_redness_score(region_raw_index, region_extra_features, excluded_regions, lighting_corrected), 1,
    )

    return {
        'redness_score': overall_score,
        'severity': _severity_from_model_score(overall_score),
        'region_scores': region_scores,
        'region_raw_index': region_raw_index,
        # b*/L*/highlight_ratio per region -- not used by the rule-based score,
        # only by management/commands/train_redness_regression.py to build a
        # richer feature vector than the single a* channel above.
        'region_extra_features': region_extra_features,
        'lighting_corrected': lighting_corrected,
        'excluded_regions': excluded_regions,
    }
