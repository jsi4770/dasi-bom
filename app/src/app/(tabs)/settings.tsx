import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmBottomSheet } from '@/components/warm/warm-bottom-sheet';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmCard } from '@/components/warm/warm-card';
import { WarmInfoNote } from '@/components/warm/warm-info-note';
import { WarmScreen } from '@/components/warm/warm-screen';
import { blobDecorationStyle, Warm } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { ApiError, getTodayReminders, TodayReminder } from '@/lib/api';
import {
  disablePushNotifications,
  enablePushNotifications,
  getCurrentSubscription,
  getNotificationPermission,
  isPushSupported,
} from '@/lib/push';
import { formatTimeLabel } from '@/lib/reminder-format';

/** 'checking'(초기 확인 중) → 'unsupported'(브라우저 미지원) | 'denied'(브라우저에서 알림 차단)
 * | 'off' | 'on' 으로 정리되고, 토글 중에는 'processing'을 거친다. */
type PushUiState = 'checking' | 'unsupported' | 'denied' | 'off' | 'on' | 'processing';

function pushStatusLabel(state: PushUiState): string {
  switch (state) {
    case 'checking':
      return '확인하는 중…';
    case 'unsupported':
      return '이 브라우저에서는 지원하지 않아요';
    case 'denied':
      return '브라우저에서 알림이 차단되어 있어요';
    case 'processing':
      return '처리하는 중…';
    case 'on':
      return '이 브라우저로 알림을 받고 있어요';
    case 'off':
      return '꺼져 있어요 · 켜면 복약 시간에 알려드려요';
  }
}

