import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmHeader } from '@/components/warm/warm-header';
import { WarmInfoNote } from '@/components/warm/warm-info-note';
import { WarmScreen } from '@/components/warm/warm-screen';
import { blobDecorationStyle, SeverityColors, Warm } from '@/constants/theme';
import { useUserConsent } from '@/hooks/use-user-consent';
import { ApiError, saveUserConsent, type UserConsentPayload } from '@/lib/api';

// 시안 "다시봄 리뉴얼 온보딩.dc.html" 07/08 화면 — 동의 항목은 이 앱에 실제로 존재하는 두 가지
// (얼굴 사진 / 건강 데이터)뿐이고 둘 다 선택 항목이라, 시안 메모대로 "전체 동의 / 개별 동의 +
// 동의 없이 시작하기"로 동의 여부를 드러내는 구조로 구현했다. 동의 상태는 GET/POST
// /api/users/consent/ 로 저장·조회한다 — 저장된 기록이 없는 유저는 404 → 초기 상태(둘 다 미동의)로 취급.
function finishOnboarding() {
  // 온보딩 스택을 지우고 홈 탭으로 진입 — 뒤로가기로 온보딩에 못 돌아오게 replace 사용
  router.replace('/');
}

function ConsentCheckbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked ? styles.checkboxChecked : styles.checkboxEmpty]}>
      {checked && (
        <SymbolView
          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
          size={13}
          tintColor="#ffffff"
        />
      )}
    </View>
  );
}

