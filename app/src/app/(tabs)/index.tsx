import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmBottomSheet } from '@/components/warm/warm-bottom-sheet';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmCard } from '@/components/warm/warm-card';
import { WarmScreen } from '@/components/warm/warm-screen';
import { WarmSlider } from '@/components/warm/warm-slider';
import {
  CHECKIN_SCALE_LABELS,
  CHECKIN_SCALE_MAX,
  CHECKIN_SCALE_MIN,
  DEFAULT_CHECKIN_SCALE,
  MOCK_ROUTINE_STATUS,
} from '@/constants/mock-data';
import { blobDecorationStyle, checkInScaleColor, Warm } from '@/constants/theme';
import {
  ApiError,
  getTodayCheckIn,
  getTodayReminders,
  getTodaySummary,
  getWeeklyReport,
  listFaceAnalyses,
  patchTodayCheckIn,
  type FaceAnalysisResult,
  type TodayReminder,
  type TodaySummary,
  type WeeklyReportStats,
} from '@/lib/api';

// 홈 전용 마스코트 이미지 — report.tsx의 REPORT_MASCOT_IMAGE와 별도로 관리한다.
const HOME_CHAT_MASCOT_IMAGE = require('@/assets/images/home/chat.png');
const HOME_NEW_USER_MASCOT_IMAGE = require('@/assets/images/home/new-user-home.png');

// symptom-log.tsx/report.tsx/care.tsx와 동일한 KST 날짜 계산 — created_at 등은 UTC ISO 문자열이라
// 자정 근처의 "오늘" 판정이 문자열 슬라이싱으로는 어긋난다.
const KST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });
function kstToday() {
  return KST_DATE_FORMATTER.format(new Date());
}

const TODAY_HEADER_LABEL = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(new Date());

