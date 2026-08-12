// 백엔드 연동 전 임시 목업 데이터.
// 필드 이름은 backend/apps/symptoms 응답 스키마(README 참고)와 맞춰두었다 —
// GET /api/symptoms/types/, GET /api/symptoms/checkins/today/ 로 교체할 때 타입 변경 없이 붙일 수 있게 하였다

export type SymptomType = {
  code: string;
  label: string;
  category: 'vasomotor' | 'sleep' | 'mood' | 'physical';
  emoji: string;
};

// backend/apps/symptoms/models.py SymptomLog.Severity(1/2/3)와 동일 — 원터치 기록 후 다시 누르면
// 가벼움→보통→심함→기록 취소 순으로 순환한다. 기본값은 백엔드와 동일하게 'moderate'.
export type Severity = 'mild' | 'moderate' | 'severe';
export const SEVERITY_CYCLE: Severity[] = ['mild', 'moderate', 'severe'];
export const DEFAULT_SEVERITY: Severity = 'moderate';

// backend/apps/symptoms/models.py DailyCheckIn.Scale(1~5)와 동일한 5단계 척도.
// "입력 부담을 줄이려고 필수는 수면·기분 두 개뿐" — 저녁 체크인 바텀시트도 이 두 항목만 요구한다.
export const CHECKIN_SCALE_LABELS = ['매우 나쁨', '나쁨', '보통', '좋음', '매우 좋음'] as const;
export const CHECKIN_SCALE_MIN = 1;
export const CHECKIN_SCALE_MAX = 5;
export const DEFAULT_CHECKIN_SCALE = 3; // Scale.NEUTRAL

export type TodaySymptomLog = Record<string, Severity>;
export type TodayCheckIn = { sleepQuality: number; mood: number } | null;

// backend/apps/symptoms/migrations/0002_seed_symptom_types.py 의 12종과 동일
export const SYMPTOM_TYPES: SymptomType[] = [
  { code: 'hot_flash', label: '홍조', category: 'vasomotor', emoji: '🔥' },
  { code: 'night_sweat', label: '식은땀', category: 'vasomotor', emoji: '💧' },
  { code: 'palpitation', label: '두근거림', category: 'vasomotor', emoji: '💓' },
  { code: 'insomnia', label: '잠들기 어려움', category: 'sleep', emoji: '🌙' },
  { code: 'night_waking', label: '자다 깸', category: 'sleep', emoji: '😪' },
  { code: 'low_mood', label: '기분 가라앉음', category: 'mood', emoji: '🌧️' },
  { code: 'irritability', label: '짜증·예민함', category: 'mood', emoji: '⚡' },
  { code: 'anxiety', label: '불안', category: 'mood', emoji: '😰' },
  { code: 'joint_pain', label: '관절통', category: 'physical', emoji: '🦴' },
  { code: 'headache', label: '두통', category: 'physical', emoji: '🤕' },
  { code: 'fatigue', label: '피로감', category: 'physical', emoji: '🔋' },
  { code: 'dryness', label: '건조·불편감', category: 'physical', emoji: '🌵' },
];

// TODO: 백엔드 연동되면 GET /api/symptoms/checkins/?from=&to= 집계로 교체
export const MOCK_WEEKLY_STATS = {
  hotFlashCount: 4,
  avgSleepHours: 5.5,
  moodLabel: '보통',
  trendNote: '지난주보다 홍조가 줄었어요. 잘 기록하고 있어요.',
};

// TODO: 백엔드 연동되면 GET /api/notifications/today/ 로 교체
export const MOCK_ROUTINE_STATUS = {
  medicationDoneToday: true,
  medicationSummary: '오늘 1회 완료',
  meditationDoneToday: false,
  meditationSummary: '오늘 아직 안 했어요',
};

export const MENOPAUSE_SURVEY_OPTIONS = [
  '생리 주기가 불규칙해지기 시작했어요',
  '생리가 완전히 멈춘 지 1년이 넘었어요',
  '완경 이후 몇 년이 지났어요',
  '잘 모르겠어요 / 해당 사항 없음',
];
