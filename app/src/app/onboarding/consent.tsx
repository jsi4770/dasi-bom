import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmHeader } from '@/components/warm/warm-header';
import { WarmInfoNote } from '@/components/warm/warm-info-note';
import { WarmScreen } from '@/components/warm/warm-screen';
import { SeverityColors, Warm } from '@/constants/theme';
import { ApiError, getConsent, saveConsent } from '@/lib/api';

export default function OnboardingConsentScreen() {
  const { redirectTo } = useLocalSearchParams<{ redirectTo?: string }>();

  const [faceAnalysisConsent, setFaceAnalysisConsent] = useState(false);
  const [healthDataConsent, setHealthDataConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // 이미 동의한 적 있으면(재방문) 토글 초기값을 그 값으로 맞춘다 — 처음이면 getConsent()가
  // 404를 흡수해 둘 다 false를 주므로 그대로 둔다.
  useEffect(() => {
    let cancelled = false;
    getConsent().then((consent) => {
      if (cancelled) return;
      setFaceAnalysisConsent(consent.face_analysis_consent);
      setHealthDataConsent(consent.health_data_consent);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function goNext() {
    // redirectTo는 쿼리 파라미터라 컴파일 시점엔 어떤 경로인지 알 수 없다(typedRoutes) — 이
    // 화면으로 들여보낸 쪽(동의 차단 팝업)이 실제 존재하는 경로만 넣는다는 전제로 캐스팅한다.
    router.replace((redirectTo ?? '/') as Href);
  }

  function submit(payload: { face_analysis_consent: boolean; health_data_consent: boolean }) {
    if (saving) return;
    setSaving(true);
    setErrorText(null);
    saveConsent(payload)
      .then(goNext)
      .catch((error) => {
        setErrorText(error instanceof ApiError ? error.message : '저장하지 못했어요. 다시 시도해주세요.');
      })
      .finally(() => setSaving(false));
  }

  return (
    <WarmScreen header={<WarmHeader title="데이터 활용 동의" variant="minimal" onBack={() => router.back()} />}>
      <View style={styles.titleBlock}>
        <ThemedText style={styles.title}>내 정보 활용 동의</ThemedText>
        <ThemedText style={styles.subtitle}>
          아래 정보는 더 나은 건강 참고 정보를 드리기 위해 사용돼요. 동의하지 않은 항목은 제외하고도
          계속 이용할 수 있어요.
        </ThemedText>
      </View>

      <View style={styles.consentList}>
        <View style={styles.consentItem}>
          <View style={styles.consentTextBlock}>
            <ThemedText style={styles.cardTitle}>얼굴 사진</ThemedText>
            <ThemedText style={styles.cardBody}>
              피부 상태와 홍조 변화를 참고하기 위해 얼굴 사진을 활용해요. 사진은 앱 내에서만 사용되며
              외부에 공유되지 않아요.
            </ThemedText>
          </View>
          <Switch
            value={faceAnalysisConsent}
            onValueChange={setFaceAnalysisConsent}
            trackColor={{ false: Warm.border, true: Warm.primarySoftBorder }}
            thumbColor={faceAnalysisConsent ? Warm.primary : Warm.card}
          />
        </View>

        <View style={[styles.consentItem, styles.consentItemLast]}>
          <View style={styles.consentTextBlock}>
            <ThemedText style={styles.cardTitle}>건강 데이터 (수면·심박)</ThemedText>
            <ThemedText style={styles.cardBody}>
              Google Health 또는 목업 데이터의 수면·심박 정보를 일별 기록에 연결해요. 데이터 연동은
              언제든지 중단할 수 있어요.
            </ThemedText>
          </View>
          <Switch
            value={healthDataConsent}
            onValueChange={setHealthDataConsent}
            trackColor={{ false: Warm.border, true: Warm.primarySoftBorder }}
            thumbColor={healthDataConsent ? Warm.primary : Warm.card}
          />
        </View>
      </View>

      <WarmInfoNote
        icon="!"
        text="이 앱이 제공하는 모든 정보는 건강 참고 자료예요. 의료 진단·처방·임상 판단을 대신하지 않아요. 건강에 이상이 느껴지면 전문 의료진과 상담하세요."
      />

      {errorText && <ThemedText style={styles.error}>{errorText}</ThemedText>}

      <View style={styles.spacer} />

      <WarmButton
        label={saving ? '저장하는 중…' : '홈으로 계속하기'}
        onPress={() => submit({ face_analysis_consent: faceAnalysisConsent, health_data_consent: healthDataConsent })}
      />
      <WarmButton
        label="동의 없이 시작하기"
        variant="text"
        onPress={() => submit({ face_analysis_consent: false, health_data_consent: false })}
      />
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Warm.textDeep,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.text,
  },
  consentList: {
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  consentItemLast: {
    borderBottomWidth: 0,
  },
  consentTextBlock: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 21,
    color: Warm.textSecondary,
  },
  error: {
    fontSize: 13,
    lineHeight: 19,
    color: SeverityColors.severe.fill,
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
});
