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

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # 값 채우기 (DB, GEMINI_API_KEY 등)

# PostgreSQL 로컬 실행 후
python manage.py migrate
python manage.py createsuperuser
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

### 시연용 목업 데이터

```bash
python manage.py seed_symptoms --reset     # demo / demo1234 계정에 14일치 생성
```

난수 시드가 고정돼 있어 몇 번을 돌려도 같은 데이터가 나옵니다(기준일만 오늘로 이동). 주간 리포트가 다시 찾아내야 할 패턴을 의도적으로 심어 뒀습니다.

- 홍조가 저녁(18~22시)에 몰림 — 전체의 약 58%
- 못 잔 다음날 홍조가 늘어남 — 평균 3.2회 vs 2.0회
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
