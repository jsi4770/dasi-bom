import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmScreen } from '@/components/warm/warm-screen';
import { MOCK_ROUTINE_STATUS, MOCK_WEEKLY_STATS } from '@/constants/mock-data';
import { Warm } from '@/constants/theme';

function ChevronRight({ color }: { color: string }) {
  return (
    <SymbolView
      name={{ ios: 'chevron.right', android: 'arrow_forward', web: 'arrow_forward' }}
      size={14}
      tintColor={color}
    />
  );
}

export default function HomeScreen() {
  return (
    // 홈은 탭 루트라 뒤로가기가 필요 없어 헤더 없이 콘텐츠부터 시작한다 — 하단 탭바는 (tabs)/_layout.tsx가 담당.
    <WarmScreen>
      <View style={styles.heroBlock}>
        <View style={styles.heroBlob} />
        <ThemedText style={styles.heroTitle}>오늘도 잘 지내고 계신가요?</ThemedText>
        <ThemedText style={styles.heroText}>
          오늘 기록한 증상이 없어요. 몸에 변화가 느껴지면 바로 남겨보세요.
        </ThemedText>
      </View>

      <Pressable
        onPress={() => router.push('/symptom-log')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.ctaRow, pressed && styles.pressed]}>
        <ThemedText style={styles.ctaLabel}>지금 증상 기록하기</ThemedText>
        <ChevronRight color={Warm.secondaryStrong} />
      </Pressable>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>이번 주 내 몸 이야기</ThemedText>

        <View style={styles.hotFlashHero}>
          <View style={styles.hotFlashBlob} />
          <ThemedText style={styles.statLabel}>홍조</ThemedText>
          <View style={styles.hotFlashValueRow}>
            <ThemedText style={styles.hotFlashValue}>{MOCK_WEEKLY_STATS.hotFlashCount}</ThemedText>
            <ThemedText style={styles.hotFlashUnit}>회</ThemedText>
          </View>
          <View style={styles.subStatRow}>
            <View style={styles.subStatCard}>
              <ThemedText style={styles.statLabel}>수면</ThemedText>
              <ThemedText style={styles.subStatValue}>{MOCK_WEEKLY_STATS.avgSleepHours}시간</ThemedText>
            </View>
            <View style={styles.subStatCard}>
              <ThemedText style={styles.statLabel}>기분</ThemedText>
              <ThemedText style={styles.subStatValue}>{MOCK_WEEKLY_STATS.moodLabel}</ThemedText>
            </View>
          </View>
        </View>

        <ThemedText style={styles.trendNote}>{MOCK_WEEKLY_STATS.trendNote}</ThemedText>

        <Pressable
          onPress={() => router.push('/report')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
          <ThemedText style={styles.linkRowLabel}>7일 리포트 전체 보기</ThemedText>
          <ChevronRight color={Warm.textDeep} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>오늘의 루틴</ThemedText>
        <View>
          <Pressable
            onPress={() => router.push('/care')}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.routineRow,
              !MOCK_ROUTINE_STATUS.medicationDoneToday && styles.routineRowHighlight,
              pressed && styles.pressed,
            ]}>
            <View
              style={[styles.routineDot, MOCK_ROUTINE_STATUS.medicationDoneToday && styles.routineDotDone]}>
              {MOCK_ROUTINE_STATUS.medicationDoneToday && (
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={13}
                  tintColor="#ffffff"
                />
              )}
            </View>
            <View style={styles.routineText}>
              <ThemedText style={styles.routineLabel}>복약·영양제</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {MOCK_ROUTINE_STATUS.medicationSummary}
              </ThemedText>
            </View>
            <ThemedText
              style={[
                styles.routineAction,
                !MOCK_ROUTINE_STATUS.medicationDoneToday && styles.routineActionEmphasis,
              ]}>
              루틴 설정
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.push('/care')}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.routineRow,
              styles.routineRowLast,
              !MOCK_ROUTINE_STATUS.meditationDoneToday && styles.routineRowHighlight,
              pressed && styles.pressed,
            ]}>
            <View
              style={[styles.routineDot, MOCK_ROUTINE_STATUS.meditationDoneToday && styles.routineDotDone]}>
              {MOCK_ROUTINE_STATUS.meditationDoneToday && (
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={13}
                  tintColor="#ffffff"
                />
              )}
            </View>
            <View style={styles.routineText}>
              <ThemedText style={styles.routineLabel}>명상·스트레칭</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {MOCK_ROUTINE_STATUS.meditationSummary}
              </ThemedText>
            </View>
            <ThemedText
              style={[
                styles.routineAction,
                !MOCK_ROUTINE_STATUS.meditationDoneToday && styles.routineActionEmphasis,
              ]}>
              시작하기
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.iconList}>
        <Pressable
          onPress={() => router.push('/chat')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.iconRow, pressed && styles.pressed]}>
          <ThemedText style={styles.iconRowEmoji}>💬</ThemedText>
          <View style={styles.iconRowText}>
            <ThemedText style={styles.routineLabel}>챗봇과 이야기 나누기</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              오늘 어떠셨나요? 편하게 말씀해 보세요.
            </ThemedText>
          </View>
          <ChevronRight color={Warm.textDeep} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/face-capture')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.iconRow, pressed && styles.pressed]}>
          <ThemedText style={styles.iconRowEmoji}>🤳</ThemedText>
          <View style={styles.iconRowText}>
            <ThemedText style={styles.routineLabel}>얼굴 사진·건강 데이터 연결</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              피부와 홍조 변화를 참고 지표로 기록해요.
            </ThemedText>
          </View>
          <ChevronRight color={Warm.textDeep} />
        </Pressable>
      </View>

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
  pressed: {
    opacity: 0.7,
  },
  heroBlock: {
    position: 'relative',
    gap: 8,
  },
  heroBlob: {
    position: 'absolute',
    right: -30,
    top: -28,
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: Warm.accentSoftBg,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    color: Warm.textDeep,
  },
  heroText: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.text,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: Warm.secondarySoft,
  },
  ctaLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.secondaryStrong,
  },
  section: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.textDeep,
    marginBottom: 12,
  },
  hotFlashHero: {
    position: 'relative',
    gap: 4,
    marginBottom: 12,
  },
  hotFlashBlob: {
    position: 'absolute',
    right: -20,
    top: -12,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: Warm.secondarySoft,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Warm.text,
  },
  hotFlashValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginBottom: 14,
  },
  hotFlashValue: {
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 38,
    color: Warm.textDeep,
  },
  hotFlashUnit: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
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
    padding: 14,
    backgroundColor: Warm.backgroundSubtle,
  },
  subStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  trendNote: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.textSecondary,
    marginBottom: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Warm.border,
  },
  linkRowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Warm.textDeep,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 58,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  routineRowLast: {
    borderBottomWidth: 0,
  },
  routineRowHighlight: {
    marginHorizontal: -14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 61, 44, 0.07)',
  },
  routineDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
  routineText: {
    flex: 1,
    gap: 2,
  },
  routineLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Warm.text,
  },
  routineAction: {
    fontSize: 14,
    fontWeight: '500',
    color: Warm.textSecondary,
    flexShrink: 0,
  },
  routineActionEmphasis: {
    fontWeight: '700',
    color: Warm.textDeep,
  },
  iconList: {
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  iconRowEmoji: {
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
