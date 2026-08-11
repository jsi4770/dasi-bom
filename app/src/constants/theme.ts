/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // ThemedText의 themeColor 기본값 — Warm 팔레트와 어긋나면(예: 차가운 회색) 화면 전체가
    // 이질적으로 보이므로 Warm 톤과 동일하게 맞춰둔다.
    text: '#725C3A',
    background: '#E5E0D8',
    backgroundElement: '#EFE9DF',
    backgroundSelected: '#E4E9DF',
    textSecondary: '#7A6748',
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
 * "완경기 웰니스 코칭" 온보딩/홈 디자인 전용 팔레트.
 * 50대 완경기 사용자 타깃 — 어스톤(자연스러운 흙톤) 단색 팔레트, 그라디언트 없음.
 * 베이스 5색: 아몬드/바닐라(배경), 매치(메인 포인트), 차이(보조 포인트), 캐롭(텍스트), 피스타치(부드러운 보조 강조).
 * 텍스트·주요 버튼은 배경 대비 WCAG AA(4.5:1, 큰 텍스트/UI 요소는 3:1) 이상을 만족하도록 각 톤의
 * strong/soft 파생색을 함께 정의해뒀다 — 새 색을 추가할 때도 이 기준으로 검증할 것.
 * 다크모드 시안은 없어서 라이트 전용.
 */
export const Warm = {
  // 배경
  background: '#E5E0D8', // 아몬드 — 기본 화면 배경
  backgroundWarm: '#E5D2B8', // 바닐라 — 히어로 등 강조 섹션 배경
  backgroundSubtle: '#EFE9DF', // 옅은 중립 — 리스트 아이템 미선택 배경
  card: '#FCFAF6', // 카드 배경(따뜻한 화이트)
  border: '#D9C9AE',

  // 텍스트 — 캐롭 계열
  text: '#725C3A', // 기본/강조 텍스트 (카드·화이트 위 6.1:1, 배경 위 4.8:1)
  textDeep: '#5A4A2E', // 진한 캐롭 — backgroundWarm 위 텍스트, 헤드라인
  textSecondary: '#7A6748', // 보조 텍스트 — 카드/소프트 배경 위에서만 사용(5:1대)
  textTertiary: '#95815C', // 캡션류 — 큰 텍스트/아이콘 라벨 전용(작은 텍스트엔 사용 금지)

  // 메인 포인트 — 매치
  primary: '#809671',
  primaryShadow: 'rgba(128, 150, 113, 0.35)',
  primaryStrong: '#5E6E53', // 흰 텍스트와 5.5:1 — 작은 텍스트/네비 아이콘용
  primaryDeep: '#47563E', // 눌림 상태 등 진한 강조
  primarySoft: '#E4E9DF',
  primarySoftBorder: '#C7D1BE',

  // 보조 포인트 — 차이
  secondary: '#D2AB80',
  secondaryStrong: '#9C7A4E', // 큰 텍스트/아이콘 전용(작은 텍스트엔 사용 금지)
  secondarySoft: '#F3E8DA',
  secondarySoftBorder: '#E4CDAE',

  // 부드러운 보조 강조 — 피스타치 (낮은 심각도 등)
  accentSoft: '#B3B792',
  accentSoftStrong: '#7D8264', // 큰 텍스트/아이콘 전용(작은 텍스트엔 사용 금지)
  accentSoftBg: '#EDEFE5',

  // 히어로/결과 카드 — 바닐라 바탕 강조 섹션
  heroBg: '#E5D2B8',
  heroBorder: '#DCC29C',
  heroTitle: '#5A4A2E',
  heroText: '#5A4A2E',

  resultBg: '#E4E9DF',
  resultBorder: '#C7D1BE',
  resultLabel: '#725C3A',
  resultTitle: '#5A4A2E',
  resultText: '#725C3A',
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
  severe: { fill: Warm.text, soft: '#E9E1D3', border: Warm.textDeep, label: '심함' },
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
