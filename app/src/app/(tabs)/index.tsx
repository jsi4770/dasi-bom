import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmCard } from '@/components/warm/warm-card';
import { WarmScreen } from '@/components/warm/warm-screen';
import { MOCK_ROUTINE_STATUS, MOCK_WEEKLY_STATS } from '@/constants/mock-data';
import { blobDecorationStyle, Warm } from '@/constants/theme';

function ChevronRight({ color }: { color: string }) {
  return (
    <SymbolView
      name={{ ios: 'chevron.right', android: 'arrow_forward', web: 'arrow_forward' }}
      size={16}
      tintColor={color}
    />
  );
}

export default function HomeScreen() {
  return (
    // 홈은 탭 루트라 뒤로가기가 필요 없어 헤더 없이 콘텐츠부터 시작한다 — 하단 탭바는 (tabs)/_layout.tsx가 담당.
    // 50대 사용자 대상 재설계: 화면당 카드 3개(이번 주 홍조 / 오늘의 루틴 / 다른 기능)로 묶어
    // 한눈에 구획이 보이게 하고, 설명 문장은 최대한 줄이고, 글자·터치 영역은 전반적으로 키움.
    <WarmScreen>
      <View style={styles.heroBlock}>
        <View style={styles.heroBlob} />
        <ThemedText style={styles.heroTitle}>오늘도 잘 지내고 계신가요?</ThemedText>
        <ThemedText style={styles.heroText}>오늘 기록한 증상이 아직 없어요</ThemedText>
      </View>

      <WarmButton
        label="지금 증상 기록하기"
        onPress={() => router.push('/symptom-log')}
        trailingIcon
      />

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>이번 주 내 몸 이야기</ThemedText>

        <Pressable
          onPress={() => router.push('/report')}
          accessibilityRole="button"
          style={({ pressed }) => [pressed && styles.pressed]}>
          <WarmCard>
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

            <ThemedText style={styles.trendNote}>{MOCK_WEEKLY_STATS.trendNote}</ThemedText>

            <View style={styles.cardFooterRow}>
              <ThemedText style={styles.cardFooterLabel}>자세히 보기</ThemedText>
              <ChevronRight color={Warm.textDeep} />
            </View>
          </WarmCard>
        </Pressable>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>오늘의 루틴</ThemedText>
        <WarmCard style={styles.noPad}>
          <Pressable
            onPress={() => router.push('/care')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.routineRow, pressed && styles.pressed]}>
            <View
              style={[styles.routineDot, MOCK_ROUTINE_STATUS.medicationDoneToday && styles.routineDotDone]}>
              {MOCK_ROUTINE_STATUS.medicationDoneToday && (
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={16}
                  tintColor="#ffffff"
                />
              )}
            </View>
            <ThemedText style={styles.routineLabel}>복약·영양제</ThemedText>
            <ThemedText
              style={[
                styles.routineAction,
                !MOCK_ROUTINE_STATUS.medicationDoneToday && styles.routineActionEmphasis,
              ]}>
              {MOCK_ROUTINE_STATUS.medicationDoneToday ? '완료' : '기록하기'}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.push('/care')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.routineRow, styles.routineRowLast, pressed && styles.pressed]}>
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
        </WarmCard>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>더 살펴보기</ThemedText>
        <WarmCard style={styles.noPad}>
          <Pressable
            onPress={() => router.push('/chat')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.iconRow, pressed && styles.pressed]}>
            <View style={styles.iconRowIconBadge}>
              <SymbolView
                name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'chat', web: 'chat' }}
                size={24}
                tintColor={Warm.primaryStrong}
              />
            </View>
            <ThemedText style={styles.iconRowLabel}>챗봇과 이야기 나누기</ThemedText>
            <ChevronRight color={Warm.textDeep} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/face-capture')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.iconRow, styles.iconRowLast, pressed && styles.pressed]}>
            <View style={styles.iconRowIconBadge}>
              <SymbolView
                name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
                size={24}
                tintColor={Warm.primaryStrong}
              />
            </View>
            <ThemedText style={styles.iconRowLabel}>얼굴 사진 분석</ThemedText>
            <ChevronRight color={Warm.textDeep} />
          </Pressable>
        </WarmCard>
      </View>
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
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: Warm.textDeep,
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
    minHeight: 76,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  iconRowLast: {
    borderBottomWidth: 0,
  },
  iconRowIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Warm.primarySoft,
    flexShrink: 0,
  },
  iconRowLabel: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: Warm.text,
  },
});
