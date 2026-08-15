import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmScreen } from '@/components/warm/warm-screen';
import { CHECKIN_SCALE_LABELS } from '@/constants/mock-data';
import { Warm } from '@/constants/theme';
import {
  ApiError,
  getWeeklyReport,
  listCheckIns,
  listSymptomLogs,
  type CareSignalReason,
  type DailyCheckInEntry,
  type SkinLink,
  type SymptomBreakdownRow,
  type SymptomLogEntry,
  type WeeklyReport,
} from '@/lib/api';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

// occurred_at은 UTC ISO 문자열(DRF 기본 직렬화, settings.USE_TZ=True)이라, 백엔드가
// timezone.localtime()으로 요일/시간대를 계산하는 것과 맞추려면 Asia/Seoul 기준으로 다시 변환해야 한다.
// 문자열 슬라이싱은 자정 근처 기록(예: KST 00:30 = UTC 전날 15:30)을 잘못된 날짜로 집계하므로 쓰지 않는다.
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

function buildDailySkinScores(skinLink: SkinLink, weekDates: string[]) {
  const byDate = new Map((skinLink?.days ?? []).map((d) => [d.date, d.redness_score]));
  return weekDates.map((d) => byDate.get(d) ?? null);
}

// 그 주 최댓값의 70% 이상이면 진한 색, 그 아래 0 초과 값은 옅은 색, 값이 없거나 0이면 데이터 없음 스타일.
// "가장 심했던/가장 적었던 날"처럼 해석을 붙이지 않고 크기만 시각화한다.
const TIMELINE_ROW_HEIGHT = 42;
const TIMELINE_MIN_BAR = 6;
const TIMELINE_SOLID_RATIO = 0.7;
const TIMELINE_NO_DATA_COLOR = 'rgba(46,42,36,0.1)';

function timelineBarVisual(value: number | null, maxValue: number, colors: { solid: string; dimmed: string }) {
  if (value == null || value === 0) {
    return { height: TIMELINE_MIN_BAR, backgroundColor: TIMELINE_NO_DATA_COLOR };
  }
  const ratio = maxValue > 0 ? value / maxValue : 0;
  const height = TIMELINE_MIN_BAR + ratio * (TIMELINE_ROW_HEIGHT - TIMELINE_MIN_BAR);
  return { height, backgroundColor: ratio >= TIMELINE_SOLID_RATIO ? colors.solid : colors.dimmed };
}

const TIMELINE_COLORS = {
  hotFlash: { solid: '#D3968C', dimmed: 'rgba(211,150,140,0.55)' },
  sleep: { solid: '#0F3D2C', dimmed: 'rgba(15,61,44,0.28)' },
  skin: { solid: '#839958', dimmed: 'rgba(131,153,88,0.4)' },
};

function TimelineRow({
  label,
  values,
  colors,
}: {
  label: string;
  values: (number | null)[];
  colors: { solid: string; dimmed: string };
}) {
  const max = Math.max(0, ...values.filter((v): v is number => v != null));
  return (
    <View style={styles.timelineRow}>
      <ThemedText style={styles.timelineRowLabel}>{label}</ThemedText>
      <View style={styles.timelineBars}>
        {values.map((value, index) => (
          <View key={index} style={[styles.timelineBar, timelineBarVisual(value, max, colors)]} />
        ))}
      </View>
    </View>
  );
}

// 지난주 대비 증감 배지/수치의 색상 — 홍조는 줄수록 개선, 늘수록 주의. 경고색(빨강·주황)은 쓰지 않는다.
const POLARITY_COLORS = {
  improve: { bg: '#E8EDDD', text: '#3D5226' },
  caution: { bg: '#F4E2D4', text: '#6E3B26' },
  neutral: { bg: '#F3EFE6', text: '#2E2A24' },
} as const;

function hotFlashBadgeText(hotFlash: SymptomBreakdownRow) {
  if (hotFlash.delta === 0) return `${hotFlash.label} 비슷해요`;
  const direction = hotFlash.delta < 0 ? '줄었어요' : '늘었어요';
  return `${hotFlash.label} ${Math.abs(hotFlash.delta)}회 ${direction}`;
}

