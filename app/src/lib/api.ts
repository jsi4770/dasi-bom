import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

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

export class ApiError extends Error {
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
    throw new ApiError(
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

export type FaceAnalysisResult = {
  id: number;
  image: string;
  redness_score: number;
  severity: 'normal' | 'mild' | 'moderate' | 'severe';
  region_scores: Record<string, number>;
  created_at: string;
  lighting_corrected: boolean;
  excluded_regions: string[];
};

/** 촬영한 사진을 얼굴 홍조 분석 API로 업로드한다.
 * 웹은 photoUri가 blob: URL이라 fetch로 Blob을 받아 붙이고,
 * 네이티브는 file:// uri를 그대로 FormData에 넘기면 RN이 알아서 처리한다. */
export async function uploadFaceAnalysis(photoUri: string): Promise<FaceAnalysisResult> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(photoUri)).blob();
    formData.append('image', blob, 'face.jpg');
  } else {
    formData.append('image', {
      uri: photoUri,
      name: 'face.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
  }
  return request<FaceAnalysisResult>('/api/face-analysis/', { method: 'POST', body: formData });
}

/** 메시지 텍스트를 TTS로 합성해 재생 가능한 uri를 반환한다.
 * 네이티브는 expo-audio 플레이어가 파일 uri로 재생하는 게 안정적이라 로컬에 다운로드하고,
 * 웹은 expo-file-system이 미지원이라 <audio> 엘리먼트가 바로 스트리밍하도록 URL을 그대로 넘긴다. */
export async function fetchMessageSpeechFile(messageId: number): Promise<string> {
  const url = `${getApiBaseUrl()}/api/chatbot/messages/${messageId}/speech/`;
  if (Platform.OS === 'web') {
    return url;
  }
  const destination = new File(Paths.cache, `chatbot-speech-${messageId}-${Date.now()}.wav`);
  try {
    const file = await File.downloadFileAsync(url, destination);
    return file.uri;
  } catch {
    throw new ApiError(502, '음성을 만드는 데 실패했어요. 다시 시도해주세요.');
  }
}
