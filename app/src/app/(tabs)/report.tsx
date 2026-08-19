import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmScreen } from '@/components/warm/warm-screen';
import { blobDecorationStyle, Warm } from '@/constants/theme';
import {
  ApiError,
  getWeeklyReport,
  listCheckIns,
  listSymptomLogs,
  type CareSignalReason,
  type DailyCheckInEntry,
  type SkinLink,
  type SleepLink,
  type SymptomBreakdownRow,
  type SymptomLogEntry,
  type WeeklyReport,
  type WeeklyReportStats,
} from '@/lib/api';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

// 리포트 전용 마스코트 — 온보딩 이미지(assets/images/onboarding/)와 별도로 관리한다.
// 신규 사용자(기록 0건) / 기록 부족(3일 미만) 상태 화면 공통으로 쓴다.
const REPORT_MASCOT_IMAGE = require('@/assets/images/report/mascot-state.png');

// 시안 문구("3일만 기록해도 흐름이 보이기 시작해요")를 그대로 기준값으로 쓴다 — 별도 기획 임계값이 없어서
// 복잡한 규칙을 새로 만들지 않고 시안이 이미 제시한 숫자를 따른다.
const MIN_DAYS_FOR_FULL_VIEW = 3;

// 증상 랭킹 막대의 기준 스케일. 이 기간의 1위 횟수를 그대로 분모로 쓰면 모든 증상이
// 1회뿐인 주에도 막대가 100%까지 차 실제보다 심각해 보인다 — 하루 한 번(주 7회) 수준은
// 돼야 막대가 꽉 찬다고 보고, 그 미만인 주는 분모를 이 값으로 고정해 압축한다.
// 1위가 이 값 이상이면 기존처럼 서로 다른 증상 간 상대적 차이가 그대로 보인다.
const SYMPTOM_BAR_SCALE_FLOOR = 7;

// ---- 날짜 계산 ----
// occurred_at은 UTC ISO 문자열(DRF 기본 직렬화, settings.USE_TZ=True)이라, 백엔드가
// timezone.localtime()으로 요일을 계산하는 것과 맞추려면 Asia/Seoul 기준으로 다시 변환해야 한다.
const KST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });

function kstDateKey(date: Date) {
  return KST_DATE_FORMATTER.format(date);
}

// week_start는 DateField(달력 날짜, 시각 없음)라 타임존 변환이 필요 없다 — 순수 캘린더 연산.
function addDays(dateStr: string, offset: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offset));
  return dt.toISOString().slice(0, 10);
}

