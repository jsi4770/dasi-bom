import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Warm } from '@/constants/theme';
import { ApiError, uploadFaceAnalysis } from '@/lib/api';

// 얼굴 타원 가이드 크기. 화면 폭 기준으로 잡아서 기기마다 비슷한 비율로 보이게 함.
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OVAL_WIDTH = SCREEN_WIDTH * 0.7;
const OVAL_HEIGHT = OVAL_WIDTH * 1.3;

export default function FaceCaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <ThemedView style={styles.centerFill} />;
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.centerFill}>
        <SafeAreaView style={styles.permissionContent}>
          <ThemedText type="subtitle" style={styles.centerText}>
            카메라 권한이 필요해요
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
            얼굴 사진으로 피부 상태를 확인하려면{'\n'}카메라 접근을 허용해주세요.
          </ThemedText>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <ThemedText type="default" style={styles.primaryButtonText}>
              권한 허용하기
            </ThemedText>
          </TouchableOpacity>
        </SafeAreaView>
      </ThemedView>
    );
  }

  async function handleCapture() {
    if (!cameraRef.current || !isCameraReady) {
      return;
    }
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (photo) {
      setPhotoUri(photo.uri);
    }
  }

  function handleRetake() {
    setPhotoUri(null);
    setErrorText(null);
  }

  async function handleConfirm() {
    if (!photoUri || isAnalyzing) {
      return;
    }
    setIsAnalyzing(true);
    setErrorText(null);
    try {
      const result = await uploadFaceAnalysis(photoUri);
      router.replace({
        pathname: '/face-result',
        params: { photoUri, result: JSON.stringify(result) },
      });
    } catch (error) {
      setErrorText(
        error instanceof ApiError ? error.message : '사진을 분석하지 못했어요. 다시 시도해주세요.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  if (photoUri) {
    return (
      <View style={styles.fill}>
        <Image source={{ uri: photoUri }} style={styles.fill} contentFit="cover" />
        <SafeAreaView style={styles.previewControls}>
          {errorText && (
            <ThemedText type="small" style={styles.previewErrorText}>
              {errorText}
            </ThemedText>
          )}
          <View style={styles.previewButtonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRetake}
              disabled={isAnalyzing}>
              <ThemedText type="default" style={styles.secondaryButtonText}>
                다시 찍기
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleConfirm}
              disabled={isAnalyzing}>
              {isAnalyzing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText type="default" style={styles.primaryButtonText}>
                  이 사진 사용하기
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        ref={cameraRef}
        style={styles.fill}
        facing="front"
        onCameraReady={() => setIsCameraReady(true)}
      />

      <FaceGuideOverlay />

      <SafeAreaView style={styles.chrome} pointerEvents="box-none">
        <View style={styles.guideTextBox}>
          <ThemedText type="default" style={styles.guideText}>
            타원 안에 얼굴을 맞추고 정면을 바라봐주세요
          </ThemedText>
          <ThemedText type="small" style={styles.guideSubText}>
            창을 마주보는 곳처럼 조명이 고른 곳에서 찍으면 더 정확해요
          </ThemedText>
        </View>

        <View style={styles.captureRow}>
          <TouchableOpacity
            accessibilityLabel="사진 촬영"
            style={styles.shutterButton}
            onPress={handleCapture}
            disabled={!isCameraReady}>
            <View style={styles.shutterButtonInner} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// 얼굴을 맞출 타원 가이드 + 눈높이 기준선.
// 실시간 얼굴 인식은 하지 않고, 사용자가 스스로 정렬하도록 고정된 시각 가이드만 제공한다.
function FaceGuideOverlay() {
  const ovalTop = (Dimensions.get('window').height - OVAL_HEIGHT) / 2;
  const ovalLeft = (SCREEN_WIDTH - OVAL_WIDTH) / 2;
  const eyeLineTop = ovalTop + OVAL_HEIGHT * 0.38;

  return (
    <View style={styles.fill} pointerEvents="none">
      <View style={[styles.mask, { top: 0, height: ovalTop }]} />
      <View style={[styles.mask, { bottom: 0, height: ovalTop }]} />
      <View style={[styles.mask, { top: ovalTop, height: OVAL_HEIGHT, left: 0, width: ovalLeft }]} />
      <View
        style={[
          styles.mask,
          { top: ovalTop, height: OVAL_HEIGHT, right: 0, width: ovalLeft },
        ]}
      />
      <View
        style={[
          styles.ovalOutline,
          { top: ovalTop, left: ovalLeft, width: OVAL_WIDTH, height: OVAL_HEIGHT },
        ]}
      />
      <View style={[styles.eyeLine, { top: eyeLineTop, left: ovalLeft, width: OVAL_WIDTH }]} />
    </View>
  );
}

const MASK_COLOR = 'rgba(0, 0, 0, 0.55)';

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  centerFill: {
    flex: 1,
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  permissionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  mask: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: MASK_COLOR,
  },
  ovalOutline: {
    position: 'absolute',
    borderRadius: OVAL_WIDTH,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderStyle: 'dashed',
  },
  eyeLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  chrome: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.five,
  },
  guideTextBox: {
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
  },
  guideText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '600',
  },
  guideSubText: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  captureRow: {
    alignItems: 'center',
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
  },
  previewControls: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
  },
  previewButtonRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  previewErrorText: {
    color: '#ffffff',
    backgroundColor: 'rgba(214, 69, 69, 0.85)',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    textAlign: 'center',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Warm.primaryDeep,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
