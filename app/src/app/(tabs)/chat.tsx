import { File } from 'expo-file-system';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, SeverityColors, Spacing, Warm } from '@/constants/theme';
import {
  ApiError,
  ChatMessage,
  createChatSession,
  fetchMessageSpeechFile,
  sendAudioMessage,
  sendTextMessage,
} from '@/lib/api';

// expo-audio 의 RecordingPresets.HIGH_QUALITY 는 iOS/Android는 m4a(AAC), 웹은 webm으로 녹음한다.
const RECORDING_MIME_TYPE = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';

// 웹에서 recorder.uri는 blob: URL이라 expo-file-system(웹 미지원) 대신 fetch + FileReader로 base64 변환한다.
function blobUrlToBase64(blobUrl: string): Promise<string> {
  return fetch(blobUrl)
    .then((response) => response.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.slice(result.indexOf(',') + 1));
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
    );
}

export default function ChatScreen() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);
  const [loadingSpeechId, setLoadingSpeechId] = useState<number | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  // 챗봇 답변이 도착하는 즉시 TTS를 미리 받아서 캐싱해둔다 — "음성으로 듣기"를 누르면
  // 그때 새로 만들지 않고 이미 준비된 걸 바로 재생해서 체감 대기시간을 없앤다.
  // 재생은 여전히 사용자가 버튼을 눌러야만 시작된다(자동재생 아님).
  const speechCacheRef = useRef<Map<number, string>>(new Map());

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    createChatSession()
      .then((session) => setSessionId(session.id))
      .catch(() => setErrorText('대화를 시작하지 못했어요. 앱을 다시 열어주세요.'));
  }, []);

  const isSpeaking = playerStatus.playing ? speakingMessageId : null;

  function appendMessages(result: { user_message: ChatMessage; assistant_message: ChatMessage }) {
    setMessages((prev) => [...prev, result.user_message, result.assistant_message]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    prefetchSpeech(result.assistant_message.id);
  }

  function prefetchSpeech(messageId: number) {
    if (speechCacheRef.current.has(messageId)) {
      return;
    }
    fetchMessageSpeechFile(messageId)
      .then((uri) => {
        speechCacheRef.current.set(messageId, uri);
      })
      .catch(() => {
        // 미리 받기는 실패해도 조용히 넘어간다 — 사용자가 버튼을 누르면 그때 다시 시도된다.
      });
  }

  function describeError(error: unknown, fallback: string) {
    return error instanceof ApiError ? error.message : fallback;
  }

  async function handleSendText() {
    const text = input.trim();
    if (!text || !sessionId || isSending) {
      return;
    }
    setInput('');
    setIsSending(true);
    setErrorText(null);
    try {
      appendMessages(await sendTextMessage(sessionId, text));
    } catch (error) {
      setErrorText(describeError(error, '메시지를 보내지 못했어요.'));
    } finally {
      setIsSending(false);
    }
  }

  async function handleMicPress() {
    if (!sessionId || isSending) {
      return;
    }

    if (recorderState.isRecording) {
      setIsSending(true);
      setErrorText(null);
      try {
        // 웹에서 recorder.stop()이 내부적으로 MediaRecorder의 dataavailable 이벤트를 기다리는데,
        // 브라우저/타이밍에 따라 그 이벤트가 끝내 안 오는 경우가 있어 화면이 영원히 멈출 수 있다.
        // 안전장치로 타임아웃을 걸어 그런 경우에도 에러로 빠져나오게 한다.
        await Promise.race([
          recorder.stop(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('recorder.stop() timed out')), 6000)
          ),
        ]);
        const uri = recorder.uri;
        if (!uri) {
          throw new Error('recording produced no audio file');
        }
        const base64 =
          Platform.OS === 'web' ? await blobUrlToBase64(uri) : await new File(uri).base64();
        appendMessages(await sendAudioMessage(sessionId, base64, RECORDING_MIME_TYPE));
      } catch (error) {
        setErrorText(describeError(error, '음성 메시지를 보내지 못했어요.'));
      } finally {
        setIsSending(false);
      }
      return;
    }

    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setErrorText('마이크 권한이 필요해요.');
      return;
    }
    setErrorText(null);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function handlePlaySpeech(message: ChatMessage) {
    if (isSpeaking === message.id) {
      player.pause();
      return;
    }

    const cachedUri = speechCacheRef.current.get(message.id);
    if (cachedUri) {
      setErrorText(null);
      player.replace(cachedUri);
      player.play();
      setSpeakingMessageId(message.id);
      return;
    }

    setLoadingSpeechId(message.id);
    setErrorText(null);
    try {
      const fileUri = await fetchMessageSpeechFile(message.id);
      speechCacheRef.current.set(message.id, fileUri);
      player.replace(fileUri);
      player.play();
      setSpeakingMessageId(message.id);
    } catch (error) {
      setErrorText(describeError(error, '음성을 재생하지 못했어요.'));
    } finally {
      setLoadingSpeechId(null);
    }
  }

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <ThemedText type="subtitle" style={styles.headerTitle}>
            챗봇과 대화하기
          </ThemedText>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isSpeaking={isSpeaking === item.id}
              isLoadingSpeech={loadingSpeechId === item.id}
              onPlaySpeech={() => handlePlaySpeech(item)}
            />
          )}
          ListEmptyComponent={
            <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
              오늘 하루 어떠셨어요? 편하게 말을 걸어보세요.
            </ThemedText>
          }
        />

        {errorText && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
            {errorText}
          </ThemedText>
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Spacing.four}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              accessibilityLabel={recorderState.isRecording ? '녹음 중지 및 전송' : '음성으로 말하기'}
              style={[
                styles.micButton,
                recorderState.isRecording && styles.micButtonActive,
                (isSending || !sessionId) && styles.micButtonDisabled,
              ]}
              onPress={handleMicPress}
              disabled={isSending || !sessionId}>
              {recorderState.isRecording ? (
                <SymbolView
                  name={{ ios: 'stop.fill', android: 'stop', web: 'stop' }}
                  size={20}
                  tintColor="#ffffff"
                />
              ) : (
                <SymbolView
                  name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
                  size={20}
                  tintColor="#ffffff"
                />
              )}
            </TouchableOpacity>

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="메시지를 입력해주세요"
              placeholderTextColor={Warm.textTertiary}
              style={[styles.input, (isSending || recorderState.isRecording) && styles.inputDisabled]}
              editable={!isSending && !recorderState.isRecording}
              onSubmitEditing={handleSendText}
              returnKeyType="send"
            />

            <TouchableOpacity
              accessibilityLabel="메시지 전송"
              style={[
                styles.sendButton,
                (isSending || !input.trim() || !sessionId) && styles.sendButtonDisabled,
              ]}
              onPress={handleSendText}
              disabled={isSending || !input.trim() || !sessionId}>
              <SymbolView
                name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }}
                size={20}
                tintColor="#ffffff"
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* 웹 하단 탭바(app-tabs.web.tsx)가 콘텐츠 위에 오버레이로 얹히는 구조라, 그 높이만큼
            KeyboardAvoidingView 바깥에 별도 여백을 둬서 입력창이 가리지 않게 한다. 네이티브는
            탭바가 네비게이터가 자체적으로 공간을 차지하는 구조라 필요 없다. */}
        {Platform.OS === 'web' && <View style={styles.webTabBarSpacer} />}
      </SafeAreaView>
    </ThemedView>
  );
}

