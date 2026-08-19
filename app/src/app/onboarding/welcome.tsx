import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmInfoNote } from '@/components/warm/warm-info-note';
import { WarmScreen } from '@/components/warm/warm-screen';
import { blobDecorationStyle, Warm } from '@/constants/theme';

// 시안 "다시봄 리뉴얼 온보딩.dc.html" 01~06 화면 — 긴 설명 한 화면 대신 기능 하나씩 소개하는 튜토리얼.
// 최종 흐름(튜토리얼 → 완경 단계 설문 → 설문 결과 → 정보 활용 동의 → 홈)에 맞춰, 튜토리얼 마지막(06)과
// 상단 건너뛰기 모두 설문 화면(survey.tsx)으로 이동한다.
const STEP_COUNT = 6;
const DOT_INACTIVE = 'rgba(46, 42, 36, 0.2)';

// 마스코트 PNG 7장 중 6장을 단계별로 배치 — main.png은 이번 튜토리얼에는 쓰지 않고 남겨둠(다른 화면의
// 대표 이미지로 쓸 수 있게 예비). 조합이 마음에 안 들면 아래 매핑만 바꾸면 된다.
const ONBOARDING_IMAGES = {
  hello: require('@/assets/images/onboarding/hello.png'),
  together: require('@/assets/images/onboarding/together.png'),
  listen: require('@/assets/images/onboarding/listen.png'),
  question: require('@/assets/images/onboarding/question.png'),
  cheering: require('@/assets/images/onboarding/cheering.png'),
  checkTogether: require('@/assets/images/onboarding/check-together.png'),
} as const;

const RECORD_ITEMS = [
  { title: '증상 기록하기', hint: '홍조·불면 등 12가지' },
  { title: '수면 시간 기록', hint: '저녁 체크인에서' },
  { title: '얼굴 사진 기록', hint: '주 1~2회' },
];

const CHAT_SUGGESTIONS = ['밤에 자꾸 깨요', '홍조가 심할 때', '병원에 가야 할까요'];

const DAILY_STEPS = [
  { title: '아침에 약·영양제 확인', body: '알림이 오면 챙기고 눌러두시면 돼요.' },
  { title: '낮에 느낀 증상 기록', body: '홍조가 오면 그때그때 남겨주세요.' },
  { title: '잠들기 전 체크인', body: '하루를 정리하고 잠 기록을 남겨요.' },
];

function ProgressHeader({ step, onSkip }: { step: number; onSkip: () => void }) {
  return (
    <View style={styles.progressHeader}>
      <View style={styles.dotsRow}>
        {Array.from({ length: STEP_COUNT }).map((_, index) => (
          <View key={index} style={[styles.dot, index === step && styles.dotActive]} />
        ))}
      </View>
      <Pressable onPress={onSkip} hitSlop={10}>
        <ThemedText style={styles.skipText}>건너뛰기</ThemedText>
      </Pressable>
    </View>
  );
}

function ChatBubble({ children }: { children: string }) {
  return (
    <View style={styles.chatBubble}>
      <ThemedText style={styles.chatBubbleText}>{children}</ThemedText>
    </View>
  );
}

