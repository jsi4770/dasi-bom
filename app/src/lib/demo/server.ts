/** 데모 모드용 인메모리 API.
 *
 * 백엔드(Django REST) 없이도 앱의 모든 화면이 동작하도록 `api.ts`의 authorizedFetch가 호출하는
 * 엔드포인트를 같은 응답 모양으로 흉내 낸다. 상태는 메모리에만 있어 새로고침하면 시드 데이터로 돌아간다.
 * 모든 데이터는 가상의 예시이며 실제 사용자 정보가 아니다. */

type JsonBody = Record<string, unknown>;

type DemoSymptomType = {
  id: number;
  code: string;
  label: string;
  category: string;
  emoji: string;
  order: number;
};

type DemoLog = {
  id: number;
  symptom_type: number;
  symptom_type_detail: DemoSymptomType;
  severity: 1 | 2 | 3;
  occurred_at: string;
  memo: string;
  source: 'manual' | 'chat' | 'backfill' | 'seed';
  created_at: string;
};

type DemoCheckIn = {
  id: number;
  date: string;
  sleep_quality: number | null;
  mood: number | null;
  fatigue: number | null;
  stress: number | null;
  sleep_hours: string | null;
  memo: string;
  created_at: string;
  updated_at: string;
};

type DemoReminder = {
  id: number;
  type: 'medication' | 'mindfulness';
  label: string;
  time: string;
  is_active: boolean;
  created_at: string;
};

type DemoFace = {
  id: number;
  image: string;
  redness_score: number;
  severity: 'normal' | 'mild' | 'moderate' | 'severe';
  region_scores: Record<string, number>;
  created_at: string;
  lighting_corrected: boolean;
  excluded_regions: string[];
};

type DemoMessage = { id: number; role: 'user' | 'assistant'; text: string; created_at: string };

/* ── 날짜 유틸 (로컬 시간 기준) ── */

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const round1 = (n: number) => Math.round(n * 10) / 10;

/* ── 시드 데이터 ── */

const SYMPTOM_TYPES: DemoSymptomType[] = [
  ['hot_flash', '홍조', 'vasomotor', '🔥'],
  ['night_sweat', '식은땀', 'vasomotor', '💧'],
  ['palpitation', '두근거림', 'vasomotor', '💓'],
  ['insomnia', '잠들기 어려움', 'sleep', '🌙'],
  ['night_waking', '자다 깸', 'sleep', '😪'],
  ['low_mood', '기분 가라앉음', 'mood', '🌧️'],
  ['irritability', '짜증·예민함', 'mood', '⚡'],
  ['anxiety', '불안', 'mood', '😰'],
  ['joint_pain', '관절통', 'physical', '🦴'],
  ['headache', '두통', 'physical', '🤕'],
  ['fatigue', '피로감', 'physical', '🔋'],
  ['dryness', '건조·불편감', 'physical', '🌵'],
].map(([code, label, category, emoji], i) => ({ id: i + 1, code, label, category, emoji, order: (i + 1) * 10 }));

