import { router, Slot, usePathname } from 'expo-router';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';

import { ThemedText } from './themed-text';

import { MaxContentWidth, Spacing, Warm } from '@/constants/theme';

const TABS = [
  { key: 'home', href: '/', label: '홈' },
  { key: 'report', href: '/report', label: '리포트' },
  { key: 'care', href: '/care', label: '돌봄' },
  { key: 'chat', href: '/chat', label: '대화' },
  { key: 'settings', href: '/settings', label: '설정' },
] as const;

// 이 폭 이상이면 "실제 모바일 브라우저"가 아니라 데스크톱 브라우저로 보고 폰 프레임을 씌운다.
// 네이티브(app-tabs.tsx의 NativeTabs)는 이 파일 자체를 안 쓰므로 실기기 실행엔 영향 없음.
const DESKTOP_BREAKPOINT = 820;
// 실제 모바일 목업 캡처(430x932)와 동일한 세로 비율.
const PHONE_ASPECT_RATIO = 932 / 430;
const PHONE_FRAME_MARGIN = 48;
const PHONE_FRAME_MAX_HEIGHT = 900;

/**
 * expo-router/ui의 Tabs/TabList/TabSlot 조합은 선언한 탭 외 경로(onboarding/*,
 * symptom-log, face-capture 등)로는 못 감 — 안 걸린 경로는 그냥 첫 탭으로 남아있음.
 * Slot(=현재 매칭된 라우트를 그대로 렌더)로 바꾸고, 탭 바는 5개 탭 루트에서만
 * 직접 그려서 네이티브(NativeTabs)와 동일하게 임의 화면 push가 가능하게 함.
 */
export default function AppTabs() {
  const pathname = usePathname();
  const showTabBar = TABS.some((tab) => tab.href === pathname);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= DESKTOP_BREAKPOINT;

  const body = (
    <View style={styles.root}>
      <Slot />
      {showTabBar && (
        <View style={styles.tabListContainer}>
          <View style={styles.innerContainer}>
            {TABS.map((tab) => {
              const isFocused = tab.href === pathname;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => router.push(tab.href)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <View style={[styles.tabButtonView, isFocused && styles.tabButtonViewFocused]}>
                    <ThemedText type="small" style={isFocused ? styles.labelFocused : styles.label}>
                      {tab.label}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );

  if (!isDesktop) {
    return body;
  }

  // 세로 비율을 유지하면서 뷰포트 안에 들어오도록, 높이를 먼저 잡고 거기서 폭을 역산 —
  // 폭이 MaxContentWidth를 넘으면 그때는 폭을 기준으로 다시 잡는다(반대로 하면 아주 넓고
  // 낮은 창에서 폰이 옆으로 퍼져버림).
  let frameHeight = Math.min(windowHeight - PHONE_FRAME_MARGIN * 2, PHONE_FRAME_MAX_HEIGHT);
  let frameWidth = frameHeight / PHONE_ASPECT_RATIO;
  if (frameWidth > MaxContentWidth) {
    frameWidth = MaxContentWidth;
    frameHeight = frameWidth * PHONE_ASPECT_RATIO;
  }

  return (
    <View style={styles.desktopBackdrop}>
      <View style={[styles.phoneFrame, { width: frameWidth, height: frameHeight }]}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  desktopBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DAD5C8',
  },
  phoneFrame: {
    borderRadius: 44,
    borderWidth: 10,
    borderColor: '#17160F',
    overflow: 'hidden',
    backgroundColor: Warm.background,
    boxShadow: '0px 30px 70px rgba(23, 22, 15, 0.35)',
  },
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    backgroundColor: Warm.card,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  tabButtonViewFocused: {
    backgroundColor: Warm.primarySoft,
  },
  label: {
    fontSize: 15,
    color: Warm.textSecondary,
  },
  labelFocused: {
    fontSize: 15,
    color: Warm.primaryStrong,
    fontWeight: '700',
  },
});
