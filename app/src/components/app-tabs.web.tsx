import { router, Slot, usePathname } from 'expo-router';
import { Pressable, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';

import { MaxContentWidth, Spacing, Warm } from '@/constants/theme';

const TABS = [
  { key: 'home', href: '/', label: '홈' },
  { key: 'report', href: '/report', label: '리포트' },
  { key: 'care', href: '/care', label: '돌봄' },
  { key: 'chat', href: '/chat', label: '대화' },
  { key: 'settings', href: '/settings', label: '설정' },
] as const;

/**
 * expo-router/ui의 Tabs/TabList/TabSlot 조합은 선언한 탭 외 경로(onboarding/*,
 * symptom-log, face-capture 등)로는 못 감 — 안 걸린 경로는 그냥 첫 탭으로 남아있음.
 * Slot(=현재 매칭된 라우트를 그대로 렌더)로 바꾸고, 탭 바는 5개 탭 루트에서만
 * 직접 그려서 네이티브(NativeTabs)와 동일하게 임의 화면 push가 가능하게 함.
 */
export default function AppTabs() {
  const pathname = usePathname();
  const showTabBar = TABS.some((tab) => tab.href === pathname);

  return (
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
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
