import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmBottomSheet } from '@/components/warm/warm-bottom-sheet';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmCard } from '@/components/warm/warm-card';
import { WarmHeader } from '@/components/warm/warm-header';
import { WarmScreen } from '@/components/warm/warm-screen';
import { WarmSlider } from '@/components/warm/warm-slider';
import {
  CHECKIN_SCALE_LABELS,
  CHECKIN_SCALE_MAX,
  CHECKIN_SCALE_MIN,
  DEFAULT_CHECKIN_SCALE,
  SEVERITY_CYCLE,
  SYMPTOM_TYPES,
  type Severity,
  type TodaySymptomLog,
} from '@/constants/mock-data';
import { blobDecorationStyle, checkInScaleColor, SeverityColors, Warm } from '@/constants/theme';

function nextSeverity(current: Severity | undefined): Severity | undefined {
  if (!current) return SEVERITY_CYCLE[0];
  const index = SEVERITY_CYCLE.indexOf(current);
  if (index === SEVERITY_CYCLE.length - 1) return undefined;
  return SEVERITY_CYCLE[index + 1];
}

export default function SymptomLogScreen() {
  // TODO: 백엔드 연동되면 오늘 로그는 GET/POST /api/symptoms/logs/ 로 교체
  const [loggedSymptoms, setLoggedSymptoms] = useState<TodaySymptomLog>({});
  // TODO: GET/PUT /api/symptoms/checkins/today/ 로 교체
  const [checkInDone, setCheckInDone] = useState(false);
  const [sleepQuality, setSleepQuality] = useState(DEFAULT_CHECKIN_SCALE);
  const [mood, setMood] = useState(DEFAULT_CHECKIN_SCALE);
  const [sheetVisible, setSheetVisible] = useState(false);

  const loggedCount = Object.keys(loggedSymptoms).length;

  function cycleSymptom(code: string) {
    setLoggedSymptoms((prev) => {
      const next = { ...prev };
      const severity = nextSeverity(prev[code]);
      if (severity) {
        next[code] = severity;
      } else {
        delete next[code];
      }
      return next;
    });
  }

  function handleSaveCheckIn() {
    setCheckInDone(true);
    setSheetVisible(false);
  }

  return (
    <WarmScreen header={<WarmHeader title="증상 기록" variant="minimal" onBack={() => router.back()} />}>
      {/* 1. 오늘 상태 — 가장 큰 정보 단위 */}
      <View style={styles.statusBlock}>
        <View style={styles.statusBlob} />
        <ThemedText style={styles.statusEyebrow}>오늘 상태</ThemedText>
        <ThemedText style={styles.statusHeadline}>
          {loggedCount === 0
            ? '오늘 기록한 증상이 아직 없어요'
            : `오늘 ${loggedCount}개 증상을 기록했어요`}
        </ThemedText>
        <View style={styles.statusChipRow}>
          <View style={[styles.statusChip, checkInDone && styles.statusChipDone]}>
            <ThemedText style={[styles.statusChipText, checkInDone && styles.statusChipTextDone]}>
              {checkInDone ? '✓ 저녁 체크인 완료' : '저녁 체크인 아직이에요'}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* 2. 증상 항목 — 중간 크기 정보 단위, 원터치 기록 */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>지금 느끼는 게 있으면 눌러주세요</ThemedText>
        <ThemedText style={styles.sectionHint}>
          한 번 누르면 기록돼요. 다시 누르면 얼마나 심한지 표시할 수 있어요.
        </ThemedText>
        <View style={styles.symptomGrid}>
          {SYMPTOM_TYPES.map((symptom) => {
            const severity = loggedSymptoms[symptom.code];
            const colors = severity ? SeverityColors[severity] : null;
            return (
              <Pressable
                key={symptom.code}
                onPress={() => cycleSymptom(symptom.code)}
                accessibilityRole="button"
                accessibilityLabel={
                  severity
                    ? `${symptom.label}, ${SeverityColors[severity].label}으로 기록됨`
                    : `${symptom.label} 기록하기`
                }
                style={({ pressed }) => [
                  styles.symptomButton,
                  {
                    backgroundColor: colors?.soft ?? Warm.backgroundSubtle,
                    borderColor: colors?.fill ?? 'transparent',
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={styles.symptomLabel}>{symptom.label}</ThemedText>
                {/* 3. 상세 — 가장 작은 정보 단위(심각도), 색만이 아니라 텍스트로도 표시 */}
                {severity ? (
                  <View style={styles.severityChip}>
                    <View style={[styles.severityDot, { backgroundColor: colors!.fill }]} />
                    <ThemedText style={styles.severityChipText}>{colors!.label}</ThemedText>
                  </View>
                ) : (
                  <View style={styles.severityChipPlaceholder} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 저녁 체크인 진입 — 바텀시트로 오픈, 입력 부담 최소화(수면·기분 2개뿐) */}
      <Pressable
        onPress={() => setSheetVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="저녁 체크인 입력하기">
        {({ pressed }) => (
          <WarmCard bordered={false} style={pressed ? styles.pressed : undefined}>
            <View style={styles.checkInRow}>
              <View style={styles.checkInIcon}>
                <SymbolView
                  name={{ ios: 'moon.fill', android: 'bedtime', web: 'bedtime' }}
                  size={22}
                  tintColor={Warm.primaryStrong}
                />
              </View>
              <View style={styles.checkInTextBlock}>
                <ThemedText style={styles.cardTitle}>저녁 체크인</ThemedText>
                <ThemedText style={styles.checkInSubtext}>
                  {checkInDone ? '오늘 체크인을 완료했어요' : '수면과 기분만 간단히 기록해요'}
                </ThemedText>
              </View>
              <ThemedText style={styles.checkInArrow}>
                {checkInDone ? '수정 →' : '입력하기 →'}
              </ThemedText>
            </View>
          </WarmCard>
        )}
      </Pressable>

      <View style={styles.spacer} />

      {loggedCount > 0 && <ThemedText style={styles.selectedCount}>{loggedCount}가지 선택됨</ThemedText>}
      <WarmButton label="완료" onPress={() => router.back()} />

      <WarmBottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} title="저녁 체크인">
        <ThemedText style={styles.sheetIntro}>오늘 하루가 어떠셨나요? 딱 두 가지만 알려주세요.</ThemedText>

        <WarmSlider
          label="잠은 잘 주무셨나요?"
          min={CHECKIN_SCALE_MIN}
          max={CHECKIN_SCALE_MAX}
          value={sleepQuality}
          onChange={setSleepQuality}
          trackColorForValue={checkInScaleColor}
          formatValue={(v) => CHECKIN_SCALE_LABELS[v - 1]}
          minLabel="매우 나쁨"
          maxLabel="매우 좋음"
        />

        <WarmSlider
          label="오늘 기분은 어떠세요?"
          min={CHECKIN_SCALE_MIN}
          max={CHECKIN_SCALE_MAX}
          value={mood}
          onChange={setMood}
          trackColorForValue={checkInScaleColor}
          formatValue={(v) => CHECKIN_SCALE_LABELS[v - 1]}
          minLabel="매우 나쁨"
          maxLabel="매우 좋음"
        />

        <WarmButton label="저장하고 완료" onPress={handleSaveCheckIn} />
      </WarmBottomSheet>
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  statusBlock: {
    gap: 6,
    position: 'relative',
  },
  statusBlob: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 140,
    height: 140,
    borderRadius: 999,
    ...blobDecorationStyle(Warm.accentSoft),
  },
  statusEyebrow: {
    fontSize: 14,
    fontWeight: '700',
    color: Warm.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusHeadline: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 32,
    color: Warm.textDeep,
  },
  statusChipRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Warm.secondarySoft,
  },
  statusChipDone: {
    backgroundColor: Warm.primarySoft,
  },
  statusChipText: {
    // primarySoft/secondarySoft 배경 모두 위에서 항상 4.5:1 이상을 확보하는 text(캐롭) 고정 사용.
    fontSize: 16,
    fontWeight: '700',
    color: Warm.text,
  },
  statusChipTextDone: {
    color: Warm.text,
  },
  section: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Warm.textDeep,
  },
  sectionHint: {
    fontSize: 16,
    lineHeight: 22,
    color: Warm.textSecondary,
    marginBottom: 10,
  },
  symptomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  symptomButton: {
    width: '31%',
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  symptomLabel: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: Warm.text,
  },
  severityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  severityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  severityChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Warm.text,
  },
  severityChipPlaceholder: {
    height: 20,
  },
  pressed: {
    opacity: 0.7,
  },
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkInIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Warm.primarySoft,
  },
  checkInTextBlock: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  checkInSubtext: {
    fontSize: 16,
    color: Warm.textSecondary,
  },
  checkInArrow: {
    fontSize: 15,
    fontWeight: '700',
    color: Warm.primaryStrong,
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: '500',
    color: Warm.textSecondary,
    textAlign: 'center',
  },
  sheetIntro: {
    fontSize: 16,
    lineHeight: 23,
    color: Warm.textSecondary,
  },
});
