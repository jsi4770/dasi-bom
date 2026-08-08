from django.db import migrations

# 완경기 대표 증상 12종. 앱에서 3x4 버튼 그리드로 그리는 걸 전제로 순서를 잡았다.
# 항목을 바꾸려면 이 마이그레이션을 고치지 말고 admin에서 수정하거나 새 마이그레이션을 추가할 것.
SYMPTOM_TYPES = [
    # (code, label, category, emoji, order)
    ('hot_flash', '홍조', 'vasomotor', '🔥', 10),
    ('night_sweat', '식은땀', 'vasomotor', '💧', 20),
    ('palpitation', '두근거림', 'vasomotor', '💓', 30),
    ('insomnia', '잠들기 어려움', 'sleep', '🌙', 40),
    ('night_waking', '자다 깸', 'sleep', '😪', 50),
    ('low_mood', '기분 가라앉음', 'mood', '🌧️', 60),
    ('irritability', '짜증·예민함', 'mood', '⚡', 70),
    ('anxiety', '불안', 'mood', '😰', 80),
    ('joint_pain', '관절통', 'physical', '🦴', 90),
    ('headache', '두통', 'physical', '🤕', 100),
    ('fatigue', '피로감', 'physical', '🔋', 110),
    ('dryness', '건조·불편감', 'physical', '🌵', 120),
]


def create_symptom_types(apps, schema_editor):
    SymptomType = apps.get_model('symptoms', 'SymptomType')
    for code, label, category, emoji, order in SYMPTOM_TYPES:
        SymptomType.objects.update_or_create(
            code=code,
            defaults={'label': label, 'category': category, 'emoji': emoji, 'order': order},
        )


def delete_symptom_types(apps, schema_editor):
    SymptomType = apps.get_model('symptoms', 'SymptomType')
    # 기록이 걸려 있으면 PROTECT에 막히므로, 지우지 않고 비활성화만 한다.
    SymptomType.objects.filter(code__in=[c for c, *_ in SYMPTOM_TYPES]).update(is_active=False)


class Migration(migrations.Migration):

    dependencies = [
        ('symptoms', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_symptom_types, delete_symptom_types),
    ]