function MessageBubble({
  message,
  isSpeaking,
  isLoadingSpeech,
  onPlaySpeech,
}: {
  message: ChatMessage;
  isSpeaking: boolean;
  isLoadingSpeech: boolean;
  onPlaySpeech: () => void;
}) {
  const isAssistant = message.role === 'assistant';

  return (
    <View style={[styles.bubbleRow, isAssistant ? styles.bubbleRowLeft : styles.bubbleRowRight]}>
      <View style={[styles.bubble, isAssistant ? styles.bubbleAssistant : styles.bubbleUser]}>
        <ThemedText type="default" style={isAssistant ? undefined : styles.bubbleUserText}>
          {message.text}
        </ThemedText>
        {isAssistant && (
          <TouchableOpacity
            accessibilityLabel="음성으로 듣기"
            style={styles.speechButton}
            onPress={onPlaySpeech}>
            {!isLoadingSpeech && (
              <SymbolView
                name={
                  isSpeaking
                    ? { ios: 'pause.fill', android: 'pause', web: 'pause' }
                    : { ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' }
                }
                size={14}
                tintColor={Warm.textSecondary}
              />
            )}
            <ThemedText type="small" themeColor="textSecondary">
              {isLoadingSpeech ? '음성 준비 중…' : isSpeaking ? '재생 중지' : '음성으로 듣기'}
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  messageList: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    flexGrow: 1,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowLeft: {
    justifyContent: 'flex-start',
  },
  bubbleRowRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  bubbleAssistant: {
    backgroundColor: Warm.backgroundSubtle,
    borderBottomLeftRadius: Spacing.one,
  },
  bubbleUser: {
    backgroundColor: Warm.secondarySoft,
    borderBottomRightRadius: Spacing.one,
  },
  bubbleUserText: {
    color: Warm.secondaryStrong,
  },
  speechButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    marginTop: Spacing.half,
  },
  errorText: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
    color: SeverityColors.severe.fill,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  micButton: {
    width: 56,
    height: 56,
    borderRadius: Spacing.three,
    backgroundColor: Warm.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: SeverityColors.severe.fill,
  },
  micButtonDisabled: {
    opacity: 0.4,
  },
  input: {
    flex: 1,
    height: 56,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    backgroundColor: Warm.card,
    fontSize: 16,
    color: Warm.text,
  },
  inputDisabled: {
    opacity: 0.4,
  },
  sendButton: {
    width: 56,
    height: 56,
    borderRadius: Spacing.three,
    backgroundColor: Warm.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  webTabBarSpacer: {
    height: BottomTabInset,
  },
});
