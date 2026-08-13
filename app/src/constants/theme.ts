/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform, type ViewStyle } from 'react-native';

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
 * 배경 원형 장식(블롭)을 단색 원 대신 흐릿하게 번진 얼룩처럼 보이게 한다.
 * react-native-web(0.21)은 `experimental_backgroundImage`를 CSS로 옮기지 못해 웹에서 배경이
 * 통째로 사라지므로 웹은 표준 `backgroundImage` 키를 따로 써야 한다. 그라디언트가 박스 경계
 * 바로 앞(75%)까지 불투명을 유지하면 blur(30px)가 번질 여백이 부족해 박스 모서리가 사각형으로
 * 잘려 보이길래(경계 클리핑) 45%부터 완전 투명으로 만들어 blur가 안에서 다 번지게 여유를 둔다.
 */
export function blobDecorationStyle(color: string): ViewStyle {
  const gradient = `radial-gradient(circle, ${color} 0%, ${color} 20%, transparent 45%)`;
  return Platform.OS === 'web'
    ? ({ backgroundImage: gradient, filter: 'blur(30px)' } as ViewStyle)
    : ({ experimental_backgroundImage: gradient, filter: 'blur(30px)' } as ViewStyle);
}

/**
 * 증상 심각도 표시용 — 신호등 계열(초록→노랑/주황→빨강)로 직관적인 위험도를 전달한다.
 * fill/border는 항상 함께 써서(카드 위 원색 단독 대비가 낮음) 흰 배경 위에서도 형태가 또렷하게 보이게 하고,
 * 색만으로 정보를 전달하지 않도록 label 텍스트를 항상 같이 표기한다.
 * 증상 기록 전용 팔레트 — 저녁 체크인은 방향이 반대라 [[CheckInColors]]를 따로 쓴다.
 */
// 라벨은 backend/apps/symptoms/models.py의 SymptomLog.Severity(MILD/MODERATE/SEVERE) 한글 표기와 맞춤.
export const SeverityColors = {
  mild: { fill: '#839958', soft: '#EEF1E4', border: '#5C6B3E', label: '가벼움' },
  moderate: { fill: '#C79A4E', soft: '#F6E9D2', border: '#8A6425', label: '보통' },
  severe: { fill: '#B0563F', soft: '#F3DFD8', border: '#7A3A29', label: '심함' },
} as const;

export type SeverityLevel = keyof typeof SeverityColors;

/**
 * DailyCheckIn.Scale(1~5, 낮을수록 나쁨)용 색상 — 증상 심각도(SeverityColors)와 의미 방향이 반대라서
 * (증상은 심할수록 진하게, 체크인은 값이 낮을수록/나쁠수록 진하게) 팔레트를 완전히 분리했다.
 * 기존 매핑 로직(<=2 나쁨 / ==3 보통 / 그 외 좋음)과 슬라이더 동작은 그대로 유지.
 */
export const CheckInColors = {
  low: '#B0563F', // 나쁨(1~2) — severe와 동일 계열의 경고색
  neutral: '#C79A4E', // 보통(3)
  high: '#839958', // 좋음(4~5) — 안정감을 주는 그린 계열
} as const;

export function checkInScaleColor(value: number) {
  if (value <= 2) return CheckInColors.low;
  if (value === 3) return CheckInColors.neutral;
  return CheckInColors.high;
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

// 웹 탭바(components/app-tabs.web.tsx)는 콘텐츠 위에 position:absolute로 얹히는 오버레이라 실제
// 렌더 높이만큼 하단 여백을 직접 확보해줘야 한다 — tabListContainer padding(16×2) +
// innerContainer paddingVertical(8×2) + tabButtonView minHeight(44) + borderTopWidth(1) = 93.
// 탭바 쪽 치수가 바뀌면 이 값도 함께 맞춰야 한다.
const WEB_TAB_BAR_HEIGHT = 93;

export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: WEB_TAB_BAR_HEIGHT }) ?? 0;
// 모바일 웹(QR 접속)을 기준 화면으로 보되, 큰 화면(PC 브라우저)에서 콘텐츠가 과도하게 늘어나지
// 않도록 잡아주는 상한값. 특정 기기 해상도를 흉내내는 고정폭이 아니라 폭이 좁을 땐 100%로
// 자연스럽게 줄어들고, 넓을 땐 이 값에서 멈추는 용도로만 쓴다.
export const MaxContentWidth = 480;
