# dasi-bom backend (Django REST API)

## 구조

```
backend/
├── config/            # 프로젝트 설정 (settings, urls, wsgi/asgi)
├── apps/
│   ├── users/          # 인증/사용자
│   ├── symptoms/        # 증상 기록 + AI 분석 리포트 (허서영)
│   ├── chatbot/          # 생활 정보 길잡이 챗봇 - Gemini API (박소정)
│   ├── face_analysis/    # 얼굴 사진 분석 - CV 모델 (조수인)
│   └── notifications/    # 복약/명상 알림
├── requirements.txt
└── .env.example
```

## 로컬 세팅

### 1. 의존성 설치

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 환경 변수

```bash
cp .env.example .env   # 값 채우기 (GEMINI_API_KEY 등). DB 값은 아래 3번 컨테이너와 맞춰져 있어 기본값 그대로 써도 됨
```

### 3. PostgreSQL 준비 (Docker)

로컬에 Postgres를 따로 설치하지 않았다면, `.env.example`의 DB 값과 정확히 맞춘 컨테이너 하나면 충분합니다.

```bash
docker run --name dasibom-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=dasibom \
  -p 5432:5432 \
  -d postgres:16
```

한 번 만들어두면 다음부터는 `docker start dasibom-postgres`로 재기동하면 됩니다.

### 4. 마이그레이션 적용

```bash
python manage.py migrate
python manage.py createsuperuser   # 선택
```

### 5. 시연용 데이터 생성

```bash
python manage.py seed_symptoms --reset     # 증상 기록·체크인 (14일치)
python manage.py seed_reminders --reset    # 리마인더·완료기록 (7일치)
```

둘 다 같은 데모 계정(`demo` / `demo1234`)을 씁니다. 자세한 내용은 아래 각 앱 섹션 참고.

### 6. 서버 실행

```bash
python manage.py runserver
```

헬스체크: `GET /api/health/` → `{"status": "ok"}`

## API 라우팅

각 기능 앱은 `/api/<app>/` 아래에 마운트되어 있습니다 (`config/urls.py`).
엔드포인트는 각 앱의 `views.py` / `urls.py`에 추가하세요.

## symptoms (증상 기록 · 체크인)

모델 4개로 나뉩니다.

| 모델 | 역할 |
| --- | --- |
| `SymptomType` | 증상 마스터 12종. **앱의 원터치 버튼 목록을 이 테이블에서 내려주므로**, 항목이 바뀌어도 앱 재배포가 필요 없습니다. 초기 데이터는 마이그레이션 `0002`에 있고, 이후 변경은 admin에서 |
| `SymptomLog` | 낮에 원터치로 남기는 증상 1건. `source`로 직접 기록/챗봇 대화/소급 기록을 구분 |
| `DailyCheckIn` | 저녁 종합 체크인. 하루 1건(`user`+`date` 유니크). **이 레코드가 있으면 그날은 기록 완료**로 셉니다 (성공 지표: 2주 연속 주 5일) |
| `WeeklyReport` | 주간 패턴 리포트 캐시. 숫자는 `stats`(규칙 기반 집계), 문장은 `summary_text` |

`DailyCheckIn`에서 필수는 `sleep_quality`·`mood` 두 개뿐입니다. PRD의 "입력 부담 최소화" 때문에 나머지는 건너뛸 수 있게 뒀습니다.

### API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/api/symptoms/types/` | 원터치 버튼 목록 (비활성 증상 제외) |
| `POST` | `/api/symptoms/logs/` | 증상 기록. **`symptom_type` 하나만 보내면 됩니다** — 시각은 지금, 강도는 '보통'이 기본값 |
| `GET` | `/api/symptoms/logs/` | 기간 조회 |
| `DELETE` | `/api/symptoms/logs/<id>/` | 오입력 취소 |
| `GET` | `/api/symptoms/checkins/today/` | 오늘 체크인 상태 |
| `PUT` | `/api/symptoms/checkins/today/` | 오늘 체크인 저장 (없으면 생성 `201`, 있으면 수정 `200`) |
| `GET` | `/api/symptoms/checkins/` | 기간 조회 |
| `GET` | `/api/symptoms/reports/weekly/` | 주간 패턴 리포트 (`?week=2026-08-03`, 없으면 이번 주 / `?refresh=1`로 문장 재생성) |
| `GET` | `/api/symptoms/streak/` | 기록 지속 현황 (연속 일수, 주별 달성) |

