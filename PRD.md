# PRD — 다시 봄 (dasi-bom)

순천향 멋쟁이사자처럼 해커톤 1팀 "얼룩덜룩"

## 프로젝트 개요

**과제명**: 완경기 여성의 흩어진 몸·마음·피부 신호를 AI가 하나로 연결해, 매일의 생활습관으로 풀어주는 서비스

### Q1. 누가 쓸까?

완경에 접어든 50대 여성 A씨. 직장에 다니면서 동시에 자녀의 등하교와 부모님 병원 동행까지 챙기느라, 자기 몸에 이상 신호가 와도 '나중에'로 미루는 사람.

### Q2. 뭐가 답답한가?

- **장면 1 — 아침, 인지 못함의 순간**: 홍조·발한이 하루 서너 번 반복돼도 각각의 순간은 "사건"으로만 느껴지고 흩어질 뿐 "데이터"로 축적되지 않음
- **장면 2 — 저녁 식탁, 고립의 순간**: 가족에게 증상을 말해도 "나이 들면 다 그렇지"로 넘어가고, 아무도 "갱년기"란 단어를 꺼내지 않음. 말할 언어도 들어줄 사람도 부재
- **장면 3 — 병원 앱 결제 화면, 부담의 순간**: "이 정도로 병원까지 가야 하나"라는 판단 기준 자체가 없어서, 비용을 따지기도 전에 이미 마음이 꺾임. 진짜 장벽은 비용이 아니라 "갈 자격이 있는지조차 모르겠다"는 확신의 부재
- **장면 4 — 딸이 깔아준 앱, 낯섦의 순간**: 온보딩 단계에서 "이게 나를 위한 것인가"라는 자기 검열이 먼저 작동해 첫 실행 후 3분 내 이탈

### Q3. 어떻게 풀까?

예측할 수 없는 갱년기 증상 앞에서 막막한 50대 여성을 위해, 몸·마음·피부 데이터를 하나로 엮어 '오늘 컨디션이 왜 이런지' 설명해주고, 바쁜 하루 틈새에 자기 돌봄을 심어주는 도구예요.

### Q4. 기능 딱 3개

1. **저녁 증상 기록 + AI 분석 리포트**
   - 낮 동안 원터치로 증상 즉시 기록
   - 저녁 종합 체크인(버튼/슬라이더 중심, 입력 부담 최소화)으로 수면·감정 등 보완
   - 주간 패턴 리포트 제공 (예: "이번 주 홍조 4회, 주로 저녁 시간대")
   - 며칠간 기록 안 된 과거 증상을 AI가 먼저 물어봄
   - 효과: 흩어지던 증상을 데이터로 축적시키고, "병원 갈 만한 상황인지" 판단 근거 제공
2. **생활 정보 길잡이 챗봇**
   - 초기엔 정서적 위안 중심 — 가족·친구에게 못 꺼낸 이야기를 나눌 상대, 생성형 AI + TTS 음성 대화로 낮은 진입 장벽
   - 관계가 쌓이면 실용 정보로 확장 (어느 과를 가야 할지, 영양제 등)
   - 효과: 고립감 완화 + 병원행을 망설이는 사용자에게 1차 판단 도움
3. **알림 (복약·영양제 + 명상·스트레칭)**
   - 복약/영양제 시간 알림
   - 3~5분 명상·스트레칭 알림으로 병원 없이도 가능한 첫 관리 단계 제공
   - 효과: 관리를 "결심"이 아닌 "루틴"으로 만들고, 챙김받는다는 정서적 신호도 겸함

### Q5. 어떻게 생겼나

_TBD — 화면 와이어프레임/디자인 확정되면 채우기_

### Q6. 성공의 모습

사용자 중 60% 이상이 2주 연속 주 5일 이상 기록을 완료하면 성공

### 필요 데이터 · 제약

기본적으로 목업 데이터를 구축해서 사용하되, Google Health 연동과 얼굴 사진 분석 기능은 실제로 구현한다. 단, MVP 시연에서는 목업 데이터(사전 준비된 얼굴 사진·생활 정보)로 심사위원이 직접 연동하지 않아도 되게 한다.

### 노트

- AAC의 안티에이징 제품들이 있으면 광고·홍보할 수 있는 포인트 있을지 생각
- 며칠 이상 안 들어오는 사용자에게는 유도하는 알림 보내기

### 향후 개선 과제

- ~~**얼굴 촬영 가이드 UI (앱)**~~ — 2026-08-10 `feature/face-capture-guide`로 구현 완료(정적 타원 오버레이 + 눈높이 기준선). 단 "이 사진 사용하기"가 아직 업로드 API에 연결되지 않은 자리표시자 → **남은 일: 체크인 제출/업로드 흐름 연동은 백엔드 인증(Token/JWT) 붙은 뒤 진행**
- **홍조 모델 재보정**: 2026-08-10 Kaggle 194장 벤치마크에서 Pearson r=0.22(약한 상관), 전반적 과소평가 경향 확인 — `A_CHANNEL_LOW/HIGH` 재보정 또는 촬영 조건 표준화 필요

