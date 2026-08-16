import { SymbolView } from 'expo-symbols';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmHeader } from '@/components/warm/warm-header';
import { WarmInfoNote } from '@/components/warm/warm-info-note';
import { WarmScreen } from '@/components/warm/warm-screen';
import { Warm } from '@/constants/theme';
import { ApiError, completeReminder, getTodayReminders, TodayReminder } from '@/lib/api';
import { formatTimeLabel, timeBucket, TIME_BUCKET_ORDER } from '@/lib/reminder-format';

const EXAMPLE_ROWS = [
  { label: '호르몬 치료제 · 처방약', time: '아침 8:00' },
  { label: '칼슘 · 비타민D', time: '저녁 식후' },
  { label: '오메가3 · 유산균', time: '취침 전' },
];

export default function MedicationScreen() {
  const [reminders, setReminders] = useState<TodayReminder[] | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(() => {
    getTodayReminders()
      .then((all) => setReminders(all.filter((r) => r.type === 'medication')))
      .catch((error) => {
        setErrorText(error instanceof ApiError ? error.message : '목록을 불러오지 못했어요.');
      });
  }, []);

  useFocusEffect(load);

  function openForm(reminder?: TodayReminder) {
    router.push({
      pathname: '/medication-form',
      params: reminder ? { reminder: JSON.stringify(reminder) } : {},
    });
  }

  async function toggleComplete(reminder: TodayReminder) {
    setReminders((prev) =>
      prev
        ? prev.map((r) => (r.id === reminder.id ? { ...r, completed: !r.completed } : r))
        : prev
    );
    try {
      await completeReminder(reminder.id);
    } catch {
      // 실패하면 다음 포커스 때 서버 상태로 다시 맞춰진다 — 낙관적 갱신을 되돌리지는 않는다(짧은 네트워크
      // 오류로 화면이 깜빡이는 것을 피하기 위함).
    }
  }

  const header = (
    <WarmHeader title="복약·영양제" onBack={() => router.back()} />
  );

  if (reminders === null) {
    return (
      <WarmScreen header={header}>
        {errorText ? (
          <ThemedText type="small" style={styles.errorText}>
            {errorText}
          </ThemedText>
        ) : (
          <ActivityIndicator color={Warm.primary} style={styles.loading} />
        )}
      </WarmScreen>
    );
  }

  if (reminders.length === 0) {
    return (
      <WarmScreen header={header}>
        <View style={styles.titleBlock}>
          <ThemedText style={styles.title}>챙기고 있는 약이나{'\n'}영양제가 있으세요?</ThemedText>
          <ThemedText style={styles.subtitle}>
            시간을 정해두면 그 시간에 알려드려요. 먹었는지 아닌지만 눌러두면 됩니다.
          </ThemedText>
        </View>

        <View style={styles.exampleBlock}>
          <ThemedText style={styles.exampleHeading}>이런 걸 등록하실 수 있어요</ThemedText>
          {EXAMPLE_ROWS.map((row, index) => (
            <View
              key={row.label}
              style={[styles.exampleRow, index === EXAMPLE_ROWS.length - 1 && styles.exampleRowLast]}>
              <ThemedText style={styles.exampleLabel}>{row.label}</ThemedText>
              <ThemedText style={styles.exampleTime}>{row.time}</ThemedText>
            </View>
          ))}
        </View>

        <WarmInfoNote text="복용량이나 처방 내용은 저장하지 않습니다. 이름과 시간만 기록해요." />

        <View style={styles.spacer} />
        <WarmButton label="루틴 추가하기" onPress={() => openForm()} />
      </WarmScreen>
    );
  }

  const completedCount = reminders.filter((r) => r.completed).length;
  const today = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());

  return (
    <WarmScreen header={header}>
      <View style={styles.summaryBlock}>
        <ThemedText style={styles.summaryDate}>{today}</ThemedText>
        <ThemedText style={styles.summaryHeadline}>
          {reminders.length}개 중 {completedCount}개{'\n'}챙기셨어요
        </ThemedText>
      </View>

      {TIME_BUCKET_ORDER.map((bucket) => {
        const items = reminders.filter((r) => timeBucket(r.time) === bucket);
        if (items.length === 0) return null;
        return (
          <View key={bucket} style={styles.bucketBlock}>
            <ThemedText style={styles.bucketLabel}>{bucket}</ThemedText>
            {items.map((reminder) => (
              <Pressable
                key={reminder.id}
                onPress={() => openForm(reminder)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.itemRow, pressed && styles.pressed]}>
                <Pressable
                  onPress={() => toggleComplete(reminder)}
                  accessibilityRole="button"
                  accessibilityLabel={reminder.completed ? '완료 취소' : '완료로 표시'}
                  hitSlop={8}
                  style={[styles.checkCircle, reminder.completed && styles.checkCircleDone]}>
                  {reminder.completed && (
                    <SymbolView
                      name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                      size={14}
                      tintColor="#ffffff"
                    />
                  )}
                </Pressable>
                <View style={styles.itemTextBlock}>
                  <ThemedText style={[styles.itemLabel, reminder.completed && styles.itemLabelDone]}>
                    {reminder.label}
                  </ThemedText>
                  <ThemedText style={styles.itemTime}>{formatTimeLabel(reminder.time)}</ThemedText>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'arrow_forward', web: 'arrow_forward' }}
                  size={14}
                  tintColor={Warm.textTertiary}
                />
              </Pressable>
            ))}
          </View>
        );
      })}

      <ThemedText style={styles.disclaimer}>
        놓친 날이 있어도 괜찮아요. 기록은 참고용이고, 복용 판단은 담당 의사와 상의하세요.
      </ThemedText>

      {errorText && (
        <ThemedText type="small" style={styles.errorText}>
          {errorText}
        </ThemedText>
      )}

      <View style={styles.spacer} />
      <WarmButton label="루틴 추가하기" onPress={() => openForm()} />
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  loading: {
    marginTop: 24,
  },
  errorText: {
    color: Warm.secondaryStrong,
  },
  titleBlock: {
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
    color: Warm.textDeep,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: Warm.text,
    opacity: 0.85,
  },
  exampleBlock: {
    gap: 4,
  },
  exampleHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: Warm.text,
    opacity: 0.7,
    marginBottom: 8,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  exampleRowLast: {
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  exampleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Warm.text,
  },
  exampleTime: {
    fontSize: 14,
    color: Warm.textSecondary,
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
  summaryBlock: {
    gap: 6,
  },
  summaryDate: {
    fontSize: 15,
    fontWeight: '500',
    color: Warm.text,
    opacity: 0.7,
  },
  summaryHeadline: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
    color: Warm.textDeep,
  },
  bucketBlock: {
    gap: 4,
  },
  bucketLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Warm.textDeep,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 68,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(46, 42, 36, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkCircleDone: {
    borderWidth: 0,
    backgroundColor: Warm.primary,
  },
  itemTextBlock: {
    flex: 1,
    gap: 3,
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Warm.text,
  },
  itemLabelDone: {
    opacity: 0.55,
    textDecorationLine: 'line-through',
  },
  itemTime: {
    fontSize: 14,
    color: Warm.textSecondary,
  },
  disclaimer: {
    fontSize: 14,
    lineHeight: 21,
    color: Warm.text,
    opacity: 0.6,
  },
});