조회용 쿼리 파라미터는 `?date=2026-08-08` (하루) 또는 `?from=...&to=...` (기간)이고, 아무것도 안 주면 **최근 14일**입니다.

**모든 엔드포인트가 로그인을 요구합니다.** 시연에서는 원클릭 게스트 로그인으로 토큰을 받아 쓰면 됩니다.

```bash
curl -X POST http://localhost:8000/api/auth/demo-login/     # → {"access": "...", "refresh": "..."}
curl -H "Authorization: Bearer <access>" http://localhost:8000/api/symptoms/reports/weekly/
```

기록이 `request.user` 기준으로 저장·조회되므로, 데모 계정으로 로그인하면 `seed_symptoms`가 만든 14일치 데이터가 그대로 보입니다.

두 가지만 기억하시면 됩니다.

- **`source`는 서버가 정합니다.** 이 엔드포인트로 들어온 기록은 전부 `manual`이 됩니다. 챗봇이 대화로 받아낸 소급 기록은 별도 엔드포인트(`backfill`, 예정)로 받아서 구분합니다.
- **체크인을 아직 안 한 상태는 오류가 아닙니다.** `GET .../today/`는 404 대신 `{"completed": false, "check_in": null}`을 200으로 돌려줍니다. 앱이 예외 처리 없이 화면을 그릴 수 있게 하려는 것입니다.

```jsonc
// GET /api/symptoms/checkins/today/
{ "date": "2026-08-08", "completed": true, "check_in": { "sleep_quality": 3, "mood": 4, ... } }
```

### 주간 리포트 — 숫자는 코드, 문장은 AI

역할이 나뉘어 있습니다. 이 경계가 이 기능의 핵심입니다.

| 파일 | 역할 |
| --- | --- |
| `analysis.py` | **숫자를 전부 규칙 기반으로 계산합니다.** 증상별 횟수, 지난주 대비 증감, 시간대 분포, 수면-증상 비교, 미기록일 |
| `summary.py` | 계산된 숫자만 Gemini에 넘겨 **해석과 생활 제안 문장**을 받습니다 |

**Gemini에 원본 기록을 통째로 넘기지 않습니다.** 수치를 지어내면 리포트 전체를 믿을 수 없게 되기 때문입니다. 프롬프트에도 "위 집계에 없는 숫자는 쓰지 말 것"을 명시했습니다.

생성된 문장은 `WeeklyReport.summary_text`에 저장하고, **집계가 달라졌을 때만 새로 만듭니다.** 시연 중 같은 주를 여러 번 열어도 문장이 매번 바뀌면 곤란하고, 무료 티어 한도도 아껴야 해서입니다. 응답의 `summary_source`로 어떻게 나온 문장인지 알 수 있습니다.

| `summary_source` | 뜻 |
| --- | --- |
| `ai` | Gemini가 새로 생성 |
| `cached` | 저장된 문장 재사용 (집계 변화 없음) |
| `template` | 키가 없거나 호출 실패 → 규칙 기반 문장으로 폴백 |

`GEMINI_API_KEY`가 없어도 리포트는 정상적으로 나갑니다.

### 판단하지 않는 것

없는 패턴을 있다고 말하지 않도록 최소 조건을 뒀습니다.

