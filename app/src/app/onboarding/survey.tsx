import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmHeader } from '@/components/warm/warm-header';
import { WarmScreen } from '@/components/warm/warm-screen';
import { MENOPAUSE_SURVEY_OPTIONS } from '@/constants/mock-data';
import { blobDecorationStyle, Warm } from '@/constants/theme';

export default function OnboardingSurveyScreen() {
  const [choice, setChoice] = useState<number | null>(null);

  return (
    <WarmScreen header={<WarmHeader title="완경 단계 설문" variant="minimal" onBack={() => router.back()} />}>
      <View style={styles.titleBlock}>
        <View style={styles.titleBlob} />
        <ThemedText style={styles.title}>현재 나의 상태를 알려주세요</ThemedText>
        <ThemedText type="small" themeColor="text">
          의료적 진단이 아닌 개인화 참고 정보로만 사용돼요
        </ThemedText>
      </View>

      <View style={styles.options}>
        {MENOPAUSE_SURVEY_OPTIONS.map((label, index) => {
          const selected = choice === index;
          const isLast = index === MENOPAUSE_SURVEY_OPTIONS.length - 1;
          return (
            <Pressable
              key={label}
              onPress={() => setChoice(index)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.option, !isLast && styles.optionDivider, selected && styles.optionSelected]}>
              <ThemedText style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {label}
              </ThemedText>
              <View style={[styles.dot, selected && styles.dotSelected]}>
                {selected && (
                  <SymbolView
                    name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                    size={13}
                    tintColor="#ffffff"
                  />
                )}
              </View>
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
    position: 'relative',
  },
  titleBlob: {
    position: 'absolute',
    right: 0,
    top: -75,
    width: 130,
    height: 130,
    borderRadius: 999,
    ...blobDecorationStyle(Warm.accentSoft),
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Warm.textDeep,
  },
  options: {
    borderRadius: 20,
    backgroundColor: Warm.card,
    paddingHorizontal: 18,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    minHeight: 60,
    paddingVertical: 16,
  },
  optionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  optionSelected: {
    marginHorizontal: -18,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: Warm.primarySoft,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(46, 42, 36, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dotSelected: {
    borderColor: Warm.primary,
    backgroundColor: Warm.primary,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: Warm.text,
  },
  optionLabelSelected: {
    fontWeight: '700',
    color: Warm.textDeep,
  },
  centerText: {
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
});
