import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmHeader } from '@/components/warm/warm-header';
import { WarmScreen } from '@/components/warm/warm-screen';
import { Warm } from '@/constants/theme';
import { completeReminder, getTodayReminders, type MindfulnessSession } from '@/lib/api';

export default function MindfulnessSessionScreen() {
  const { session: sessionParam } = useLocalSearchParams<{ session: string }>();
  const session: MindfulnessSession = JSON.parse(sessionParam);

  const [stepIndex, setStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(session.steps[0].seconds);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const hasMarkedComplete = useRef(false);

  const step = session.steps[stepIndex];
  const isLastStep = stepIndex === session.steps.length - 1;

  useEffect(() => {
    if (isPaused || isFinished) {
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) {
          return prev - 1;
        }
        if (isLastStep) {
          setIsFinished(true);
          return 0;
        }
        setStepIndex((i) => i + 1);
        return session.steps[stepIndex + 1].seconds;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused, isFinished, stepIndex, isLastStep, session.steps]);

  // 세션을 끝까지 마치면, 오늘 아직 안 한 명상·스트레칭 리마인더가 있으면 완료 처리한다 --
  // 실패해도(오늘 그런 리마인더가 없거나 요청 에러) 완료 화면은 그대로 보여준다. 필수 경로 아님.
  useEffect(() => {
    if (!isFinished || hasMarkedComplete.current) {
      return;
    }
    hasMarkedComplete.current = true;
    getTodayReminders()
      .then((reminders) => {
        const target = reminders.find((r) => r.type === 'mindfulness' && !r.completed);
        return target ? completeReminder(target.id) : undefined;
      })
      .catch(() => {});
  }, [isFinished]);

  function handleSkip() {
    if (isLastStep) {
      setIsFinished(true);
      return;
    }
    setStepIndex((i) => i + 1);
    setSecondsLeft(session.steps[stepIndex + 1].seconds);
  }

  if (isFinished) {
    return (
      <WarmScreen scrollable={false} header={<WarmHeader title={session.title} variant="minimal" onBack={() => router.back()} />}>
        <View style={styles.doneCenter}>
          <View style={styles.doneBadge}>
            <ThemedText style={styles.doneBadgeText}>✓</ThemedText>
          </View>
          <ThemedText style={styles.doneTitle}>수고하셨어요!</ThemedText>
          <ThemedText style={styles.doneText}>{session.title}을(를) 마쳤어요</ThemedText>
        </View>
        <WarmButton label="닫기" onPress={() => router.back()} />
      </WarmScreen>
    );
  }

  return (
    <WarmScreen scrollable={false} header={<WarmHeader title={session.title} variant="minimal" onBack={() => router.back()} />}>
      <View style={styles.progressRow}>
        {session.steps.map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= stepIndex && styles.progressDotDone]} />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.stepLabel}>
        {stepIndex + 1} / {session.steps.length} 단계
      </ThemedText>

      <View style={styles.mascotWrap}>
        <Mascot pose={step.pose} />
      </View>

      <View style={styles.instructionBlock}>
        <ThemedText style={styles.instruction}>{step.instruction}</ThemedText>
        <ThemedText style={styles.timer}>{secondsLeft}초</ThemedText>
      </View>

      <View style={styles.controlsRow}>
        <Pressable
          onPress={() => setIsPaused((p) => !p)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}>
          <ThemedText style={styles.controlButtonText}>{isPaused ? '이어하기' : '잠시 멈추기'}</ThemedText>
        </Pressable>
        <Pressable
          onPress={handleSkip}
          accessibilityRole="button"
          style={({ pressed }) => [styles.controlButton, styles.controlButtonPrimary, pressed && styles.pressed]}>
          <ThemedText style={[styles.controlButtonText, styles.controlButtonPrimaryText]}>다음 동작</ThemedText>
        </Pressable>
      </View>
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Warm.backgroundSubtle,
  },
  progressDotDone: {
    backgroundColor: Warm.primary,
  },
  stepLabel: {
    textAlign: 'center',
  },
  mascotWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionBlock: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  instruction: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
    textAlign: 'center',
    color: Warm.textDeep,
  },
  timer: {
    fontSize: 44,
    fontWeight: '800',
    color: Warm.primaryStrong,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  controlButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Warm.card,
    borderWidth: 1.5,
    borderColor: Warm.border,
  },
  controlButtonPrimary: {
    backgroundColor: Warm.primary,
    borderWidth: 0,
  },
  controlButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.text,
  },
  controlButtonPrimaryText: {
    color: '#ffffff',
  },
  doneCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  doneBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Warm.primarySoft,
    marginBottom: 6,
  },
  doneBadgeText: {
    fontSize: 30,
    fontWeight: '800',
    color: Warm.primaryStrong,
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Warm.textDeep,
  },
  doneText: {
    fontSize: 16,
    color: Warm.text,
  },
});
