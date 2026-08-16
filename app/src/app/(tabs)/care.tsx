import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmCard } from '@/components/warm/warm-card';
import { WarmScreen } from '@/components/warm/warm-screen';
import { Warm } from '@/constants/theme';
import { ApiError, getMindfulnessSessions, listSymptomLogs, MindfulnessSession, SymptomLogEntry } from '@/lib/api';

// report.tsx의 KST 날짜 계산과 동일한 방식(자정 근처 기록의 날짜 오분류 방지) — occurred_at은
// UTC ISO 문자열이라 이 변환 없이는 "오늘" 판정이 어긋난다.
const KST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });
function kstDateKey(date: Date) {
  return KST_DATE_FORMATTER.format(date);
}

// AI 자유문 대신 오늘 기록된 증상 라벨(구조화된 필드)만으로 문장을 조합한다(report.tsx의
// buildHeaderSummary와 같은 접근) — "이/가" 등 받침에 따라 달라지는 조사를 피하려 항목을
// 가운뎃점으로 나열하고 "기록이 있었어요"처럼 조사가 필요 없는 서술로 맺는다.
function buildTodaySummary(logs: SymptomLogEntry[]) {
  const counts = new Map<string, number>();
  const labelByCode = new Map<string, string>();
  for (const log of logs) {
    const { code, label } = log.symptom_type_detail;
    counts.set(code, (counts.get(code) ?? 0) + 1);
    labelByCode.set(code, label);
  }
  const topLabels = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([code]) => labelByCode.get(code)!);

  if (topLabels.length === 0) {
    return '아직 오늘 기록이 없어요. 짧은 스트레칭과 호흡으로 몸과 마음을 가볍게 해보세요.';
  }
  return `오늘 ${topLabels.join('·')} 기록이 있었어요. 짧은 스트레칭과 호흡으로 몸과 마음을 가볍게 해보세요.`;
}

export default function CareScreen() {
  const [sessions, setSessions] = useState<MindfulnessSession[] | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);

  useEffect(() => {
    getMindfulnessSessions()
      .then(setSessions)
      .catch((error) => {
        setErrorText(error instanceof ApiError ? error.message : '목록을 불러오지 못했어요.');
      });

    const today = kstDateKey(new Date());
    listSymptomLogs({ from: today, to: today })
      .then((logs) => setSummaryText(buildTodaySummary(logs)))
      .catch(() => setSummaryText(buildTodaySummary([])));
  }, []);

  function openSession(session: MindfulnessSession) {
    router.push({ pathname: '/mindfulness-session', params: { session: JSON.stringify(session) } });
  }

  return (
    <WarmScreen>
      <View style={styles.titleBlock}>
        <ThemedText style={styles.title}>명상·스트레칭</ThemedText>
        <ThemedText style={styles.subtitle}>몸이 편안해지는 3분, 지금 시작해볼까요?</ThemedText>
      </View>

      {summaryText && (
        <WarmCard>
          <ThemedText type="small" themeColor="textSecondary" style={styles.summaryEyebrow}>
            오늘의 상태
          </ThemedText>
          <ThemedText style={styles.summaryText}>{summaryText}</ThemedText>
        </WarmCard>
      )}

      {errorText && (
        <ThemedText type="small" style={styles.errorText}>
          {errorText}
        </ThemedText>
      )}

      {sessions === null && !errorText && <ActivityIndicator color={Warm.primary} style={styles.loading} />}

      {sessions && sessions.length > 0 && (
        <ThemedText style={styles.listLabel}>오늘 해볼 수 있는 루틴</ThemedText>
      )}

      {sessions?.map((session) => (
        <Pressable
          key={session.id}
          onPress={() => openSession(session)}
          accessibilityRole="button"
          style={({ pressed }) => [pressed && styles.pressed]}>
          <WarmCard>
            <View style={styles.sessionRow}>
              <View style={styles.sessionText}>
                <ThemedText style={styles.sessionTitle}>{session.title}</ThemedText>
                <ThemedText type="default" themeColor="textSecondary">
                  {session.description}
                </ThemedText>
              </View>
              <View style={styles.durationBadge}>
                <ThemedText style={styles.durationText}>{Math.round(session.total_seconds / 60)}분</ThemedText>
              </View>
            </View>
          </WarmCard>
        </Pressable>
      ))}
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  titleBlock: {
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Warm.textDeep,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: Warm.text,
  },
  loading: {
    marginTop: 24,
  },
  errorText: {
    color: Warm.secondaryStrong,
  },
  summaryEyebrow: {
    letterSpacing: 0.2,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
    color: Warm.text,
  },
  listLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sessionText: {
    flex: 1,
    gap: 4,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  durationBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Warm.primarySoft,
  },
  durationText: {
    fontSize: 15,
    fontWeight: '700',
    color: Warm.primaryStrong,
  },
});
