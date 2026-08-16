import { DarkTheme, DefaultTheme, Redirect, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/lib/auth-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const pathname = usePathname();
  const { status } = useAuth();

  // TODO: 온보딩 완료 여부를 저장(AsyncStorage 등)해서 재방문 시에는 건너뛰게 하기.
  // pathname이 실제로 onboarding에 들어온 걸 렌더 중에 확인하고서야 Redirect를 내림 —
  // effect에서 내리면 같은 틱에 바로 언마운트되어 아직 처리 중인 replace 액션이 씹힘.
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [needsBootRedirect, setNeedsBootRedirect] = useState(true);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (pathname.startsWith('/onboarding')) {
      setNeedsBootRedirect(false);
    }
  }

  // 인증 상태를 아직 모르는 동안(저장된 토큰 확인/검증 중)에는 홈·탭이 잠깐 보이는 걸 막기 위해
  // 아무것도 그리지 않는다 — AnimatedSplashOverlay가 그 위를 덮고 있어 화면은 계속 스플래시로 보인다.
  if (status === 'loading') {
    return null;
  }

  const isAuthRoute = pathname.startsWith('/auth');

  // 세 조건은 상호 배타적으로 평가해야 한다 — 그렇지 않으면 인증 성공 직후처럼
  // isAuthRoute와 needsBootRedirect가 동시에 참인 순간 <Redirect>가 두 개 마운트되어
  // 서로 다른 목적지로 navigate를 경쟁시킨다. needsBootRedirect(온보딩 미방문)가
  // isAuthRoute보다 먼저 판정되어야 "인증 성공 → 온보딩으로 한 번에" 흐름이 유지된다.
  let redirectTarget: 'auth' | 'onboarding' | 'home' | null = null;
  if (status === 'unauthenticated' && !isAuthRoute) {
    redirectTarget = 'auth';
  } else if (status === 'authenticated' && needsBootRedirect) {
    redirectTarget = 'onboarding';
  } else if (status === 'authenticated' && isAuthRoute) {
    redirectTarget = 'home';
  }

  return (
    <>
      {redirectTarget === 'auth' && <Redirect href="/auth" />}
      {redirectTarget === 'onboarding' && <Redirect href="/onboarding/welcome" />}
      {redirectTarget === 'home' && <Redirect href="/" />}
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="face-capture" options={{ headerShown: false }} />
        <Stack.Screen name="face-result" options={{ headerShown: false }} />
        <Stack.Screen name="symptom-log" options={{ headerShown: false }} />
        <Stack.Screen name="mindfulness-session" options={{ headerShown: false }} />
        <Stack.Screen name="medication" options={{ headerShown: false }} />
        <Stack.Screen name="medication-form" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/welcome" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/survey" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/survey-result" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/consent" options={{ headerShown: false }} />
        <Stack.Screen name="auth/index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