const MINDFULNESS_SESSIONS = [
  {
    id: 1, code: 'neck_shoulder_stretch', title: '목·어깨 스트레칭', description: '뭉친 목과 어깨를 풀어줘요',
    steps: [
      { instruction: '편하게 앉아 어깨 힘을 빼요', seconds: 15, pose: 'rest' },
      { instruction: '고개를 오른쪽으로 천천히 기울여요', seconds: 20, pose: 'tilt_right' },
      { instruction: '고개를 왼쪽으로 천천히 기울여요', seconds: 20, pose: 'tilt_left' },
      { instruction: '어깨를 귀 쪽으로 올렸다 내리기를 반복해요', seconds: 30, pose: 'shoulder_shrug' },
      { instruction: '양팔을 뒤로 젖혀 가슴을 활짝 펴요', seconds: 30, pose: 'chest_open' },
      { instruction: '목을 크게 한 바퀴 돌려요', seconds: 30, pose: 'neck_roll' },
      { instruction: '숨을 크게 내쉬며 천천히 마무리해요', seconds: 35, pose: 'breathe' },
    ],
  },
  {
    id: 2, code: 'breathing_meditation', title: '호흡 명상', description: '깊게 숨쉬며 마음을 가라앉혀요',
    steps: [
      { instruction: '편안한 자세로 앉아 눈을 감아요', seconds: 15, pose: 'rest' },
      { instruction: '코로 천천히 4초간 숨을 들이마셔요', seconds: 20, pose: 'breathe' },
      { instruction: '4초간 숨을 참아요', seconds: 20, pose: 'rest' },
      { instruction: '입으로 6초간 천천히 내쉬어요', seconds: 25, pose: 'breathe' },
      { instruction: '같은 리듬으로 호흡을 반복해요', seconds: 60, pose: 'breathe' },
      { instruction: '눈을 뜨고 몸의 감각을 느껴봐요', seconds: 20, pose: 'rest' },
      { instruction: '천천히 마무리해요', seconds: 20, pose: 'rest' },
    ],
  },
  {
    id: 3, code: 'evening_wind_down', title: '저녁 이완 스트레칭', description: '하루를 마무리하는 가벼운 이완',
    steps: [
      { instruction: '자리에 편하게 앉거나 누워요', seconds: 15, pose: 'rest' },
      { instruction: '양손을 깍지 끼고 위로 쭉 뻗어요', seconds: 20, pose: 'reach_up' },
      { instruction: '상체를 좌우로 천천히 기울여요', seconds: 30, pose: 'side_bend' },
      { instruction: '발목을 천천히 돌려요', seconds: 30, pose: 'ankle_roll' },
      { instruction: '무릎을 가슴 쪽으로 당겨 안아요', seconds: 30, pose: 'hug_knees' },
      { instruction: '온몸의 힘을 빼고 편하게 누워요', seconds: 35, pose: 'lie_relax' },
      { instruction: '천천히 눈을 감고 호흡에 집중해요', seconds: 20, pose: 'breathe' },
    ],
  },
].map((s) => ({ ...s, total_seconds: s.steps.reduce((sum, step) => sum + step.seconds, 0) }));

// 결정적 난수 — 새로고침해도 같은 시드 데이터가 나오게 한다.
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// 기록을 빠뜨린 날(오늘 기준 N일 전) — 리포트의 "기록하지 않은 날" 표시를 보여주기 위함
const SKIPPED_OFFSETS = new Set([3, 9]);
// 얼굴 사진을 남긴 날
const FACE_OFFSETS = [2, 5, 8, 11];

function severityFromScore(score: number): DemoFace['severity'] {
  if (score < 18.6) return 'normal';
  if (score < 25.1) return 'mild';
  if (score < 43) return 'moderate';
  return 'severe';
}

const FACE_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde7d9"/><stop offset="1" stop-color="#f8c9b0"/></linearGradient></defs>' +
      '<rect width="240" height="240" fill="url(#g)"/>' +
      '<ellipse cx="120" cy="125" rx="62" ry="78" fill="#f3b79a"/>' +
      '<circle cx="98" cy="112" r="6" fill="#7a4a3a"/><circle cx="142" cy="112" r="6" fill="#7a4a3a"/>' +
      '<path d="M100 150 Q120 168 140 150" stroke="#7a4a3a" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '</svg>'
  );

