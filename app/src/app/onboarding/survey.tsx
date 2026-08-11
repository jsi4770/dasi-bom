import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmHeader } from '@/components/warm/warm-header';
import { WarmScreen } from '@/components/warm/warm-screen';
import { MENOPAUSE_SURVEY_OPTIONS } from '@/constants/mock-data';
import { Warm } from '@/constants/theme';

export default function OnboardingSurveyScreen() {
  const [choice, setChoice] = useState<number | null>(null);

  return (
    <WarmScreen header={<WarmHeader title="완경 단계 설문" onBack={() => router.back()} />}>
      <View style={styles.titleBlock}>
        <ThemedText style={styles.title}>현재 나의 상태를 알려주세요</ThemedText>
        <ThemedText type="small" themeColor="text">
          의료적 진단이 아닌 개인화 참고 정보로만 사용돼요
        </ThemedText>
      </View>

      <View style={styles.options}>
        {MENOPAUSE_SURVEY_OPTIONS.map((label, index) => {
          const selected = choice === index;
          return (
            <Pressable
              key={label}
              onPress={() => setChoice(index)}
              style={[styles.option, selected && styles.optionSelected]}>
              <View style={[styles.dot, selected && styles.dotSelected]} />
              <ThemedText style={styles.optionLabel}>{label}</ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="small" themeColor="text" style={styles.centerText}>
        어떤 답을 선택해도 앱 이용에 제한이 없어요
      </ThemedText>

      <View style={styles.spacer} />

      <WarmButton
        label="결과 확인하기"
        onPress={() => router.push('/onboarding/survey-result')}
      />
      <WarmButton label="지금은 건너뛸게요" variant="text" onPress={() => router.push('/onboarding/consent')} />
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
  options: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Warm.border,
    backgroundColor: Warm.card,
  },
  optionSelected: {
    borderColor: Warm.primary,
    backgroundColor: Warm.heroBg,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Warm.primarySoftBorder,
  },
  dotSelected: {
    borderColor: Warm.primary,
    backgroundColor: Warm.primary,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Warm.text,
  },
  centerText: {
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
});