### 기술 스택

| 영역 | 기술 |
| --- | --- |
| 앱 | React Native (Expo) |
| 백엔드 | Django (Django REST Framework) |
| DB | PostgreSQL |
| 챗봇 | Gemini API |
| 얼굴·피부 분석 | 자체 파인튜닝 CV 모델 |

### 팀 & 역할

| 이름 | 역할 |
| --- | --- |
| 차성진 | 풀스택 |
| 안수진 | 프론트엔드 |
| 박소정 | 챗봇 |
| 조수인 | 얼굴 사진 분석 |
| 허서영 | 사용자 체크·증상 분석 |

---

## 구현 기록

작업할 때마다 아래 표에 새 행을 추가하세요. 최신 항목이 위로 오게 씁니다.

| 날짜 | 작성자 | 브랜치/PR | 내용 |
| --- | --- | --- | --- |
| 2026-08-15 | 허서영 | `feature/symptom-chat-bridge` | 챗봇 연동 한 쌍 — `GET /api/symptoms/missed-days/`(체크인도 증상 기록도 없는 지난 날, 가까운 날부터. 오늘은 하루가 끝나기 전이라 제외), `POST /api/symptoms/logs/backfill/`(챗봇이 대화로 받아낸 지난 날 증상을 코드로 받아 저장). **설계에서 걸린 문제**: 소급 기록은 시각을 모르는데 임의로 정오 같은 값을 넣으면 리포트 대표 문구인 "주로 저녁 시간대" 집계가 채워 넣은 시각 때문에 망가진다 — `SymptomLog.time_estimated` 필드를 추가해 시각을 특정 못 한 기록은 시간대 분포에서만 빼고 총계에는 넣도록 함. 챗봇이 "언제쯤이었어요?"까지 물어봤으면 `time_slot`(dawn/morning/afternoon/evening)을 넘겨 정상 집계에 포함시킬 수 있음. `source`는 서버가 정함(지난 날 `backfill` / 오늘 `chat`), 30일보다 오래된 날은 거절. 테스트 56개 |
| 2026-08-15 | 허서영 | `feature/symptom-skin-link` | 주간 리포트에 피부 데이터·진료 상담 근거 추가 — `skin_link`는 같은 날 얼굴 홍조 점수와 증상 기록을 나란히 놓되 **상관을 계산하지 않음**(194장 벤치마크 r=0.22 + 주당 사진 2~3장이라 어떤 수치도 근거가 못 됨). AI 프롬프트에도 두 값을 인과로 엮지 말라고 명시. `care_signal`은 PRD 장면 3("갈 자격이 있는지조차 모르겠다")에 답하려는 것으로, 기준을 넘은 항목만 보여주고 진단은 하지 않음 — 임계값(주당 홍조 10회/못 잔 밤 3일/기분 저하 3일)은 임상 근거가 아니라 시연용 placeholder임을 코드 주석에 명시. 둘 다 조건이 안 맞으면 리포트에서 조용히 빠짐. **시연 데이터 미해결**: demo 계정에 얼굴 분석 기록이 없어 `skin_link`가 안 나옴 — 조수인님께 (1) 내 시드에서 FaceAnalysis도 생성 (2) 시연 중 직접 촬영 (3) 얼굴분석 쪽 시드 커맨드 중 어느 쪽이 좋을지 문의함 |
| 2026-08-14 | 안수진 | `feature/auth-login-front` | 인증 프론트 구현 — 데모 로그인/일반 로그인/회원가입 화면(`auth/index.tsx`, `auth/login.tsx`, `auth/signup.tsx`) 신설, `auth-context.tsx`(`AuthProvider`)로 인증 상태(`loading`/`authenticated`/`unauthenticated`)에 따라 `_layout.tsx`에서 라우팅 분기 — 미인증 시 `/auth`로, 인증 성공 시 온보딩 미완료면 온보딩으로 아니면 홈으로 리다이렉트. `auth-storage.ts`가 access/refresh 토큰을 네이티브는 `expo-secure-store`, 웹은 `localStorage`에 저장. `lib/api.ts`에 `authorizedFetch` 추가 — 요청마다 `Authorization: Bearer` 자동 첨부, 401 응답 시 `/api/auth/token/refresh/`로 갱신 후 원 요청 1회 재시도, 여러 요청이 동시에 401을 받아도 진행 중인 refresh Promise를 공유해 중복 refresh 방지, refresh까지 실패하면 토큰을 지우고 로그인 화면으로 이동. 현재 로그인 사용자 조회(`getMe`)도 추가. **범위에서 제외**: 로그아웃 로직(`logout()`)은 구현했지만 설정 화면 UI가 아직 "coming soon" 플레이스홀더라 실제 진입점은 없음(다음 작업에서 연결 필요). 비밀번호 찾기·로그인 상태 유지(자동 로그인 유지 등)는 대응하는 백엔드 API가 없어 이번 구현에서 제외. 기존 화면의 기능·API 계약·데이터 구조는 인증 연동에 필요한 부분(요청 헤더 첨부, 401 처리) 외에는 변경하지 않음 |
| 2026-08-14 | 안수진 | `feature/auth-login-front` | Warm 디자인 시스템 2차 개편 — 디자인 토큰 및 온보딩 4개 화면(welcome/survey/survey-result/consent), 홈 화면 정보구조, 증상 기록 화면, 챗봇 화면 UI를 새 톤으로 재정비. 증상 강도 시각화를 다듬고, 이모지 위주였던 UI를 텍스트/`SymbolView` 아이콘 중심으로 정리. `warm-screen`/`warm-button` 등 공용 컴포넌트에 웹 대응(반응형 레이아웃)을 추가하고, 얼굴 촬영 가이드라인·카메라 권한 요청 UI를 손봄. 버그 수정: 준비중(coming-soon) 화면이 웹에서 중앙 정렬되지 않던 문제, 얼굴 촬영 권한 버튼이 세로로 늘어지던 문제, 웹에서 하단 탭바와 챗봇 입력 영역이 겹치던 문제 해결 |
| 2026-08-12 | 허서영 | `feature/symptom-report` | 주간 패턴 리포트 구현 — `GET /api/symptoms/reports/weekly/`, `GET /api/symptoms/streak/`. **역할 분담이 핵심**: `analysis.py`가 숫자(증상별 횟수·지난주 대비 증감·시간대 분포·수면 비교·미기록일)를 전부 규칙 기반으로 계산하고, `summary.py`는 그 숫자만 Gemini에 넘겨 해석·생활 제안 문장을 받음 — 원본 기록을 통째로 넘기면 수치를 지어낼 수 있어서. 생성 문장은 `summary_text`에 저장하고 집계가 바뀔 때만 재생성(시연 중 문장이 매번 달라지는 것 방지 + 무료 티어 절약), 응답의 `summary_source`로 `ai`/`cached`/`template` 구분. 키가 없어도 규칙 기반 문장으로 폴백. **없는 패턴을 있다고 하지 않도록 최소 조건**을 둠 — 한 시간대에 40% 이상 몰려야 "주로 ○○ 시간대"라고 쓰고, 수면-증상 비교는 양쪽 표본 2일 이상일 때만. **작업 중 시드 버그 발견**: `sleep_quality`는 "어젯밤"을 묻는 값이라 그 체크인을 남긴 당일과 묶여야 하는데, 시드가 증상을 하루 뒤에 얹고 있어서 분석기가 같은 날끼리 비교하면 아무 상관도 못 찾는 상태였음 — 같은 날로 수정(재시드 후 못 잔 날 6.0건 vs 잘 잔 날 3.7건으로 검출됨). 인증은 같은 날 머지된 `feature/auth`(#25)의 SimpleJWT를 그대로 사용 — 처음엔 챗봇·얼굴분석처럼 `get_demo_user()` 우회로 만들었다가, `DemoLoginView`(원클릭 게스트 로그인)가 이미 토큰을 발급해준다는 걸 확인하고 `request.user` 기반으로 되돌림. 우회 코드 없이 진짜 인증을 쓰면서도 시연은 그대로 가능. **챗봇·얼굴분석은 아직 `AllowAny` + `get_demo_user()` 상태라 같은 방식으로 정리하면 좋겠음.** 테스트 35개 |
| 2026-08-11 | 안수진 | `develop` | "완경기 웰니스 코칭" 컨셉으로 앱 리브랜딩 — 어스톤 계열 Warm 팔레트(`constants/theme.ts`)와 공용 컴포넌트(`components/warm/`: screen/header/card/button/bottom-sheet/slider/info-note/coming-soon) 신설. 온보딩 플로우(welcome → survey → survey-result → consent) 추가, 앱 최초 진입 시 온보딩 미완료 사용자를 자동 리다이렉트. 홈 화면을 목업 데이터(`constants/mock-data.ts`) 기반 위젯형 UI로 전면 개편 — 이번 주 몸 상태 통계 배지, 오늘의 루틴(복약·명상), 마음 돌봄(챗봇), 얼굴 사진 연결 카드 구성. 하단 탭을 홈/리포트/돌봄/대화/설정 5개로 재구성(웹 탭바는 Slot 기반으로 교체). 증상 기록 화면(`symptom-log`) 추가 — 증상 12종 원터치 기록 + 저녁 체크인(수면·기분) 바텀시트. 리포트/돌봄/설정 화면은 아직 백엔드 연동 전이라 우선 "coming soon" 자리표시자로 연결. 미사용 Expo 템플릿 보일러플레이트(explore/external-link/collapsible/web-badge) 제거. 같은 시점에 `feature/chatbot`(박소정, 아래 항목)이 origin/develop에 먼저 머지되면서 `chat.tsx`·`index.tsx`에서 충돌 발생 — `chat.tsx`는 이쪽의 "coming soon" 자리표시자 대신 origin의 실제 Gemini 챗봇 구현을 채택, `index.tsx`는 새 홈 화면 리디자인에 챗봇·체크인 사진 진입 카드가 이미 포함돼 있어 이쪽 버전을 그대로 채택하는 방식으로 병합 후 `develop`에 직접 push. **남은 일**: 리포트/돌봄/설정 화면의 실제 데이터 연동(현재 전부 목업) |
| 2026-08-11 | 조수인 | `feature/face-analysis-flow` | 체크인 사진 촬영("이 사진 사용하기"가 자리표시자였던 부분)을 실제 얼굴 홍조 분석 API(`feature/face-analysis` 등, 8/7)와 연결하고 결과 화면(`face-result.tsx`)을 새로 만듦. **연결 과정에서 발견한 문제 2개**: (1) `FaceAnalysisListCreateView`가 `permission_classes = [IsAuthenticated]`로 막혀있었음 — 아직 실제 인증(Token/JWT)이 없어서 이 상태로는 앱에서 호출 자체가 불가능했음. 챗봇이 쓰던 데모 계정 패턴을 `apps/users/demo.py`(`get_demo_user()`)로 공용화해서 챗봇·얼굴분석 둘 다 재사용하도록 정리 (2) 로컬에서 실제 업로드 테스트하다 `InvalidStorageError: Could not find config for 'default' in settings.STORAGES`로 크래시 발견 — 어제(`feature/production-deploy`) WhiteNoise 정적파일 설정을 추가하며 `STORAGES`에 `staticfiles`만 넣고 `default`(미디어 업로드용)를 빠뜨렸던 게 원인. 이 버그는 이미 배포된 Railway 백엔드에도 그대로 있었지만 지금까지는 파일 업로드 쓰는 기능이 없어서 안 드러났던 것 — `default`에 `FileSystemStorage` 추가로 해결. 앱 쪽: `lib/api.ts`에 `uploadFaceAnalysis()` 추가(웹은 `blob:` uri를 fetch로 Blob 변환, 네이티브는 `file://` uri를 FormData에 그대로 전달), `ChatbotApiError`를 `ApiError`로 이름 일반화(얼굴분석에도 재사용). `face-capture.tsx`의 "이 사진 사용하기"가 이제 실제로 업로드·분석하고 로딩 상태/에러(예: 얼굴 미인식) 처리 후 결과 화면으로 이동. `face-result.tsx`는 종합 점수/등급 배지/부위별 막대그래프/제외된 부위 안내를 보여줌. Railway `Procfile`에 `download_face_model` 스텝 추가 — `ml_models/`가 gitignore 대상이라 배포 환경엔 모델 파일이 없었음. 브라우저(Mac 웹캠)로 촬영 화면까지는 확인, 실제 촬영→업로드→결과 화면 확인은 수인님이 직접 테스트 예정 |
| 2026-08-11 | 조수인 | `feature/production-deploy` | 심사위원 QR 데모용 실배포 완료 — 백엔드는 Railway, 프론트는 Vercel(Expo 웹 export). 백엔드: `gunicorn`(WSGI)·`whitenoise`(정적파일)·`dj-database-url`(Railway Postgres의 `DATABASE_URL` 파싱, 로컬 개발은 기존 `DB_*` 변수로 조립한 URL을 기본값으로 유지) 추가, `Procfile`에 `migrate → collectstatic → gunicorn` 순서로 기동 명령 작성. 배포 중 두 가지 실제 장애 발생: (1) `mediapipe`가 자체적으로 non-headless `opencv-contrib-python`을 의존성으로 강제해서, `opencv-contrib-python-headless`로 바꿔봐도 두 버전이 같이 깔리며 `ImportError: libxcb.so.1` 그대로 재현됨 — requirements는 원래 opencv로 되돌리고 대신 Railway `RAILPACK_DEPLOY_APT_PACKAGES`로 X11 공유 라이브러리(`libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 libxcb1`)를 배포 컨테이너에 설치해서 해결 (2) Vercel 정적 배포에서 `/chat`, `/face-capture` 같은 확장자 없는 라우트가 404 — `vercel.json`에 `cleanUrls: true` 추가로 해결. 도메인은 매 배포마다 달라져서(Railway `*.up.railway.app`, Vercel 프리뷰 `*.vercel.app`) 미리 정확한 값을 알 수 없어 `ALLOWED_HOSTS`/`CSRF_TRUSTED_ORIGINS`/`CORS_ALLOWED_ORIGIN_REGEXES`를 와일드카드로 설정. Vercel 프로젝트명 `dasi-bom`은 이미 다른 계정이 선점하고 있어서 `dasi-bom-ebon.vercel.app`으로 자동 배정됨. 최종 URL: 백엔드 `https://backend-production-ac60.up.railway.app`, 프론트 `https://dasi-bom-ebon.vercel.app` — 세션 생성/텍스트 대화/TTS까지 curl로, 챗봇·카메라 화면은 QR 스캔으로 실기기 확인 완료 |
| 2026-08-11 | 조수인 | `feature/pwa-web-support` | 심사위원 배포 방식 결정: 비용 없이 iOS/Android 모두 QR 스캔만으로(설치 과정 없이) 바로 접속 가능해야 해서, 유일하게 해당 조건을 만족하는 웹(PWA)으로 배포하기로 함. 지금까지 챗봇/카메라 화면이 `Platform.OS !== 'web'`로 막혀있던 걸 열면서 실제로 웹에서 뭐가 깨지는지 각 라이브러리의 `.web.ts` 구현체를 직접 뜯어봄 — `expo-file-system`은 웹에서 완전 미지원(전부 no-op, `console.warn`만 함)이라 이걸 쓰던 두 곳이 그대로는 100% 깨지는 걸 확인: (1) `chat.tsx`의 마이크 녹음 전송 — 웹에서 `recorder.uri`는 `File`이 아니라 `blob:` URL이라, `fetch` + `FileReader`로 직접 base64 인코딩하는 웹 전용 분기 추가 (녹음 포맷도 웹은 `audio/webm`이라 MIME 타입 분기 — Gemini API가 공식 지원하는 포맷인지 검색으로 확인 후 진행) (2) `lib/api.ts`의 TTS 오디오 다운로드 — 웹은 오히려 다운로드가 필요 없어서(`<audio>` 엘리먼트가 URL을 직접 스트리밍 재생) `expo-audio`의 `AudioPlayer.web.ts` 내부 구현을 확인해 파일 다운로드 없이 백엔드 URL을 그대로 반환하도록 단순화. `expo-camera`/`face-capture.tsx`는 `expo-file-system`을 안 써서 별도 수정 없이 웹에서 정상 동작 확인. 홈 화면 게이팅 제거(`(tabs)/index.tsx`) 후 실제 브라우저에서 챗봇 대화·카메라 촬영 둘 다 동작 확인함(수인 직접 테스트). **남은 일**: 지금은 로컬 LAN에서만 확인한 상태 — 백엔드 공개 호스팅 + 프론트 웹 빌드 배포(HTTPS 필수, 마이크/카메라 권한이 HTTP에서는 브라우저가 막음) 진행 예정 |
| 2026-08-11 | 조수인 | `fix/chat-navigation-and-recording` | 2026-08-10 `feature/chatbot`(박소정)에서 미뤄뒀던 "남은 일"(실기기/시뮬레이터로 마이크 녹음 검증)을 이어서 진행 — iOS 시뮬레이터 인프라부터 복구(Xcode 플랫폼 다운로드, SDK 57 Expo Go는 App Store 심사 대기 중이라 GitHub 릴리스(`expo/expo-go-releases`)에서 직접 받아 `simctl install`)하고 실제로 챗봇 화면에 들어가 보니 버그 2개 발견. **(1) 챗봇 화면 진입 자체가 안 됨**: 박소정이 8/10에 이미 "웹에서 `router.push('/chat')`이 안 된다"는 걸 발견해 `Platform.OS !== 'web'`로 게이팅했었는데, 원인(`_layout.tsx`가 `NativeTabs`만 렌더링하고 `Stack`이 없어서 탭에 없는 라우트는 갈 곳이 없음)이 웹만의 문제가 아니라 네이티브에서도 동일하게 발생하는 구조적 문제였음 — 네이티브에서는 그동안 아무도 실기기/시뮬레이터로 열어본 적이 없어서 발견되지 못했던 것. `index.tsx`/`explore.tsx`를 `(tabs)/` 라우트 그룹으로 옮기고, 루트 `_layout.tsx`에 `Stack`을 씌워 `(tabs)`를 한 화면으로, `chat`/`face-capture`를 그 위에 push되는 화면으로 등록해서 해결. **(2) 마이크 녹음 시 크래시**: `chat.tsx`에서 `recorder.record()` 호출 전에 iOS 오디오 세션을 녹음 허용 모드로 바꾸는 코드가 없어서 `RecordingDisabledException` 발생 — `setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })` 추가로 해결(`playsInSilentMode`를 같이 안 주면 iOS가 "불가능한 조합"이라고 거부함). 두 수정 후 시뮬레이터에서 텍스트 대화·마이크 녹음·TTS 재생 전부 실제로 확인 완료 |
| 2026-08-10 | 박소정 | `feature/chatbot` | Gemini API(`google-genai`) 기반 챗봇 MVP 구현 — 텍스트 대화 + 음성 대화(녹음→Gemini 전사→대화→TTS 응답), 전부 무료 티어 사용. 백엔드: `apps/chatbot`에 `ChatSession`/`ChatMessage` 모델과 `gemini.py` 서비스 레이어(대화 생성/음성 전사/TTS 합성 — TTS는 raw PCM(24kHz/16bit/mono) 응답을 `wave` 모듈로 WAV 헤더 붙여서 반환) 추가. API 3개: 세션 생성/목록, 메시지 전송(텍스트 또는 base64 오디오 — 오디오면 먼저 Gemini로 전사 후 동일 파이프라인 재사용)/목록, 메시지별 TTS 오디오 스트리밍(저장 안 하고 매번 새로 합성). 인증(Token/JWT)이 아직 없어서 symptoms/notifications와 같은 `demo` 계정에 고정 — `TODO(PRD)` 주석 남겨두고 나중에 `request.user`로 교체 예정. 스모크테스트 중 `GEMINI_API_KEY`가 비어있을 때 `genai.Client()` 생성이 에러 래퍼 바깥에서 일어나 500으로 죽는 버그 발견 — 클라이언트 생성과 호출을 한 함수(`_generate_content`)로 합쳐서 429/일반 에러 모두 502/503으로 깔끔히 내려가게 수정. 앱: `expo-audio`/`expo-file-system`(신규 File/Directory 클래스 기반 API로 완전히 바뀜 — `downloadAsync`는 레거시) 도입, `chat.tsx`에 텍스트 입력/전송 + 마이크 녹음 + 챗봇 답변 TTS 재생(`player.replace()`로 오디오 소스 교체) 구현. 홈 화면에 진입 버튼을 추가하며 웹으로 확인하다가 `router.push('/chat')`이 웹에서 전혀 동작하지 않는 걸 발견 — 원인은 루트 레이아웃이 `NativeTabs`만 렌더링하고 `Stack`이 없어서 탭 목록에 없는 라우트로는 웹에서 못 감(직접 URL 이동으로도 재현), `face-capture`가 애초에 iOS/Android 전용으로 게이팅됐던 것과 같은 이유였음 — 챗봇 진입 버튼도 동일하게 `Platform.OS !== 'web'`로 게이팅. iOS 시뮬레이터 도구가 인프라 크래시로 재시도 불가 상태가 되어 실기기/시뮬레이터 화면 확인은 못 함(앱 UI 자체는 타입체크/린트 클린). 실제 발급받은 `GEMINI_API_KEY`로 백엔드 전체 흐름은 curl로 라이브 검증 완료 — (1) 기본 채팅 모델 `gemini-2.5-flash`가 "no longer available to new users" 404를 반환하는 걸 발견, 신규 키에서도 항상 열려있는 별칭 모델 `gemini-flash-latest`로 교체(`settings.py`/`.env.example` 기본값 변경) (2) 텍스트 대화 응답이 페르소나대로 정상 생성됨을 확인 (3) TTS 응답이 RIFF/WAVE PCM 16bit mono 24000Hz로 올바르게 인코딩되고 실제로 들리는 음성임을 재생해서 확인 (4) 방금 받은 TTS 음성을 사용자 입력인 것처럼 되돌려 넣어 음성 전사 파이프라인을 라운드트립으로 검증 — 원문과 정확히 일치하는 텍스트로 전사됨. `gemini-2.5-flash-preview-tts`(TTS)와 `gemini-flash-latest`(대화)는 이 키로 정상 동작하나 `gemini-2.5-flash-lite`도 같은 이유로 막혀있었음(모델 가용성은 키/계정별로 달라질 수 있음, 문제 생기면 이 방법으로 `client.models.list()`로 확인). **남은 일**: 앱에서 실제 마이크 녹음(m4a, `audio/mp4`)으로 보내는 경로는 아직 실기기 검증 전(오늘은 오디오 파일을 직접 만들어 우회 검증함) — 시뮬레이터/실기기 복구되면 마이크 버튼부터 확인 |
| 2026-08-10 | 조수인 | `feature/face-capture-guide` | 홍조 벤치마크(같은 날 `feature/redness-benchmark-dataset`)에서 드러난 오차의 상당 부분이 비표준 촬영 조건(각도·조명)에서 비롯된다고 보고, 실시간 얼굴 인식 없이 가벼운 정적 오버레이로 촬영을 유도하는 방식을 택함. expo-camera 설치 + 카메라 권한 설정, `face-capture.tsx`에 전면 카메라 위 반투명 마스크 + 점선 타원 가이드로 얼굴 정렬 유도. 타원 38% 지점에 눈높이 기준선을 둬서 백엔드 `analyze_face_redness()`가 볼 ROI 앵커로 쓰는 눈꼬리 랜드마크가 잘 잡히도록 함. 조명 편향 완화를 위해 "고른 조명에서 촬영" 안내 문구 포함, 촬영 후 다시찍기/사용하기 미리보기 제공, 홈 화면에 진입점 버튼 추가(iOS/Android 전용). "이 사진 사용하기" 버튼은 아직 체크인 제출/업로드 API와 연결되지 않은 자리표시자 — 백엔드 인증(Token/JWT)이 먼저 붙어야 실제 업로드 연동 가능 |
| 2026-08-10 | 조수인 | `feature/redness-benchmark-dataset` | 기존 벤치마크(`manage.py benchmark_face_analysis`)는 자체 라벨링한 실사진 7장뿐이라 표본이 매우 작았음 — Kaggle `skin_type_classification_dataset`의 train/valid 스플릿(dry/oily/normal)에 실측 "Redness Severity (0-5)" 라벨이 있는 걸 확인해 194장 규모로 재검증하는 `benchmark_redness_severity_dataset` 커맨드 추가. Image_ID + Redness Severity를 라벨 xlsx에서 읽어 파일명 접두어로 실제 이미지 경로 매칭(200/200 매칭 확인), 라벨을 0~100 스케일로 변환해 `analyze_face_redness()` 결과와 비교, MAE/RMSE·Pearson/Spearman 상관계수·4단계 등급 혼동행렬 출력. 결과: 얼굴 인식 성공률 98%(194/197)이나 Pearson r=0.22로 상관관계가 약하고 전반적으로 과소평가(under-scoring)하는 경향 확인 — `A_CHANNEL_LOW/HIGH` 재보정 또는 촬영 조건 표준화 필요성의 근거 데이터로 남김 |
| 2026-08-10 | 차성진 | `feature/reminders` | `Reminder`(복약·영양제 / 명상·스트레칭, 매일 반복 시각) / `ReminderCompletion`(하루 단위 완료 기록, `(reminder, date)` unique) 모델 구현. API: CRUD + 완료 토글(`POST .../complete`, 완료 기록 있으면 삭제=취소·없으면 생성=완료) + 오늘 조회(`GET .../today`, 완료 여부 포함). `PUT`은 막고 `PATCH`만 허용(시간·활성화 여부만 부분 수정하면 되므로), 비활성 리마인더를 완료 처리하려 하면 404. 테스트 14개, 데모 계정용 시드 커맨드(7일치, 재현성 보장) 추가, README에 Docker PostgreSQL 로컬 세팅 가이드 추가 |
| 2026-08-09 | 조수인 | `fix/face-analysis-reference-skin-check` | 실사진 7장에 육안 severity 라벨(mild/moderate/severe)을 매기고 `manage.py benchmark_face_analysis`로 파이프라인 예측과 대조 — 최초 일치율 29%(2/7), 대부분 mild/moderate가 severe로 과대예측됨. 원인 추적 결과 화이트밸런스 기준점(관자놀이/턱)이 실제 피부인지 검증 없이 그대로 쓰이고 있었음 — 라벨=mild인데 raw 점수가 라벨=severe 사진들보다도 높게 나온 사진 하나를 진단해보니, 관자놀이 기준점 하나는 머리카락, 하나는 배경 창문을 잡고 있었음(Lab chroma로 구분: 실제 피부 12.7 vs 머리카락 4.2 / 배경 5.0). `_looks_like_skin_reference()`(밝기+chroma 이중 체크)를 추가해 기준점에서 머리카락·배경을 배제하되, 타이트한 크롭으로 셋 다 걸러지는 사진을 위해 밝기만 보는 느슨한 필터로 폴백하는 2단계 로직 구성 — 이 수정만으로 해당 사진 raw값이 17.0 → 2.25로 정상 범위 복귀. 이어서 라벨 그룹별 raw 분포(mild 0.33~2.25 / moderate 10.0~12.0 / severe 12.0~21.25)에 최소자승 회귀를 적용해 `A_CHANNEL_LOW`(0.0→-5.0)·`A_CHANNEL_HIGH`(15.0→21.5) 재계산. 최종 일치율 86%(6/7), 남은 1건은 두 라벨 그룹의 raw값이 정확히 동률(12.0)인 경계 케이스라 구조적으로 어쩔 수 없음. n=7은 표본이 매우 작아 확정적 보정은 아니며, 라벨 계속 늘려서 재보정 필요 — 라벨 파일은 `apps/face_analysis/benchmark_labels.json`, 재현은 `manage.py benchmark_face_analysis` |
| 2026-08-08 | 허서영 | `feature/symptom-api` | 기록 API 구현: 증상 버튼 목록 조회, 원터치 기록(`symptom_type` 하나만 보내면 됨)·취소, 오늘 체크인 조회·업서트, 기간 조회(`?date=` 또는 `?from=&to=`, 기본 최근 14일). 두 가지 설계 결정 — (1) `source`는 앱이 못 정하고 서버가 `manual`로 고정해, 나중에 챗봇 소급 기록과 섞이지 않게 함 (2) 체크인 미완료는 오류가 아니라 정상 상태라서 404 대신 `completed: false`를 200으로 반환. 테스트 21개(사용자 격리·오입력 취소·미래 시각 거부·척도 범위 등) 및 시드 데이터로 실제 서버 검증 |
| 2026-08-08 | 허서영 | `feature/symptom-log` | 증상 기록·체크인 데이터 모델 구축: `SymptomType`(증상 마스터 12종, 앱 버튼 목록을 API로 내려주기 위해 상수가 아닌 테이블로 둠) / `SymptomLog`(원터치 기록, `source`로 직접·챗봇·소급 구분) / `DailyCheckIn`(하루 1건, 필수는 수면·기분 2개만 — 입력 부담 최소화) / `WeeklyReport`(숫자는 규칙 기반 `stats`, 문장은 `summary_text`). 시연용 `seed_symptoms` 커맨드 추가 — 난수 시드 고정으로 재현 가능하며, 리포트가 다시 찾아내야 할 패턴(홍조 저녁 편중 58%, 못 잔 다음날 홍조 3.2회 vs 2.0회, 미기록일 2일)을 의도적으로 심어 둠 |
| 2026-08-07 | 조수인 | `fix/face-analysis-cheek-without-eyes` | 눈이 안 보이는(코·입·볼·턱만 나온) 클로즈업 사진에서 볼이 명백히 찍혀 있는데도 전부 제외되는 문제 발견 — 볼 앵커가 눈꼬리 랜드마크에 의존해서, 눈이 프레임 밖이면 볼도 무조건 제외됐음. 눈이 프레임 안이면 기존 눈+입꼬리 중점을 쓰고, 눈이 없으면 코→입꼬리 방향 연장(코-입꼬리 벡터의 0.25배 추가 연장)으로 대체하는 폴백 추가. 배율은 실사진으로 스윕(0/0.15/0.25/0.35)해서 양쪽 다 머리카락 안 걸리는 값으로 선정 |
| 2026-08-07 | 조수인 | `fix/face-analysis-lighting-bias` | 거의 안 찍힌 반대쪽 볼(카메라 밖으로 돌아간 얼굴)에 66.7점이 나오는 문제 발견 — 원인은 MediaPipe가 프레임 밖으로 나간 눈 랜드마크까지 좌표를 추정(이미지 폭 밖 x좌표)해서, 그 랜드마크로 만든 ROI가 clamp되어 얇고 비대표적인 조각을 긁어온 것. ROI를 구성하는 랜드마크가 이미지 프레임 안에 충분히 들어와 있는지(`_fully_in_frame`) 먼저 확인하고, 아니면 크롭조차 시도하지 않고 바로 `excluded_regions`에 넣도록 수정. 같은 사진 재검증 시 right_cheek/forehead/nose 정상적으로 제외되고 left_cheek만 점수화됨 |
| 2026-08-07 | 조수인 | `fix/face-analysis-lighting-bias` | 얼굴이 살짝 돌아간 실사진에서 반대쪽 볼 점수가 0으로 나오는 문제 발견 — 눈 기준 고정 비율 오프셋으로 볼 위치를 잡던 방식이 정면이 아닌 얼굴에서 머리카락/배경을 잘못 잡는 버그였음. 눈꼬리·입꼬리 중점(둘 다 각도에 따라 같이 움직이는 실제 랜드마크)으로 앵커 교체, 피부처럼 안 보이면(너무 어두우면) 해당 부위를 점수에서 제외하고 `excluded_regions`로 표기하는 안전장치 추가. 실사진으로 재검증(양볼 100/93.3, 이마 40, 코 73.3 — 육안 홍조와 부합) |
| 2026-08-07 | 조수인 | `fix/face-analysis-lighting-bias` | 실사진 테스트에서 이마·코 점수가 항상 볼보다 높게 나오는 문제 발견(조명 편향). 관자놀이/턱을 기준점으로 삼는 화이트밸런스 보정 추가 + 하이라이트에 강한 median 기반 점수 계산으로 수정. 단, 정면 플래시처럼 얼굴 안에서도 밝기 편차가 큰 사진은 여전히 부정확 — README에 촬영 가이드(고른 조명 권장) 명시, 응답에 `lighting_corrected` 플래그 추가 |
| 2026-08-07 | 조수인 | `feature/face-analysis` | 얼굴 홍조 분석 MVP 구현: MediaPipe FaceLandmarker로 이마/양볼/코 ROI 추출 + Lab a\* 채널 기반 규칙형 점수화, `/api/face-analysis/` 업로드·조회 API, 모델 다운로드 커맨드. Django 6.1 → DRF 비호환 발견해 5.2 LTS로 다운그레이드 |
| 2026-08-06 | - | `develop` | 레포 초기 세팅: Expo(app) + Django(backend) 프로젝트 구조, 브랜치 전략(develop/main) 및 네이밍 규칙 문서화 |
