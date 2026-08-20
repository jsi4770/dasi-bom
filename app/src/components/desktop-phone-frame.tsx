import { ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { MaxContentWidth, Warm } from '@/constants/theme';

// 이 폭 이상이면 "실제 모바일 브라우저"가 아니라 데스크톱 브라우저로 보고 폰 프레임을 씌운다.
const DESKTOP_BREAKPOINT = 820;
// 실제 모바일 목업 캡처(430x932)와 동일한 세로 비율.
const PHONE_ASPECT_RATIO = 932 / 430;
const PHONE_FRAME_MARGIN = 48;
const PHONE_FRAME_MAX_HEIGHT = 900;

/**
 * 데스크톱 웹 브라우저에서만 앱 전체를 폰 프레임(둥근 베젤 + 그림자)으로 감싼다.
 * 앱 루트(app/_layout.tsx)에서 한 번만 씌워서 인증/온보딩/탭 화면 전부에 적용되게 한다.
 * Platform.OS 체크가 있어 네이티브(iOS/Android)에서는 항상 children을 그대로 반환하고,
 * 웹이라도 뷰포트 폭이 DESKTOP_BREAKPOINT 미만(실제 모바일 브라우저)이면 그대로 반환 —
 * 즉 실기기 실행에는 어떤 경우에도 영향이 없다.
 */
export function DesktopPhoneFrame({ children }: { children: ReactNode }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && windowWidth >= DESKTOP_BREAKPOINT;

  if (!isDesktopWeb) {
    return <>{children}</>;
  }

  // 세로 비율을 유지하면서 뷰포트 안에 들어오도록, 높이를 먼저 잡고 거기서 폭을 역산 —
  // 폭이 MaxContentWidth를 넘으면 그때는 폭을 기준으로 다시 잡는다(반대로 하면 아주 넓고
  // 낮은 창에서 폰이 옆으로 퍼져버린다).
  let frameHeight = Math.min(windowHeight - PHONE_FRAME_MARGIN * 2, PHONE_FRAME_MAX_HEIGHT);
  let frameWidth = frameHeight / PHONE_ASPECT_RATIO;
  if (frameWidth > MaxContentWidth) {
    frameWidth = MaxContentWidth;
    frameHeight = frameWidth * PHONE_ASPECT_RATIO;
  }

  return (
    <View style={styles.backdrop}>
      <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DAD5C8',
  },
  frame: {
    borderRadius: 44,
    borderWidth: 2.5,
    borderColor: '#17160F',
    overflow: 'hidden',
    backgroundColor: Warm.background,
    boxShadow: '0px 30px 70px rgba(23, 22, 15, 0.35)',
  },
});
