// Reminder.time은 백엔드에서 "HH:MM:SS" 문자열로 온다(DRF TimeField 기본 직렬화).
// 리마인더 화면들(medication.tsx, medication-form.tsx, 홈 카드)이 공통으로 쓰는 표시/그룹핑 로직.

export type TimeBucket = '아침' | '점심' | '저녁' | '취침';

export const TIME_BUCKET_ORDER: TimeBucket[] = ['아침', '점심', '저녁', '취침'];

export function parseTimeParts(time: string): { hour: number; minute: number } {
  const [hStr, mStr] = time.split(':');
  return { hour: Number(hStr), minute: Number(mStr) };
}

export function timeBucket(time: string): TimeBucket {
  const { hour } = parseTimeParts(time);
  if (hour >= 5 && hour < 11) return '아침';
  if (hour >= 11 && hour < 17) return '점심';
  if (hour >= 17 && hour < 21) return '저녁';
  return '취침';
}

export function formatTimeLabel(time: string): string {
  const { hour, minute } = parseTimeParts(time);
  const period = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${hour12}:${String(minute).padStart(2, '0')}`;
}

/** 저장용 "HH:MM:SS" 문자열로 변환. */
export function buildTimeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}
