import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmScreen } from '@/components/warm/warm-screen';
import { blobDecorationStyle, SeverityColors, Warm } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function AuthStartScreen() {
  const { demoLogin } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

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
    <WarmScreen backgroundColor={Warm.card} scrollable={false}>
      <View style={styles.blobTopLeft} />
      <View style={styles.blobBottomRight} />

      <View style={styles.content}>
        <View style={styles.heroBlock}>
          <ThemedText style={styles.eyebrow}>DASI · BOM</ThemedText>
          <ThemedText style={styles.title}>{'오늘의 나를\n다시 봄'}</ThemedText>
          <ThemedText style={styles.subtitle}>
            {'완경기의 하루하루를 기록하고\n내 몸의 리듬을 함께 살펴봐요.'}
          </ThemedText>
        </View>

        <View style={styles.actions}>
          <View style={styles.demoBlock}>
            <WarmButton
              label="회원가입 없이 둘러보기"
              trailingIcon
              onPress={handleDemoLogin}
              style={isSubmitting ? styles.buttonDisabled : undefined}
            />
            <ThemedText style={styles.demoCaption}>
              {isSubmitting ? '연결하는 중이에요…' : '데모 계정으로 모든 기능을 바로 체험할 수 있어요'}
            </ThemedText>
            {errorText && <ThemedText style={styles.error}>{errorText}</ThemedText>}
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <ThemedText style={styles.dividerLabel}>또는</ThemedText>
            <View style={styles.dividerLine} />
          </View>

          <WarmButton
            label="이메일로 로그인"
            variant="secondary"
            style={styles.outlineButton}
            onPress={() => router.push('/auth/login')}
          />

          <View style={styles.linkRow}>
            <ThemedText style={styles.linkPrompt}>처음이신가요?</ThemedText>
            <ThemedText style={styles.link} onPress={() => router.push('/auth/signup')}>
              새로 시작하기
            </ThemedText>
          </View>
        </View>
      </View>
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  blobTopLeft: {
    position: 'absolute',
    left: -70,
    top: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    ...blobDecorationStyle(Warm.accentSoft),
  },
  blobBottomRight: {
    position: 'absolute',
    right: -90,
    top: 210,
    width: 280,
    height: 280,
    borderRadius: 140,
    ...blobDecorationStyle(Warm.secondarySoftBorder),
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingBottom: 12,
  },
  heroBlock: {
    gap: 14,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: Warm.accentSoft,
    letterSpacing: 2,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 44,
    color: Warm.textDeep,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 27,
    color: Warm.text,
    opacity: 0.72,
  },
  actions: {
    gap: 16,
  },
  demoBlock: {
    gap: 9,
    alignItems: 'center',
  },
  demoCaption: {
    fontSize: 13,
    fontWeight: '500',
    color: Warm.text,
    opacity: 0.6,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  error: {
    fontSize: 13,
    lineHeight: 19,
    color: SeverityColors.severe.fill,
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Warm.border,
  },
  dividerLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Warm.text,
    opacity: 0.5,
  },
  outlineButton: {
    borderColor: 'rgba(15, 61, 44, 0.3)',
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
