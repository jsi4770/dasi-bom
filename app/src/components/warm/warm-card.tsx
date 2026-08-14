import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Warm } from '@/constants/theme';

export type WarmCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * true(기본) — 기존처럼 1px 테두리가 있는 카드.
   * false — 시안(다시봄 증상기록.dc.html 등)처럼 테두리 없이 배경색만으로 구분되는 flat 카드.
   * 필요한 화면에서만 명시적으로 선택해서 쓴다.
   */
  bordered?: boolean;
};

export function WarmCard({ children, style, bordered = true }: WarmCardProps) {
  return <View style={[styles.card, bordered && styles.cardBordered, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: Warm.card,
  },
  cardBordered: {
    borderWidth: 1,
    borderColor: Warm.border,
  },
});
