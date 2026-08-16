import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmBottomSheet } from '@/components/warm/warm-bottom-sheet';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmInfoNote } from '@/components/warm/warm-info-note';
import { WarmScreen } from '@/components/warm/warm-screen';
import { blobDecorationStyle, Warm } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { getTodayReminders, TodayReminder } from '@/lib/api';
import { formatTimeLabel } from '@/lib/reminder-format';

function ChevronRight() {
  return (
    <SymbolView
      name={{ ios: 'chevron.right', android: 'arrow_forward', web: 'arrow_forward' }}
      size={14}
      tintColor={Warm.textDeep}
    />
  );
}

function summarizeReminders(
  reminders: TodayReminder[] | null,
  failed: boolean,
  type: TodayReminder['type']
) {
  if (failed) return '불러오지 못했어요';
  if (reminders === null) return '확인하는 중…';
  const items = reminders.filter((r) => r.type === type);
  if (items.length === 0) return '아직 없어요 · 눌러서 추가해보세요';
  return `${items.length}개 · ${items.map((r) => formatTimeLabel(r.time)).join(', ')}`;
}

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [reminders, setReminders] = useState<TodayReminder[] | null>(null);
  const [remindersFailed, setRemindersFailed] = useState(false);
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getTodayReminders()
        .then((all) => {
          setReminders(all);
          setRemindersFailed(false);
        })
        .catch(() => setRemindersFailed(true));
    }, [])
  );

  function openReminders(type: TodayReminder['type']) {
    router.push({ pathname: '/medication', params: { type } });
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setLogoutSheetVisible(false);
    }
  }

  const accountLabel = user?.username === 'demo' ? '둘러보기 중' : user?.email || user?.username || '';
  const version = Constants.expoConfig?.version ?? '-';

  return (
    // 50대 사용자 대상 설정 화면: 홈/돌봄과 동일하게 헤더 없이 본문 헤드라인으로 시작하고,
    // 실제 목적지가 없는 항목(이용약관 등)에는 화살표를 붙이지 않아 "눌러도 아무 일 없는" 탭을 피한다.
    <WarmScreen>
      <View style={styles.heroBlock}>
        <View style={styles.heroBlob} />
        <ThemedText style={styles.heroTitle}>설정</ThemedText>
        <ThemedText style={styles.heroText}>
          알림 시간을 바꾸거나, 오늘 챙길 것을 다시 확인하실 수 있어요.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>알림·루틴</ThemedText>
        <View>
          <Pressable
            onPress={() => openReminders('medication')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.rowTextBlock}>
              <ThemedText style={styles.rowLabel}>복약·영양제</ThemedText>
              <ThemedText style={styles.rowValue}>
                {summarizeReminders(reminders, remindersFailed, 'medication')}
              </ThemedText>
            </View>
            <ChevronRight />
          </Pressable>
          <Pressable
            onPress={() => openReminders('mindfulness')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.pressed]}>
            <View style={styles.rowTextBlock}>
              <ThemedText style={styles.rowLabel}>명상·스트레칭</ThemedText>
              <ThemedText style={styles.rowValue}>
                {summarizeReminders(reminders, remindersFailed, 'mindfulness')}
              </ThemedText>
            </View>
            <ChevronRight />
          </Pressable>
        </View>
        <ThemedText style={styles.helperNote}>
          각 항목을 누르시면 시간을 바꾸거나 새로 추가하실 수 있어요.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>계정</ThemedText>
        <View style={[styles.row, styles.rowLast]}>
          <View style={styles.rowTextBlock}>
            <ThemedText style={styles.rowLabel}>로그인 계정</ThemedText>
            <ThemedText style={styles.rowValue}>{accountLabel}</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>앱 정보</ThemedText>
        <View style={styles.inlineRow}>
          <ThemedText style={styles.rowLabel}>버전</ThemedText>
          <ThemedText style={styles.rowValue}>{version}</ThemedText>
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <View style={styles.rowTextBlock}>
            <ThemedText style={styles.rowLabel}>이용약관 · 개인정보 처리방침</ThemedText>
            <ThemedText style={styles.rowValue}>기록을 어떻게 보관하는지 적어두었어요</ThemedText>
          </View>
        </View>

        <WarmInfoNote text="다시-봄의 기록은 참고용이며, 의료적 진단이나 처방을 대신하지 않아요." />
      </View>

      <View style={styles.spacer} />

      <Pressable
        onPress={() => setLogoutSheetVisible(true)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.logoutLink, pressed && styles.pressed]}>
        <ThemedText style={styles.logoutLinkText}>로그아웃</ThemedText>
      </Pressable>

      <WarmBottomSheet
        visible={logoutSheetVisible}
        onClose={() => setLogoutSheetVisible(false)}
        title="로그아웃">
        <ThemedText style={styles.logoutSheetText}>
          지금까지의 기록은 계정에 그대로 남아 있어요. 다시 로그인하시면 이어서 보실 수 있습니다.
        </ThemedText>
        <WarmButton
          label={loggingOut ? '로그아웃 중…' : '로그아웃'}
          onPress={handleLogout}
        />
        <WarmButton label="돌아가기" variant="secondary" onPress={() => setLogoutSheetVisible(false)} />
      </WarmBottomSheet>
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
    gap: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.textDeep,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 68,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  rowLast: {
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  rowTextBlock: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Warm.textDeep,
  },
  rowValue: {
    fontSize: 15,
    lineHeight: 21,
    color: Warm.text,
    opacity: 0.8,
  },
  helperNote: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.text,
    opacity: 0.78,
    marginTop: 12,
  },
  spacer: {
    flex: 1,
    minHeight: 24,
  },
  logoutLink: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  logoutLinkText: {
    fontSize: 16,
    fontWeight: '700',
    color: Warm.textDeep,
    textDecorationLine: 'underline',
  },
  logoutSheetText: {
    fontSize: 15,
    lineHeight: 23,
    color: Warm.text,
    opacity: 0.85,
  },
});
