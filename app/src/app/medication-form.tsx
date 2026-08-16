import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmBottomSheet } from '@/components/warm/warm-bottom-sheet';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmHeader } from '@/components/warm/warm-header';
import { WarmScreen } from '@/components/warm/warm-screen';
import { WarmTextInput } from '@/components/warm/warm-text-input';
import { SeverityColors, Warm } from '@/constants/theme';
import { ApiError, createReminder, deleteReminder, TodayReminder, updateReminder } from '@/lib/api';
import { buildTimeValue, formatTimeLabel, parseTimeParts } from '@/lib/reminder-format';

type ReminderKind = TodayReminder['type'];

const SUGGESTED_LABELS: Record<ReminderKind, string[]> = {
  medication: ['호르몬 치료제', '칼슘', '비타민D', '오메가3', '유산균'],
  mindfulness: ['아침 스트레칭', '저녁 명상', '목·어깨 스트레칭', '호흡 정리'],
};

const TIME_PRESETS = [
  { label: '아침', hour: 8, minute: 0 },
  { label: '점심', hour: 13, minute: 0 },
  { label: '저녁', hour: 19, minute: 0 },
  { label: '취침', hour: 22, minute: 0 },
];

const MINUTE_STEP = 10;

export default function MedicationFormScreen() {
  const { reminder: reminderParam, type: typeParam } = useLocalSearchParams<{
    reminder?: string;
    type?: string;
  }>();
  const reminder: TodayReminder | null = reminderParam ? JSON.parse(reminderParam) : null;
  const isEdit = reminder !== null;
  const type: ReminderKind = reminder?.type ?? (typeParam === 'mindfulness' ? 'mindfulness' : 'medication');

  const initialTime = parseTimeParts(reminder?.time ?? '19:00:00');

  const [label, setLabel] = useState(reminder?.label ?? '');
  const [hour, setHour] = useState(initialTime.hour);
  const [minute, setMinute] = useState(initialTime.minute);
  // /today/ 목록에 뜨는 리마인더는 항상 is_active=True(TodayRemindersView 필터)라서
  // 편집 진입 시 기본값을 true로 둬도 실제 데이터와 어긋나지 않는다.
  const [isActive, setIsActive] = useState(true);
  const [timeSheetVisible, setTimeSheetVisible] = useState(false);
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const trimmedLabel = label.trim();
  const timeValue = buildTimeValue(hour, minute);

  async function handleSave() {
    if (!trimmedLabel || saving) return;
    setSaving(true);
    setErrorText(null);
    try {
      if (isEdit) {
        await updateReminder(reminder.id, { label: trimmedLabel, time: timeValue, is_active: isActive });
      } else {
        await createReminder({ type, label: trimmedLabel, time: timeValue, is_active: isActive });
      }
      router.back();
    } catch (error) {
      setErrorText(error instanceof ApiError ? error.message : '저장하지 못했어요. 다시 시도해주세요.');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || saving) return;
    setSaving(true);
    try {
      await deleteReminder(reminder.id);
      router.back();
    } catch (error) {
      setErrorText(error instanceof ApiError ? error.message : '삭제하지 못했어요. 다시 시도해주세요.');
      setSaving(false);
      setDeleteSheetVisible(false);
    }
  }

  function adjustHour(delta: number) {
    setHour((prev) => (prev + delta + 24) % 24);
  }

  function adjustMinute(delta: number) {
    setMinute((prev) => (prev + delta + 60) % 60);
  }

  return (
    <WarmScreen header={<WarmHeader title={isEdit ? '루틴 편집' : '루틴 추가'} onBack={() => router.back()} />}>
      {isEdit && (
        <Pressable
          onPress={() => setDeleteSheetVisible(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}>
          <ThemedText style={styles.deleteLinkText}>삭제</ThemedText>
        </Pressable>
      )}

      <WarmTextInput
        label="무엇을 챙기시나요?"
        value={label}
        onChangeText={setLabel}
        placeholder="예: 칼슘 · 비타민D"
      />

      <View style={styles.chipRow}>
        {SUGGESTED_LABELS[type].map((chip) => (
          <Pressable
            key={chip}
            onPress={() => setLabel(chip)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
            <ThemedText style={styles.chipText}>{chip}</ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.fieldBlock}>
        <ThemedText style={styles.fieldLabel}>시간</ThemedText>
        <Pressable
          onPress={() => setTimeSheetVisible(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.timeRow, pressed && styles.pressed]}>
          <ThemedText style={styles.timeValue}>{formatTimeLabel(timeValue)}</ThemedText>
          <ThemedText style={styles.timeChangeText}>변경</ThemedText>
        </Pressable>
        <ThemedText style={styles.helperNote}>매일 이 시간에 목록에 나타나요.</ThemedText>
      </View>

      <View style={[styles.fieldBlock, styles.toggleRow]}>
        <View style={styles.toggleTextBlock}>
          <ThemedText style={styles.fieldLabel}>목록에 표시</ThemedText>
          <ThemedText style={styles.helperNote}>꺼두면 오늘의 목록에서 빠져요.</ThemedText>
        </View>
        <Pressable
          onPress={() => setIsActive((prev) => !prev)}
          accessibilityRole="switch"
          accessibilityState={{ checked: isActive }}
          style={[styles.switchTrack, isActive && styles.switchTrackOn]}>
          <View style={[styles.switchThumb, isActive && styles.switchThumbOn]} />
        </Pressable>
      </View>

      {errorText && (
        <ThemedText type="small" style={styles.errorText}>
          {errorText}
        </ThemedText>
      )}

      <View style={styles.spacer} />
      <WarmButton label="저장하기" onPress={handleSave} />

      <WarmBottomSheet
        visible={timeSheetVisible}
        onClose={() => setTimeSheetVisible(false)}
        title="몇 시에 알려드릴까요?">
        <View style={styles.presetRow}>
          {TIME_PRESETS.map((preset) => {
            const selected = hour === preset.hour && minute === preset.minute;
            return (
              <Pressable
                key={preset.label}
                onPress={() => {
                  setHour(preset.hour);
                  setMinute(preset.minute);
                }}
                accessibilityRole="button"
                style={[styles.presetCard, selected && styles.presetCardSelected]}>
                <ThemedText style={[styles.presetLabel, selected && styles.presetLabelSelected]}>
                  {preset.label}
                </ThemedText>
                <ThemedText style={[styles.presetTime, selected && styles.presetTimeSelected]}>
                  {`${preset.hour}:${String(preset.minute).padStart(2, '0')}`}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ThemedText style={styles.customLabel}>직접 정하기</ThemedText>
        <View style={styles.stepperRow}>
          <TimeStepper value={hour} onDecrease={() => adjustHour(-1)} onIncrease={() => adjustHour(1)} />
          <ThemedText style={styles.stepperColon}>:</ThemedText>
          <TimeStepper
            value={minute}
            onDecrease={() => adjustMinute(-MINUTE_STEP)}
            onIncrease={() => adjustMinute(MINUTE_STEP)}
          />
        </View>

        <WarmButton label="이 시간으로 정하기" onPress={() => setTimeSheetVisible(false)} />
      </WarmBottomSheet>

      <WarmBottomSheet
        visible={deleteSheetVisible}
        onClose={() => setDeleteSheetVisible(false)}
        title="루틴 삭제">
        <ThemedText style={styles.deleteConfirmText}>
          {`${trimmedLabel || '이'} 루틴을 삭제할까요?`}
        </ThemedText>
        <ThemedText style={styles.deleteConfirmSub}>
          지금까지 챙긴 기록은 그대로 남고, 앞으로 목록에만 나타나지 않아요.
        </ThemedText>
        <Pressable
          onPress={handleDelete}
          accessibilityRole="button"
          style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}>
          <ThemedText style={styles.dangerButtonText}>삭제하기</ThemedText>
        </Pressable>
        <WarmButton label="그대로 두기" variant="secondary" onPress={() => setDeleteSheetVisible(false)} />
      </WarmBottomSheet>
    </WarmScreen>
  );
}

function TimeStepper({
  value,
  onDecrease,
  onIncrease,
}: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={onDecrease}
        accessibilityRole="button"
        accessibilityLabel="줄이기"
        hitSlop={8}
        style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}>
        <ThemedText style={styles.stepperButtonText}>−</ThemedText>
      </Pressable>
      <ThemedText style={styles.stepperValue}>{String(value).padStart(2, '0')}</ThemedText>
      <Pressable
        onPress={onIncrease}
        accessibilityRole="button"
        accessibilityLabel="늘리기"
        hitSlop={8}
        style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}>
        <ThemedText style={styles.stepperButtonText}>+</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  deleteLink: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
  },
  deleteLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: SeverityColors.severe.fill,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(46, 42, 36, 0.07)',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Warm.text,
    opacity: 0.8,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Warm.textDeep,
    paddingLeft: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Warm.border,
  },
  timeValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Warm.textDeep,
  },
  timeChangeText: {
    fontSize: 15,
    fontWeight: '600',
    color: Warm.primaryStrong,
  },
  helperNote: {
    fontSize: 13,
    lineHeight: 19,
    color: Warm.text,
    opacity: 0.55,
    paddingLeft: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 64,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Warm.border,
  },
  toggleTextBlock: {
    flex: 1,
    gap: 3,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(46, 42, 36, 0.16)',
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: Warm.primary,
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  errorText: {
    color: SeverityColors.severe.fill,
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetCard: {
    flex: 1,
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(46, 42, 36, 0.06)',
    alignItems: 'flex-start',
  },
  presetCardSelected: {
    backgroundColor: Warm.primary,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Warm.text,
    opacity: 0.6,
  },
  presetLabelSelected: {
    color: '#ffffff',
    opacity: 0.75,
  },
  presetTime: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.text,
    opacity: 0.8,
  },
  presetTimeSelected: {
    color: '#ffffff',
    opacity: 1,
  },
  customLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Warm.text,
    opacity: 0.7,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Warm.border,
  },
  stepper: {
    alignItems: 'center',
    gap: 8,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Warm.primarySoft,
  },
  stepperButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: Warm.primaryStrong,
  },
  stepperValue: {
    fontSize: 30,
    fontWeight: '800',
    color: Warm.textDeep,
    minWidth: 52,
    textAlign: 'center',
  },
  stepperColon: {
    fontSize: 26,
    fontWeight: '800',
    color: Warm.textDeep,
  },
  deleteConfirmText: {
    fontSize: 20,
    fontWeight: '800',
    color: Warm.textDeep,
  },
  deleteConfirmSub: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.text,
    opacity: 0.75,
  },
  dangerButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SeverityColors.severe.fill,
  },
  dangerButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
});
