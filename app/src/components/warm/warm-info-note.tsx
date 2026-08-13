import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Warm } from '@/constants/theme';

export type WarmInfoNoteProps = {
  icon?: string;
  title?: string;
  text: string;
};

export function WarmInfoNote({ icon = 'i', title, text }: WarmInfoNoteProps) {
  return (
    <View style={styles.container}>
      <ThemedText style={styles.icon}>{icon}</ThemedText>
      <View style={styles.body}>
        {title ? <ThemedText style={styles.title}>{title}</ThemedText> : null}
        <ThemedText style={styles.text}>{text}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Warm.backgroundSubtle,
    borderWidth: 1,
    borderColor: Warm.border,
  },
  icon: {
    fontSize: 18,
    fontWeight: '800',
    color: Warm.primaryStrong,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Warm.text,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.textSecondary,
  },
});
