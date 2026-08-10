import { File } from 'expo-file-system';
import { router } from 'expo-router';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  ChatbotApiError,
  ChatMessage,
  createChatSession,
  fetchMessageSpeechFile,
  sendAudioMessage,
  sendTextMessage,
} from '@/lib/api';

// expo-audio 의 RecordingPresets.HIGH_QUALITY 는 iOS/Android 모두 m4a(AAC) 컨테이너로 녹음한다.
const RECORDING_MIME_TYPE = 'audio/mp4';

export default function ChatScreen() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);
  const [loadingSpeechId, setLoadingSpeechId] = useState<number | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

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
  }

  function describeError(error: unknown, fallback: string) {
    return error instanceof ChatbotApiError ? error.message : fallback;
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
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        return;
      }
      setIsSending(true);
      setErrorText(null);
      try {
        const base64 = await new File(uri).base64();
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
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function handlePlaySpeech(message: ChatMessage) {
    if (isSpeaking === message.id) {
      player.pause();
      return;
    }
    setLoadingSpeechId(message.id);
    setErrorText(null);
    try {
      const fileUri = await fetchMessageSpeechFile(message.id);
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
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="default">닫기</ThemedText>
          </TouchableOpacity>
          <ThemedText type="subtitle" style={styles.headerTitle}>
            챗봇과 대화하기
          </ThemedText>
          <View style={styles.headerSpacer} />
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
              style={[styles.micButton, recorderState.isRecording && styles.micButtonActive]}
              onPress={handleMicPress}
              disabled={isSending || !sessionId}>
              <ThemedText type="default" style={styles.micButtonText}>
                {recorderState.isRecording ? '■' : '🎤'}
              </ThemedText>
            </TouchableOpacity>

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="메시지를 입력해주세요"
              placeholderTextColor="#8E8E93"
              style={styles.input}
              editable={!isSending && !recorderState.isRecording}
              onSubmitEditing={handleSendText}
              returnKeyType="send"
            />

            <TouchableOpacity
              accessibilityLabel="메시지 전송"
              style={styles.sendButton}
              onPress={handleSendText}
              disabled={isSending || !input.trim() || !sessionId}>
              <ThemedText type="default" style={styles.sendButtonText}>
                전송
              </ThemedText>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
            <ThemedText type="small" themeColor="textSecondary">
              {isLoadingSpeech ? '음성 준비 중…' : isSpeaking ? '⏸ 재생 중지' : '🔊 음성으로 듣기'}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 32,
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
    maxWidth: '80%',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  bubbleAssistant: {
    backgroundColor: '#F0F0F3',
    borderBottomLeftRadius: Spacing.half,
  },
  bubbleUser: {
    backgroundColor: '#208AEF',
    borderBottomRightRadius: Spacing.half,
  },
  bubbleUserText: {
    color: '#ffffff',
  },
  speechButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.half,
  },
  errorText: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
    color: '#D64545',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: '#D64545',
  },
  micButtonText: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    backgroundColor: '#F0F0F3',
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
