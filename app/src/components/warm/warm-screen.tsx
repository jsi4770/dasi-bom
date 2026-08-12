import { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Warm } from '@/constants/theme';

export type WarmScreenProps = {
  header?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
};

/** 온보딩/홈 화면 공통 뼈대: 상단 헤더(선택) + 세이프에어리어 대응 스크롤 영역. */
export function WarmScreen({ header, children, scrollable = true }: WarmScreenProps) {
  const insets = useSafeAreaInsets();

  const contentPlatformStyle = Platform.select({
    android: { paddingBottom: insets.bottom },
    web: { paddingBottom: 32 },
  });

  return (
    <View style={styles.root}>
      {header}
      {scrollable ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, contentPlatformStyle]}>
          <View style={styles.inner}>{children}</View>
        </ScrollView>
      ) : (
        <View style={styles.staticWrapper}>
          <View style={[styles.inner, styles.staticContent]}>{children}</View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Warm.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  // scrollable=false 경로: 넓은 화면(웹)에서 scrollContent와 동일하게 inner 블록을
  // 뷰포트 전체 기준 가운데로 오게 함(WarmComingSoon 등에서 사용).
  staticWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  staticContent: {
    flex: 1,
  },
});
