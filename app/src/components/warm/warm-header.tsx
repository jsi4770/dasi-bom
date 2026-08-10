import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Warm } from '@/constants/theme';

export type WarmHeaderProps = {
  title: string;
  onBack?: () => void;
};

export function WarmHeader({ title, onBack }: WarmHeaderProps) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityLabel="뒤로가기" style={styles.backButton}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={20}
            tintColor={Warm.primaryStrong}
          />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
      <ThemedText style={styles.title}>{title}</ThemedText>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Warm.border,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Warm.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 44,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '700',
    color: Warm.text,
  },
});
