import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Warm } from '@/constants/theme';

export type WarmCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function WarmCard({ children, style }: WarmCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: Warm.card,
    borderWidth: 1,
    borderColor: Warm.border,
  },
});
