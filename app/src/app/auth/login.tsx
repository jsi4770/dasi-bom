import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmScreen } from '@/components/warm/warm-screen';
import { WarmTextInput } from '@/components/warm/warm-text-input';
import { blobDecorationStyle, SeverityColors, Warm } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const { login, demoLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !isSubmitting;

  async function handleLogin() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      await login(username.trim(), password);
    } catch (error) {
      setErrorText(
        error instanceof ApiError ? error.message : '로그인에 실패했어요. 네트워크 상태를 확인해주세요.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      await demoLogin();
    } catch (error) {
      setErrorText(error instanceof ApiError ? error.message : '데모 로그인에 실패했어요. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <WarmScreen backgroundColor={Warm.card}>
      <View style={styles.blob} />

      <View style={styles.titleBlock}>
        <ThemedText style={styles.title}>다시 오셨네요</ThemedText>
        <ThemedText style={styles.subtitle}>기록은 그대로 남아 있어요.</ThemedText>
      </View>

      <View style={styles.fields}>
        <WarmTextInput
          label="아이디"
          value={username}
          onChangeText={setUsername}
          placeholder="아이디를 입력해주세요"
          autoCapitalize="none"
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
        />
        <WarmTextInput
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호를 입력해주세요"
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />
      </View>

      {errorText && <ThemedText style={styles.error}>{errorText}</ThemedText>}

      <View style={styles.buttons}>
        <WarmButton
          label="로그인"
          onPress={handleLogin}
          style={!canSubmit ? styles.buttonDisabled : undefined}
        />
        <WarmButton
          label="회원가입 없이 둘러보기"
          trailingIcon
          variant="secondary"
          style={[styles.outlineButton, isSubmitting && styles.buttonDisabled]}
          onPress={handleDemoLogin}
        />
      </View>

      <ThemedText style={styles.footnote}>
        기록한 내용은 나만 볼 수 있어요. 언제든 내보내거나 삭제할 수 있습니다.
      </ThemedText>

      <View style={styles.spacer} />

      <View style={styles.linkRow}>
        <ThemedText style={styles.linkPrompt}>처음이신가요?</ThemedText>
        <ThemedText style={styles.link} onPress={() => router.push('/auth/signup')}>
          새로 시작하기
        </ThemedText>
      </View>
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    right: -80,
    top: -70,
    width: 280,
    height: 280,
    borderRadius: 140,
    ...blobDecorationStyle(Warm.accentSoft),
  },
  titleBlock: {
    gap: 10,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Warm.textDeep,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Warm.text,
    opacity: 0.72,
  },
  fields: {
    gap: 12,
  },
  error: {
    fontSize: 13,
    lineHeight: 19,
    color: SeverityColors.severe.fill,
  },
  buttons: {
    gap: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  outlineButton: {
    borderColor: 'rgba(15, 61, 44, 0.3)',
  },
  footnote: {
    fontSize: 14,
    lineHeight: 22,
    color: Warm.text,
    opacity: 0.6,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  spacer: {
    flex: 1,
    minHeight: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 44,
  },
  linkPrompt: {
    fontSize: 15,
    fontWeight: '500',
    color: Warm.text,
    opacity: 0.65,
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
    color: Warm.textDeep,
    textDecorationLine: 'underline',
  },
});
