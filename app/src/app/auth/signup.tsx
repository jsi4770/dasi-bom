import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmScreen } from '@/components/warm/warm-screen';
import { WarmTextInput } from '@/components/warm/warm-text-input';
import { blobDecorationStyle, SeverityColors, Warm } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { enablePushNotifications, isPushSupported } from '@/lib/push';

function ConsentCheckbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked ? styles.checkboxChecked : styles.checkboxEmpty]}>
      {checked && (
        <SymbolView
          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
          size={13}
          tintColor="#ffffff"
        />
      )}
    </View>
  );
}

export default function SignupScreen() {
  const { signup, demoLogin } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreeRequired, setAgreeRequired] = useState(false);
  const [agreeOptional, setAgreeOptional] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const agreeAll = agreeRequired && agreeOptional;
  const canSubmit = name.trim().length > 0 && password.length > 0 && agreeRequired && !isSubmitting;

  function toggleAll() {
    const next = !agreeAll;
    setAgreeRequired(next);
    setAgreeOptional(next);
  }

  async function handleSignup() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      await signup({
        username: name.trim(),
        password,
        email: email.trim() ? email.trim() : undefined,
      });
      // 알림 받기 동의한 경우에만 권한 요청
      // await 없이 fire-and-forget — 가입/온보딩 흐름을 절대 막지 않음
      // 거부/차단/미지원/서버 오류 등 모든 실패는 조용히 무시
      if (agreeOptional && isPushSupported()) {
        enablePushNotifications().catch(() => {});
      }
    } catch (error) {
      setErrorText(
        error instanceof ApiError ? error.message : '회원가입에 실패했어요. 네트워크 상태를 확인해주세요.'
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
        <ThemedText style={styles.title}>함께 시작해요</ThemedText>
        <ThemedText style={styles.subtitle}>간단한 정보만 입력하면 됩니다.</ThemedText>
      </View>

      <View style={styles.fields}>
        <WarmTextInput
          label="어떻게 불러드릴까요?"
          value={name}
          onChangeText={setName}
          placeholder="이름 또는 별명"
          autoCapitalize="none"
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
        />
        <WarmTextInput
          label="이메일"
          value={email}
          onChangeText={setEmail}
          placeholder="soojin@dasibom.kr"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <WarmTextInput
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호를 입력해주세요"
          secureTextEntry
          helperText="영문·숫자 포함 8자 이상"
          autoComplete="password-new"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={handleSignup}
        />
      </View>

      <View style={styles.consentBlock}>
        <Pressable style={styles.consentAllRow} onPress={toggleAll}>
          <ConsentCheckbox checked={agreeAll} />
          <ThemedText style={styles.consentAllLabel}>전체 동의</ThemedText>
        </Pressable>
        <Pressable style={styles.consentRow} onPress={() => setAgreeRequired((prev) => !prev)}>
          <View style={styles.consentRowLeft}>
            <ConsentCheckbox checked={agreeRequired} />
            <ThemedText style={styles.consentLabel}>이용약관 · 개인정보 처리방침 (필수)</ThemedText>
          </View>
        </Pressable>
        <Pressable style={styles.consentRow} onPress={() => setAgreeOptional((prev) => !prev)}>
          <View style={styles.consentRowLeft}>
            <ConsentCheckbox checked={agreeOptional} />
            <ThemedText style={styles.consentLabel}>기록 알림 받기 (선택)</ThemedText>
          </View>
        </Pressable>
      </View>

      {errorText && <ThemedText style={styles.error}>{errorText}</ThemedText>}

      <View style={styles.buttons}>
        <WarmButton
          label="가입하고 시작하기"
          onPress={handleSignup}
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

      <View style={styles.spacer} />

      <View style={styles.linkRow}>
        <ThemedText style={styles.linkPrompt}>이미 계정이 있나요?</ThemedText>
        <ThemedText style={styles.link} onPress={() => router.push('/auth/login')}>
          로그인
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
    ...blobDecorationStyle(Warm.secondarySoftBorder),
  },
  titleBlock: {
    gap: 10,
    marginTop: 16,
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
  consentBlock: {
    borderTopWidth: 1,
    borderTopColor: Warm.border,
    paddingTop: 2,
  },
  consentAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  consentAllLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Warm.textDeep,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  consentRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  consentLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Warm.text,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Warm.primary,
  },
  checkboxEmpty: {
    borderWidth: 1.5,
    borderColor: Warm.border,
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
