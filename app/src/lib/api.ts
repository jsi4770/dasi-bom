import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { clearTokens, getTokens, saveAccessToken, saveTokens } from '@/lib/auth-storage';

export type ChatSession = {
  id: number;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  created_at: string;
};

type SendMessageResult = {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
}

const SESSION_EXPIRED_MESSAGE = '로그인이 만료됐어요. 다시 로그인해주세요.';

let onSessionExpired: (() => void) | null = null;

/** AuthProvider가 마운트 시 등록한다. refresh까지 실패해 세션이 완전히 끊기면
 * 저장된 토큰을 지운 뒤 이 콜백으로 로그인 화면 이동을 위임한다. */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

async function buildHeaders(init: HeadersInit | undefined, skipAuth: boolean): Promise<Headers> {
  const headers = new Headers(init);
  if (!skipAuth) {
    const tokens = await getTokens();
    if (tokens?.access) {
      headers.set('Authorization', `Bearer ${tokens.access}`);
    }
  }
  return headers;
}

// 동시에 여러 요청이 401을 받아도 refresh 호출은 한 번만 나가도록, 진행 중인 refresh Promise를 공유한다.
let refreshPromise: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const tokens = await getTokens();
  if (!tokens?.refresh) {
    throw new ApiError(401, SESSION_EXPIRED_MESSAGE);
  }
  const { access } = await request<{ access: string }>(
    '/api/auth/token/refresh/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: tokens.refresh }),
    },
    { skipAuth: true }
  );
  await saveAccessToken(access);
  return access;
}

type RequestExtras = {
  /** login/signup/demo-login/refresh처럼 아직 access token이 없거나 불필요한 요청에 사용 — 이 요청들에는
   * Authorization을 붙이지 않고, 401을 받아도 refresh를 시도하지 않는다(무한 refresh 루프 방지). */
  skipAuth?: boolean;
};

async function authorizedFetch(
  path: string,
  init: RequestInit = {},
  { skipAuth = false }: RequestExtras = {}
): Promise<Response> {
  const url = `${getApiBaseUrl()}${path}`;
  const headers = await buildHeaders(init.headers, skipAuth);
  const response = await fetch(url, { ...init, headers });

  if (response.status !== 401 || skipAuth) {
    return response;
  }

  try {
    refreshPromise ??= performRefresh().finally(() => {
      refreshPromise = null;
    });
    const newAccess = await refreshPromise;
    const retryHeaders = new Headers(init.headers);
    retryHeaders.set('Authorization', `Bearer ${newAccess}`);
    return await fetch(url, { ...init, headers: retryHeaders });
  } catch (error) {
    await clearTokens();
    onSessionExpired?.();
    throw error instanceof ApiError ? error : new ApiError(401, SESSION_EXPIRED_MESSAGE);
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null);
  return new ApiError(response.status, body?.detail ?? '요청을 처리하지 못했어요. 다시 시도해주세요.');
}

async function request<T>(path: string, init?: RequestInit, extras?: RequestExtras): Promise<T> {
  const response = await authorizedFetch(path, init, extras);
  if (!response.ok) {
    throw await toApiError(response);
  }
  return response.json() as Promise<T>;
}

export function createChatSession() {
  return request<ChatSession>('/api/chatbot/sessions/', { method: 'POST' });
}

