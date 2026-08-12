/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // ThemedText의 themeColor 기본값 — Warm 팔레트와 어긋나면(예: 차가운 회색) 화면 전체가 이질적으로 보이므로 Warm 톤과 동일하게 맞춰둔다.
    text: '#2E2A24',
    background: '#F3EFE6',
    backgroundElement: '#FBF9F3',
    backgroundSelected: '#E8EDE3',
    textSecondary: '#5C574C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * "다시-봄" 온보딩/홈 디자인 전용 팔레트 (2024 리디자인 — 핑크+그린 방향, 디자인 시안
 * "다시봄 온보딩.dc.html" 기준). 50대 완경기 사용자 타깃, 그라디언트 없이 단색 팔레트 유지.
 * 베이스: 크림(배경), 딥그린(메인 포인트·헤드라인), 더스티로즈/피치(보조 포인트), 올리브(장식 강조).
 * 텍스트·주요 버튼은 배경 대비 WCAG AA(4.5:1, 큰 텍스트/UI 요소는 3:1) 이상을 만족하도록 각 톤의
 * strong/soft 파생색을 함께 정의해뒀다 — 새 색을 추가할 때도 이 기준으로 검증할 것.
 * 다크모드 시안은 없어서 라이트 전용.
 */
export const Warm = {
  // 배경
  background: '#F3EFE6', // 크림 — 기본 화면 배경
  backgroundWarm: '#F4E2D4', // 피치 — 히어로 등 강조 섹션 배경
  backgroundSubtle: '#EDE8DA', // 옅은 중립 — 리스트 아이템 미선택 배경, 슬라이더 트랙
  card: '#FBF9F3', // 카드 배경(따뜻한 화이트)
  border: 'rgba(46, 42, 36, 0.14)',

  // 텍스트
  text: '#2E2A24', // 기본 본문 텍스트 (카드·화이트 위 15:1, 배경 위 12.4:1)
  textDeep: '#0F3D2C', // 딥그린 — 헤드라인·강조 텍스트 (화이트 위 12.2:1)
  textSecondary: '#5C574C', // 보조 텍스트 (배경/카드 위 6.2:1)
  textTertiary: '#8C8676', // 캡션류 — 큰 텍스트/아이콘 라벨 전용(작은 텍스트엔 사용 금지)

  // 메인 포인트 — 딥그린
  primary: '#0F3D2C',
  primaryShadow: 'rgba(15, 61, 44, 0.3)',
  primaryStrong: '#0F3D2C', // 흰 텍스트와 12.2:1 — 작은 텍스트에도 안전
  primaryDeep: '#0A2A1D', // 눌림 상태 등 진한 강조
  primarySoft: '#E8EDE3',
  primarySoftBorder: '#C3D0BC',

  // 보조 포인트 — 더스티로즈/피치
  secondary: '#D3968C', // 장식용(블롭 등) — 작은 텍스트 배경으로는 대비 부족, 큰 도형 전용
  secondaryStrong: '#6E3B26', // 피치 배경 위 텍스트/아이콘용 (7.2:1)
  secondarySoft: '#F4E2D4',
  secondarySoftBorder: '#E8C7B8',

  // 부드러운 보조 강조 — 올리브 (장식 블롭, 토글 on 등. 작은 텍스트 배경 금지 — 대비 3.2:1)
  accentSoft: '#839958',
  accentSoftStrong: '#5C6B3E', // 큰 텍스트/아이콘 전용(작은 텍스트엔 사용 금지)
  accentSoftBg: '#EEF1E4',

  // 히어로/결과 카드 — 피치 바탕 강조 섹션
  heroBg: '#F4E2D4',
  heroBorder: '#E8C7B8',
  heroTitle: '#0F3D2C',
  heroText: '#2E2A24',

  resultBg: '#FBF9F3',
  resultBorder: 'rgba(46, 42, 36, 0.14)',
  resultLabel: '#6E3B26',
  resultTitle: '#0F3D2C',
  resultText: '#2E2A24',
} as const;

/**
 * 증상 심각도 표시용 — 팔레트 톤 안에서 명도 차이로 구분(피스타치 → 차이 → 캐롭 순으로 진해짐).
 * fill/border는 항상 함께 써서(카드 위 원색 단독 대비가 낮음) 흰 배경 위에서도 형태가 또렷하게 보이게 하고,
 * 색만으로 정보를 전달하지 않도록 label 텍스트를 항상 같이 표기한다.
 */
// 라벨은 backend/apps/symptoms/models.py의 SymptomLog.Severity(MILD/MODERATE/SEVERE) 한글 표기와 맞춤.
export const SeverityColors = {
  mild: { fill: Warm.accentSoft, soft: Warm.accentSoftBg, border: Warm.accentSoftStrong, label: '가벼움' },
  moderate: { fill: Warm.secondary, soft: Warm.secondarySoft, border: Warm.secondaryStrong, label: '보통' },
  severe: { fill: Warm.text, soft: '#E7E0D0', border: Warm.textDeep, label: '심함' },
} as const;

export type SeverityLevel = keyof typeof SeverityColors;

/**
 * DailyCheckIn.Scale(1~5, 낮을수록 나쁨)용 색상 — SeverityColors와 방향이 반대라서
 * (증상은 심각도가 높을수록 진하게, 체크인은 값이 낮을수록/나쁠수록 진하게) 별도 헬퍼로 분리했다.
 */
export function checkInScaleColor(value: number) {
  if (value <= 2) return SeverityColors.severe.fill;
  if (value === 3) return SeverityColors.moderate.fill;
  return SeverityColors.mild.fill;
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
