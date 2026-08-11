"""집계된 숫자를 사람이 읽는 문장으로 바꾼다.

역할 분담이 핵심이다 — **숫자는 `analysis.py` 가 계산하고, 여기서는 해석과 제안만 만든다.**
Gemini 에 원본 기록을 통째로 넘기지 않는 이유는 두 가지다.

1. 시연에서 매번 같은 숫자가 나와야 한다. 생성된 문장은 `WeeklyReport.summary_text` 에
   저장해두고 다시 쓴다.
2. LLM 이 "홍조 7회" 같은 수치를 지어내면 리포트 전체를 믿을 수 없게 된다.

키가 없거나 호출이 실패해도 리포트는 나가야 하므로, 항상 규칙 기반 문장으로 폴백한다.
"""

import logging

from django.conf import settings

logger = logging.getLogger(__name__)

PROMPT_RULES = """[지켜야 할 것]
- 위 집계에 없는 숫자나 사실은 절대 쓰지 마세요. 수치를 새로 만들면 안 됩니다.
- 진단하거나 병명을 말하지 마세요. 의료 조언이 아니라 생활 제안입니다.
- 3~4문장, 짧고 따뜻한 존댓말. 완경기에 접어든 50대 여성에게 말하듯이.
- 첫 문장은 이번 주 가장 두드러진 패턴, 마지막 문장은 오늘 바로 해볼 수 있는 작은 제안 하나.
- "데이터에 따르면" 같은 딱딱한 표현 대신 일상적인 말로."""


def build_summary(stats):
    """(문장, 출처) 를 돌려준다. 출처는 'ai' 또는 'template'."""
    if not stats['total_logs'] and not stats['days_recorded']:
        return '이번 주에는 아직 기록이 없어요. 오늘 저녁에 한 번 남겨보시면 어떨까요?', 'template'

    if settings.GEMINI_API_KEY:
        try:
            return _ask_gemini(stats), 'ai'
        except Exception as exc:  # 키 오류·한도 초과·네트워크 등 무엇이든 리포트는 나가야 한다
            logger.warning('주간 리포트 문장 생성 실패, 템플릿으로 대체: %s', exc)

    return _from_template(stats), 'template'


def _ask_gemini(stats):
    # 챗봇(apps.chatbot.gemini)과 같은 SDK 를 쓰지만, 그쪽 내부 함수에 의존하지 않으려고
    # 여기서 따로 호출한다. 공용 헬퍼가 생기면 그걸로 바꾸는 게 낫다.
    from google import genai

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    response = client.models.generate_content(
        model=settings.GEMINI_CHAT_MODEL,
        contents=f'{_describe(stats)}\n\n{PROMPT_RULES}',
    )
    text = (response.text or '').strip()
    if not text:
        raise ValueError('빈 응답')
    return text


def _describe(stats):
    """집계 dict 를 프롬프트에 넣을 텍스트로 편다."""
    lines = [
        '아래는 한 사용자의 이번 주 증상 기록을 집계한 결과입니다. 숫자는 이미 계산돼 있습니다.',
        '',
        '[집계]',
        f'기간: {stats["week_start"]} ~ {stats["week_end"]}',
        f'기록한 날: {stats["days_recorded"]}일 (목표 주 {stats["goal_days"]}일)',
        f'전체 증상 기록: {stats["total_logs"]}건',
    ]

    for row in stats['symptoms'][:4]:
        line = f'- {row["label"]} {row["count"]}회'
        if row['prev_count']:
            line += f' (지난주 {row["prev_count"]}회, {row["delta"]:+d})'
        if row['peak_slot_label']:
            line += f' / {row["peak_slot_label"]} 시간대에 {round(row["peak_ratio"] * 100)}% 몰림'
        lines.append(line)

    link = stats['sleep_link']
    if link:
        lines.append(
            f'- 잠을 설쳤다고 기록한 날은 하루 평균 {link["symptoms_after_poor_sleep"]}건, '
            f'잘 잔 날은 {link["symptoms_after_good_sleep"]}건'
        )

    averages = stats['check_in_averages']
    if averages['mood'] is not None:
        lines.append(f'- 기분 평균 {averages["mood"]}/5, 수면 평균 {averages["sleep_quality"]}/5')

    return '\n'.join(lines)


def _with_particle(word, with_final, without_final):
    """받침 유무에 따라 조사를 고른다 ('홍조가' / '식은땀이').

    한글 음절은 유니코드에서 (코드 - 0xAC00) % 28 이 0 이면 받침이 없다.
    """
    last = word[-1]
    has_final = '가' <= last <= '힣' and (ord(last) - 0xAC00) % 28 != 0
    return word + (with_final if has_final else without_final)


def _from_template(stats):
    """Gemini 없이도 리포트가 비어 보이지 않게 하는 최소 문장."""
    sentences = []
    symptoms = stats['symptoms']

    if symptoms:
        top = symptoms[0]
        first = f'{_with_particle(top["label"], "이", "가")} {top["count"]}번 있었어요'
        if top['peak_slot_label']:
            first += f'. 주로 {top["peak_slot_label"]} 시간대였고요'
        sentences.append(first + '.')

        if top['prev_count'] and top['delta']:
            direction = '늘었어요' if top['delta'] > 0 else '줄었어요'
            sentences.append(f'지난주보다 {abs(top["delta"])}번 {direction}.')

    link = stats['sleep_link']
    if link and link['difference'] > 0:
        sentences.append(
            f'잠을 설친 날에는 증상이 하루 평균 {link["symptoms_after_poor_sleep"]}건으로, '
            f'잘 주무신 날({link["symptoms_after_good_sleep"]}건)보다 잦았어요.'
        )

    sentences.append(
        f'{stats["days_recorded"]}일 기록하셨어요. 이렇게 쌓인 기록이 나중에 병원에서 이야기할 때 도움이 됩니다.'
        if stats['goal_met']
        else f'이번 주는 {stats["days_recorded"]}일 기록하셨어요. 조금씩이라도 이어가 보면 패턴이 더 잘 보입니다.'
    )
    return ' '.join(sentences)