function formatDeltaChip(delta: number) {
  if (delta === 0) return null;
  const sign = delta < 0 ? '−' : '+';
  return `${sign}${Math.abs(delta)}`;
}

function moodQualitativeLabel(mood: number | null) {
  if (mood == null) return null;
  const index = Math.min(4, Math.max(0, Math.round(mood) - 1));
  return CHECKIN_SCALE_LABELS[index];
}

// summary_text(AI 자유문)는 매주 문장 구조가 달라질 수 있어 시니어 대상 화면엔 부적합 — 대신
// stats의 구조화된 필드에서 직접 문장을 조합한다. 형식이 항상 보장된다.
function buildHeaderSummary(hotFlash: SymptomBreakdownRow | undefined) {
  if (!hotFlash) return '이번 주엔 홍조 기록이 없었어요.';
  if (hotFlash.prev_count > 0 && hotFlash.delta !== 0) {
    return `지난주보다 홍조 기록이 ${hotFlash.delta < 0 ? '줄었어요' : '늘었어요'}.`;
  }
  if (hotFlash.prev_count > 0 && hotFlash.delta === 0) {
    return '지난주와 비슷하게 홍조를 기록하셨어요.';
  }
  return `이번 주 홍조를 ${hotFlash.count}회 기록했어요.`;
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

// 시안의 유기적 얼룩(비대칭 border-radius)은 RN의 borderRadius가 지원하지 않는 CSS 전용 문법이라,
// 이 앱의 다른 장식 블롭들과 마찬가지로 원형 + 방사형 그라데이션으로 근사한다.
const HEADER_BLOB_GRADIENT = 'radial-gradient(circle at 38% 34%, #839958 0%, #FBF9F3 76%)';
const headerBlobBackground = Platform.select({
  web: { backgroundImage: HEADER_BLOB_GRADIENT },
  default: { experimental_backgroundImage: HEADER_BLOB_GRADIENT },
});

export default function ReportScreen() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [logs, setLogs] = useState<SymptomLogEntry[]>([]);
  const [checkIns, setCheckIns] = useState<DailyCheckInEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'loaded'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  // chat.tsx의 createChatSession().then().catch() 패턴과 동일 — async/await로 쓰면 eslint
  // (react-hooks/set-state-in-effect)가 await 이후의 setState도 effect 본문 동기 호출로 오인해 flag한다.
  const load = useCallback(() => {
    getWeeklyReport()
      .then((weeklyReport) => {
        const range = { from: weeklyReport.stats.week_start, to: weeklyReport.stats.week_end };
        return Promise.all([listSymptomLogs(range), listCheckIns(range)]).then(([weekLogs, weekCheckIns]) => {
          setReport(weeklyReport);
          setLogs(weekLogs);
          setCheckIns(weekCheckIns);
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
    load();
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
  const hotFlash = stats.symptoms.find((s) => s.code === 'hot_flash');
  const hasHotFlashComparison = !!hotFlash && hotFlash.prev_count > 0;

  const weekDates = buildWeekDates(stats.week_start);
  const todayKey = kstDateKey(new Date());
  const hotFlashDaily = buildDailyHotFlashCounts(logs, weekDates);
  const sleepDaily = buildDailySleepHours(checkIns, weekDates);
  const skinDaily = buildDailySkinScores(stats.skin_link, weekDates);

  const sleepHours = stats.check_in_averages.sleep_hours;
  const moodLabel = moodQualitativeLabel(stats.check_in_averages.mood);

  const insightBlocks: { label: string; body: string }[] = [];
  if (hotFlash) {
    insightBlocks.push({
      label: hotFlash.label,
      body: hotFlash.peak_slot_label
        ? `이번 주 ${hotFlash.count}회 기록했고, ${hotFlash.peak_slot_label} 시간대에 몰려 있었어요.`
        : `이번 주 ${hotFlash.count}회 기록했어요.`,
    });
  }
  if (sleepHours != null || moodLabel != null) {
    const sleepPart = sleepHours != null ? `평균 ${sleepHours}시간 주무셨` : null;
    const moodPart = moodLabel != null ? `기분은 '${moodLabel}'으로 남기셨어요` : null;
    const body =
      sleepPart && moodPart ? `${sleepPart}고, ${moodPart}.` : sleepPart ? `${sleepPart}어요.` : `${moodPart}.`;
    insightBlocks.push({ label: '수면과 기분', body });
  }
  if (stats.skin_link) {
    insightBlocks.push({
      label: '피부',
      body: `얼굴 사진은 ${stats.skin_link.photo_days}일 찍으셨고, 홍조 점수는 평균 ${stats.skin_link.average_redness}점이었어요.`,
    });
  }

  const hotFlashDeltaChip = hasHotFlashComparison ? formatDeltaChip(hotFlash!.delta) : null;

  return (
    <WarmScreen>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerBlob} />
          <View style={styles.headerTextBlock}>
            <ThemedText style={styles.headerTitle}>이번 주 리포트</ThemedText>
            <ThemedText style={styles.headerSummary}>{buildHeaderSummary(hotFlash)}</ThemedText>
          </View>
        </View>

        <View style={styles.badgeRow}>
          {hasHotFlashComparison && hotFlash && (
            <View style={[styles.badge, { backgroundColor: POLARITY_COLORS[
              hotFlash.delta < 0 ? 'improve' : hotFlash.delta > 0 ? 'caution' : 'neutral'
            ].bg }]}>
              <ThemedText
                style={[
                  styles.badgeText,
                  { color: POLARITY_COLORS[hotFlash.delta < 0 ? 'improve' : hotFlash.delta > 0 ? 'caution' : 'neutral'].text },
                ]}>
                {hotFlashBadgeText(hotFlash)}
              </ThemedText>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: POLARITY_COLORS.neutral.bg }]}>
            <ThemedText style={[styles.badgeText, { color: POLARITY_COLORS.neutral.text }]}>
              {stats.days_recorded}일 기록했어요
            </ThemedText>
          </View>
          {stats.skin_link && (
            <View style={[styles.badge, { backgroundColor: POLARITY_COLORS.neutral.bg }]}>
              <ThemedText style={[styles.badgeText, { color: POLARITY_COLORS.neutral.text }]}>
                얼굴 사진 {stats.skin_link.photo_days}일
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.timelineSection}>
          <ThemedText style={styles.timelineTitle}>한 주의 흐름</ThemedText>
          <ThemedText style={styles.timelineDescription}>요일별로 기록한 값을 나란히 놓았어요.</ThemedText>

          <View style={styles.timelineRows}>
            <TimelineRow label="홍조" values={hotFlashDaily} colors={TIMELINE_COLORS.hotFlash} />
            <TimelineRow label="수면" values={sleepDaily} colors={TIMELINE_COLORS.sleep} />
            <TimelineRow label="피부" values={skinDaily} colors={TIMELINE_COLORS.skin} />

            <View style={styles.timelineWeekdayRow}>
              <View style={styles.timelineRowLabelSpacer} />
              <View style={styles.timelineWeekdayLabels}>
                {WEEKDAY_LABELS.map((label, index) => (
                  <ThemedText
                    key={label}
                    style={[
                      styles.timelineWeekdayLabel,
                      weekDates[index] === todayKey && styles.timelineWeekdayLabelToday,
                    ]}>
                    {label}
                  </ThemedText>
                ))}
              </View>
            </View>
          </View>
        </View>

        {insightBlocks.length > 0 && (
          <View style={styles.insightSection}>
            <ThemedText style={styles.insightTitle}>이렇게 읽었어요</ThemedText>
            <View>
              {insightBlocks.map((block, index) => (
                <View
                  key={block.label}
                  style={[
                    styles.insightBlock,
                    index === insightBlocks.length - 1 && styles.insightBlockLast,
                  ]}>
                  <ThemedText style={styles.insightLabel}>{block.label}</ThemedText>
                  <ThemedText style={styles.insightBody}>{block.body}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.detailSection}>
          <ThemedText style={styles.detailTitle}>자세한 수치</ThemedText>
          <View>
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>홍조</ThemedText>
              <View style={styles.detailValueRow}>
                <ThemedText style={styles.detailValue}>{hotFlash?.count ?? 0}회</ThemedText>
                {hotFlashDeltaChip && (
                  <ThemedText
                    style={[
                      styles.detailDelta,
                      { color: POLARITY_COLORS[hotFlash!.delta < 0 ? 'improve' : 'caution'].text },
                    ]}>
                    {hotFlashDeltaChip}
                  </ThemedText>
                )}
              </View>
            </View>

            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>평균 수면</ThemedText>
              <ThemedText style={styles.detailValue}>{sleepHours != null ? `${sleepHours}시간` : '기록 없음'}</ThemedText>
            </View>

            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>평균 기분</ThemedText>
              <ThemedText style={styles.detailValue}>{moodLabel ?? '기록 없음'}</ThemedText>
            </View>

            {stats.skin_link && (
              <View style={[styles.detailRow, styles.detailRowLast]}>
                <View style={styles.detailLabelStack}>
                  <ThemedText style={styles.detailLabel}>피부 홍조 점수</ThemedText>
                  <ThemedText style={styles.detailSubLabel}>얼굴 사진 {stats.skin_link.photo_days}일 평균</ThemedText>
                </View>
                <ThemedText style={styles.detailValue}>{stats.skin_link.average_redness}점</ThemedText>
              </View>
            )}
          </View>
        </View>

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
                  <View key={reason.code} style={[styles.careReasonRow, index > 0 && styles.careReasonRowDivider]}>
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

        {stats.missed_dates.length > 0 && (
          <View style={styles.fillNote}>
            <ThemedText style={styles.fillNoteTitle}>기록을 더 채우면 관찰이 정확해져요</ThemedText>
            <ThemedText style={styles.fillNoteText}>
              이번 주 {stats.missed_dates.length}일은 기록이 없었어요. 오늘 체크인에서 채워보세요.
            </ThemedText>
          </View>
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
  header: {
    position: 'relative',
    // WarmScreen.inner의 paddingTop:24에 +22 해서 시안의 상단 46px을 맞춘다.
    marginTop: 22,
    marginBottom: 30,
  },
  headerBlob: {
    position: 'absolute',
    right: -46,
    top: -46,
    width: 170,
    height: 170,
    borderRadius: 999,
    opacity: 0.42,
    ...headerBlobBackground,
  },
  headerTextBlock: {
    gap: 10,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 40.5,
    color: Warm.textDeep,
  },
  headerSummary: {
    fontSize: 19,
    fontWeight: '600',
    lineHeight: 29.45,
    color: Warm.text,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 38,
  },
  badge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  timelineSection: {
    marginBottom: 40,
  },
  timelineTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.textDeep,
    marginBottom: 6,
  },
  timelineDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: Warm.text,
    opacity: 0.65,
    marginBottom: 18,
  },
  timelineRows: {
    gap: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timelineRowLabel: {
    width: 44,
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '600',
    color: Warm.text,
    opacity: 0.7,
  },
  timelineRowLabelSpacer: {
    width: 44,
    flexShrink: 0,
  },
  timelineBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    height: TIMELINE_ROW_HEIGHT,
  },
  timelineBar: {
    flex: 1,
    borderRadius: 6,
  },
  timelineWeekdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 2,
  },
  timelineWeekdayLabels: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
  },
  timelineWeekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: Warm.text,
    opacity: 0.55,
  },
  timelineWeekdayLabelToday: {
    fontWeight: '700',
    color: Warm.textDeep,
    opacity: 1,
  },
  insightSection: {
    marginBottom: 38,
  },
  insightTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.textDeep,
    marginBottom: 14,
  },
  insightBlock: {
    gap: 5,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  insightBlockLast: {
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  insightLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Warm.accentSoft,
    letterSpacing: 0.28,
  },
  insightBody: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 26.4,
    color: Warm.text,
  },
  detailSection: {
    marginBottom: 34,
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.textDeep,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  detailRowLast: {
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  detailLabelStack: {
    gap: 2,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Warm.text,
  },
  detailSubLabel: {
    fontSize: 13,
    color: Warm.text,
    opacity: 0.6,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 21.6,
    color: Warm.textDeep,
  },
  detailDelta: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 15.6,
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
  fillNote: {
    backgroundColor: Warm.background,
    borderRadius: 20,
    padding: 18,
    gap: 6,
    marginBottom: 24,
  },
  fillNoteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  fillNoteText: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.text,
  },
  disclaimer: {
    fontSize: 14,
    lineHeight: 20,
    color: Warm.textSecondary,
    marginBottom: 22,
  },
});