function formatHoursMinutes(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

function ChevronRight({ color }: { color: string }) {
  return (
    <SymbolView
      name={{ ios: 'chevron.right', android: 'arrow_forward', web: 'arrow_forward' }}
      size={16}
      tintColor={color}
    />
  );
}

function CheckDot({ done, tone }: { done: boolean; tone: 'accent' | 'default' }) {
  if (!done) {
    return (
      <View
        style={[
          styles.recordDot,
          { borderColor: tone === 'accent' ? 'rgba(110, 59, 38, 0.45)' : 'rgba(15, 61, 44, 0.4)' },
        ]}
      />
    );
  }
  return (
    <View style={[styles.recordDot, styles.recordDotDone]}>
      <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={15} tintColor="#ffffff" />
    </View>
  );
}

type RecordRowProps = {
  title: string;
  subtitle: string;
  completed: boolean;
  tone: 'accent' | 'default';
  onPress: () => void;
};

// 홈 "오늘의 기록" 그룹의 증상·수면·사진 3개 행 — 완료 여부(completed)는 항상 실제 API 응답으로만 결정한다.
function RecordRow({ title, subtitle, completed, tone, onPress }: RecordRowProps) {
  const accentTone = tone === 'accent';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${completed ? '완료' : '미완료'}`}
      style={({ pressed }) => [
        styles.recordRow,
        { backgroundColor: accentTone ? Warm.secondarySoft : Warm.backgroundSubtle },
        pressed && styles.pressed,
      ]}>
      <CheckDot done={completed} tone={tone} />
      <View style={styles.recordTextBlock}>
        <ThemedText style={[styles.recordTitle, { color: accentTone ? Warm.secondaryStrong : Warm.textDeep }]}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.recordSubtitle, { color: accentTone ? Warm.secondaryStrong : Warm.text }]}>
          {subtitle}
        </ThemedText>
      </View>
      <ChevronRight color={accentTone ? Warm.secondaryStrong : Warm.textDeep} />
    </Pressable>
  );
}

type PhotoStatus = { completedToday: boolean; lastDate: string | null };

function computePhotoStatus(list: FaceAnalysisResult[]): PhotoStatus {
  if (list.length === 0) return { completedToday: false, lastDate: null };
  let latest = list[0];
  for (const item of list) {
    if (Date.parse(item.created_at) > Date.parse(latest.created_at)) latest = item;
  }
  const latestKstDate = KST_DATE_FORMATTER.format(new Date(latest.created_at));
  return { completedToday: latestKstDate === kstToday(), lastDate: latestKstDate };
}

function symptomSubtitle(summary: TodaySummary | null) {
  if (!summary) return '불러오는 중…';
  return summary.symptom.completed
    ? `오늘 ${summary.symptom.count}번 기록했어요`
    : '지금 느끼는 게 있으면 눌러서 기록해보세요';
}

function sleepSubtitle(summary: TodaySummary | null) {
  if (!summary) return '불러오는 중…';
  return summary.sleep.completed && summary.sleep.sleep_hours !== null
    ? `${formatHoursMinutes(summary.sleep.sleep_hours)} 주무신 것으로 기록했어요`
    : '어젯밤 잠은 어떠셨어요?';
}

function photoSubtitle(status: PhotoStatus | null) {
  if (!status) return '불러오는 중…';
  if (status.completedToday) return '오늘 촬영을 완료했어요';
  if (status.lastDate === null) return '아직 촬영한 사진이 없어요 · 첫 사진을 남겨보세요';
  const days = Math.max(0, Math.round((Date.parse(kstToday()) - Date.parse(status.lastDate)) / 86400000));
  return `마지막 촬영 ${days}일 전 · 주 1~2회면 충분해요`;
}

function moodLabelFromAverage(mood: number | null): string {
  if (mood === null) return '기록 없음';
  const index = Math.min(CHECKIN_SCALE_MAX, Math.max(CHECKIN_SCALE_MIN, Math.round(mood))) - 1;
  return CHECKIN_SCALE_LABELS[index];
}

const SLEEP_HOURS_MIN = 0;
const SLEEP_HOURS_MAX = 12;
const SLEEP_HOURS_STEP = 0.5;
const DEFAULT_SLEEP_HOURS = 7;

export default function HomeScreen() {
  const [medicationReminders, setMedicationReminders] = useState<TodayReminder[] | null>(null);
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyReportStats | null>(null);

  const [sleepSheetVisible, setSleepSheetVisible] = useState(false);
  const [sleepHours, setSleepHours] = useState(DEFAULT_SLEEP_HOURS);
  const [sleepQuality, setSleepQuality] = useState(DEFAULT_CHECKIN_SCALE);
  const [savingSleep, setSavingSleep] = useState(false);
  const [sleepError, setSleepError] = useState<string | null>(null);

  // 홈은 탭 루트라 마운트된 채로 유지되므로, 다른 화면을 다녀온 뒤 카드 상태가 그대로 남지 않도록
  // 포커스될 때마다 다시 불러온다. 각 요청은 독립적으로 실패해도(비로그인 등) 조용히 미완료/빈 상태로
  // 남아 화면이 깨지지 않게 한다 — 하나로 묶어 기다리면 느린 API 하나가 전체를 막는다.
  useFocusEffect(
    useCallback(() => {
      getTodayReminders()
        .then((all) => setMedicationReminders(all.filter((r) => r.type === 'medication')))
        .catch(() => {});
      getTodaySummary()
        .then(setSummary)
        .catch(() => {});
      listFaceAnalyses()
        .then((list) => setPhotoStatus(computePhotoStatus(list)))
        .catch(() => {});
      getWeeklyReport()
        .then((report) => setWeeklyStats(report.stats))
        .catch(() => {});
    }, [])
  );

  const medicationTotal = medicationReminders?.length ?? 0;
  const medicationCompleted = medicationReminders?.filter((r) => r.completed).length ?? 0;
  const medicationAllDone = medicationTotal > 0 && medicationCompleted === medicationTotal;
  const medicationActionText =
    medicationTotal === 0 ? '등록하기' : medicationAllDone ? '완료' : `${medicationCompleted}/${medicationTotal} 완료`;

  const recordDoneCount = summary
    ? [summary.symptom.completed, summary.sleep.completed, summary.checkin.completed].filter(Boolean).length
    : 0;

  // 데이터가 전부 로드됐고, 오늘 아무 기록도 없고, 등록해둔 복약 리마인더도 없으면 "처음 오신 분"으로
  // 본다 — 별도 백엔드 신호가 없어 실제 API로 확인 가능한 값만으로 판단한다.
  const dataLoaded = medicationReminders !== null && summary !== null;
  const isNewUser =
    dataLoaded &&
    medicationTotal === 0 &&
    summary!.symptom.count === 0 &&
    !summary!.sleep.completed &&
    !summary!.checkin.completed;

  function openSleepSheet() {
    setSleepHours(summary?.sleep.sleep_hours ?? DEFAULT_SLEEP_HOURS);
    setSleepQuality(DEFAULT_CHECKIN_SCALE);
    setSleepError(null);
    setSleepSheetVisible(true);
    // sleep_quality는 today-summary에 없어 필요할 때만 getTodayCheckIn으로 따로 채운다.
    getTodayCheckIn()
      .then((res) => {
        if (res.check_in) setSleepQuality(res.check_in.sleep_quality);
      })
      .catch(() => {});
  }

  function handleSaveSleep() {
    if (savingSleep) return;
    setSavingSleep(true);
    setSleepError(null);
    patchTodayCheckIn({ sleep_hours: sleepHours, sleep_quality: sleepQuality as 1 | 2 | 3 | 4 | 5 })
      .then(() => {
        setSleepSheetVisible(false);
        getTodaySummary().then(setSummary).catch(() => {});
      })
      .catch((error) => {
        setSleepError(error instanceof ApiError ? error.message : '저장하지 못했어요. 다시 시도해주세요.');
      })
      .finally(() => setSavingSleep(false));
  }

  const hotFlashRow = weeklyStats?.symptoms.find((s) => s.code === 'hot_flash');
  const weeklyIsEmpty = weeklyStats ? weeklyStats.days_recorded === 0 && weeklyStats.total_logs === 0 : true;
  const avgSleepHours = weeklyStats?.check_in_averages.sleep_hours ?? null;
  const avgMood = weeklyStats?.check_in_averages.mood ?? null;

  return (
    <WarmScreen>
      <View style={styles.heroBlock}>
        <View style={styles.heroBlob} />
        <ThemedText style={styles.heroDate}>{TODAY_HEADER_LABEL}</ThemedText>
        {isNewUser ? (
          <>
            <ThemedText style={styles.heroTitle}>{'오늘도 나를\n돌아봐요'}</ThemedText>
            <View style={styles.newUserRow}>
              <Image source={HOME_NEW_USER_MASCOT_IMAGE} style={styles.newUserMascot} contentFit="contain" />
              <View style={styles.newUserBubble}>
                <ThemedText style={styles.newUserBubbleText}>
                  첫 기록을 남겨보실까요? 오늘 몸이 어땠는지만 알려주시면 돼요.
                </ThemedText>
              </View>
            </View>
          </>
        ) : (
          <>
            <ThemedText style={styles.heroTitle}>{'오늘도 잘\n지내고 계신가요?'}</ThemedText>
            <ThemedText style={styles.heroText}>
              {summary === null
                ? '오늘의 기록을 불러오는 중이에요'
                : summary.symptom.count > 0
                  ? `오늘 증상을 ${summary.symptom.count}번 기록했어요`
                  : '오늘 기록한 증상이 아직 없어요'}
            </ThemedText>
          </>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText style={styles.sectionTitle}>오늘의 기록</ThemedText>
          <ThemedText style={styles.sectionHeaderMeta}>3개 중 {recordDoneCount}개</ThemedText>
        </View>

        <View style={styles.recordGroup}>
          <RecordRow
            title="증상 기록하기"
            subtitle={symptomSubtitle(summary)}
            completed={summary?.symptom.completed ?? false}
            tone="default"
            onPress={() => router.push('/symptom-log')}
          />
          <RecordRow
            title="수면 시간 기록"
            subtitle={sleepSubtitle(summary)}
            completed={summary?.sleep.completed ?? false}
            tone="default"
            onPress={openSleepSheet}
          />
          <RecordRow
            title="얼굴 사진 기록"
            subtitle={photoSubtitle(photoStatus)}
            completed={photoStatus?.completedToday ?? false}
            tone="default"
            onPress={() => router.push('/face-capture')}
          />
        </View>
        <ThemedText style={styles.recordFootnote}>세 가지 기록이 모이면 리포트에서 함께 볼 수 있어요.</ThemedText>
      </View>

      {!weeklyIsEmpty && (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>이번 주 내 몸 이야기</ThemedText>

          <Pressable
            onPress={() => router.push('/report')}
            accessibilityRole="button"
            style={({ pressed }) => [pressed && styles.pressed]}>
            <WarmCard>
              <ThemedText style={styles.statLabel}>홍조</ThemedText>
              <View style={styles.hotFlashValueRow}>
                <ThemedText style={styles.hotFlashValue}>{hotFlashRow?.count ?? 0}</ThemedText>
                <ThemedText style={styles.hotFlashUnit}>회</ThemedText>
              </View>

              <View style={styles.subStatRow}>
                <View style={styles.subStatCard}>
                  <ThemedText style={styles.statLabel}>수면</ThemedText>
                  <ThemedText style={styles.subStatValue}>
                    {avgSleepHours !== null ? formatHoursMinutes(avgSleepHours) : '–'}
                  </ThemedText>
                </View>
                <View style={styles.subStatCard}>
                  <ThemedText style={styles.statLabel}>기분</ThemedText>
                  <ThemedText style={styles.subStatValue}>{moodLabelFromAverage(avgMood)}</ThemedText>
                </View>
              </View>

              <ThemedText style={styles.trendNote}>
                이번 주 {weeklyStats!.days_recorded}일 기록했어요.
              </ThemedText>

              <View style={styles.cardFooterRow}>
                <ThemedText style={styles.cardFooterLabel}>자세히 보기</ThemedText>
                <ChevronRight color={Warm.textDeep} />
              </View>
            </WarmCard>
          </Pressable>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText style={styles.sectionTitle}>오늘의 루틴</ThemedText>
          <Pressable onPress={() => router.push('/medication')} accessibilityRole="button" hitSlop={8}>
            <ThemedText style={styles.sectionHeaderLink}>루틴 설정</ThemedText>
          </Pressable>
        </View>
        <WarmCard style={styles.noPad}>
          <Pressable
            onPress={() => router.push('/medication')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.routineRow, pressed && styles.pressed]}>
            <View style={[styles.routineDot, medicationAllDone && styles.routineDotDone]}>
              {medicationAllDone && (
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={16}
                  tintColor="#ffffff"
                />
              )}
            </View>
            <ThemedText style={styles.routineLabel}>복약·영양제</ThemedText>
            <ThemedText style={[styles.routineAction, !medicationAllDone && styles.routineActionEmphasis]}>
              {medicationActionText}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.push('/care')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.routineRow, pressed && styles.pressed]}>
            <View
              style={[styles.routineDot, MOCK_ROUTINE_STATUS.meditationDoneToday && styles.routineDotDone]}>
              {MOCK_ROUTINE_STATUS.meditationDoneToday && (
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={16}
                  tintColor="#ffffff"
                />
              )}
            </View>
            <ThemedText style={styles.routineLabel}>명상·스트레칭</ThemedText>
            <ThemedText
              style={[
                styles.routineAction,
                !MOCK_ROUTINE_STATUS.meditationDoneToday && styles.routineActionEmphasis,
              ]}>
              {MOCK_ROUTINE_STATUS.meditationDoneToday ? '완료' : '시작하기'}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.push({ pathname: '/medication-form', params: { type: 'medication' } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.routineRow, styles.routineRowLast, pressed && styles.pressed]}>
            <View style={styles.routineAddIcon}>
              <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={15} tintColor={Warm.primary} />
            </View>
            <ThemedText style={styles.routineLabel}>약·영양제 추가하기</ThemedText>
            <ChevronRight color={Warm.textDeep} />
          </Pressable>
        </WarmCard>
      </View>

      <Pressable
        onPress={() => router.push('/chat')}
        accessibilityRole="button"
        style={({ pressed }) => [pressed && styles.pressed]}>
        <WarmCard bordered={false} style={styles.noPad}>
          <View style={styles.iconRow}>
            <Image source={HOME_CHAT_MASCOT_IMAGE} style={styles.chatMascotImage} contentFit="contain" />
            <View style={styles.chatTextBlock}>
              <ThemedText style={styles.iconRowLabel}>봄이와 이야기 나누기</ThemedText>
              <ThemedText style={styles.chatSubtext}>편하게 말씀해 보세요</ThemedText>
            </View>
            <ChevronRight color={Warm.textDeep} />
          </View>
        </WarmCard>
      </Pressable>

      <WarmButton
        label={summary?.checkin.completed ? '저녁 체크인 완료 · 다시 보기' : '저녁 체크인 하기'}
        variant={summary?.checkin.completed ? 'secondary' : 'primary'}
        onPress={() => router.push('/symptom-log')}
      />

      <WarmBottomSheet visible={sleepSheetVisible} onClose={() => setSleepSheetVisible(false)} title="수면 시간 기록">
        <ThemedText style={styles.sheetIntro}>어젯밤 총 몇 시간 주무셨는지 알려주세요.</ThemedText>

        <WarmSlider
          label="몇 시간 주무셨어요?"
          min={SLEEP_HOURS_MIN}
          max={SLEEP_HOURS_MAX}
          step={SLEEP_HOURS_STEP}
          value={sleepHours}
          onChange={setSleepHours}
          trackColorForValue={() => Warm.primary}
          formatValue={formatHoursMinutes}
          minLabel="0시간"
          maxLabel="12시간"
        />

        <WarmSlider
          label="잠은 푹 자셨어요?"
          min={CHECKIN_SCALE_MIN}
          max={CHECKIN_SCALE_MAX}
          value={sleepQuality}
          onChange={setSleepQuality}
          trackColorForValue={checkInScaleColor}
          formatValue={(v) => CHECKIN_SCALE_LABELS[v - 1]}
          minLabel="거의 못 잤어요"
          maxLabel="푹 잤어요"
        />

        {sleepError && <ThemedText style={styles.inlineErrorText}>{sleepError}</ThemedText>}

        <WarmButton label={savingSleep ? '저장하는 중…' : '기록 저장하기'} onPress={handleSaveSleep} />
      </WarmBottomSheet>
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  noPad: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 0,
  },
  heroBlock: {
    position: 'relative',
    gap: 8,
  },
  heroBlob: {
    position: 'absolute',
    right: 0,
    top: -40,
    width: 130,
    height: 130,
    borderRadius: 999,
    ...blobDecorationStyle(Warm.accentSoft),
  },
  heroDate: {
    fontSize: 15,
    fontWeight: '500',
    color: Warm.textSecondary,
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 32,
    color: Warm.textDeep,
  },
  heroText: {
    fontSize: 17,
    lineHeight: 24,
    color: Warm.text,
  },
  newUserRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  newUserMascot: {
    width: 88,
    aspectRatio: 351 / 317,
  },
  newUserBubble: {
    flex: 1,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    padding: 16,
    backgroundColor: Warm.backgroundSubtle,
  },
  newUserBubbleText: {
    fontSize: 16,
    lineHeight: 23,
    color: Warm.text,
  },
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  sectionHeaderMeta: {
    fontSize: 15,
    fontWeight: '500',
    color: Warm.textSecondary,
  },
  sectionHeaderLink: {
    fontSize: 15,
    fontWeight: '600',
    color: Warm.textDeep,
    minHeight: 44,
    textAlignVertical: 'center',
  },
  recordGroup: {
    gap: 8,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
  },
  recordDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recordDotDone: {
    borderWidth: 0,
    backgroundColor: Warm.primary,
  },
  recordTextBlock: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  recordTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  recordSubtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  recordFootnote: {
    fontSize: 15,
    lineHeight: 21,
    color: Warm.textSecondary,
  },
  statLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Warm.text,
  },
  hotFlashValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  hotFlashValue: {
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 44,
    color: Warm.textDeep,
  },
  hotFlashUnit: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    color: Warm.text,
  },
  subStatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  subStatCard: {
    flex: 1,
    gap: 4,
    borderRadius: 18,
    padding: 16,
    backgroundColor: Warm.backgroundSubtle,
  },
  subStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  trendNote: {
    fontSize: 16,
    lineHeight: 23,
    color: Warm.textSecondary,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  cardFooterLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  routineRowLast: {
    borderBottomWidth: 0,
  },
  routineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(15, 61, 44, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  routineDotDone: {
    borderWidth: 0,
    backgroundColor: Warm.primary,
  },
  routineAddIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Warm.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  routineLabel: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: Warm.text,
  },
  routineAction: {
    fontSize: 16,
    fontWeight: '600',
    color: Warm.textSecondary,
    flexShrink: 0,
  },
  routineActionEmphasis: {
    fontWeight: '700',
    color: Warm.textDeep,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 68,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  chatMascotImage: {
    height: 60,
    aspectRatio: 471 / 552,
    flexShrink: 0,
  },
  chatTextBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  iconRowLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Warm.text,
  },
  chatSubtext: {
    fontSize: 15,
    color: Warm.textSecondary,
  },
  sheetIntro: {
    fontSize: 16,
    lineHeight: 23,
    color: Warm.textSecondary,
  },
  inlineErrorText: {
    fontSize: 14,
    lineHeight: 20,
    color: Warm.secondaryStrong,
  },
});
