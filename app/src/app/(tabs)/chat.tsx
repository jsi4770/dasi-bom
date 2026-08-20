import { File } from 'expo-file-system';
import { Image } from 'expo-image';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WarmButton } from '@/components/warm/warm-button';
import { BottomTabInset, SeverityColors, Spacing, Warm } from '@/constants/theme';
import {
  ApiError,
  ChatMessage,
  createChatSession,
  fetchMessageSpeechFile,
  sendAudioMessage,
  sendTextMessage,
} from '@/lib/api';

// 시안 "다시봄 리뉴얼 챗봇.dc.html" 기준 — 마스코트 "봄이" 프로필을 붙인 메신저형 UI.
// listen.png(듣는 포즈, 클로즈업)는 원형 아바타용, profile.png(전신)는 인사 화면의 큰 아바타용으로 쓴다.
const MASCOT_IMAGES = {
  listen: require('@/assets/images/chat/listen.png'),
  profile: require('@/assets/images/chat/profile.png'),
} as const;

const QUICK_QUESTIONS = ['얼굴이 화끈거려요', '잠을 잘 못 자요', '기분이 자주 가라앉아요'];

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

function formatMessageTime(isoString: string) {
  return new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true }).format(
    new Date(isoString)
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
  // 재생은 여전히 사용자가 버튼을 눌러야만 시작된다(자동재생 아님). 진행 중인 요청까지 Promise로
  // 캐싱해서, 미리 받기가 끝나기 전에 버튼을 눌러도 같은 요청을 공유하고 중복 호출하지 않는다.
  const speechCacheRef = useRef<Map<number, Promise<string>>>(new Map());

  const insets = useSafeAreaInsets();
  // 안드로이드는 SafeAreaView의 bottom edge 패딩만으로는 제스처 내비게이션 바 영역을
  // 완전히 피하지 못해 입력창(마이크·텍스트·전송)이 일부 가려지는 경우가 있어, 입력 영역에
  // insets.bottom만큼 추가 여백을 더해준다. iOS/웹은 기존 레이아웃 그대로 둔다.
  const inputAreaPlatformStyle = Platform.select({ android: { paddingBottom: insets.bottom } });

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

  /** 메시지의 TTS 파일을 가져온다. 이미 요청이 진행 중이거나 끝난 게 있으면 그걸 그대로
   * 공유해서, 미리 받기와 버튼 클릭이 겹쳐도 같은 메시지에 대해 Gemini를 두 번 호출하지 않는다.
   * 실패하면 캐시에서 지워서 다음 시도가 새로 요청하게 한다. */
  function getSpeechFile(messageId: number): Promise<string> {
    let promise = speechCacheRef.current.get(messageId);
    if (!promise) {
      promise = fetchMessageSpeechFile(messageId);
      speechCacheRef.current.set(messageId, promise);
      promise.catch(() => {
        speechCacheRef.current.delete(messageId);
      });
    }
    return promise;
  }

  function prefetchSpeech(messageId: number) {
    getSpeechFile(messageId).catch(() => {
      // 미리 받기 실패는 조용히 넘어간다 — 사용자가 버튼을 누르면 그때 다시 시도된다.
    });
  }

  function describeError(error: unknown, fallback: string) {
    return error instanceof ApiError ? error.message : fallback;
  }

  async function sendText(text: string) {
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

  function handleSendText() {
    sendText(input.trim());
  }

  function handleQuickQuestion(question: string) {
    sendText(question);
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

  /** 녹음을 전송하지 않고 그대로 버린다 — handleMicPress의 정지+전송 경로와 달리 recorder.stop()만
   * 호출하고 sendAudioMessage를 부르지 않는다. */
  async function handleCancelRecording() {
    try {
      await recorder.stop();
    } catch {
      // 취소 중 정지 실패는 무시 — 어차피 보내지 않을 녹음이라 사용자에게 에러를 보여줄 필요가 없다.
    }
  }

  async function handlePlaySpeech(message: ChatMessage) {
    if (isSpeaking === message.id) {
      player.pause();
      return;
    }

    setLoadingSpeechId(message.id);
    setErrorText(null);
    try {
      const fileUri = await getSpeechFile(message.id);
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
          <View style={styles.headerAvatar}>
            <Image source={MASCOT_IMAGES.listen} style={styles.headerAvatarImage} contentFit="cover" />
          </View>
          <View style={styles.headerTextCol}>
            <ThemedText style={styles.headerTitle}>봄이</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {isSending ? '지금 답을 준비하고 있어요' : '언제든 이야기 들어드려요'}
            </ThemedText>
          </View>
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
            <View style={styles.emptyState}>
              <Image source={MASCOT_IMAGES.profile} style={styles.emptyAvatarImage} contentFit="contain" />
              <ThemedText style={styles.emptyTitle}>봄이가 기다리고 있었어요</ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptySubtitle}>
                {'오늘 몸과 마음은 어떠셨나요.\n편한 말로 이야기해 주세요.'}
              </ThemedText>
              <View style={styles.quickQuestionRow}>
                {QUICK_QUESTIONS.map((question) => (
                  <TouchableOpacity
                    key={question}
                    style={styles.quickQuestionChip}
                    disabled={isSending || !sessionId}
                    onPress={() => handleQuickQuestion(question)}>
                    <ThemedText style={styles.quickQuestionText}>{question}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          ListFooterComponent={
            isSending ? (
              <TypingIndicator />
            ) : messages.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
                이 대화는 건강 참고 정보이며 의료 진단이 아닙니다. 증상이 지속되면 전문의 상담을 권해요.
              </ThemedText>
            ) : null
          }
        />

        {errorText && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
            {errorText}
          </ThemedText>
        )}

        <KeyboardAvoidingView
          style={inputAreaPlatformStyle}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Spacing.four}>
          {recorderState.isRecording ? (
            <RecordingCard onFinish={handleMicPress} onCancel={handleCancelRecording} />
          ) : (
            <View style={styles.inputRow}>
              <TouchableOpacity
                accessibilityLabel="음성으로 말하기"
                style={[styles.micButton, (isSending || !sessionId) && styles.micButtonDisabled]}
                onPress={handleMicPress}
                disabled={isSending || !sessionId}>
                <SymbolView
                  name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
                  size={20}
                  tintColor="#ffffff"
                />
              </TouchableOpacity>

              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="메시지를 입력해주세요"
                placeholderTextColor={Warm.textTertiary}
                style={[styles.input, isSending && styles.inputDisabled]}
                editable={!isSending}
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
          )}
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

  if (!isAssistant) {
    return (
      <View style={[styles.bubbleRow, styles.bubbleRowRight]}>
        <View style={styles.bubbleTimeCol}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.bubbleTime}>
            {formatMessageTime(message.created_at)}
          </ThemedText>
          <View style={[styles.bubble, styles.bubbleUser]}>
            <ThemedText style={styles.bubbleUserText}>{message.text}</ThemedText>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, styles.bubbleRowLeft]}>
      <View style={styles.messageAvatar}>
        <Image source={MASCOT_IMAGES.listen} style={styles.messageAvatarImage} contentFit="cover" />
      </View>
      <View style={styles.bubbleAssistantCol}>
        <ThemedText type="small" themeColor="textSecondary">
          봄이
        </ThemedText>
        <View style={styles.bubbleTimeCol}>
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            <ThemedText style={styles.bubbleAssistantText}>{message.text}</ThemedText>
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
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.bubbleTime}>
            {formatMessageTime(message.created_at)}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowLeft, styles.typingRow]}>
      <View style={styles.messageAvatar}>
        <Image source={MASCOT_IMAGES.listen} style={styles.messageAvatarImage} contentFit="cover" />
      </View>
      <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
        <View style={styles.typingDot} />
        <View style={[styles.typingDot, styles.typingDotMid]} />
        <View style={[styles.typingDot, styles.typingDotFaint]} />
      </View>
    </View>
  );
}

