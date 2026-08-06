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

## face_analysis (얼굴 홍조 분석)

MediaPipe FaceLandmarker로 얼굴 부위(이마/양볼/코)를 찾고, 각 부위의 CIE Lab a\* 채널(피부 홍조를 정량화할 때 쓰는 색공간 지표)을 점수화하는 규칙 기반 MVP입니다. 딥러닝 학습 없이 바로 동작하며, 로직은 `apps/face_analysis/analysis.py`에 있습니다.

```bash
python manage.py download_face_model   # ml_models/face_landmarker.task 다운로드 (최초 1회, gitignore됨)
```

- `POST /api/face-analysis/` — `multipart/form-data`로 `image` 업로드 → `{redness_score, severity, region_scores}` 저장 + 반환
- `GET /api/face-analysis/` — 로그인 사용자의 분석 이력 조회
- 얼굴을 못 찾으면 `422`와 안내 메시지 반환

**주의**: `A_CHANNEL_LOW` / `A_CHANNEL_HIGH` / `SEVERITY_BINS` (analysis.py 상단)는 실측 데이터 없이 잡은 placeholder 값입니다. 실제 얼굴 사진이 모이면 재보정 필요.
