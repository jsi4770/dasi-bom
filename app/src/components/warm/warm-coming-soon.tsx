import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmScreen } from '@/components/warm/warm-screen';
import { Warm } from '@/constants/theme';

export type WarmComingSoonProps = {
  emoji: string;
  title: string;
  description: string;
};

/** 이번 디자인 파일(완경기 웰니스 코칭.dc.html) 범위 밖이라 아직 내용이 없는 탭의 자리표시자.
 * emoji prop은 그림 이모지 대신 짧은 글자(예: 화면 제목 첫 글자)를 받아 텍스트 배지로 보여준다. */
export function WarmComingSoon({ emoji, title, description }: WarmComingSoonProps) {
  return (
    <WarmScreen scrollable={false}>
      <View style={styles.center}>
        <View style={styles.emojiBadge}>
          <ThemedText style={styles.emoji}>{emoji}</ThemedText>
        </View>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText style={styles.description}>{description}</ThemedText>
        <View style={styles.badge}>
          <ThemedText style={styles.badgeText}>준비 중이에요</ThemedText>
        </View>
      </View>
    </WarmScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  emojiBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Warm.primarySoft,
    marginBottom: 4,
  },
  emoji: {
    fontSize: 24,
    fontWeight: '800',
    color: Warm.primaryStrong,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Warm.text,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: Warm.textSecondary,
  },
  badge: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Warm.primarySoft,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Warm.primaryStrong,
  },
});