function RecordingCard({ onFinish, onCancel }: { onFinish: () => void; onCancel: () => void }) {
  return (
    <View style={styles.recordingCard}>
      <View style={styles.recordingAvatar}>
        <Image source={MASCOT_IMAGES.listen} style={styles.recordingAvatarImage} contentFit="cover" />
      </View>
      <ThemedText style={styles.recordingTitle}>듣고 있어요</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.recordingSubtitle}>
        천천히 말씀하셔도 괜찮아요.
      </ThemedText>
      <View style={styles.waveformRow}>
        {WAVEFORM_HEIGHTS.map((height, index) => (
          <View key={index} style={[styles.waveformBar, { height }]} />
        ))}
      </View>
      <View style={styles.recordingButtons}>
        <WarmButton label="말하기 완료" onPress={onFinish} />
        <WarmButton label="취소" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

const WAVEFORM_HEIGHTS = [14, 30, 44, 24, 38, 18, 28];

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: Warm.card,
    borderWidth: 1.5,
    borderColor: 'rgba(131, 153, 88, 0.45)',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  headerTextCol: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Warm.textDeep,
  },
  messageList: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.three,
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.four,
  },
  emptyAvatarImage: {
    width: 132,
    height: 132,
    marginBottom: Spacing.one,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Warm.textDeep,
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
  },
  quickQuestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  quickQuestionChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    backgroundColor: Warm.backgroundSubtle,
    borderWidth: 1,
    borderColor: Warm.border,
  },
  quickQuestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Warm.textDeep,
  },
  bubbleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bubbleRowLeft: {
    justifyContent: 'flex-start',
  },
  bubbleRowRight: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Warm.card,
    borderWidth: 1.5,
    borderColor: 'rgba(131, 153, 88, 0.45)',
    flexShrink: 0,
    marginTop: 18,
  },
  messageAvatarImage: {
    width: '100%',
    height: '100%',
  },
  bubbleAssistantCol: {
    gap: 5,
    maxWidth: '82%',
  },
  bubbleTimeCol: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  bubbleTime: {
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '100%',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  bubbleAssistant: {
    backgroundColor: Warm.card,
    borderBottomLeftRadius: Spacing.one,
    borderWidth: 1,
    borderColor: Warm.border,
  },
  bubbleAssistantText: {
    color: Warm.text,
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
    marginTop: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Warm.border,
  },
  typingRow: {
    marginTop: -Spacing.one,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: Spacing.three,
    marginTop: 18,
  },
  typingDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(15, 61, 44, 0.5)',
  },
  typingDotMid: {
    backgroundColor: 'rgba(15, 61, 44, 0.32)',
  },
  typingDotFaint: {
    backgroundColor: 'rgba(15, 61, 44, 0.18)',
  },
  disclaimer: {
    textAlign: 'center',
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.two,
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
  recordingCard: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    padding: Spacing.four,
    borderRadius: 26,
    backgroundColor: Warm.card,
    borderWidth: 1,
    borderColor: Warm.border,
    alignItems: 'center',
    shadowColor: '#2E2A24',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 4,
    gap: Spacing.one,
  },
  recordingAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    backgroundColor: Warm.backgroundSubtle,
    borderWidth: 2,
    borderColor: 'rgba(131, 153, 88, 0.4)',
    marginBottom: Spacing.two,
  },
  recordingAvatarImage: {
    width: '100%',
    height: '100%',
  },
  recordingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  recordingSubtitle: {
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: 44,
    marginBottom: Spacing.three,
  },
  waveformBar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: Warm.accentSoft,
  },
  recordingButtons: {
    width: '100%',
    gap: Spacing.two,
  },
  webTabBarSpacer: {
    height: BottomTabInset,
  },
});