function createState() {
  const rng = makeRng(20260815);
  const today = new Date();
  const nowIso = new Date().toISOString();
  const typeByCode = Object.fromEntries(SYMPTOM_TYPES.map((t) => [t.code, t]));

  const logs: DemoLog[] = [];
  const checkIns: DemoCheckIn[] = [];
  let logId = 1;
  let checkInId = 1;

  for (let offset = 1; offset <= 13; offset++) {
    if (SKIPPED_OFFSETS.has(offset)) continue;
    const day = addDays(today, -offset);
    const add = (code: string, hour: number, severity: 1 | 2 | 3) => {
      const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, Math.floor(rng() * 50));
      logs.push({
        id: logId++, symptom_type: typeByCode[code].id, symptom_type_detail: typeByCode[code], severity,
        occurred_at: when.toISOString(), memo: '', source: 'seed', created_at: when.toISOString(),
      });
    };
    const hotFlashHours = [14, 15, 20, 21, 3, 13];
    const count = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      add('hot_flash', hotFlashHours[Math.floor(rng() * hotFlashHours.length)], (1 + Math.floor(rng() * 3)) as 1 | 2 | 3);
    }
    const others = ['insomnia', 'fatigue', 'irritability', 'headache', 'joint_pain', 'night_sweat'];
    add(others[Math.floor(rng() * others.length)], rng() < 0.5 ? 22 : 9, (1 + Math.floor(rng() * 3)) as 1 | 2 | 3);

    const sleepQuality = 2 + Math.floor(rng() * 3);
    const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 21, 30).toISOString();
    checkIns.push({
      id: checkInId++, date: ymd(day), sleep_quality: sleepQuality, mood: 2 + Math.floor(rng() * 3),
      fatigue: 2 + Math.floor(rng() * 3), stress: 2 + Math.floor(rng() * 3),
      sleep_hours: (4.5 + sleepQuality * 0.7 + rng() * 0.6).toFixed(1), memo: '', created_at: when, updated_at: when,
    });
  }

  const faces: DemoFace[] = FACE_OFFSETS.map((offset, i) => {
    const score = [31.2, 22.4, 38.6, 26.9][i];
    const day = addDays(today, -offset);
    return {
      id: i + 1, image: FACE_PLACEHOLDER, redness_score: score, severity: severityFromScore(score),
      region_scores: {
        forehead: round1(score * 0.9), nose: round1(score * 1.1), left_cheek: round1(score * 1.05), right_cheek: round1(score * 0.95),
      },
      created_at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 20, 10).toISOString(),
      lighting_corrected: true, excluded_regions: [],
    };
  });

  const reminders: DemoReminder[] = [
    { id: 1, type: 'medication', label: '칼슘·마그네슘', time: '08:00:00', is_active: true, created_at: nowIso },
    { id: 2, type: 'medication', label: '이소플라본 영양제', time: '19:00:00', is_active: true, created_at: nowIso },
    { id: 3, type: 'mindfulness', label: '아침 스트레칭', time: '07:30:00', is_active: true, created_at: nowIso },
    { id: 4, type: 'mindfulness', label: '저녁 명상', time: '21:30:00', is_active: true, created_at: nowIso },
  ];

  return {
    user: { id: 1, username: 'demo', email: 'demo@example.com' },
    logs, checkIns, faces, reminders,
    completions: new Set<string>([`1:${ymd(today)}`]), // `${reminderId}:${date}`
    survey: null as null | { choice: number; stage: string; answered_at: string },
    consent: null as null | {
      face_analysis_consent: boolean; face_analysis_consented_at: string | null;
      health_data_consent: boolean; health_data_consented_at: string | null;
    },
    nextLogId: logId, nextCheckInId: checkInId, nextFaceId: faces.length + 1, nextReminderId: 5,
    nextSessionId: 1, nextMessageId: 1,
  };
}

let state = createState();

/* ── 응답 헬퍼 ── */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const empty = (status = 204) => new Response(null, { status });
const notFound = (detail = '찾을 수 없어요.') => json({ detail }, 404);

/* ── 계산 헬퍼 ── */

const logDate = (log: DemoLog) => ymd(new Date(log.occurred_at));
const faceDate = (face: DemoFace) => ymd(new Date(face.created_at));

function slotOf(iso: string): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date(iso).getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}
const SLOT_LABELS = { morning: '아침', afternoon: '오후', evening: '저녁', night: '밤' } as const;

function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}

