"""Gemini API 연동. 대화 생성 / 음성 전사 / TTS 합성을 감싼다.

무료 티어를 쓰므로 요청이 몰리면 429가 날 수 있다 — 호출부(views.py)는
GeminiRateLimitError 를 잡아서 사용자에게 "잠시 후 다시 시도" 안내로 바꿔야 한다.
"""
import io
import wave

from django.conf import settings
from google import genai
from google.genai import errors, types

SYSTEM_INSTRUCTION = (
    '너는 "다시 봄" 앱의 생활 정보 길잡이 챗봇이야. 완경(폐경)에 접어든 50대 여성 사용자와 '
    '대화해. 처음에는 정서적 위안과 공감을 우선하고, 사용자가 편해지면 병원 과·영양제 등 '
    '실용 정보로 자연스럽게 넓혀가. 짧고 따뜻한 존댓말로, 한 번에 2~4문장 정도로 답해.'
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
            raise GeminiRateLimitError('Gemini 무료 티어 요청 한도를 초과했습니다.') from exc
        raise GeminiError(str(exc)) from exc
    except errors.APIError as exc:
        raise GeminiError(str(exc)) from exc
    except Exception as exc:
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