export default function OnboardingConsentScreen() {
  const { consent, loading: consentLoading, error: consentError, refetch } = useUserConsent();

  const [faceConsent, setFaceConsent] = useState(false);
  const [healthConsent, setHealthConsent] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // GET 응답(또는 404 → null)이 도착하면 한 번만 체크 상태를 채운다 — 렌더 중 조건부로 처리해
  // (React 공식 문서의 "prop이 바뀌면 state를 조정" 패턴) effect 한 틱을 더 쓰지 않는다. 이후 사용자가
  // 직접 바꾼 값을 재조회가 다시 덮어쓰지 않도록 prefilled 플래그로 막는다.
  if (consent !== undefined && !prefilled) {
    setPrefilled(true);
    setFaceConsent(consent?.face_analysis_consent ?? false);
    setHealthConsent(consent?.health_data_consent ?? false);
  }

  const agreeAll = faceConsent && healthConsent;

  function toggleAll() {
    const next = !agreeAll;
    setFaceConsent(next);
    setHealthConsent(next);
  }

  async function persistConsent(payload: UserConsentPayload) {
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveUserConsent(payload);
      finishOnboarding();
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : '저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleSaveAndContinue() {
    if (isSaving) return;
    persistConsent({ face_analysis_consent: faceConsent, health_data_consent: healthConsent });
  }

  // "동의 없이 시작하기"도 저장을 생략하지 않고 두 항목 모두 false로 명시적으로 저장한다 — GET 404(초기
  // 상태)와 "명시적으로 동의를 거부함"을 구분해, 이후 얼굴 사진/건강 데이터 기능에서 동의 여부를 조회할 때
  // 실제 사용자 선택이 남아 있도록 한다.
  function handleSkipWithoutConsent() {
    if (isSaving) return;
    persistConsent({ face_analysis_consent: false, health_data_consent: false });
  }

  return (
    <WarmScreen header={<WarmHeader title="데이터 활용 동의" variant="minimal" onBack={() => router.back()} />}>
      <View style={styles.blob} />

      <View style={styles.titleBlock}>
        <ThemedText style={styles.title}>시작하기 전에 확인해 주세요</ThemedText>
        <ThemedText style={styles.subtitle}>
          {'기록을 어떻게 쓰는지 알려드릴게요.\n필요한 것만 골라 동의하실 수 있어요.'}
        </ThemedText>
      </View>

      {consentError && (
        <ThemedText style={styles.error}>
          {consentError.message}{' '}
          <ThemedText style={styles.retryLink} onPress={() => refetch()}>
            다시 시도
          </ThemedText>
        </ThemedText>
      )}

      <Pressable
        style={styles.allRow}
        onPress={toggleAll}
        disabled={consentLoading}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreeAll }}>
        <ConsentCheckbox checked={agreeAll} />
        <ThemedText style={styles.allRowLabel}>전체 동의하기</ThemedText>
      </Pressable>

      <View style={styles.consentList}>
        <Pressable
          style={styles.consentItem}
          onPress={() => setFaceConsent((prev) => !prev)}
          disabled={consentLoading}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: faceConsent }}>
          <ConsentCheckbox checked={faceConsent} />
          <View style={styles.consentTextBlock}>
            <View style={styles.consentLabelRow}>
              <View style={styles.optionalBadge}>
                <ThemedText style={styles.optionalBadgeText}>선택</ThemedText>
              </View>
              <ThemedText style={styles.cardTitle}>얼굴 사진</ThemedText>
            </View>
            <ThemedText style={styles.cardBody}>
              피부 상태와 홍조 변화를 참고하기 위해 얼굴 사진을 활용해요. 사진은 앱 내에서만 사용되며
              외부에 공유되지 않아요.
            </ThemedText>
          </View>
        </Pressable>

        <Pressable
          style={[styles.consentItem, styles.consentItemLast]}
          onPress={() => setHealthConsent((prev) => !prev)}
          disabled={consentLoading}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: healthConsent }}>
          <ConsentCheckbox checked={healthConsent} />
          <View style={styles.consentTextBlock}>
            <View style={styles.consentLabelRow}>
              <View style={styles.optionalBadge}>
                <ThemedText style={styles.optionalBadgeText}>선택</ThemedText>
              </View>
              <ThemedText style={styles.cardTitle}>건강 데이터 (수면·심박)</ThemedText>
            </View>
            <ThemedText style={styles.cardBody}>
              Google Health 또는 목업 데이터의 수면·심박 정보를 일별 기록에 연결해요. 데이터 연동은
              언제든지 중단할 수 있어요.
            </ThemedText>
          </View>
        </Pressable>
      </View>

      {saveError && <ThemedText style={styles.error}>{saveError}</ThemedText>}

      <WarmInfoNote
        icon="!"
        text="이 앱이 제공하는 모든 정보는 건강 참고 자료예요. 의료 진단·처방·임상 판단을 대신하지 않아요. 건강에 이상이 느껴지면 전문 의료진과 상담하세요."
      />

      <View style={styles.spacer} />

      <WarmButton
        label={isSaving ? '저장하는 중...' : '동의하고 시작하기'}
        onPress={handleSaveAndContinue}
        style={isSaving ? styles.buttonDisabled : undefined}
      />
      <WarmButton
        label="동의 없이 시작하기"
        variant="text"
        onPress={handleSkipWithoutConsent}
        style={isSaving ? styles.buttonDisabled : undefined}
      />
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    left: -20,
    top: -10,
    width: 200,
    height: 200,
    borderRadius: 100,
    ...blobDecorationStyle(Warm.accentSoft),
  },
  titleBlock: {
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Warm.textDeep,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.text,
  },
  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: Warm.backgroundSubtle,
  },
  allRowLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  consentList: {
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  consentItemLast: {
    borderBottomWidth: 0,
  },
  consentTextBlock: {
    flex: 1,
    gap: 4,
  },
  consentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 61, 44, 0.1)',
  },
  optionalBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Warm.textDeep,
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
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: Warm.primary,
  },
  checkboxEmpty: {
    borderWidth: 1.8,
    borderColor: 'rgba(15, 61, 44, 0.4)',
  },
  error: {
    fontSize: 13,
    lineHeight: 19,
    color: SeverityColors.severe.fill,
  },
  retryLink: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
    color: SeverityColors.severe.fill,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
});
