import { DarkTheme, DefaultTheme, Redirect, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();

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

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {needsBootRedirect && <Redirect href="/onboarding/welcome" />}
      <AppTabs />
    </ThemeProvider>
  );
}
