import { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Warm } from '@/constants/theme';

export type WarmScreenProps = {
  header?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
  /** 기본은 크림 배경(Warm.background). 로그인/회원가입처럼 화면 전체가 하나의 흰 카드처럼
   * 보이는 시안(Warm.card)을 쓸 때만 지정한다. */
  backgroundColor?: string;
};

/** 온보딩/홈 화면 공통 뼈대: 상단 헤더(선택) + 세이프에어리어 대응 스크롤 영역. */
export function WarmScreen({
  header,
  children,
  scrollable = true,
  backgroundColor = Warm.background,
}: WarmScreenProps) {
  const insets = useSafeAreaInsets();

  const contentPlatformStyle = Platform.select({
    android: { paddingBottom: insets.bottom },
    web: { paddingBottom: 32 },
  });

  // 안드로이드는 기존 상태바 처리 그대로 유지 — iOS(PWA 포함)/일반 웹만 노치·다이나믹 아일랜드를
  // 피하도록 상단 세이프에어리어만큼 추가 여백을 준다. 일반 웹 브라우저는 insets.top이 0이라 기존
  // 레이아웃과 동일하게 보인다.
  const topInset = Platform.OS === 'android' ? 0 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor, paddingTop: topInset }]}>
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