- 한 시간대에 **40% 이상** 몰려야 "주로 ○○ 시간대"라고 씁니다. 고르게 흩어져 있으면 시간대를 언급하지 않습니다.
- 수면-증상 비교는 잘 잔 날·못 잔 날이 **각각 2일 이상**일 때만 합니다. 하루씩만 비교하면 우연입니다.
- 프롬프트에서 진단·병명을 금지했습니다. 의료 조언이 아니라 생활 제안입니다.

### 시연용 목업 데이터

```bash
python manage.py seed_symptoms --reset     # demo / demo1234 계정에 14일치 생성
```

난수 시드가 고정돼 있어 몇 번을 돌려도 같은 데이터가 나옵니다(기준일만 오늘로 이동). 주간 리포트가 다시 찾아내야 할 패턴을 의도적으로 심어 뒀습니다.

- 홍조가 저녁에 몰림 — 리포트가 "저녁 83%"로 잡아냄
- 잠을 설쳤다고 기록한 날 증상이 늘어남 — 하루 평균 6.0건 vs 3.7건
- 기록이 빠진 날 2일 — 챗봇이 먼저 물어볼 재료

**주의**: `--reset`은 대상 사용자의 증상 기록·체크인·주간 리포트를 **전부 지우고** 다시 만듭니다. 시연 계정에만 쓰세요.

## face_analysis (얼굴 홍조 분석)

MediaPipe FaceLandmarker로 얼굴 부위(이마/양볼/코)를 찾고, 각 부위의 CIE Lab a\* 채널(피부 홍조를 정량화할 때 쓰는 색공간 지표)을 점수화하는 규칙 기반 MVP입니다. 딥러닝 학습 없이 바로 동작하며, 로직은 `apps/face_analysis/analysis.py`에 있습니다.

```bash
python manage.py download_face_model   # ml_models/face_landmarker.task 다운로드 (최초 1회, gitignore됨)
```

- `POST /api/face-analysis/` — `multipart/form-data`로 `image` 업로드 → `{redness_score, severity, region_scores, lighting_corrected, excluded_regions}` 저장 + 반환
- `GET /api/face-analysis/` — 로그인 사용자의 분석 이력 조회
- 얼굴을 못 찾으면 `422`와 안내 메시지 반환

**주의**
- `A_CHANNEL_LOW` / `A_CHANNEL_HIGH` / `SEVERITY_BINS` (analysis.py 상단)는 실측 데이터 없이 잡은 placeholder 값입니다. 실제 얼굴 사진이 모이면 재보정 필요.
- 관자놀이/턱 부위를 기준으로 화이트밸런스(조명 색온도) 보정을 하지만, **고르지 않은 강한 조명(예: 정면 플래시로 이마·코만 밝고 볼은 그늘짐)까지는 보정하지 못합니다.** 이런 사진은 부위별 점수가 0으로 뭉치거나 왜곡될 수 있음 — 데모/촬영 시 가급적 창문광처럼 고르게 퍼지는 조명 사용 권장. 응답의 `lighting_corrected`가 `false`면 보정 기준(관자놀이/턱)조차 프레임 밖이라 보정이 아예 적용되지 않은 것.
- 볼 ROI는 눈꼬리·입꼬리 중점을 기준으로 잡아 얼굴이 돌아간(정면이 아닌) 사진에도 어느 정도 대응하지만, 극단적인 각도에서는 여전히 어긋날 수 있음. 그런 경우 대비로 ROI가 너무 어두우면(머리카락/배경 오인 가능성) 해당 부위를 점수에서 제외하고 `excluded_regions`에 표기함.
- 얼굴이 카메라 밖으로 많이 돌아가면 MediaPipe가 프레임 밖 좌표까지 랜드마크를 추정하는데, 그런 랜드마크로 만든 ROI는 (clamp되어 얇고 비대표적인 조각만 남기 때문에) 아예 크롭을 시도하지 않고 제외함 — 얼굴 한쪽이 거의 안 찍힌 사진은 그쪽 부위들이 대부분 `excluded_regions`로 빠지는 게 정상.
