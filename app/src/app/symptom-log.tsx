import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

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
  type Severity,
} from '@/constants/mock-data';
import { blobDecorationStyle, checkInScaleColor, SeverityColors, Warm } from '@/constants/theme';
import {
  ApiError,
  createSymptomLog,
  deleteSymptomLog,
  getTodayCheckIn,
  listSymptomLogs,
  listSymptomTypes,
  saveTodayCheckIn,
  type SymptomLogEntry,
  type SymptomTypeSummary,
} from '@/lib/api';

// report.tsx/care.tsx와 동일한 KST 날짜 계산 — occurred_at은 UTC ISO 문자열이라 자정 근처 기록의
// "오늘" 판정이 문자열 슬라이싱으로는 어긋난다.
const KST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });
function kstToday() {
  return KST_DATE_FORMATTER.format(new Date());
}

const SEVERITY_TO_API: Record<Severity, 1 | 2 | 3> = { mild: 1, moderate: 2, severe: 3 };
const API_TO_SEVERITY: Record<1 | 2 | 3, Severity> = { 1: 'mild', 2: 'moderate', 3: 'severe' };

function nextSeverity(current: Severity | undefined): Severity | undefined {
  if (!current) return SEVERITY_CYCLE[0];
  const index = SEVERITY_CYCLE.indexOf(current);
  if (index === SEVERITY_CYCLE.length - 1) return undefined;
  return SEVERITY_CYCLE[index + 1];
}

// 같은 증상에 오늘 기록이 여러 건이면(예: 챗봇 소급 기록과 겹침) 가장 최근 것만 버튼에 반영한다 —
// 목록은 백엔드가 -occurred_at 순으로 내려주므로 코드별로 처음 만나는 항목이 최신이다.
function latestLogByCode(logs: SymptomLogEntry[]): Record<string, SymptomLogEntry> {
  const map: Record<string, SymptomLogEntry> = {};
  for (const log of logs) {
    const code = log.symptom_type_detail.code;
    if (!(code in map)) {
      map[code] = log;
    }
  }
  return map;
}

