import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmHeader } from '@/components/warm/warm-header';
import { WarmInfoNote } from '@/components/warm/warm-info-note';
import { WarmScreen } from '@/components/warm/warm-screen';
import { Warm } from '@/constants/theme';

function finishOnboarding() {
  // 온보딩 스택을 지우고 홈 탭으로 진입 — 뒤로가기로 온보딩에 못 돌아오게 replace 사용
  router.replace('/');
}

export default function OnboardingConsentScreen() {
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
          <ThemedText style={styles.cardTitle}>얼굴 사진</ThemedText>
          <ThemedText style={styles.cardBody}>
            피부 상태와 홍조 변화를 참고하기 위해 얼굴 사진을 활용해요. 사진은 앱 내에서만 사용되며
            외부에 공유되지 않아요.
          </ThemedText>
        </View>

        <View style={[styles.consentItem, styles.consentItemLast]}>
          <ThemedText style={styles.cardTitle}>건강 데이터 (수면·심박)</ThemedText>
          <ThemedText style={styles.cardBody}>
            Google Health 또는 목업 데이터의 수면·심박 정보를 일별 기록에 연결해요. 데이터 연동은
            언제든지 중단할 수 있어요.
          </ThemedText>
        </View>
      </View>

      <WarmInfoNote
        icon="!"
        text="이 앱이 제공하는 모든 정보는 건강 참고 자료예요. 의료 진단·처방·임상 판단을 대신하지 않아요. 건강에 이상이 느껴지면 전문 의료진과 상담하세요."
      />

      <View style={styles.spacer} />

      <WarmButton label="홈으로 계속하기" onPress={finishOnboarding} />
      <WarmButton label="동의 없이 시작하기" variant="text" onPress={finishOnboarding} />
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
    // 카드가 아닌 화면 배경 위에 바로 놓여서 textSecondary(카드 전용)는 대비가 살짝 부족함 — text 사용.
    fontSize: 15,
    lineHeight: 22,
    color: Warm.text,
  },
  consentList: {
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  consentItem: {
    gap: 6,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  consentItemLast: {
    borderBottomWidth: 0,
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
  spacer: {
    flex: 1,
    minHeight: 12,
  },
});