export default function OnboardingWelcomeScreen() {
  const [step, setStep] = useState(0);

  function goNext() {
    setStep((prev) => Math.min(prev + 1, STEP_COUNT - 1));
  }

  // 튜토리얼을 종료하는 게 아니라 온보딩의 다음 단계인 완경 단계 설문으로 바로 이동한다.
  function skipToSurvey() {
    router.push('/onboarding/survey');
  }

  return (
    // key={step}로 단계마다 ScrollView를 새로 마운트 — 그러지 않으면 이전 단계에서 스크롤한 위치가
    // 다음 단계에도 그대로 남아, 짧은 화면에서 "다음" 버튼을 누르자마자 내용 위쪽이 잘려 보인다.
    <WarmScreen key={step} header={<ProgressHeader step={step} onSkip={skipToSurvey} />}>
      {step === 0 && (
        <View style={styles.stepBody}>
          <View style={styles.mascotWrap}>
            <View style={[styles.blob, styles.blobGreen]} />
            <Image source={ONBOARDING_IMAGES.hello} style={styles.mascotImage} contentFit="contain" />
          </View>
          <View style={styles.titleBlock}>
            <ThemedText style={styles.title}>{'안녕하세요,\n저는 봄이예요'}</ThemedText>
            <ThemedText style={styles.subtitle}>
              {'지금 몸에 일어나는 변화를\n함께 살펴보려고 왔어요.\n제가 하나씩 안내해 드릴게요.'}
            </ThemedText>
          </View>
        </View>
      )}

      {step === 1 && (
        <View style={styles.stepBody}>
          <View style={styles.mascotWrap}>
            <View style={[styles.blob, styles.blobPink]} />
            <Image source={ONBOARDING_IMAGES.together} style={styles.mascotImage} contentFit="contain" />
          </View>
          <View style={styles.titleBlock}>
            <ThemedText style={styles.title}>{'오늘 몸이 어땠는지\n남겨보세요'}</ThemedText>
            <ThemedText style={styles.subtitle}>
              {'증상, 잠, 얼굴 사진 세 가지를\n하루에 한 번씩 기록해요.'}
            </ThemedText>
          </View>
          <View style={styles.featureList}>
            {RECORD_ITEMS.map((item) => (
              <View key={item.title} style={styles.featureRow}>
                <ThemedText style={styles.featureTitle}>{item.title}</ThemedText>
                <ThemedText style={styles.featureHint}>{item.hint}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepBody}>
          <View style={styles.chatRow}>
            <Image source={ONBOARDING_IMAGES.listen} style={styles.avatarImageSmall} contentFit="contain" />
            <ChatBubble>{'궁금한 게 있으면\n저에게 편하게 물어보세요.'}</ChatBubble>
          </View>
          <View style={styles.titleBlock}>
            <ThemedText style={styles.title}>{'말로 물어보실 수도\n있어요'}</ThemedText>
            <ThemedText style={styles.subtitle}>
              {'잠이 안 올 때, 얼굴이 달아오를 때.\n무엇이든 물어보시면 아는 만큼 알려드려요.'}
            </ThemedText>
          </View>
          <View style={styles.suggestionRow}>
            {CHAT_SUGGESTIONS.map((label) => (
              <View key={label} style={styles.suggestionChip}>
                <ThemedText style={styles.suggestionChipText}>{label}</ThemedText>
              </View>
            ))}
          </View>
          <WarmInfoNote text="의료적 진단이 아니에요. 걱정되는 증상은 병원에서 확인해 보세요." />
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepBody}>
          <View style={styles.mascotWrap}>
            <View style={[styles.blob, styles.blobPink]} />
            <Image source={ONBOARDING_IMAGES.question} style={styles.mascotImage} contentFit="contain" />
          </View>
          <View style={styles.titleBlock}>
            <ThemedText style={styles.title}>{'하루 끝에 한 번,\n안부를 물어요'}</ThemedText>
            <ThemedText style={styles.subtitle}>
              {'오늘 어떠셨는지 짧게 여쭤볼게요.\n세 번만 누르면 끝나요.'}
            </ThemedText>
          </View>
          <View style={styles.moodPreview}>
            <ThemedText style={styles.moodPreviewTitle}>오늘 기분은 어떠셨어요?</ThemedText>
            <View style={styles.moodPreviewRow}>
              <View style={styles.moodPill}>
                <ThemedText style={styles.moodPillText}>좋았어요</ThemedText>
              </View>
              <View style={[styles.moodPill, styles.moodPillSelected]}>
                <ThemedText style={styles.moodPillTextSelected}>보통이에요</ThemedText>
              </View>
              <View style={styles.moodPill}>
                <ThemedText style={styles.moodPillText}>힘들었어요</ThemedText>
              </View>
            </View>
          </View>
        </View>
      )}

      {step === 4 && (
        <View style={styles.stepBody}>
          <View style={styles.chatRow}>
            <Image
              source={ONBOARDING_IMAGES.checkTogether}
              style={styles.avatarImageMedium}
              contentFit="contain"
            />
            <ChatBubble>{'하루에 이 세 가지만\n하시면 돼요.'}</ChatBubble>
          </View>
          <View style={styles.numberedList}>
            {DAILY_STEPS.map((item, index) => (
              <View key={item.title} style={styles.numberedRow}>
                <View style={styles.numberBadge}>
                  <ThemedText style={styles.numberBadgeText}>{index + 1}</ThemedText>
                </View>
                <View style={styles.numberedTextBlock}>
                  <ThemedText style={styles.featureTitle}>{item.title}</ThemedText>
                  <ThemedText style={styles.numberedBody}>{item.body}</ThemedText>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {step === 5 && (
        <View style={styles.stepBody}>
          <View style={styles.mascotWrap}>
            <View style={[styles.blob, styles.blobPink]} />
            <Image source={ONBOARDING_IMAGES.cheering} style={styles.mascotImage} contentFit="contain" />
          </View>
          <View style={styles.titleBlock}>
            <ThemedText style={styles.title}>{'이제 나의 완경 단계를\n알아볼까요?'}</ThemedText>
            <ThemedText style={styles.subtitle}>
              {'세 가지만 여쭤볼게요.\n한 화면에 하나씩 나와요.\n1분이면 끝나요.'}
            </ThemedText>
          </View>
          <WarmInfoNote text={'결과는 참고용이며\n의료적 진단이 아니에요.'} />
        </View>
      )}

      <View style={styles.spacer} />

      {step < STEP_COUNT - 1 ? (
        <WarmButton label="다음" onPress={goNext} />
      ) : (
        <WarmButton label="나의 완경 단계 알아보기" onPress={skipToSurvey} />
      )}
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  progressHeader: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    minHeight: 44,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 7,
  },
  dot: {
    width: 9,
    height: 5,
    borderRadius: 3,
    backgroundColor: DOT_INACTIVE,
  },
  dotActive: {
    width: 26,
    backgroundColor: Warm.primary,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: Warm.text,
    opacity: 0.7,
  },
  // flex:1 + justifyContent:'center'는 react-native-web에서 ScrollView 안에 중첩된 flexGrow 체인과
  // 얽히면 스크롤은 필요 없는데도(scrollHeight===clientHeight) 내용 위쪽이 잘려 보이는 버그가 있어
  // 피한다 — 다른 온보딩 화면들처럼 콘텐츠는 위에서부터 흐르게 하고 spacer(아래)가 남는 공간을 채운다.
  stepBody: {
    gap: 24,
    alignItems: 'center',
    paddingTop: 28,
  },
  mascotWrap: {
    position: 'relative',
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotImage: {
    width: 190,
    height: 190,
  },
  blob: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
  },
  blobGreen: {
    ...blobDecorationStyle(Warm.accentSoft),
  },
  blobPink: {
    ...blobDecorationStyle(Warm.secondary),
  },
  titleBlock: {
    gap: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
    color: Warm.textDeep,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: Warm.text,
    textAlign: 'center',
  },
  featureList: {
    width: '100%',
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Warm.backgroundSubtle,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Warm.textDeep,
  },
  featureHint: {
    fontSize: 15,
    color: Warm.text,
    opacity: 0.75,
  },
  avatarImageSmall: {
    width: 74,
    height: 74,
    flexShrink: 0,
  },
  avatarImageMedium: {
    width: 88,
    height: 88,
    flexShrink: 0,
  },
  chatRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  chatBubble: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    backgroundColor: Warm.backgroundSubtle,
  },
  chatBubbleText: {
    fontSize: 16,
    lineHeight: 24,
    color: Warm.text,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  suggestionChip: {
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 61, 44, 0.08)',
  },
  suggestionChipText: {
    fontSize: 15,
    fontWeight: '500',
    color: Warm.textDeep,
  },
  moodPreview: {
    width: '100%',
    gap: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: Warm.backgroundSubtle,
  },
  moodPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Warm.textDeep,
  },
  moodPreviewRow: {
    flexDirection: 'row',
    gap: 8,
  },
  moodPill: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Warm.card,
  },
  moodPillSelected: {
    backgroundColor: Warm.primary,
  },
  moodPillText: {
    fontSize: 15,
    fontWeight: '500',
    color: Warm.text,
  },
  moodPillTextSelected: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  numberedList: {
    width: '100%',
    gap: 12,
  },
  numberedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: Warm.backgroundSubtle,
  },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Warm.primary,
  },
  numberBadgeText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  numberedTextBlock: {
    flex: 1,
    gap: 4,
  },
  numberedBody: {
    fontSize: 15,
    lineHeight: 24,
    color: Warm.text,
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
});
