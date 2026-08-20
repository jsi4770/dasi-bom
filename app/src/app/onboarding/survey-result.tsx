import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmHeader } from '@/components/warm/warm-header';
import { WarmInfoNote } from '@/components/warm/warm-info-note';
import { WarmScreen } from '@/components/warm/warm-screen';
import { blobDecorationStyle, SeverityColors, Warm } from '@/constants/theme';
import { ApiError, getMenopauseSurvey, type MenopauseStage } from '@/lib/api';

const MENOPAUSE_STAGES: MenopauseStage[] = ['peri', 'menopause', 'post', 'unknown'];

function isMenopauseStage(value: string | undefined): value is MenopauseStage {
  return !!value && (MENOPAUSE_STAGES as string[]).includes(value);
}

// 백엔드 CHOICE_TO_STAGE(models.py)가 정의하는 값만 사용 — 존재하지 않는 의학적 설명/판정 기준은 만들지 않는다.
const RESULT_CONTENT: Record<
  MenopauseStage,
  { title: string; text: string; listTitle?: string; listItems?: string[] }
> = {
  peri: {
    title: '완경 이행기 (추정)',
    text: '생리 주기가 불규칙해지고 있다고 답해주셨어요. 완경 이행기에 해당할 수 있어요.',
    listTitle: '이런 경험을 하고 계신가요?',
    listItems: [
      '생리 주기가 불규칙해지고 있어요',
      '갑작스러운 열감이나 발한이 느껴져요',
      '수면이 예전보다 불편하게 느껴져요',
    ],
  },
  menopause: {
    title: '완경',
    text: '생리가 완전히 멈춘 지 1년이 넘었다고 답해주셨어요. 완경에 해당해요.',
  },
  post: {
    title: '완경 후기',
    text: '완경 이후 몇 년이 지났다고 답해주셨어요. 완경 후기에 해당해요.',
  },
  unknown: {
    title: '판정 불가',
    text: '답변만으로는 지금 단계를 확인하기 어려워요. 증상이 궁금하시면 전문 의료진과 상담해보세요.',
  },
};

export default function OnboardingSurveyResultScreen() {
  const params = useLocalSearchParams<{ stage?: string }>();
  const paramStage = isMenopauseStage(params.stage) ? params.stage : null;

  const [stage, setStage] = useState<MenopauseStage | null>(paramStage);
  const [loading, setLoading] = useState(!paramStage);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (paramStage) return;

    let cancelled = false;
    async function loadStage() {
      setLoading(true);
      setErrorText(null);
      try {
        const survey = await getMenopauseSurvey();
        if (cancelled) return;
        if (survey) {
          setStage(survey.stage);
        } else {
          // 저장된 설문 응답이 없는 상태로 이 화면에 들어온 경우 — 결과를 만들어낼 수 없어 설문으로 되돌린다.
          router.replace('/onboarding/survey');
        }
      } catch (error) {
        if (cancelled) return;
        setErrorText(
          error instanceof ApiError ? error.message : '설문 결과를 불러오지 못했어요. 다시 시도해주세요.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadStage();

    return () => {
      cancelled = true;
    };
    // paramStage는 최초 마운트 시점 값만 확인하면 되고, 재조회 트리거로 쓰지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content = stage ? RESULT_CONTENT[stage] : null;

  return (
    <WarmScreen header={<WarmHeader title="설문 결과" variant="minimal" onBack={() => router.back()} />}>
      <View style={styles.titleBlock}>
        <View style={styles.titleBlob} />
        <ThemedText style={styles.title}>응답해 주셔서 감사해요</ThemedText>
        <ThemedText type="small" themeColor="text">
          답변을 바탕으로 지금 나의 상태를 정리했어요
        </ThemedText>
      </View>

      {loading && (
        <ThemedText type="small" themeColor="text" style={styles.centerText}>
          결과를 불러오는 중이에요...
        </ThemedText>
      )}

      {errorText && <ThemedText style={styles.error}>{errorText}</ThemedText>}

      {content && (
        <>
          <View style={styles.resultCard}>
            <View style={styles.resultBadge}>
              <ThemedText style={styles.resultBadgeText}>나의 완경 단계 참고 정보</ThemedText>
            </View>
            <ThemedText style={styles.resultTitle}>{content.title}</ThemedText>
            <ThemedText style={styles.resultText}>{content.text}</ThemedText>
          </View>

          {content.listItems && (
            <View style={styles.listBlock}>
              <ThemedText style={styles.cardTitle}>{content.listTitle}</ThemedText>
              <ThemedText style={styles.cardBody}>
                {content.listItems.map((item) => `· ${item}`).join('\n')}
              </ThemedText>
            </View>
          )}
        </>
      )}

      <WarmInfoNote text="이 결과는 설문 응답을 바탕으로 한 개인화 참고 정보예요. 의료적 진단이나 처방이 아니며, 정확한 확인은 전문 의료진과 상담하세요." />

      <View style={styles.spacer} />

      <WarmButton label="계속하기" onPress={() => router.push('/onboarding/consent')} />
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
  centerText: {
    textAlign: 'center',
  },
  error: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: SeverityColors.severe.fill,
  },
  resultCard: {
    gap: 10,
    borderRadius: 22,
    padding: 20,
    backgroundColor: Warm.resultBg,
  },
  resultBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Warm.secondarySoft,
  },
  resultBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Warm.resultLabel,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Warm.resultTitle,
  },
  resultText: {
    fontSize: 14,
    lineHeight: 21,
    color: Warm.resultText,
  },
  listBlock: {
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Warm.textDeep,
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