export default function SymptomLogScreen() {
  const [status, setStatus] = useState<'loading' | 'error' | 'loaded'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [symptomTypes, setSymptomTypes] = useState<SymptomTypeSummary[]>([]);
  const [loggedSymptoms, setLoggedSymptoms] = useState<Record<string, SymptomLogEntry>>({});
  const [pendingCodes, setPendingCodes] = useState<Set<string>>(new Set());
  const [symptomError, setSymptomError] = useState<string | null>(null);

  const [checkInDone, setCheckInDone] = useState(false);
  const [sleepQuality, setSleepQuality] = useState(DEFAULT_CHECKIN_SCALE);
  const [mood, setMood] = useState(DEFAULT_CHECKIN_SCALE);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [savingCheckIn, setSavingCheckIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  // report.tsx의 .then/.catch 패턴과 동일 — async/await로 쓰면 eslint(react-hooks/set-state-in-effect)가
  // await 이후의 setState도 effect 본문 동기 호출로 오인해 flag한다.
  const load = useCallback(() => {
    const today = kstToday();
    Promise.all([listSymptomTypes(), listSymptomLogs({ from: today, to: today }), getTodayCheckIn()])
      .then(([types, logs, todayCheckIn]) => {
        setSymptomTypes(types);
        setLoggedSymptoms(latestLogByCode(logs));
        setCheckInDone(todayCheckIn.completed);
        if (todayCheckIn.check_in) {
          setSleepQuality(todayCheckIn.check_in.sleep_quality);
          setMood(todayCheckIn.check_in.mood);
        }
        setStatus('loaded');
      })
      .catch((error) => {
        setErrorMessage(
          error instanceof ApiError ? error.message : '기록을 불러오지 못했어요. 다시 시도해주세요.'
        );
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleRetry() {
    setStatus('loading');
    load();
  }

  // 백엔드에 증상 기록 수정(PATCH)이 없어 심각도를 바꿀 때도 삭제 후 재생성한다. 생성보다 삭제를
  // 먼저 해야 생성이 실패해도 같은 증상이 두 건 남아 주간 집계가 이중으로 잡히는 일이 없다.
  // 실패하면 수동으로 되돌리는 대신 오늘 기록을 서버에서 다시 불러와 진짜 상태로 맞춘다.
  function cycleSymptom(typeDef: SymptomTypeSummary) {
    const code = typeDef.code;
    if (pendingCodes.has(code)) return;

    const current = loggedSymptoms[code];
    const currentSeverity = current ? API_TO_SEVERITY[current.severity] : undefined;
    const nextUi = nextSeverity(currentSeverity);

    setSymptomError(null);
    setPendingCodes((prev) => new Set(prev).add(code));

    let action: Promise<SymptomLogEntry | null>;
    if (!nextUi) {
      action = deleteSymptomLog(current!.id).then(() => null);
    } else if (current) {
      action = deleteSymptomLog(current.id).then(() =>
        createSymptomLog({ symptom_type: typeDef.id, severity: SEVERITY_TO_API[nextUi] })
      );
    } else {
      action = createSymptomLog({ symptom_type: typeDef.id, severity: SEVERITY_TO_API[nextUi] });
    }

    action
      .then((entry) => {
        setLoggedSymptoms((prev) => {
          const next = { ...prev };
          if (entry) {
            next[code] = entry;
          } else {
            delete next[code];
          }
          return next;
        });
      })
      .catch((error) => {
        setSymptomError(
          error instanceof ApiError ? error.message : '기록을 저장하지 못했어요. 다시 시도해주세요.'
        );
        const today = kstToday();
        listSymptomLogs({ from: today, to: today })
          .then((logs) => setLoggedSymptoms(latestLogByCode(logs)))
          .catch(() => {});
      })
      .finally(() => {
        setPendingCodes((prev) => {
          const next = new Set(prev);
          next.delete(code);
          return next;
        });
      });
  }

  function handleSaveCheckIn() {
    if (savingCheckIn) return;
    setSavingCheckIn(true);
    setCheckInError(null);
    saveTodayCheckIn({ sleep_quality: sleepQuality as 1 | 2 | 3 | 4 | 5, mood: mood as 1 | 2 | 3 | 4 | 5 })
      .then((result) => {
        setCheckInDone(result.completed);
        if (result.check_in) {
          setSleepQuality(result.check_in.sleep_quality);
          setMood(result.check_in.mood);
        }
        setSheetVisible(false);
      })
      .catch((error) => {
        setCheckInError(
          error instanceof ApiError ? error.message : '체크인을 저장하지 못했어요. 다시 시도해주세요.'
        );
      })
      .finally(() => setSavingCheckIn(false));
  }

  if (status === 'loading') {
    return (
      <WarmScreen
        header={<WarmHeader title="증상 기록" variant="minimal" onBack={() => router.back()} />}
        scrollable={false}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Warm.primary} size="large" />
        </View>
      </WarmScreen>
    );
  }

  if (status === 'error') {
    return (
      <WarmScreen
        header={<WarmHeader title="증상 기록" variant="minimal" onBack={() => router.back()} />}
        scrollable={false}>
        <View style={styles.centerFill}>
          <ThemedText style={styles.loadErrorText}>{errorMessage}</ThemedText>
          <WarmButton label="다시 시도" onPress={handleRetry} variant="secondary" style={styles.retryButton} />
        </View>
      </WarmScreen>
    );
  }

  const loggedCount = Object.keys(loggedSymptoms).length;

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
        {symptomError && <ThemedText style={styles.inlineErrorText}>{symptomError}</ThemedText>}
        <View style={styles.symptomGrid}>
          {symptomTypes.map((symptom) => {
            const entry = loggedSymptoms[symptom.code];
            const severity = entry ? API_TO_SEVERITY[entry.severity] : undefined;
            const colors = severity ? SeverityColors[severity] : null;
            const isPending = pendingCodes.has(symptom.code);
            return (
              <Pressable
                key={symptom.code}
                onPress={() => cycleSymptom(symptom)}
                disabled={isPending}
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
                  (pressed || isPending) && styles.pressed,
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

        {checkInError && <ThemedText style={styles.inlineErrorText}>{checkInError}</ThemedText>}

        <WarmButton label={savingCheckIn ? '저장하는 중…' : '저장하고 완료'} onPress={handleSaveCheckIn} />
      </WarmBottomSheet>
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadErrorText: {
    fontSize: 16,
    lineHeight: 23,
    color: Warm.text,
    textAlign: 'center',
  },
  retryButton: {
    minWidth: 160,
  },
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
  inlineErrorText: {
    fontSize: 14,
    lineHeight: 20,
    color: Warm.secondaryStrong,
    marginBottom: 8,
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