function weekStats(monday: Date) {
  const start = ymd(monday);
  const end = ymd(addDays(monday, 6));
  const prevStart = ymd(addDays(monday, -7));
  const prevEnd = ymd(addDays(monday, -1));

  const logs = state.logs.filter((l) => inRange(logDate(l), start, end));
  const prevLogs = state.logs.filter((l) => inRange(logDate(l), prevStart, prevEnd));
  const checkIns = state.checkIns.filter((c) => inRange(c.date, start, end));
  const faces = state.faces.filter((f) => inRange(faceDate(f), start, end));

  const recordedDates = new Set<string>([...logs.map(logDate), ...checkIns.map((c) => c.date)]);

  const byCode = new Map<string, DemoLog[]>();
  logs.forEach((l) => byCode.set(l.symptom_type_detail.code, [...(byCode.get(l.symptom_type_detail.code) ?? []), l]));

  const symptoms = [...byCode.entries()]
    .map(([code, items]) => {
      const type = SYMPTOM_TYPES.find((t) => t.code === code)!;
      const prevCount = prevLogs.filter((l) => l.symptom_type_detail.code === code).length;
      const slotCounts: Record<string, number> = {};
      items.forEach((l) => {
        const slot = slotOf(l.occurred_at);
        slotCounts[slot] = (slotCounts[slot] ?? 0) + 1;
      });
      const [peakSlot, peakCount] = Object.entries(slotCounts).sort((a, b) => b[1] - a[1])[0];
      const hasPeak = items.length >= 3;
      return {
        code, label: type.label, emoji: type.emoji, count: items.length, prev_count: prevCount, delta: items.length - prevCount,
        peak_slot: hasPeak ? peakSlot : null,
        peak_slot_label: hasPeak ? SLOT_LABELS[peakSlot as keyof typeof SLOT_LABELS] : null,
        peak_ratio: hasPeak ? Math.round((peakCount / items.length) * 100) / 100 : null,
      };
    })
    .sort((a, b) => b.count - a.count);

  const time_slots = (Object.keys(SLOT_LABELS) as (keyof typeof SLOT_LABELS)[]).map((code) => ({
    code, label: SLOT_LABELS[code], count: logs.filter((l) => slotOf(l.occurred_at) === code).length,
  }));

  const avg = (values: (number | null)[]) => {
    const nums = values.filter((v): v is number => v !== null);
    return nums.length ? round1(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
  };
  const check_in_averages = {
    sleep_quality: avg(checkIns.map((c) => c.sleep_quality)),
    mood: avg(checkIns.map((c) => c.mood)),
    fatigue: avg(checkIns.map((c) => c.fatigue)),
    stress: avg(checkIns.map((c) => c.stress)),
    sleep_hours: avg(checkIns.map((c) => (c.sleep_hours === null ? null : Number(c.sleep_hours)))),
  };

  const poorDays = checkIns.filter((c) => (c.sleep_quality ?? 3) <= 2);
  const goodDays = checkIns.filter((c) => (c.sleep_quality ?? 3) >= 4);
  const perDay = (days: DemoCheckIn[]) =>
    days.length ? days.reduce((n, c) => n + logs.filter((l) => logDate(l) === c.date).length, 0) / days.length : 0;
  const sleep_link =
    poorDays.length > 0 && goodDays.length > 0
      ? {
          poor_sleep_days: poorDays.length, good_sleep_days: goodDays.length,
          symptoms_after_poor_sleep: round1(perDay(poorDays)), symptoms_after_good_sleep: round1(perDay(goodDays)),
          difference: round1(perDay(poorDays) - perDay(goodDays)),
        }
      : null;

  const skin_link =
    faces.length > 0
      ? {
          photo_days: new Set(faces.map(faceDate)).size,
          average_redness: round1(faces.reduce((n, f) => n + f.redness_score, 0) / faces.length),
          days: faces
            .map((f) => ({
              date: faceDate(f), redness_score: f.redness_score, severity: f.severity,
              hot_flash_logs: logs.filter((l) => logDate(l) === faceDate(f) && l.symptom_type_detail.code === 'hot_flash').length,
              symptom_logs: logs.filter((l) => logDate(l) === faceDate(f)).length,
            }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        }
      : null;

  const hotFlashCount = logs.filter((l) => l.symptom_type_detail.code === 'hot_flash').length;
  const lowMoodDays = checkIns.filter((c) => (c.mood ?? 3) <= 2).length;
  const reasons = [
    ...(hotFlashCount >= 7 ? [{ code: 'hot_flash_frequency', label: '홍조 횟수', value: hotFlashCount, threshold: 7 }] : []),
    ...(poorDays.length >= 3 ? [{ code: 'poor_sleep', label: '잘 못 잔 날', value: poorDays.length, threshold: 3 }] : []),
    ...(lowMoodDays >= 3 ? [{ code: 'low_mood', label: '기분이 가라앉은 날', value: lowMoodDays, threshold: 3 }] : []),
  ];

  const todayStr = ymd(new Date());
  const missed_dates = Array.from({ length: 7 }, (_, i) => ymd(addDays(monday, i))).filter(
    (d) => d <= todayStr && !recordedDates.has(d)
  );

  return {
    week_start: start, week_end: end, total_logs: logs.length, days_recorded: recordedDates.size, goal_days: 5,
    goal_met: recordedDates.size >= 5, symptoms, time_slots, check_in_averages, sleep_link, skin_link,
    care_signal: { suggested: reasons.length > 0, reasons }, missed_dates,
  };
}

function weeklyReport(weekParam: string | null) {
  let monday = weekParam ? parseYmd(weekParam) : mondayOf(new Date());
  let showingOtherWeek = false;
  let stats = weekStats(monday);

  // week 없이 요청했는데 이번 주가 비어 있으면, 기록이 남은 가장 최근 주로 대신 보여준다(실제 백엔드와 동일).
  if (!weekParam && stats.total_logs === 0 && stats.days_recorded === 0 && !stats.skin_link) {
    for (let back = 1; back <= 8; back++) {
      const candidate = weekStats(addDays(monday, -7 * back));
      if (candidate.total_logs > 0 || candidate.days_recorded > 0) {
        monday = addDays(monday, -7 * back);
        stats = candidate;
        showingOtherWeek = true;
        break;
      }
    }
  }

  const top = stats.symptoms[0];
  const summary_text =
    stats.total_logs === 0
      ? '이 주에는 아직 기록이 없어요. 오늘부터 하나씩 남겨볼까요?'
      : `이 주에는 ${stats.days_recorded}일 동안 ${stats.total_logs}번 기록했어요. ` +
        (top ? `가장 자주 기록된 증상은 ${top.label}(${top.count}회)예요. ` : '') +
        (stats.goal_met ? '목표 기록일을 채웠어요. 잘하고 있어요!' : '조금씩 꾸준히 기록해 보아요.');

  return {
    week_start: stats.week_start, stats, summary_text, generated_at: new Date().toISOString(),
    summary_source: 'template' as const, showing_other_week: showingOtherWeek,
  };
}

function checkInResponse(date: string) {
  const entry = state.checkIns.find((c) => c.date === date) ?? null;
  return { date, completed: entry !== null && entry.mood !== null, check_in: entry };
}

function chatReply(text: string): string {
  const t = text.trim();
  const note = '\n\n(데모 모드의 미리 준비된 답변이에요.)';
  if (/홍조|열감|화끈|달아/.test(t)) {
    return '갑자기 열이 오르면 많이 당황스러우시죠. 시원한 물을 천천히 마시고, 겉옷을 한 겹 벗어 체온을 낮춰 보세요. 언제, 얼마나 자주 생기는지 기록해 두면 진료 때 도움이 돼요.' + note;
  }
  if (/잠|수면|불면|깼/.test(t)) {
    return '잠이 잘 오지 않으면 하루가 더 길게 느껴져요. 잠들기 1시간 전에는 화면을 줄이고, 저녁 이완 스트레칭을 해 보시는 건 어떨까요? 수면 시간도 함께 기록해 보세요.' + note;
  }
  if (/우울|기분|불안|짜증|예민|외로/.test(t)) {
    return '마음이 가라앉는 날도 있어요. 그런 날의 기분을 가볍게 기록해 두면 변화를 한눈에 볼 수 있어요. 호흡 명상을 3분만 해 보시는 것도 좋아요.' + note;
  }
  if (/안녕|반가|처음/.test(t)) {
    return '안녕하세요! 오늘 몸과 마음은 어떠세요? 불편한 점이 있으면 편하게 말씀해 주세요.' + note;
  }
  if (/약|영양제|복약/.test(t)) {
    return '복약과 영양제는 정해진 시간에 챙기는 게 중요해요. 복약 알림을 설정해 두면 잊지 않고 챙길 수 있어요.' + note;
  }
  return '말씀해 주셔서 고마워요. 어떤 증상이 언제 나타나는지 조금 더 이야기해 주시면, 기록과 함께 살펴볼 수 있어요.' + note;
}

/* ── 요청 파싱 ── */

function readJson(init: RequestInit): JsonBody {
  if (typeof init.body !== 'string') return {};
  try {
    return JSON.parse(init.body) as JsonBody;
  } catch {
    return Object.fromEntries(new URLSearchParams(init.body));
  }
}

type Ctx = { m: RegExpMatchArray; query: URLSearchParams; init: RequestInit; body: JsonBody };
type Handler = (ctx: Ctx) => Response | Promise<Response>;
const routes: { method: string; re: RegExp; fn: Handler }[] = [];
const route = (method: string, pattern: string, fn: Handler) => routes.push({ method, re: new RegExp(`^${pattern}/?$`), fn });

/* ── 인증·사용자 ── */

const sessionTokens = () => ({ access: 'demo-access-token', refresh: 'demo-refresh-token' });
route('POST', '/api/auth/demo-login', () => json({ ...state.user, ...sessionTokens() }));
route('POST', '/api/auth/login', ({ body }) => {
  if (typeof body.username === 'string' && body.username.trim()) state.user = { ...state.user, username: body.username.trim() };
  return json(sessionTokens());
});
route('POST', '/api/auth/signup', ({ body }) => {
  const username = typeof body.username === 'string' && body.username.trim() ? body.username.trim() : 'demo';
  const email = typeof body.email === 'string' ? body.email : '';
  state.user = { ...state.user, username, email };
  return json({ ...state.user, ...sessionTokens() }, 201);
});
route('POST', '/api/auth/token/refresh', () => json({ access: 'demo-access-token' }));
route('GET', '/api/users/me', () => json(state.user));

const STAGES = ['peri', 'menopause', 'post', 'unknown'];
route('GET', '/api/users/menopause-survey', () => (state.survey ? json(state.survey) : notFound()));
route('POST', '/api/users/menopause-survey', ({ body }) => {
  const choice = Number(body.choice);
  if (!(choice >= 0 && choice <= 3)) return json({ detail: '올바른 선택지가 아니에요.' }, 400);
  state.survey = { choice, stage: STAGES[choice], answered_at: new Date().toISOString() };
  return json(state.survey, 201);
});
route('GET', '/api/users/consent', () => (state.consent ? json(state.consent) : notFound()));
route('POST', '/api/users/consent', ({ body }) => {
  const now = new Date().toISOString();
  const prev = state.consent ?? {
    face_analysis_consent: false, face_analysis_consented_at: null, health_data_consent: false, health_data_consented_at: null,
  };
  const next = { ...prev };
  if (typeof body.face_analysis_consent === 'boolean') {
    next.face_analysis_consent = body.face_analysis_consent;
    next.face_analysis_consented_at = body.face_analysis_consent ? now : null;
  }
  if (typeof body.health_data_consent === 'boolean') {
    next.health_data_consent = body.health_data_consent;
    next.health_data_consented_at = body.health_data_consent ? now : null;
  }
  state.consent = next;
  return json(next);
});

/* ── 증상·체크인·리포트 ── */

route('GET', '/api/symptoms/types', () => json(SYMPTOM_TYPES));
route('GET', '/api/symptoms/logs', ({ query }) => {
  const from = query.get('from') ?? '0000-01-01';
  const to = query.get('to') ?? '9999-12-31';
  return json(state.logs.filter((l) => inRange(logDate(l), from, to)).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)));
});
route('POST', '/api/symptoms/logs', ({ body }) => {
  const type = SYMPTOM_TYPES.find((t) => t.id === Number(body.symptom_type));
  if (!type) return json({ detail: '알 수 없는 증상이에요.' }, 400);
  const now = new Date().toISOString();
  const log: DemoLog = {
    id: state.nextLogId++, symptom_type: type.id, symptom_type_detail: type, severity: (Number(body.severity) || 2) as 1 | 2 | 3,
    occurred_at: now, memo: '', source: 'manual', created_at: now,
  };
  state.logs.push(log);
  return json(log, 201);
});
route('DELETE', '/api/symptoms/logs/(\\d+)', ({ m }) => {
  const id = Number(m[1]);
  if (!state.logs.some((l) => l.id === id)) return notFound();
  state.logs = state.logs.filter((l) => l.id !== id);
  return empty();
});
route('GET', '/api/symptoms/checkins', ({ query }) => {
  const from = query.get('from') ?? '0000-01-01';
  const to = query.get('to') ?? '9999-12-31';
  return json(state.checkIns.filter((c) => inRange(c.date, from, to)).sort((a, b) => a.date.localeCompare(b.date)));
});
route('GET', '/api/symptoms/checkins/today', () => json(checkInResponse(ymd(new Date()))));

function upsertTodayCheckIn(body: JsonBody) {
  const date = ymd(new Date());
  const now = new Date().toISOString();
  let entry = state.checkIns.find((c) => c.date === date);
  if (!entry) {
    entry = {
      id: state.nextCheckInId++, date, sleep_quality: null, mood: null, fatigue: null, stress: null, sleep_hours: null, memo: '',
      created_at: now, updated_at: now,
    };
    state.checkIns.push(entry);
  }
  if (body.sleep_quality !== undefined) entry.sleep_quality = Number(body.sleep_quality);
  if (body.mood !== undefined) entry.mood = Number(body.mood);
  if (body.fatigue !== undefined) entry.fatigue = body.fatigue === null ? null : Number(body.fatigue);
  if (body.stress !== undefined) entry.stress = body.stress === null ? null : Number(body.stress);
  if (body.sleep_hours !== undefined) entry.sleep_hours = body.sleep_hours === null ? null : Number(body.sleep_hours).toFixed(1);
  if (typeof body.memo === 'string') entry.memo = body.memo;
  entry.updated_at = now;
  return json(checkInResponse(date));
}
route('PUT', '/api/symptoms/checkins/today', ({ body }) => upsertTodayCheckIn(body));
route('PATCH', '/api/symptoms/checkins/today', ({ body }) => upsertTodayCheckIn(body));

route('GET', '/api/symptoms/today-summary', () => {
  const date = ymd(new Date());
  const count = state.logs.filter((l) => logDate(l) === date).length;
  const entry = state.checkIns.find((c) => c.date === date);
  return json({
    date,
    symptom: { completed: count > 0, count },
    sleep: { completed: !!entry && entry.sleep_hours !== null, sleep_hours: entry?.sleep_hours ? Number(entry.sleep_hours) : null },
    checkin: { completed: !!entry && entry.mood !== null, mood: entry?.mood ?? null },
  });
});
route('GET', '/api/symptoms/reports/weekly', ({ query }) => json(weeklyReport(query.get('week'))));

/* ── 리마인더·명상 ── */

const todayKey = () => ymd(new Date());
route('GET', '/api/reminders/mindfulness-sessions', () => json(MINDFULNESS_SESSIONS));
route('GET', '/api/reminders/today', () =>
  json(
    state.reminders
      .filter((r) => r.is_active)
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((r) => ({ id: r.id, type: r.type, label: r.label, time: r.time, completed: state.completions.has(`${r.id}:${todayKey()}`) }))
  )
);
route('GET', '/api/reminders', () => json(state.reminders));
route('POST', '/api/reminders', ({ body }) => {
  const time = typeof body.time === 'string' ? (body.time.length === 5 ? `${body.time}:00` : body.time) : '09:00:00';
  const reminder: DemoReminder = {
    id: state.nextReminderId++, type: body.type === 'mindfulness' ? 'mindfulness' : 'medication', label: String(body.label ?? ''),
    time, is_active: body.is_active !== false, created_at: new Date().toISOString(),
  };
  state.reminders.push(reminder);
  return json(reminder, 201);
});
route('POST', '/api/reminders/(\\d+)/complete', ({ m }) => {
  const id = Number(m[1]);
  if (!state.reminders.some((r) => r.id === id)) return notFound();
  state.completions.add(`${id}:${todayKey()}`);
  return json({ completed: true });
});
route('PATCH', '/api/reminders/(\\d+)', ({ m, body }) => {
  const reminder = state.reminders.find((r) => r.id === Number(m[1]));
  if (!reminder) return notFound();
  if (body.type === 'medication' || body.type === 'mindfulness') reminder.type = body.type;
  if (typeof body.label === 'string') reminder.label = body.label;
  if (typeof body.time === 'string') reminder.time = body.time.length === 5 ? `${body.time}:00` : body.time;
  if (typeof body.is_active === 'boolean') reminder.is_active = body.is_active;
  return json(reminder);
});
route('DELETE', '/api/reminders/(\\d+)', ({ m }) => {
  const id = Number(m[1]);
  if (!state.reminders.some((r) => r.id === id)) return notFound();
  state.reminders = state.reminders.filter((r) => r.id !== id);
  return empty();
});

/* ── 얼굴 분석 ── */

route('GET', '/api/face-analysis', () => json([...state.faces].sort((a, b) => b.created_at.localeCompare(a.created_at))));
route('POST', '/api/face-analysis', ({ init }) => {
  // 촬영한 사진은 서버로 보내지 않고 이 화면에서 보여줄 용도로만 쓴다. 점수는 시연용 가상 값이다.
  let image = FACE_PLACEHOLDER;
  if (typeof FormData !== 'undefined' && init.body instanceof FormData) {
    const file = init.body.get('image') as unknown;
    if (typeof Blob !== 'undefined' && file instanceof Blob && typeof URL?.createObjectURL === 'function') {
      image = URL.createObjectURL(file);
    } else if (file && typeof file === 'object' && 'uri' in file) {
      image = String((file as { uri: unknown }).uri);
    }
  }
  const score = round1(18 + ((state.nextFaceId * 7) % 24) + 0.4);
  const result: DemoFace = {
    id: state.nextFaceId++, image, redness_score: score, severity: severityFromScore(score),
    region_scores: {
      forehead: round1(score * 0.9), nose: round1(score * 1.1), left_cheek: round1(score * 1.05), right_cheek: round1(score * 0.95),
    },
    created_at: new Date().toISOString(), lighting_corrected: true, excluded_regions: [],
  };
  state.faces.push(result);
  return json(result, 201);
});

/* ── 챗봇 ── */

route('POST', '/api/chatbot/sessions', () => {
  const now = new Date().toISOString();
  return json({ id: state.nextSessionId++, created_at: now, updated_at: now }, 201);
});
route('POST', '/api/chatbot/sessions/(\\d+)/messages', ({ body }) => {
  const now = new Date().toISOString();
  const isAudio = typeof body.audio === 'string';
  const userText = isAudio ? '(음성 메시지)' : String(body.text ?? '');
  const user: DemoMessage = { id: state.nextMessageId++, role: 'user', text: userText, created_at: now };
  const replyText = isAudio ? '데모 모드에서는 음성 인식을 사용할 수 없어요. 글자로 입력해 주세요.' : chatReply(userText);
  const assistant: DemoMessage = { id: state.nextMessageId++, role: 'assistant', text: replyText, created_at: new Date().toISOString() };
  return json({ user_message: user, assistant_message: assistant }, 201);
});
route('GET', '/api/chatbot/messages/(\\d+)/speech', () => json({ detail: '데모 모드에서는 음성 읽어주기를 지원하지 않아요.' }, 404));

/* ── 푸시 알림 (데모에서는 사용하지 않음) ── */

route('GET', '/api/push/vapid-public-key', () => json({ detail: '데모 모드에서는 알림을 지원하지 않아요.' }, 404));
route('POST', '/api/push/subscribe', () => json({ detail: '데모 모드에서는 알림을 지원하지 않아요.' }, 404));
route('POST', '/api/push/unsubscribe', () => empty());

/* ── 진입점 ── */

/** api.ts의 authorizedFetch 대신 호출된다. 실제 fetch와 같은 Response를 돌려준다. */
export async function demoFetch(path: string, init: RequestInit = {}): Promise<Response> {
  await new Promise((resolve) => setTimeout(resolve, 120)); // 실제 API처럼 약간의 지연
  const url = new URL(path, 'http://demo.local');
  const method = (init.method ?? 'GET').toUpperCase();
  const body = readJson(init);
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = url.pathname.match(r.re);
    if (m) return r.fn({ m, query: url.searchParams, init, body });
  }
  return json({ detail: `데모 모드에서 지원하지 않는 요청이에요: ${method} ${url.pathname}` }, 404);
}

/** 테스트·재시작용 — 시드 상태로 되돌린다. */
export function resetDemoState() {
  state = createState();
}
