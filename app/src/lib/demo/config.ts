/** 데모 모드 — 백엔드 없이 앱 전체를 브라우저/기기 안의 목업으로 구동한다.
 *
 * `EXPO_PUBLIC_DEMO_MODE=true`로 빌드하면 켜진다. Expo는 `process.env.EXPO_PUBLIC_*`의 정적 참조만
 * 번들에 인라인하므로, 반드시 이 리터럴 형태로 읽어야 한다(`process.env[name]`은 인라인되지 않음). */
export function isDemoMode(): boolean {
  return process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
}
