import { File, Paths } from 'expo-file-system';

export type ChatSession = {
  id: number;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  created_at: string;
};

type SendMessageResult = {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
};

export class ChatbotApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ChatbotApiError(
      response.status,
      body?.detail ?? '요청을 처리하지 못했어요. 다시 시도해주세요.'
    );
  }
  return response.json() as Promise<T>;
}

export function createChatSession() {
  return request<ChatSession>('/api/chatbot/sessions/', { method: 'POST' });
}

export function sendTextMessage(sessionId: number, text: string) {
  const body = new URLSearchParams({ text });
  return request<SendMessageResult>(`/api/chatbot/sessions/${sessionId}/messages/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

export function sendAudioMessage(sessionId: number, audioBase64: string, mimeType: string) {
  const body = new URLSearchParams({ audio: audioBase64, audio_mime_type: mimeType });
  return request<SendMessageResult>(`/api/chatbot/sessions/${sessionId}/messages/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

/** 메시지 텍스트를 TTS로 합성해 로컬 파일로 받아온다 (재생은 expo-audio 플레이어가 파일 uri로 하는 게 안정적). */
export async function fetchMessageSpeechFile(messageId: number): Promise<string> {
  const url = `${getApiBaseUrl()}/api/chatbot/messages/${messageId}/speech/`;
  const destination = new File(Paths.cache, `chatbot-speech-${messageId}-${Date.now()}.wav`);
  try {
    const file = await File.downloadFileAsync(url, destination);
    return file.uri;
  } catch {
    throw new ChatbotApiError(502, '음성을 만드는 데 실패했어요. 다시 시도해주세요.');
  }
}
