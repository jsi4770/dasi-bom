import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmCard } from '@/components/warm/warm-card';
import { WarmScreen } from '@/components/warm/warm-screen';
import { Warm } from '@/constants/theme';
import { ApiError, getMindfulnessSessions, MindfulnessSession } from '@/lib/api';

export default function CareScreen() {
  const [sessions, setSessions] = useState<MindfulnessSession[] | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    getMindfulnessSessions()
      .then(setSessions)
      .catch((error) => {
        setErrorText(error instanceof ApiError ? error.message : '목록을 불러오지 못했어요.');
      });
  }, []);

  function openSession(session: MindfulnessSession) {
    router.push({ pathname: '/mindfulness-session', params: { session: JSON.stringify(session) } });
  }

  return (
    <WarmScreen>
      <View style={styles.titleBlock}>
        <ThemedText style={styles.title}>명상·스트레칭</ThemedText>
        <ThemedText style={styles.subtitle}>몸이 편안해지는 3분, 지금 시작해볼까요?</ThemedText>
      </View>

      {errorText && (
        <ThemedText type="small" style={styles.errorText}>
          {errorText}
        </ThemedText>
      )}

      {sessions === null && !errorText && <ActivityIndicator color={Warm.primary} style={styles.loading} />}

      {sessions?.map((session) => (
        <Pressable
          key={session.id}
          onPress={() => openSession(session)}
          accessibilityRole="button"
          style={({ pressed }) => [pressed && styles.pressed]}>
          <WarmCard>
            <View style={styles.sessionRow}>
              <View style={styles.sessionText}>
                <ThemedText style={styles.sessionTitle}>{session.title}</ThemedText>
                <ThemedText type="default" themeColor="textSecondary">
                  {session.description}
                </ThemedText>
              </View>
              <View style={styles.durationBadge}>
                <ThemedText style={styles.durationText}>{Math.round(session.total_seconds / 60)}분</ThemedText>
              </View>
            </View>
          </WarmCard>
        </Pressable>
      ))}
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  titleBlock: {
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Warm.textDeep,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: Warm.text,
  },
  loading: {
    marginTop: 24,
  },
  errorText: {
    color: Warm.secondaryStrong,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sessionText: {
    flex: 1,
    gap: 4,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Warm.textDeep,
  },
  durationBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Warm.primarySoft,
  },
  durationText: {
    fontSize: 15,
    fontWeight: '700',
    color: Warm.primaryStrong,
  },
});