export function sendTextMessage(sessionId: number, text: string) {
  const body = new URLSearchParams({ text });
  return request<SendMessageResult>(`/api/chatbot/sessions/${sessionId}/messages/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

export function sendAudioMessage(sessionId: number, audioBase64: string, mimeType: string) {
  const body = new URLSearchParams({ audio: audioBase64, audio_mime_type: mimeType });
  return request<SendMessageResult>(`/api/chatbot/sessions/${sessionId}/messages/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

export type MindfulnessStep = {
  instruction: string;
  seconds: number;
  pose: string;
};

export type MindfulnessSession = {
  id: number;
  code: string;
  title: string;
  description: string;
  total_seconds: number;
  steps: MindfulnessStep[];
};

export function getMindfulnessSessions() {
  return request<MindfulnessSession[]>('/api/reminders/mindfulness-sessions/');
}

export type TodayReminder = {
  id: number;
  type: 'medication' | 'mindfulness';
  label: string;
  time: string;
  completed: boolean;
};

export function getTodayReminders() {
  return request<TodayReminder[]>('/api/reminders/today/');
}

export function completeReminder(reminderId: number) {
  return request<{ completed: boolean }>(`/api/reminders/${reminderId}/complete/`, { method: 'POST' });
}

// ---- 리마인더 등록·수정·삭제 (backend/apps/notifications ReminderSerializer와 동일한 필드) ----

export type Reminder = {
  id: number;
  type: 'medication' | 'mindfulness';
  label: string;
  time: string;
  is_active: boolean;
  created_at: string;
};

export type ReminderPayload = {
  type: 'medication' | 'mindfulness';
  label: string;
  time: string;
  is_active?: boolean;
};

export function createReminder(payload: ReminderPayload) {
  return request<Reminder>('/api/reminders/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateReminder(reminderId: number, payload: Partial<ReminderPayload>) {
  return request<Reminder>(`/api/reminders/${reminderId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** DRF의 DestroyModelMixin은 204 No Content(빈 바디)를 반환해 request()의 무조건적인
 * response.json() 파싱이 실패한다 — authorizedFetch로 인증/401 refresh는 그대로 타되, 본문은
 * 파싱하지 않는다. */
export async function deleteReminder(reminderId: number): Promise<void> {
  const response = await authorizedFetch(`/api/reminders/${reminderId}/`, { method: 'DELETE' });
  if (!response.ok) {
    throw await toApiError(response);
  }
}

export type FaceAnalysisResult = {
  id: number;
  image: string;
  redness_score: number;
  severity: 'normal' | 'mild' | 'moderate' | 'severe';
  region_scores: Record<string, number>;
  created_at: string;
  lighting_corrected: boolean;
  excluded_regions: string[];
};

/** 촬영한 사진을 얼굴 홍조 분석 API로 업로드한다.
 * 웹은 photoUri가 blob: URL이라 fetch로 Blob을 받아 붙이고,
 * 네이티브는 file:// uri를 그대로 FormData에 넘기면 RN이 알아서 처리한다. */
export async function uploadFaceAnalysis(photoUri: string): Promise<FaceAnalysisResult> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(photoUri)).blob();
    formData.append('image', blob, 'face.jpg');
  } else {
    formData.append('image', {
      uri: photoUri,
      name: 'face.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
  }
  return request<FaceAnalysisResult>('/api/face-analysis/', { method: 'POST', body: formData });
}

/** 메시지 텍스트를 TTS로 합성해 재생 가능한 uri를 반환한다. 인증이 필요한 엔드포인트라 request()와
 * 동일하게 authorizedFetch로 Authorization을 붙이고 401이면 refresh 후 1회 재시도한다.
 * 네이티브는 expo-audio 플레이어가 파일 uri로 재생하는 게 안정적이라 로컬에 다운로드하고,
 * 웹은 expo-file-system이 미지원인 데다 <audio src>가 커스텀 헤더를 못 보내므로
 * 인증된 fetch로 받은 blob을 objectURL로 바꿔 그대로 넘긴다. */
export async function fetchMessageSpeechFile(messageId: number): Promise<string> {
  const path = `/api/chatbot/messages/${messageId}/speech/`;

  try {
    const response = await authorizedFetch(path);
    if (!response.ok) {
      throw new ApiError(502, '음성을 만드는 데 실패했어요. 다시 시도해주세요.');
    }

    if (Platform.OS === 'web') {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }

    const buffer = await response.arrayBuffer();
    const file = new File(Paths.cache, `chatbot-speech-${messageId}-${Date.now()}.wav`);
    file.create();
    file.write(new Uint8Array(buffer));
    return file.uri;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(502, '음성을 만드는 데 실패했어요. 다시 시도해주세요.');
  }
}

// ---- 인증 ----

export type AuthUser = {
  id: number;
  username: string;
  email: string;
};

/** demo-login / signup 응답 — 유저 정보와 토큰을 함께 반환한다. */
export type AuthSession = AuthUser & {
  access: string;
  refresh: string;
};

export type LoginTokens = {
  access: string;
  refresh: string;
};

export type SignupPayload = {
  username: string;
  password: string;
  email?: string;
};

async function persistTokens<T extends { access: string; refresh: string }>(result: T): Promise<T> {
  await saveTokens({ access: result.access, refresh: result.refresh });
  return result;
}

/** "회원가입 없이 둘러보기" — 데모 계정으로 즉시 로그인한다. */
export async function demoLogin(): Promise<AuthSession> {
  const result = await request<AuthSession>('/api/auth/demo-login/', { method: 'POST' }, { skipAuth: true });
  return persistTokens(result);
}

export async function login(username: string, password: string): Promise<LoginTokens> {
  const result = await request<LoginTokens>(
    '/api/auth/login/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
    { skipAuth: true }
  );
  return persistTokens(result);
}

/** 가입 성공 시 유저 정보 + access/refresh를 함께 받아 즉시 로그인 상태로 전환한다. */
export async function signup(payload: SignupPayload): Promise<AuthSession> {
  const result = await request<AuthSession>(
    '/api/auth/signup/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    { skipAuth: true }
  );
  return persistTokens(result);
}

export function getMe() {
  return request<AuthUser>('/api/users/me/');
}

export async function logout(): Promise<void> {
  await clearTokens();
}

// ---- 증상·주간 리포트 ----

export type SymptomTypeSummary = {
  id: number;
  code: string;
  label: string;
  category: string;
  emoji: string;
  order: number;
};

export type SymptomLogEntry = {
  id: number;
  symptom_type: number;
  symptom_type_detail: SymptomTypeSummary;
  severity: 1 | 2 | 3;
  occurred_at: string;
  memo: string;
  source: 'manual' | 'chat' | 'backfill' | 'seed';
  created_at: string;
};

/** 앱 버튼 목록 — GET /api/symptoms/types/ (is_active만 내려온다). */
export function listSymptomTypes() {
  return request<SymptomTypeSummary[]>('/api/symptoms/types/');
}

export type SymptomBreakdownRow = {
  code: string;
  label: string;
  emoji: string;
  count: number;
  prev_count: number;
  delta: number;
  peak_slot: string | null;
  peak_slot_label: string | null;
  peak_ratio: number | null;
};

export type TimeSlotTotal = {
  code: string;
  label: string;
  count: number;
};

export type CheckInAverages = {
  sleep_quality: number | null;
  mood: number | null;
  fatigue: number | null;
  stress: number | null;
  sleep_hours: number | null;
};

export type SleepLink = {
  poor_sleep_days: number;
  good_sleep_days: number;
  symptoms_after_poor_sleep: number;
  symptoms_after_good_sleep: number;
  difference: number;
} | null;

export type SkinLinkDay = {
  date: string;
  redness_score: number;
  severity: 'normal' | 'mild' | 'moderate' | 'severe';
  hot_flash_logs: number;
  symptom_logs: number;
};

/** 같은 날의 얼굴 홍조 점수와 증상 기록을 나란히 놓은 값 — 상관관계는 계산하지 않는다(백엔드 설계 의도).
 * 이번 주 사진이 한 장도 없으면 null. */
export type SkinLink = {
  photo_days: number;
  average_redness: number;
  days: SkinLinkDay[];
} | null;

export type CareSignalReason = {
  code: string;
  label: string;
  value: number;
  threshold: number;
};

/** "진료 상담을 권할 근거" — 진단이 아니라 기준을 넘은 항목을 그대로 보여주는 안내. */
export type CareSignal = {
  suggested: boolean;
  reasons: CareSignalReason[];
};

export type WeeklyReportStats = {
  week_start: string;
  week_end: string;
  total_logs: number;
  days_recorded: number;
  goal_days: number;
  goal_met: boolean;
  symptoms: SymptomBreakdownRow[];
  time_slots: TimeSlotTotal[];
  check_in_averages: CheckInAverages;
  sleep_link: SleepLink;
  skin_link: SkinLink;
  care_signal: CareSignal;
  missed_dates: string[];
};

export type WeeklyReport = {
  week_start: string;
  stats: WeeklyReportStats;
  summary_text: string;
  generated_at: string;
  summary_source: 'ai' | 'cached' | 'template';
};

export function getWeeklyReport(opts?: { week?: string; refresh?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.week) params.set('week', opts.week);
  if (opts?.refresh) params.set('refresh', '1');
  const query = params.toString();
  return request<WeeklyReport>(`/api/symptoms/reports/weekly/${query ? `?${query}` : ''}`);
}

/** 요일별 막대그래프용 원본 기록. pagination 없이 전체 목록이 그대로 온다(views.py 참고). */
export function listSymptomLogs(range: { from: string; to: string }) {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  return request<SymptomLogEntry[]>(`/api/symptoms/logs/?${params.toString()}`);
}

/** 원터치 기록 — occurred_at을 생략하면 서버가 지금 시각을 채운다(model default=timezone.now). */
export function createSymptomLog(payload: { symptom_type: number; severity: 1 | 2 | 3 }) {
  return request<SymptomLogEntry>('/api/symptoms/logs/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** SymptomLogDetailView는 Retrieve+Destroy만 있어 수정(PATCH)이 없다 — 심각도를 바꿀 때도
 * 이 함수로 기존 기록을 지우고 createSymptomLog로 새로 만든다.
 * deleteReminder와 동일한 이유로 authorizedFetch를 직접 쓴다(204 No Content). */
export async function deleteSymptomLog(logId: number): Promise<void> {
  const response = await authorizedFetch(`/api/symptoms/logs/${logId}/`, { method: 'DELETE' });
  if (!response.ok) {
    throw await toApiError(response);
  }
}

export type DailyCheckInEntry = {
  id: number;
  date: string;
  sleep_quality: 1 | 2 | 3 | 4 | 5;
  mood: 1 | 2 | 3 | 4 | 5;
  fatigue: 1 | 2 | 3 | 4 | 5 | null;
  stress: 1 | 2 | 3 | 4 | 5 | null;
  // DecimalField 기본 직렬화라 숫자가 아니라 문자열로 온다(예: "7.2") — 소비할 때 Number()로 변환할 것.
  sleep_hours: string | null;
  memo: string;
  created_at: string;
  updated_at: string;
};

/** 통합 타임라인의 일별 수면 막대용 원본 체크인. pagination 없음(views.py 참고). */
export function listCheckIns(range: { from: string; to: string }) {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  return request<DailyCheckInEntry[]>(`/api/symptoms/checkins/?${params.toString()}`);
}

/** TodayCheckInView의 GET/PUT 공통 응답 — 아직 체크인이 없어도 404가 아니라 completed:false로 200을 준다. */
export type TodayCheckInResponse = {
  date: string;
  completed: boolean;
  check_in: DailyCheckInEntry | null;
};

export function getTodayCheckIn() {
  return request<TodayCheckInResponse>('/api/symptoms/checkins/today/');
}

/** 필수 필드(수면·기분)만 보내도 된다 — fatigue/stress 등 나머지는 serializer가 required=False라
 * 요청에 없으면 validated_data에서 빠지고, update_or_create가 defaults에 없는 필드는 건드리지 않는다. */
export function saveTodayCheckIn(payload: { sleep_quality: 1 | 2 | 3 | 4 | 5; mood: 1 | 2 | 3 | 4 | 5 }) {
  return request<TodayCheckInResponse>('/api/symptoms/checkins/today/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