function ChevronRight({ color = Warm.textDeep }: { color?: string }) {
  return (
    <SymbolView
      name={{ ios: 'chevron.right', android: 'arrow_forward', web: 'arrow_forward' }}
      size={16}
      tintColor={color}
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

function hasReminders(reminders: TodayReminder[] | null, type: TodayReminder['type']) {
  return !!reminders && reminders.some((r) => r.type === type);
}

/** 홈의 "오늘의 루틴" 카드와 같은 원형 완료 표시 — 리마인더가 하나라도 등록돼 있으면 채워진
 * 원(체크), 없으면 빈 원으로 보여줘 텍스트를 읽지 않아도 설정 여부가 한눈에 들어오게 한다. */
function RowDot({ filled }: { filled: boolean }) {
  return (
    <View style={[styles.rowDot, filled && styles.rowDotFilled]}>
      {filled && (
        <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={15} tintColor="#ffffff" />
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [reminders, setReminders] = useState<TodayReminder[] | null>(null);
  const [remindersFailed, setRemindersFailed] = useState(false);
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pushState, setPushState] = useState<PushUiState>('checking');
  const [pushError, setPushError] = useState<string | null>(null);

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

  // 화면에 다시 들어올 때마다 브라우저 알림 권한/구독 상태를 다시 확인한다 — 사용자가 브라우저
  // 설정에서 직접 권한을 바꾸고 돌아왔을 수도 있기 때문. 네이티브(iOS/Android)에서는
  // isPushSupported()가 즉시 false를 반환해 아래 브라우저 API를 아예 건드리지 않는다.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!isPushSupported()) {
          if (!cancelled) setPushState('unsupported');
          return;
        }
        if (getNotificationPermission() === 'denied') {
          if (!cancelled) setPushState('denied');
          return;
        }
        try {
          const subscription = await getCurrentSubscription();
          if (!cancelled) setPushState(subscription ? 'on' : 'off');
        } catch {
          if (!cancelled) setPushState('off');
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  function openReminders(type: TodayReminder['type']) {
    router.push({ pathname: '/medication', params: { type } });
  }

  async function handleTogglePush() {
    if (pushState !== 'on' && pushState !== 'off') return;
    const previousState = pushState;
    const turningOn = pushState === 'off';

    setPushError(null);
    setPushState('processing');
    try {
      if (turningOn) {
        await enablePushNotifications();
        setPushState('on');
      } else {
        await disablePushNotifications();
        setPushState('off');
      }
    } catch (error) {
      if (getNotificationPermission() === 'denied') {
        setPushState('denied');
        return;
      }
      setPushState(previousState);
      setPushError(
        error instanceof ApiError && error.status === 503
          ? '지금은 알림을 설정할 수 없어요. 잠시 후 다시 시도해주세요.'
          : '알림 설정을 바꾸지 못했어요. 다시 시도해주세요.'
      );
    }
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
  const reminderCount = reminders?.length ?? null;

  return (
    // 50대 사용자 대상 설정 화면: 홈/돌봄과 동일하게 헤더 없이 본문 헤드라인으로 시작하고,
    // 실제 목적지가 없는 항목(이용약관 등)에는 화살표를 붙이지 않아 "눌러도 아무 일 없는" 탭을 피한다.
    // 항목 그룹은 홈의 "오늘의 루틴" 카드와 동일하게 테두리 없는 카드 하나로 묶어, 같은 화면 안에서도
    // 어디까지가 한 묶음인지 시각적으로 바로 구분되게 한다.
    <WarmScreen>
      <View style={styles.heroBlock}>
        <View style={styles.heroBlob} />
        <ThemedText style={styles.heroTitle}>설정</ThemedText>
        <ThemedText style={styles.heroText}>
          알림 시간을 바꾸거나, 오늘 챙길 것을 다시 확인하실 수 있어요.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText style={styles.sectionTitle}>알림·루틴</ThemedText>
          {reminderCount !== null && !remindersFailed && (
            <ThemedText style={styles.sectionHeaderMeta}>총 {reminderCount}개</ThemedText>
          )}
        </View>
        <WarmCard bordered={false} style={styles.noPad}>
          <Pressable
            onPress={() => openReminders('medication')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <RowDot filled={hasReminders(reminders, 'medication')} />
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
            <RowDot filled={hasReminders(reminders, 'mindfulness')} />
            <View style={styles.rowTextBlock}>
              <ThemedText style={styles.rowLabel}>명상·스트레칭</ThemedText>
              <ThemedText style={styles.rowValue}>
                {summarizeReminders(reminders, remindersFailed, 'mindfulness')}
              </ThemedText>
            </View>
            <ChevronRight />
          </Pressable>
        </WarmCard>
        <ThemedText style={styles.helperNote}>
          각 항목을 누르시면 시간을 바꾸거나 새로 추가하실 수 있어요.
        </ThemedText>
      </View>

      {Platform.OS === 'web' && (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>브라우저 알림</ThemedText>
          <WarmCard bordered={false} style={styles.noPad}>
            <View style={[styles.row, styles.rowLast]}>
              <View style={styles.rowTextBlock}>
                <ThemedText style={styles.rowLabel}>리마인더 알림 받기</ThemedText>
                <ThemedText style={styles.rowValue}>{pushStatusLabel(pushState)}</ThemedText>
              </View>
              {pushState === 'processing' ? (
                <ActivityIndicator color={Warm.primary} />
              ) : pushState === 'on' || pushState === 'off' ? (
                <Pressable
                  onPress={handleTogglePush}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: pushState === 'on' }}
                  accessibilityLabel="리마인더 알림 받기"
                  style={({ pressed }) => [
                    styles.pushToggle,
                    pushState === 'on' && styles.pushToggleOn,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText
                    style={[styles.pushToggleLabel, pushState === 'on' && styles.pushToggleLabelOn]}>
                    {pushState === 'on' ? '켜짐' : '꺼짐'}
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </WarmCard>
          <ThemedText style={styles.helperNote}>
            {pushState === 'denied'
              ? '브라우저 주소창 옆 자물쇠 아이콘에서 알림 권한을 허용하면 다시 켤 수 있어요.'
              : '켜두시면 복약·영양제 시간에 이 브라우저로 알려드려요.'}
          </ThemedText>
          {pushError && <ThemedText style={styles.pushErrorNote}>{pushError}</ThemedText>}
        </View>
      )}

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>계정</ThemedText>
        <WarmCard bordered={false} style={styles.noPad}>
          <View style={[styles.plainRow, styles.rowLast]}>
            <View style={styles.rowTextBlock}>
              <ThemedText style={styles.rowLabel}>로그인 계정</ThemedText>
              <ThemedText style={styles.rowValue}>{accountLabel}</ThemedText>
            </View>
          </View>
        </WarmCard>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>앱 정보</ThemedText>
        <WarmCard bordered={false} style={styles.noPad}>
          <View style={styles.inlineRow}>
            <ThemedText style={styles.rowLabel}>버전</ThemedText>
            <ThemedText style={styles.rowValue}>{version}</ThemedText>
          </View>
          <View style={[styles.plainRow, styles.rowLast]}>
            <View style={styles.rowTextBlock}>
              <ThemedText style={styles.rowLabel}>이용약관 · 개인정보 처리방침</ThemedText>
              <ThemedText style={styles.rowValue}>기록을 어떻게 보관하는지 적어두었어요</ThemedText>
            </View>
          </View>
        </WarmCard>

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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  plainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  rowDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(15, 61, 44, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowDotFilled: {
    borderWidth: 0,
    backgroundColor: Warm.primary,
  },
  rowTextBlock: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  rowValue: {
    fontSize: 15,
    lineHeight: 21,
    color: Warm.textSecondary,
  },
  helperNote: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.text,
    opacity: 0.78,
  },
  pushToggle: {
    minWidth: 64,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Warm.border,
    backgroundColor: Warm.background,
  },
  pushToggleOn: {
    backgroundColor: Warm.primary,
    borderColor: Warm.primary,
  },
  pushToggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Warm.text,
  },
  pushToggleLabelOn: {
    color: '#ffffff',
  },
  pushErrorNote: {
    fontSize: 14,
    lineHeight: 20,
    color: Warm.secondaryStrong,
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
