from django.db import migrations

# 명상·스트레칭 콘텐츠 3종, 전부 3분(180초). 완경기 증상(목·어깨 긴장, 수면 전 긴장)에
# 흔히 권해지는 가벼운 동작 위주로 잡았다 — 의료적 효과를 주장하지 않는 일반 이완 루틴.
#
# 각 단계의 "pose"는 앱이 보여주는 마스코트 애니메이션 키다(app/src/components/mascot.tsx
# 의 POSES와 맞춰야 함) -- 문구에서 동작을 추측하지 않고 콘텐츠가 직접 지정한다.
SESSIONS = [
    {
        'code': 'neck_shoulder_stretch',
        'title': '목·어깨 스트레칭',
        'description': '뭉친 목과 어깨를 풀어줘요',
        'order': 10,
        'steps': [
            {'instruction': '편하게 앉아 어깨 힘을 빼요', 'seconds': 15, 'pose': 'rest'},
            {'instruction': '고개를 오른쪽으로 천천히 기울여요', 'seconds': 20, 'pose': 'tilt_right'},
            {'instruction': '고개를 왼쪽으로 천천히 기울여요', 'seconds': 20, 'pose': 'tilt_left'},
            {'instruction': '어깨를 귀 쪽으로 올렸다 내리기를 반복해요', 'seconds': 30, 'pose': 'shoulder_shrug'},
            {'instruction': '양팔을 뒤로 젖혀 가슴을 활짝 펴요', 'seconds': 30, 'pose': 'chest_open'},
            {'instruction': '목을 크게 한 바퀴 돌려요', 'seconds': 30, 'pose': 'neck_roll'},
            {'instruction': '숨을 크게 내쉬며 천천히 마무리해요', 'seconds': 35, 'pose': 'breathe'},
        ],
    },
    {
        'code': 'breathing_meditation',
        'title': '호흡 명상',
        'description': '깊게 숨쉬며 마음을 가라앉혀요',
        'order': 20,
        'steps': [
            {'instruction': '편안한 자세로 앉아 눈을 감아요', 'seconds': 15, 'pose': 'rest'},
            {'instruction': '코로 천천히 4초간 숨을 들이마셔요', 'seconds': 20, 'pose': 'breathe'},
            {'instruction': '4초간 숨을 참아요', 'seconds': 20, 'pose': 'rest'},
            {'instruction': '입으로 6초간 천천히 내쉬어요', 'seconds': 25, 'pose': 'breathe'},
            {'instruction': '같은 리듬으로 호흡을 반복해요', 'seconds': 60, 'pose': 'breathe'},
            {'instruction': '눈을 뜨고 몸의 감각을 느껴봐요', 'seconds': 20, 'pose': 'rest'},
            {'instruction': '천천히 마무리해요', 'seconds': 20, 'pose': 'rest'},
        ],
    },
    {
        'code': 'evening_wind_down',
        'title': '저녁 이완 스트레칭',
        'description': '하루를 마무리하는 가벼운 이완',
        'order': 30,
        'steps': [
            {'instruction': '자리에 편하게 앉거나 누워요', 'seconds': 15, 'pose': 'rest'},
            {'instruction': '양손을 깍지 끼고 위로 쭉 뻗어요', 'seconds': 20, 'pose': 'reach_up'},
            {'instruction': '상체를 좌우로 천천히 기울여요', 'seconds': 30, 'pose': 'side_bend'},
            {'instruction': '발목을 천천히 돌려요', 'seconds': 30, 'pose': 'ankle_roll'},
            {'instruction': '무릎을 가슴 쪽으로 당겨 안아요', 'seconds': 30, 'pose': 'hug_knees'},
            {'instruction': '온몸의 힘을 빼고 편하게 누워요', 'seconds': 35, 'pose': 'lie_relax'},
            {'instruction': '천천히 눈을 감고 호흡에 집중해요', 'seconds': 20, 'pose': 'breathe'},
        ],
    },
]


def create_sessions(apps, schema_editor):
    MindfulnessSession = apps.get_model('notifications', 'MindfulnessSession')
    for session in SESSIONS:
        total_seconds = sum(step['seconds'] for step in session['steps'])
        MindfulnessSession.objects.update_or_create(
            code=session['code'],
            defaults={
                'title': session['title'],
                'description': session['description'],
                'order': session['order'],
                'steps': session['steps'],
                'total_seconds': total_seconds,
            },
        )


def delete_sessions(apps, schema_editor):
    MindfulnessSession = apps.get_model('notifications', 'MindfulnessSession')
    MindfulnessSession.objects.filter(code__in=[s['code'] for s in SESSIONS]).update(is_active=False)


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0002_mindfulnesssession'),
    ]

    operations = [
        migrations.RunPython(create_sessions, delete_sessions),
    ]
