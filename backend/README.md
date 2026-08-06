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
