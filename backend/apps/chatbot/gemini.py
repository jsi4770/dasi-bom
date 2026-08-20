"""Gemini API 연동. 대화 생성 / 음성 전사 / TTS 합성을 감싼다.

무료 티어를 쓰므로 요청이 몰리면 429가 날 수 있다 — 호출부(views.py)는
GeminiRateLimitError 를 잡아서 사용자에게 "잠시 후 다시 시도" 안내로 바꿔야 한다.
"""
import io
import logging
import wave

from django.conf import settings
from google import genai
from google.genai import errors, types

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = (
    '너는 "다시 봄" 앱의 마스코트 "봄이"야. 사용자의 건강을 진단하는 존재가 아니라, 몸과 '
    '마음의 기록을 함께 살펴보는 웰니스 동반자로서 대화해. 따뜻하고 차분한 존댓말을 써.\n\n'
    '<대화 원칙>\n'
    '- 먼저 공감하고, 그다음에 필요한 정보를 줘.\n'
    '- 사용자의 감정을 단정하거나 과장하지 마. "얼마나 힘드셨을지 알아요", "그 마음 다 '
    '이해해요"처럼 다 안다고 단정하는 말투 대신, "밤에 잠이 안 오면 정말 지치죠"처럼 그 '
    '상황 자체에 공감하는 말투를 써.\n'
    '- 의료적 진단이나 처방은 하지 마.\n'
    '- 건강 정보는 식습관·수면·가벼운 운동 같은 일반적인 생활 습관 수준에서만 제안해.\n'
    '- 병원·전문가 상담 권유는 매 답변에 습관적으로 붙이지 마. 사용자가 상담을 이미 '
    '고민하고 있다고 말했거나, 증상이 심하거나 오래 지속돼서 전문가 판단이 필요해 보일 '
    '때만 자연스럽게 언급해. 그 외에는 생활 습관 제안과 공감으로 답을 마무리해. 특히 '
    '사용자가 "병원 가야 하나 고민이에요"처럼 상담을 이미 고려하고 있다고 말하면, 생활 '
    '습관 얘기로 넘기지 말고 그 고민을 받아주면서 상담을 권유해.\n'
    '- 답변은 2~5문장 안에서, 가능하면 2~3문장으로 짧게 끝내. 공감 한 문장, 생활 습관 '
    '제안 한 문장 정도면 충분해. 되묻는 질문이나 문단을 나눠 덧붙이는 말은 넣지 말고, '
    '꼭 필요할 때만 5문장까지 늘려. 음성으로도 들려주는 답변이라 짧을수록 좋아.\n'
    '- 사용자를 판단하거나 훈계하지 마.\n'
    '- "봄이가 도와드릴게요" 같은 표현은 가끔만 쓰고, 과도한 캐릭터 말투는 피해.'
)

# gemini-2.5-flash-preview-tts 가 돌려주는 raw PCM 오디오 스펙.
_TTS_SAMPLE_RATE = 24000
_TTS_SAMPLE_WIDTH = 2  # 16bit
_TTS_CHANNELS = 1


class GeminiError(Exception):
    """Gemini 호출 실패 (일시적 오류 포함)."""


class GeminiRateLimitError(GeminiError):
    """무료 티어 요청 한도(429) 초과."""


def _generate_content(**kwargs):
    """genai.Client 생성부터 generate_content 호출까지 한 곳에서 감싼다.

    클라이언트 생성(예: API 키 누락)과 호출(예: 429) 양쪽에서 나는 에러를 전부
    GeminiError 계열로 통일해서 views.py 가 한 가지 방식으로만 처리하면 되게 한다.
    """
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return client.models.generate_content(**kwargs)
    except errors.ClientError as exc:
        if getattr(exc, 'code', None) == 429:
            logger.warning('Gemini rate limited: %s', exc)
            raise GeminiRateLimitError('Gemini 무료 티어 요청 한도를 초과했습니다.') from exc
        logger.error('Gemini call failed (model=%s): %s', kwargs.get('model'), exc)
        raise GeminiError(str(exc)) from exc
    except errors.APIError as exc:
        logger.error('Gemini call failed (model=%s): %s', kwargs.get('model'), exc)
        raise GeminiError(str(exc)) from exc
    except Exception as exc:
        logger.exception('Unexpected error calling Gemini (model=%s)', kwargs.get('model'))
        raise GeminiError(str(exc)) from exc


def generate_reply(history, user_text):
    """history: ChatMessage 이터러블(과거 대화, 이번 사용자 메시지 제외). 챗봇 답변 텍스트를 반환한다."""
    contents = [
        types.Content(
            role='model' if m.role == 'assistant' else 'user',
            parts=[types.Part.from_text(text=m.text)],
        )
        for m in history
    ]
    contents.append(types.Content(role='user', parts=[types.Part.from_text(text=user_text)]))

    response = _generate_content(
        model=settings.GEMINI_CHAT_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=SYSTEM_INSTRUCTION),
    )
    return response.text.strip()


def transcribe_audio(audio_bytes, mime_type):
    """녹음된 사용자 음성을 한국어 텍스트로 전사한다."""
    response = _generate_content(
        model=settings.GEMINI_CHAT_MODEL,
        contents=[
            '아래 음성에서 들리는 말을 있는 그대로 한국어 텍스트로만 옮겨줘. 설명이나 부가 문장은 붙이지 마.',
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
        ],
    )
    return response.text.strip()


def synthesize_speech(text):
    """텍스트를 음성으로 합성해 WAV 바이트를 반환한다."""
    response = _generate_content(
        model=settings.GEMINI_TTS_MODEL,
        contents=text,
        config=types.GenerateContentConfig(
            response_modalities=['AUDIO'],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=settings.GEMINI_TTS_VOICE
                    )
                )
            ),
        ),
    )
    pcm = response.candidates[0].content.parts[0].inline_data.data
    return _pcm_to_wav(pcm)


def _pcm_to_wav(pcm_bytes):
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wf:
        wf.setnchannels(_TTS_CHANNELS)
        wf.setsampwidth(_TTS_SAMPLE_WIDTH)
        wf.setframerate(_TTS_SAMPLE_RATE)
        wf.writeframes(pcm_bytes)
    return buffer.getvalue()