function buildWeekDates(weekStart: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

// backend/apps/symptoms/analysis.py의 week_bounds와 동일한 월요일 기준 계산 — "다음 주" 버튼을
// 미래로 넘어가지 못하게 막는 기준점으로 쓴다.
function currentWeekMonday() {
  const todayKey = kstDateKey(new Date());
  const [y, m, d] = todayKey.split('-').map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 월=0 ~ 일=6
  return addDays(todayKey, -weekday);
}

// ---- 요일별 값 배열 ----
function buildDailyHotFlashCounts(logs: SymptomLogEntry[], weekDates: string[]) {
  const countByKey = new Map(weekDates.map((d) => [d, 0]));
  for (const log of logs) {
    if (log.symptom_type_detail.code !== 'hot_flash') continue;
    const key = kstDateKey(new Date(log.occurred_at));
    if (countByKey.has(key)) {
      countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
    }
  }
  return weekDates.map((d) => countByKey.get(d) ?? 0);
}

function buildDailySleepHours(checkIns: DailyCheckInEntry[], weekDates: string[]) {
  const byDate = new Map(checkIns.map((c) => [c.date, c.sleep_hours != null ? Number(c.sleep_hours) : null]));
  return weekDates.map((d) => byDate.get(d) ?? null);
}

// ---- 표기 헬퍼 ----
function formatShortRange(start: string, end: string) {
  const [, sm, sd] = start.split('-');
  const [, em, ed] = end.split('-');
  return `${Number(sm)}/${Number(sd)} ~ ${Number(em)}/${Number(ed)}`;
}

function formatLongRange(start: string, end: string) {
  const [, sm, sd] = start.split('-');
  const [, em, ed] = end.split('-');
  return `${Number(sm)}월 ${Number(sd)}일 ~ ${Number(em)}월 ${Number(ed)}일`;
}

function weekNavLabel(weekStart: string, thisMonday: string) {
  const diffWeeks = Math.round((Date.parse(thisMonday) - Date.parse(weekStart)) / (7 * 86400000));
  return diffWeeks <= 0 ? '최근 1주' : `${diffWeeks}주 전`;
}

function formatHoursMinutes(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

// 이번 주 vs 지난주 비교 없이, 이 기간 안에서 가장 눈에 띄는 사실 하나만 고른다.
// 여러 문장을 조합하지 않는 이유: 시안은 말풍선 한 줄 분량을 요구했고, 조합형 문장은
// 데이터 조합이 늘어날 때마다 분기가 같이 늘어나 유지보수가 어려워진다.
function buildInsightLine(stats: WeeklyReportStats): string | null {
  const hotFlash = stats.symptoms.find((s) => s.code === 'hot_flash');
  if (hotFlash && hotFlash.peak_slot_label) {
    return `${hotFlash.label}는 주로 ${hotFlash.peak_slot_label} 시간대에 기록됐어요.`;
  }
  if (stats.sleep_link && stats.sleep_link.difference !== 0) {
    const direction = stats.sleep_link.difference > 0 ? '많았어요' : '적었어요';
    return `잘 못 잔 날 다음에는 증상 기록이 하루 평균 ${Math.abs(stats.sleep_link.difference)}개 더 ${direction}.`;
  }
  if (hotFlash && hotFlash.count > 0) {
    return `이 기간 ${hotFlash.label}를 ${hotFlash.count}회 기록했어요.`;
  }
  return null;
}

// care_signal.reasons[].label은 백엔드가 붙인 원문이라 기술적으로 읽힐 수 있어, code 기준으로
// 시니어 친화적 문구로 다시 매핑한다. 모르는 code가 오면 label을 그대로 쓰고 경고만 남긴다.
const CARE_SIGNAL_LABELS: Record<
  string,
  { title: string; formatValue: (value: number) => string; formatThreshold: (threshold: number) => string }
> = {
  hot_flash_frequency: {
    title: '홍조 횟수',
    formatValue: (value) => `주 ${value}회`,
    formatThreshold: (threshold) => `기준 ${threshold}회`,
  },
  poor_sleep: {
    title: '잘 못 주무신 날',
    formatValue: (value) => `${value}일`,
    formatThreshold: (threshold) => `기준 ${threshold}일 이상`,
  },
  low_mood: {
    title: '기분이 가라앉은 날',
    formatValue: (value) => `${value}일`,
    formatThreshold: (threshold) => `기준 ${threshold}일 이상`,
  },
};

function describeCareReason(reason: CareSignalReason) {
  const mapping = CARE_SIGNAL_LABELS[reason.code];
  if (!mapping) {
    console.warn(`[report] care_signal에 알 수 없는 code가 왔어요: ${reason.code}`);
    return { title: reason.label, value: String(reason.value), threshold: `기준 ${reason.threshold}` };
  }
  return {
    title: mapping.title,
    value: mapping.formatValue(reason.value),
    threshold: mapping.formatThreshold(reason.threshold),
  };
}

const HOT_FLASH_BAR_COLOR = Warm.secondary;
const SLEEP_BAR_COLOR = Warm.primary;
const BAR_NO_DATA_COLOR = 'rgba(46,42,36,0.14)';
const BAR_MAX_HEIGHT = 96;
const BAR_MIN_HEIGHT = 8;
const BAR_FLOOR_HEIGHT = 3; // 기록 없는 날: 막대 대신 얇은 바닥선

function WeekBarChart({
  weekDates,
  todayKey,
  values,
  max,
  barColor,
  height = BAR_MAX_HEIGHT,
}: {
  weekDates: string[];
  todayKey: string;
  values: (number | null)[];
  max: number;
  barColor: (value: number, index: number) => string;
  height?: number;
}) {
  return (
    <View>
      <View style={[styles.barRow, { height }]}>
        {values.map((value, index) => {
          const hasValue = value != null;
          const ratio = hasValue && max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
          const barHeight = hasValue ? BAR_MIN_HEIGHT + ratio * (height - BAR_MIN_HEIGHT) : BAR_FLOOR_HEIGHT;
          return (
            <View
              key={weekDates[index]}
              style={[
                styles.bar,
                {
                  height: barHeight,
                  backgroundColor: hasValue ? barColor(value, index) : BAR_NO_DATA_COLOR,
                  borderRadius: hasValue ? 6 : 2,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <ThemedText
            key={label}
            style={[
              styles.weekdayLabel,
              weekDates[index] === todayKey && styles.weekdayLabelToday,
              values[index] == null && styles.weekdayLabelDim,
            ]}>
            {label}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

function WeekNavBar({
  label,
  rangeLabel,
  onPrev,
  onNext,
  nextDisabled,
}: {
  label: string;
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled: boolean;
}) {
  return (
    <View style={styles.weekNav}>
      <Pressable onPress={onPrev} accessibilityLabel="이전 주로 이동" style={styles.weekNavButton}>
        <SymbolView
          name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
          size={16}
          tintColor={Warm.primaryStrong}
        />
      </Pressable>
      <View style={styles.weekNavCenter}>
        <ThemedText style={styles.weekNavLabel}>{label}</ThemedText>
        <ThemedText style={styles.weekNavRange}>{rangeLabel}</ThemedText>
      </View>
      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        accessibilityLabel="다음 주로 이동"
        style={[styles.weekNavButton, nextDisabled && styles.weekNavButtonDisabled]}>
        <SymbolView
          name={{ ios: 'chevron.right', android: 'arrow_forward', web: 'arrow_forward' }}
          size={16}
          tintColor={nextDisabled ? Warm.textTertiary : Warm.primaryStrong}
        />
      </Pressable>
    </View>
  );
}

// 홍조는 이 리포트의 메인 지표라 요일별 막대그래프로 크게 보여준다. 피부(홍조) 점수는 사진을 찍은
// 날에만 채워지는 별도 출처라 그래프로 나란히 두면 두 그래프가 서로 다른 걸 재는데도 같은 비중으로
// 보여 헷갈린다 — 평균 점수 한 줄만 작게 보조로 붙인다.
function HotFlashSection({
  hotFlashDaily,
  weekDates,
  todayKey,
  skinLink,
}: {
  hotFlashDaily: number[];
  weekDates: string[];
  todayKey: string;
  skinLink: SkinLink;
}) {
  const values = hotFlashDaily.map((v) => (v > 0 ? v : null));
  const total = hotFlashDaily.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...hotFlashDaily);
  const peakIndex = values.reduce<number>(
    (best, v, i) => (v != null && (best === -1 || v > (values[best] ?? -1)) ? i : best),
    -1
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <ThemedText style={styles.sectionTitle}>홍조</ThemedText>
        <ThemedText style={styles.sectionHeaderValue}>이 기간 {total}회 기록</ThemedText>
      </View>
      <ThemedText style={styles.sectionDescription}>직접 남기신 홍조 기록이에요.</ThemedText>

      <WeekBarChart weekDates={weekDates} todayKey={todayKey} values={values} max={max} barColor={() => HOT_FLASH_BAR_COLOR} />

      <View style={styles.sectionFooterRow}>
        {peakIndex >= 0 ? (
          <ThemedText style={styles.sectionFooterText}>
            가장 많았던 날 {WEEKDAY_LABELS[peakIndex]}요일 {values[peakIndex]}회
          </ThemedText>
        ) : (
          <ThemedText style={styles.sectionFooterText}>홍조를 기록하시면 요일별 패턴을 보여드려요.</ThemedText>
        )}
      </View>

      {skinLink && (
        <View style={styles.skinScoreChip}>
          <ThemedText style={styles.skinScoreChipLabel}>사진 기준 평균 피부 점수</ThemedText>
          <ThemedText style={styles.skinScoreChipValue}>{skinLink.average_redness}점</ThemedText>
        </View>
      )}
    </View>
  );
}

function SleepSection({
  checkIns,
  weekDates,
  todayKey,
  avgSleepHours,
  sleepLink,
}: {
  checkIns: DailyCheckInEntry[];
  weekDates: string[];
  todayKey: string;
  avgSleepHours: number | null;
  sleepLink: SleepLink;
}) {
  const values = buildDailySleepHours(checkIns, weekDates);
  const recordedDays = values.filter((v) => v != null).length;
  const max = Math.max(1, ...values.filter((v): v is number => v != null));

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <ThemedText style={styles.sectionTitle}>수면 시간</ThemedText>
        <ThemedText style={styles.sectionHeaderValue}>{recordedDays}일 기록</ThemedText>
      </View>
      <ThemedText style={styles.sectionDescription}>체크인에 남기신 잠든 시간이에요.</ThemedText>

      {avgSleepHours != null && (
        <View style={styles.statChip}>
          <ThemedText style={styles.statChipLabel}>하루 평균</ThemedText>
          <ThemedText style={styles.statChipValue}>{formatHoursMinutes(avgSleepHours)}</ThemedText>
        </View>
      )}

      <WeekBarChart weekDates={weekDates} todayKey={todayKey} values={values} max={max} barColor={() => SLEEP_BAR_COLOR} />

      {sleepLink && (
        <View style={styles.statChipRow}>
          <View style={[styles.statChip, styles.statChipHalf]}>
            <ThemedText style={styles.statChipLabel}>잘 못 잔 날</ThemedText>
            <ThemedText style={styles.statChipValueSmall}>{sleepLink.poor_sleep_days}일</ThemedText>
          </View>
          <View style={[styles.statChip, styles.statChipHalf]}>
            <ThemedText style={styles.statChipLabel}>푹 잔 날</ThemedText>
            <ThemedText style={styles.statChipValueSmall}>{sleepLink.good_sleep_days}일</ThemedText>
          </View>
        </View>
      )}
    </View>
  );
}

function TopSymptomsSection({ symptoms }: { symptoms: SymptomBreakdownRow[] }) {
  const ranked = symptoms.filter((s) => s.count > 0).slice(0, 5);

  if (ranked.length === 0) {
    return (
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>가장 많이 기록된 증상</ThemedText>
        <ThemedText style={styles.sectionDescription}>이 기간에 기록된 증상이 없어요.</ThemedText>
      </View>
    );
  }

  const max = Math.max(ranked[0].count, SYMPTOM_BAR_SCALE_FLOOR);
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>가장 많이 기록된 증상</ThemedText>
      <ThemedText style={styles.sectionDescription}>이 기간에 남긴 기록을 횟수 순으로 모았어요.</ThemedText>
      <View style={styles.symptomList}>
        {ranked.map((row) => (
          <View key={row.code} style={styles.symptomRow}>
            <View style={styles.symptomRowHeader}>
              <ThemedText style={styles.symptomLabel}>
                {row.emoji} {row.label}
              </ThemedText>
              <ThemedText style={styles.symptomCount}>{row.count}회</ThemedText>
            </View>
            <View style={styles.symptomBarTrack}>
              <View style={[styles.symptomBarFill, { width: `${Math.max(6, (row.count / max) * 100)}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function SparseBanner({ daysRecorded }: { daysRecorded: number }) {
  const remaining = Math.max(0, MIN_DAYS_FOR_FULL_VIEW - daysRecorded);
  return (
    <View style={styles.sparseBanner}>
      <Image source={REPORT_MASCOT_IMAGE} style={styles.sparseMascotImage} contentFit="contain" />
      <ThemedText style={styles.sparseBannerTitle}>7일 중 {daysRecorded}일 기록</ThemedText>
      <View style={styles.sparseDotsRow}>
        {WEEKDAY_LABELS.map((_, index) => (
          <View key={index} style={[styles.sparseDot, index < daysRecorded && styles.sparseDotFilled]} />
        ))}
      </View>
      {remaining > 0 && (
        <ThemedText style={styles.sparseBannerText}>{remaining}일 더 채우면 전체 흐름을 볼 수 있어요.</ThemedText>
      )}
    </View>
  );
}

// 장식용 자리표시 막대 — 실제 수치가 아니라 "기록이 쌓이면 이렇게 채워진다"는 형태만 보여준다.
const PLACEHOLDER_BAR_RATIOS = [0.3, 0.52, 0.38, 0.64, 0.44, 0.56, 0.34];

function PlaceholderGraphCard({ title, caption }: { title: string; caption: string }) {
  return (
    <View style={styles.placeholderCard}>
      <ThemedText style={styles.placeholderTitle}>{title}</ThemedText>
      <View style={[styles.barRow, { height: 66 }]}>
        {PLACEHOLDER_BAR_RATIOS.map((ratio, index) => (
          <View
            key={index}
            style={[styles.bar, { height: BAR_MIN_HEIGHT + ratio * (66 - BAR_MIN_HEIGHT), backgroundColor: BAR_NO_DATA_COLOR }]}
          />
        ))}
      </View>
      <ThemedText style={styles.placeholderCaption}>{caption}</ThemedText>
    </View>
  );
}

function EmptyReportState({ onLogPress }: { onLogPress: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Image source={REPORT_MASCOT_IMAGE} style={styles.emptyMascotImage} contentFit="contain" />
      <ThemedText style={styles.emptyText}>기록이 모이면 여기에 최근 1주일 동안의 변화가 그려져요.</ThemedText>
      <ThemedText style={styles.sectionTitle}>여기에 그려질 내용</ThemedText>
      <PlaceholderGraphCard title="홍조" caption="증상을 기록하시면 채워져요" />
      <PlaceholderGraphCard title="수면 시간" caption="잠든 시각과 깬 시각을 남기시면 채워져요" />
      <WarmButton label="첫 기록 남기기" onPress={onLogPress} />
    </View>
  );
}

export default function ReportScreen() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [logs, setLogs] = useState<SymptomLogEntry[]>([]);
  const [checkIns, setCheckIns] = useState<DailyCheckInEntry[]>([]);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'loaded'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  // chat.tsx의 createChatSession().then().catch() 패턴과 동일 — async/await로 쓰면 eslint
  // (react-hooks/set-state-in-effect)가 await 이후의 setState도 effect 본문 동기 호출로 오인해 flag한다.
  const load = useCallback((week?: string) => {
    getWeeklyReport(week ? { week } : undefined)
      .then((weeklyReport) => {
        const range = { from: weeklyReport.stats.week_start, to: weeklyReport.stats.week_end };
        return Promise.all([listSymptomLogs(range), listCheckIns(range)]).then(([weekLogs, weekCheckIns]) => {
          setReport(weeklyReport);
          setLogs(weekLogs);
          setCheckIns(weekCheckIns);
          setWeekStart(weeklyReport.stats.week_start);
          setStatus('loaded');
        });
      })
      .catch((error) => {
        setErrorMessage(
          error instanceof ApiError ? error.message : '리포트를 불러오지 못했어요. 다시 시도해주세요.'
        );
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleRetry() {
    setStatus('loading');
    load(weekStart ?? undefined);
  }

  function handlePrevWeek(currentWeekStart: string) {
    setStatus('loading');
    load(addDays(currentWeekStart, -7));
  }

  function handleNextWeek(currentWeekStart: string) {
    setStatus('loading');
    load(addDays(currentWeekStart, 7));
  }

  if (status === 'loading') {
    return (
      <WarmScreen scrollable={false}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={Warm.primary} size="large" />
        </View>
      </WarmScreen>
    );
  }

  if (status === 'error' || !report) {
    return (
      <WarmScreen scrollable={false}>
        <View style={styles.centerFill}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          <WarmButton label="다시 시도" onPress={handleRetry} variant="secondary" style={styles.retryButton} />
        </View>
      </WarmScreen>
    );
  }

  const { stats } = report;
  const weekDates = buildWeekDates(stats.week_start);
  const todayKey = kstDateKey(new Date());
  const thisMonday = currentWeekMonday();
  const isCurrentWeek = stats.week_start === thisMonday;

  const hotFlashDaily = buildDailyHotFlashCounts(logs, weekDates);
  const sleepHours = stats.check_in_averages.sleep_hours;

  // skin_link는 사진만 있어도 채워지는 별도 출처라, days_recorded/total_logs(증상·체크인 기준)만
  // 보고 empty로 판정하면 사진만 남긴 주가 "기록 없음"으로 잘못 표시된다.
  const isEmpty = stats.days_recorded === 0 && stats.total_logs === 0 && !stats.skin_link;
  const isSparse = !isEmpty && stats.days_recorded < MIN_DAYS_FOR_FULL_VIEW;

  const headline = isEmpty
    ? isCurrentWeek
      ? '오늘도 나를\n돌아봐요'
      : '이 기간엔 기록이 없었어요'
    : isCurrentWeek
      ? '최근 1주일 동안의\n내 상태'
      : `${formatShortRange(stats.week_start, stats.week_end)} 기록`;

  const insightLine = !isEmpty ? buildInsightLine(stats) : null;

  return (
    <WarmScreen>
      <View style={styles.page}>
        <WeekNavBar
          label={weekNavLabel(stats.week_start, thisMonday)}
          rangeLabel={formatShortRange(stats.week_start, stats.week_end)}
          onPrev={() => handlePrevWeek(stats.week_start)}
          onNext={() => handleNextWeek(stats.week_start)}
          nextDisabled={isCurrentWeek}
        />

        <View style={styles.header}>
          <View style={styles.headerBlob} />
          <View style={styles.headerTextBlock}>
            <ThemedText style={styles.headerTitle}>{headline}</ThemedText>
            <ThemedText style={styles.headerSubtitle}>
              {formatLongRange(stats.week_start, stats.week_end)} · 7일 중 {stats.days_recorded}일 기록
            </ThemedText>
            {report.showing_other_week && (
              <ThemedText style={styles.headerNotice}>
                이번 주는 기록이 없어 최근 기록이 있는 주를 보여드리고 있어요.
              </ThemedText>
            )}
          </View>
        </View>

        {isEmpty ? (
          <EmptyReportState onLogPress={() => router.push('/symptom-log')} />
        ) : (
          <>
            {isSparse && <SparseBanner daysRecorded={stats.days_recorded} />}

            {insightLine && (
              <View style={styles.insightCallout}>
                <ThemedText style={styles.insightCalloutText}>{insightLine}</ThemedText>
              </View>
            )}

            <HotFlashSection
              hotFlashDaily={hotFlashDaily}
              weekDates={weekDates}
              todayKey={todayKey}
              skinLink={stats.skin_link}
            />

            <SleepSection
              checkIns={checkIns}
              weekDates={weekDates}
              todayKey={todayKey}
              avgSleepHours={sleepHours}
              sleepLink={stats.sleep_link}
            />

            <TopSymptomsSection symptoms={stats.symptoms} />

            {stats.care_signal.suggested && (
              <View style={styles.careSignalBlock}>
                <ThemedText style={styles.careSignalTitle}>의사 선생님과 이야기해 볼 만한 기록이 있어요</ThemedText>
                <ThemedText style={styles.careSignalBody}>
                  걱정하실 내용은 아니에요. 다음에 병원에 가실 일이 있으면 아래 기록을 보여드리면 도움이 됩니다.
                </ThemedText>
                <View style={styles.careReasonList}>
                  {stats.care_signal.reasons.map((reason, index) => {
                    const info = describeCareReason(reason);
                    return (
                      <View
                        key={reason.code}
                        style={[styles.careReasonRow, index > 0 && styles.careReasonRowDivider]}>
                        <ThemedText style={styles.careReasonLabel}>{info.title}</ThemedText>
                        <View style={styles.careReasonValueRow}>
                          <ThemedText style={styles.careReasonValue}>{info.value}</ThemedText>
                          <ThemedText style={styles.careReasonThreshold}>{info.threshold}</ThemedText>
                        </View>
                      </View>
                    );
                  })}
                </View>
                <ThemedText style={styles.careSignalFootnote}>
                  기준은 일반적인 참고값이며, 넘었다고 해서 이상이 있다는 뜻은 아닙니다.
                </ThemedText>
              </View>
            )}
          </>
        )}

        <ThemedText style={styles.disclaimer}>
          이 리포트는 건강 참고 정보이며 의료 진단이 아닙니다. 증상이 지속되거나 걱정되시면 전문의와
          상담하세요.
        </ThemedText>

        <WarmButton label="자기돌봄 추천 보기" onPress={() => router.push('/care')} />
      </View>
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
  errorText: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.text,
    textAlign: 'center',
  },
  retryButton: {
    minWidth: 160,
  },
  // WarmScreen.inner가 이미 paddingHorizontal:20을 주므로 +6 해서 시안의 좌우 26px을 맞춘다.
  page: {
    paddingHorizontal: 6,
  },

  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 56,
    padding: 6,
    borderRadius: 16,
    backgroundColor: Warm.backgroundSubtle,
    marginBottom: 22,
  },
  weekNavButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Warm.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavButtonDisabled: {
    opacity: 0.4,
  },
  weekNavCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  weekNavLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  weekNavRange: {
    fontSize: 13,
    color: Warm.text,
    opacity: 0.7,
  },

  header: {
    position: 'relative',
    marginBottom: 28,
  },
  headerBlob: {
    position: 'absolute',
    right: -40,
    top: -30,
    width: 160,
    height: 160,
    borderRadius: 999,
    opacity: 0.4,
    ...blobDecorationStyle(Warm.secondary),
  },
  headerTextBlock: {
    gap: 8,
  },
  headerTitle: {
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 36.5,
    color: Warm.textDeep,
  },
  headerSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    color: Warm.text,
    opacity: 0.8,
  },
  headerNotice: {
    fontSize: 13,
    lineHeight: 19,
    color: Warm.textSecondary,
  },

  insightCallout: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: Warm.primarySoft,
    marginBottom: 30,
  },
  insightCalloutText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: Warm.textDeep,
  },

  sparseBanner: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: Warm.primarySoft,
    gap: 12,
    marginBottom: 30,
  },
  sparseMascotImage: {
    width: 96,
    height: 96,
    alignSelf: 'center',
  },
  sparseBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  sparseDotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sparseDot: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(15,61,44,0.18)',
  },
  sparseDotFilled: {
    backgroundColor: Warm.primary,
  },
  sparseBannerText: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.textDeep,
    opacity: 0.85,
  },

  emptyState: {
    gap: 16,
    marginBottom: 12,
  },
  emptyMascotImage: {
    width: 160,
    height: 160,
    alignSelf: 'center',
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 24,
    color: Warm.text,
    marginBottom: 4,
  },
  placeholderCard: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: Warm.backgroundSubtle,
    gap: 12,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Warm.textDeep,
  },
  placeholderCaption: {
    fontSize: 14,
    lineHeight: 20,
    color: Warm.text,
    opacity: 0.7,
  },

  section: {
    marginBottom: 36,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  sectionHeaderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Warm.text,
    opacity: 0.8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: Warm.text,
    opacity: 0.7,
    marginBottom: 16,
  },
  sectionFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  sectionFooterText: {
    fontSize: 13,
    lineHeight: 19,
    color: Warm.text,
    opacity: 0.75,
  },

  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
  },
  bar: {
    flex: 1,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: Warm.text,
    opacity: 0.7,
  },
  weekdayLabelToday: {
    fontWeight: '700',
    color: Warm.textDeep,
    opacity: 1,
  },
  weekdayLabelDim: {
    opacity: 0.35,
  },

  skinScoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: Warm.backgroundSubtle,
  },
  skinScoreChipLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Warm.text,
    opacity: 0.75,
  },
  skinScoreChipValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Warm.textDeep,
  },

  statChip: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: Warm.backgroundSubtle,
    gap: 4,
    marginBottom: 14,
  },
  statChipRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statChipHalf: {
    flex: 1,
    marginBottom: 0,
  },
  statChipLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Warm.text,
    opacity: 0.8,
  },
  statChipValue: {
    fontSize: 26,
    fontWeight: '800',
    color: Warm.textDeep,
  },
  statChipValueSmall: {
    fontSize: 18,
    fontWeight: '700',
    color: Warm.textDeep,
  },

  symptomList: {
    gap: 14,
  },
  symptomRow: {
    gap: 7,
  },
  symptomRowHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  symptomLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Warm.textDeep,
  },
  symptomCount: {
    fontSize: 14,
    fontWeight: '500',
    color: Warm.text,
    opacity: 0.8,
  },
  symptomBarTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(46,42,36,0.08)',
  },
  symptomBarFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: Warm.accentSoft,
  },

  careSignalBlock: {
    backgroundColor: '#F0F2E8',
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 20,
    gap: 14,
    marginBottom: 24,
  },
  careSignalTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26.1,
    color: Warm.textDeep,
  },
  careSignalBody: {
    fontSize: 15,
    lineHeight: 24.75,
    color: Warm.text,
  },
  careReasonList: {
    backgroundColor: Warm.card,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  careReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 58,
  },
  careReasonRowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(46,42,36,0.12)',
  },
  careReasonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Warm.text,
  },
  careReasonValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  careReasonValue: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  careReasonThreshold: {
    fontSize: 13,
    color: Warm.text,
    opacity: 0.6,
  },
  careSignalFootnote: {
    fontSize: 13,
    lineHeight: 20.15,
    color: Warm.text,
    opacity: 0.62,
  },

  disclaimer: {
    fontSize: 14,
    lineHeight: 20,
    color: Warm.textSecondary,
    marginBottom: 22,
  },
});
