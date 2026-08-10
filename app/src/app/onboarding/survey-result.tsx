import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmCard } from '@/components/warm/warm-card';
import { WarmHeader } from '@/components/warm/warm-header';
import { WarmInfoNote } from '@/components/warm/warm-info-note';
import { WarmScreen } from '@/components/warm/warm-screen';
import { Warm } from '@/constants/theme';

export default function OnboardingSurveyResultScreen() {
  return (
    <WarmScreen header={<WarmHeader title="설문 결과" onBack={() => router.back()} />}>
      <View style={styles.titleBlock}>
        <ThemedText style={styles.title}>응답해 주셔서 감사해요</ThemedText>
        <ThemedText type="small" themeColor="text">
          답변을 바탕으로 지금 나의 상태를 정리했어요
        </ThemedText>
      </View>

      <View style={styles.resultCard}>
        <ThemedText style={styles.resultLabel}>나의 완경 단계 참고 정보</ThemedText>
        <ThemedText style={styles.resultTitle}>완경 이행기 (추정)</ThemedText>
        <ThemedText style={styles.resultText}>
          불규칙한 생리 주기와 홍조·발한 경험을 바탕으로 완경 이행기에 해당할 수 있어요.
        </ThemedText>
      </View>

      <WarmCard>
        <ThemedText style={styles.cardTitle}>이런 경험을 하고 계신가요?</ThemedText>
        <ThemedText style={styles.cardBody}>
          {'· 생리 주기가 불규칙해지고 있어요\n· 갑작스러운 열감이나 발한이 느껴져요\n· 수면이 예전보다 불편하게 느껴져요'}
        </ThemedText>
      </WarmCard>

      <WarmInfoNote text="이 결과는 설문 응답을 바탕으로 한 개인화 참고 정보예요. 의료적 진단이나 처방이 아니며, 정확한 확인은 전문 의료진과 상담하세요." />

      <View style={styles.spacer} />

      <WarmButton label="계속하기" onPress={() => router.push('/onboarding/consent')} />
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: Warm.text,
  },
  resultCard: {
    gap: 10,
    borderRadius: 28,
    padding: 20,
    backgroundColor: Warm.resultBg,
    borderWidth: 1,
    borderColor: Warm.resultBorder,
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Warm.resultLabel,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Warm.resultTitle,
  },
  resultText: {
    fontSize: 14,
    lineHeight: 21,
    color: Warm.resultText,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Warm.text,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 23,
    color: Warm.textSecondary,
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
});
