import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmCard } from '@/components/warm/warm-card';
import { WarmHeader } from '@/components/warm/warm-header';
import { WarmInfoNote } from '@/components/warm/warm-info-note';
import { WarmScreen } from '@/components/warm/warm-screen';
import { Warm } from '@/constants/theme';

const HELP_ITEMS = [
  { emoji: '🔥', bg: Warm.secondary, text: '홍조·발한 등 증상을 기록하고 싶은 분' },
  { emoji: '😴', bg: Warm.accentSoft, text: '수면과 기분 변화를 꾸준히 확인하고 싶은 분' },
  { emoji: '🌿', bg: Warm.primary, text: '일상 속 작은 자기돌봄을 시작하고 싶은 분' },
];

export default function OnboardingWelcomeScreen() {
  return (
    <WarmScreen
      header={
        // n28c(로그인 안내)는 이번 디자인 파일 범위 밖이라 아직 별도 화면이 없음 — 우선 설정 탭으로 연결
        <WarmHeader title="오늘의 나" onBack={() => router.push('/settings')} />
      }>
      <View style={styles.illustration}>
        <View style={[styles.blob, styles.blobYellow]} />
        <View style={[styles.blob, styles.blobGreen]} />
        <View style={styles.illustrationPlaceholder}>
          <ThemedText type="small" themeColor="textSecondary">
            앱 웰니스 일러스트
          </ThemedText>
        </View>
      </View>

      <View style={styles.titleBlock}>
        <ThemedText style={styles.title}>{'오늘의 나에 오신 걸\n환영해요'}</ThemedText>
        <ThemedText style={styles.subtitle}>
          {'완경기 증상을 편안하게 기록하고,\n내 몸의 변화를 함께 살펴봐요'}
        </ThemedText>
      </View>

      <WarmCard>
        <ThemedText style={styles.cardTitle}>이런 분께 도움이 돼요</ThemedText>
        <View style={styles.helpList}>
          {HELP_ITEMS.map((item) => (
            <View key={item.text} style={styles.helpRow}>
              <View style={[styles.helpIcon, { backgroundColor: item.bg }]}>
                <ThemedText style={styles.helpEmoji}>{item.emoji}</ThemedText>
              </View>
              <ThemedText style={styles.helpText}>{item.text}</ThemedText>
            </View>
          ))}
        </View>
      </WarmCard>

      <WarmInfoNote
        title="꼭 알아두세요"
        text="이 앱은 건강 참고 정보를 제공하며, 의료 진단이나 처방을 대신하지 않아요. 증상이 걱정된다면 전문의와 상담하세요."
      />

      <View style={styles.spacer} />

      <WarmButton label="나의 완경 단계 알아보기" onPress={() => router.push('/onboarding/survey')} />
      <WarmButton
        label="데이터 수집·처리 동의 확인하기"
        variant="secondary"
        onPress={() => router.push('/onboarding/consent')}
      />
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  illustration: {
    position: 'relative',
    width: '100%',
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobYellow: {
    width: 150,
    height: 150,
    backgroundColor: Warm.secondarySoft,
    top: -6,
    left: 14,
  },
  blobGreen: {
    width: 110,
    height: 110,
    backgroundColor: Warm.primarySoft,
    bottom: -4,
    right: 20,
  },
  illustrationPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 32,
    backgroundColor: 'rgba(253, 247, 241, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Warm.border,
    borderStyle: 'dashed',
  },
  titleBlock: {
    gap: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 34,
    textAlign: 'center',
    color: Warm.text,
  },
  subtitle: {
    // 카드가 아닌 화면 배경 위에 바로 놓여서 textSecondary(카드 전용)는 대비가 살짝 부족함 — text 사용.
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    textAlign: 'center',
    color: Warm.text,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.text,
  },
  helpList: {
    gap: 12,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  helpIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(114, 92, 58, 0.18)',
  },
  helpEmoji: {
    fontSize: 16,
  },
  helpText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: Warm.textSecondary,
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
});
