import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmCard } from '@/components/warm/warm-card';
import { WarmHeader } from '@/components/warm/warm-header';
import { WarmScreen } from '@/components/warm/warm-screen';
import { MOCK_ROUTINE_STATUS, MOCK_WEEKLY_STATS } from '@/constants/mock-data';
import { Warm } from '@/constants/theme';

// 세 배지 모두 팔레트 안의 소프트 틴트(매치/차이/피스타치)로 통일 — 색상별로 다른 계열(주황/파랑/노랑)을
// 쓰던 이전 방식은 산만해 보여서, 명도/채도가 비슷한 흙톤 3종 + 진한 캐롭 텍스트로 정리했다.
const STAT_BADGES = [
  {
    key: 'hotFlash',
    emoji: '🔥',
    label: '홍조',
    value: `${MOCK_WEEKLY_STATS.hotFlashCount}회`,
    bg: Warm.secondarySoft,
  },
  {
    key: 'sleep',
    emoji: '😴',
    label: '수면',
    value: `${MOCK_WEEKLY_STATS.avgSleepHours}h`,
    bg: Warm.accentSoftBg,
  },
  {
    key: 'mood',
    emoji: '🙂',
    label: '기분',
    value: MOCK_WEEKLY_STATS.moodLabel,
    bg: Warm.primarySoft,
  },
];

export default function HomeScreen() {
  return (
    <WarmScreen header={<WarmHeader title="홈" />}>
      <View style={styles.hero}>
        <ThemedText style={styles.heroTitle}>오늘도 잘 지내고 계신가요?</ThemedText>
        <ThemedText style={styles.heroText}>
          오늘 기록한 증상이 없어요. 몸에 변화가 느껴지면 바로 남겨보세요.
        </ThemedText>
        <WarmButton label="✍️  지금 증상 기록하기" onPress={() => router.push('/symptom-log')} />
      </View>

      <WarmCard>
        <ThemedText style={styles.cardTitle}>이번 주 내 몸 이야기</ThemedText>
        <View style={styles.statRow}>
          {STAT_BADGES.map((stat) => (
            <View key={stat.key} style={[styles.statBadge, { backgroundColor: stat.bg }]}>
              <ThemedText style={styles.statLabel}>
                {stat.emoji} {stat.label}
              </ThemedText>
              <ThemedText style={styles.statValue}>{stat.value}</ThemedText>
            </View>
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {MOCK_WEEKLY_STATS.trendNote}
        </ThemedText>
        <WarmButton
          label="7일 리포트 전체 보기 →"
          variant="text"
          onPress={() => router.push('/report')}
        />
      </WarmCard>

      <WarmCard>
        <ThemedText style={styles.cardTitle}>오늘의 루틴</ThemedText>
        <View style={styles.routineRow}>
          <View style={styles.routineText}>
            <ThemedText style={styles.routineLabel}>💊 복약·영양제</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {MOCK_ROUTINE_STATUS.medicationSummary}
            </ThemedText>
          </View>
          <Pressable style={styles.routineButtonOutline} onPress={() => router.push('/care')}>
            <ThemedText style={styles.routineButtonOutlineText}>루틴 설정</ThemedText>
          </Pressable>
        </View>
        <View style={styles.routineRow}>
          <View style={styles.routineText}>
            <ThemedText style={styles.routineLabel}>🧘 명상·스트레칭</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {MOCK_ROUTINE_STATUS.meditationSummary}
            </ThemedText>
          </View>
          <Pressable style={styles.routineButtonFilled} onPress={() => router.push('/care')}>
            <ThemedText style={styles.routineButtonFilledText}>시작하기</ThemedText>
          </Pressable>
        </View>
      </WarmCard>

      <WarmCard>
        <ThemedText style={styles.cardTitle}>마음 돌봄</ThemedText>
        <View style={styles.iconRow}>
          <View style={[styles.iconBadge, { backgroundColor: Warm.accentSoft }]}>
            <ThemedText style={styles.iconBadgeEmoji}>💬</ThemedText>
          </View>
          <View style={styles.iconRowText}>
            <ThemedText style={styles.routineLabel}>챗봇과 이야기 나누기</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              오늘 어떠셨나요? 편하게 말씀해 보세요.
            </ThemedText>
          </View>
        </View>
        <WarmButton label="대화 시작하기" variant="text" onPress={() => router.push('/chat')} />
      </WarmCard>

      <WarmCard>
        <View style={styles.iconRow}>
          <View style={[styles.iconBadge, { backgroundColor: Warm.secondary }]}>
            <ThemedText style={styles.iconBadgeEmoji}>🤳</ThemedText>
          </View>
          <View style={styles.iconRowText}>
            <ThemedText style={styles.routineLabel}>얼굴 사진·건강 데이터 연결</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              피부와 홍조 변화를 참고 지표로 기록해요.
            </ThemedText>
          </View>
        </View>
        <WarmButton
          label="사진 기록하기"
          variant="text"
          onPress={() => router.push('/face-capture')}
        />
      </WarmCard>

      <View style={styles.footerLinks}>
        {/* 데모 모드 설정 / 로그인 안내 / 설정·데이터 관리 화면은 아직 없어서 우선 설정 탭으로 모음 */}
        <Pressable onPress={() => router.push('/settings')}>
          <ThemedText style={styles.footerLink}>데모 모드 설정</ThemedText>
        </Pressable>
        <Pressable onPress={() => router.push('/settings')}>
          <ThemedText style={styles.footerLink}>로그인 안내</ThemedText>
        </Pressable>
        <Pressable onPress={() => router.push('/settings')}>
          <ThemedText style={styles.footerLink}>설정·데이터 관리</ThemedText>
        </Pressable>
      </View>
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 14,
    borderRadius: 28,
    padding: 20,
    backgroundColor: Warm.heroBg,
    borderWidth: 1,
    borderColor: Warm.heroBorder,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Warm.heroTitle,
  },
  heroText: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.heroText,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Warm.text,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBadge: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Warm.text,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: Warm.textDeep,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  routineText: {
    gap: 2,
  },
  routineLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Warm.text,
  },
  routineButtonOutline: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Warm.border,
    backgroundColor: Warm.card,
  },
  routineButtonOutlineText: {
    fontSize: 14,
    fontWeight: '700',
    color: Warm.text,
  },
  routineButtonFilled: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    // 작은 흰 텍스트라 primaryStrong(작은 텍스트 기준 AA 통과) 사용 — primary는 큰 굵은 텍스트 전용.
    backgroundColor: Warm.primaryStrong,
  },
  routineButtonFilledText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(114, 92, 58, 0.18)',
  },
  iconBadgeEmoji: {
    fontSize: 24,
  },
  iconRowText: {
    flex: 1,
    gap: 2,
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '500',
    color: Warm.text,
    textDecorationLine: 'underline',
  },
});
