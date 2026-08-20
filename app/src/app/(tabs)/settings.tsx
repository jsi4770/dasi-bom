import { Image } from 'expo-image';
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

function ChevronRight() {
  return (
    <SymbolView
      name={{ ios: 'chevron.right', android: 'arrow_forward', web: 'arrow_forward' }}
      size={14}
      tintColor={Warm.textDeep}
    />
  );
}

// 시안(다시봄 리뉴얼 설정.dc.html)이 로그아웃 시트에만 쓰는 mascot-hello — 온보딩 첫 화면과
// 같은 "인사하는 봄이" 이미지라 새 에셋 없이 그대로 재사용한다.
const LOGOUT_MASCOT_IMAGE = require('@/assets/images/onboarding/hello.png');

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
        <WarmCard style={styles.cardGroup}>
          <Pressable
            onPress={() => openReminders('medication')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cardRow, pressed && styles.pressed]}>
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
            style={({ pressed }) => [styles.cardRow, styles.cardRowDivider, pressed && styles.pressed]}>
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
          <WarmCard style={styles.cardGroup}>
            <View style={styles.cardRow}>
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
        <WarmCard style={styles.accountCard}>
          <ThemedText style={styles.rowLabel}>로그인 계정</ThemedText>
          <ThemedText style={styles.rowValue}>{accountLabel}</ThemedText>
        </WarmCard>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>앱 정보</ThemedText>
        <WarmCard style={styles.cardGroup}>
          <View style={styles.rowSingle}>
            <ThemedText style={styles.rowLabel}>버전</ThemedText>
            <ThemedText style={styles.rowValue}>{version}</ThemedText>
          </View>
        </WarmCard>

        <View style={styles.infoNoteSpacing}>
          <WarmInfoNote text="다시-봄의 기록은 참고용이며, 의료적 진단이나 처방을 대신하지 않아요." />
        </View>
      </View>

      <View style={styles.spacer} />

      <Pressable
        onPress={() => setLogoutSheetVisible(true)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.logoutLink, pressed && styles.pressed]}>
        <ThemedText style={styles.logoutLinkText}>로그아웃</ThemedText>
      </Pressable>

      <WarmBottomSheet visible={logoutSheetVisible} onClose={() => setLogoutSheetVisible(false)} title="">
        <View style={styles.logoutIntro}>
          <View style={styles.logoutMascotWrap}>
            <Image source={LOGOUT_MASCOT_IMAGE} style={styles.logoutMascotImage} contentFit="cover" />
          </View>
          <ThemedText style={styles.logoutSheetTitle}>로그아웃 할까요?</ThemedText>
          <ThemedText style={styles.logoutSheetText}>
            지금까지의 기록은 계정에 그대로 남아 있어요. 다시 로그인하시면 이어서 보실 수 있습니다.
          </ThemedText>
        </View>
        <View style={styles.logoutButtonGroup}>
          <WarmButton
            label={loggingOut ? '로그아웃 중…' : '로그아웃'}
            onPress={handleLogout}
          />
          <WarmButton label="돌아가기" variant="secondary" onPress={() => setLogoutSheetVisible(false)} />
        </View>
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
    fontSize: 16,
    fontWeight: '700',
    color: Warm.textDeep,
    marginBottom: 12,
  },
  // 시안(다시봄 리뉴얼 설정.dc.html)의 "구분선 목록 → 라운드 카드 그룹" 변경 — WarmCard를 목록
  // 컨테이너로 쓰고, 항목 사이는 카드 안쪽 옅은 구분선(cardRowDivider)으로만 나눈다.
  cardGroup: {
    paddingHorizontal: 18,
    paddingVertical: 4,
    gap: 0,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 80,
    paddingVertical: 14,
  },
  cardRowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(46, 42, 36, 0.1)',
  },
  rowSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingVertical: 12,
  },
  accountCard: {
    gap: 4,
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
  pushToggle: {
    minWidth: 64,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Warm.border,
    backgroundColor: Warm.card,
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
    marginTop: 8,
  },
  infoNoteSpacing: {
    marginTop: 16,
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
  },
  logoutLinkText: {
    fontSize: 16,
    fontWeight: '700',
    color: Warm.textDeep,
    textDecorationLine: 'underline',
  },
  logoutIntro: {
    alignItems: 'center',
    gap: 10,
  },
  // chat.tsx의 headerAvatar와 동일한 원형 아바타 컨벤션(Warm.card 배경 + 올리브 톤 테두리).
  logoutMascotWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    backgroundColor: Warm.card,
    borderWidth: 1.5,
    borderColor: 'rgba(131, 153, 88, 0.45)',
    marginBottom: 4,
  },
  logoutMascotImage: {
    width: '100%',
    height: '100%',
  },
  logoutSheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Warm.textDeep,
    textAlign: 'center',
  },
  logoutSheetText: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.text,
    opacity: 0.85,
    textAlign: 'center',
  },
  logoutButtonGroup: {
    gap: 10,
  },
});
