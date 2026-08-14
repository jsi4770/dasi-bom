import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Warm } from '@/constants/theme';

export type WarmButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  style?: StyleProp<ViewStyle>;
  /** 시안(로그인/회원가입)의 "회원가입 없이 둘러보기" 버튼처럼 오른쪽에 화살표를 붙인다. */
  trailingIcon?: boolean;
};

export function WarmButton({ label, onPress, variant = 'primary', style, trailingIcon }: WarmButtonProps) {
  const iconColor = variant === 'primary' ? '#ffffff' : Warm.primaryStrong;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'text' && styles.text,
        pressed && styles.pressed,
        style,
      ]}>
      <View style={styles.labelRow}>
        <ThemedText
          style={[
            variant === 'primary' && styles.primaryLabel,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'text' && styles.textLabel,
          ]}>
          {label}
        </ThemedText>
        {trailingIcon && (
          <SymbolView
            name={{ ios: 'chevron.right', android: 'arrow_forward', web: 'arrow_forward' }}
            size={14}
            tintColor={iconColor}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  pressed: {
    opacity: 0.85,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primary: {
    height: 60,
    backgroundColor: Warm.primary,
    shadowColor: Warm.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 3,
  },
  primaryLabel: {
    // 흰 텍스트 on 딥그린(#0F3D2C)은 12.2:1 — 대비는 여유롭지만 시니어 가독성을 위해 크게 유지.
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '700',
  },
  secondary: {
    height: 56,
    backgroundColor: Warm.card,
    borderWidth: 1.5,
    borderColor: Warm.border,
  },
  secondaryLabel: {
    color: Warm.text,
    fontSize: 17,
    fontWeight: '600',
  },
  text: {
    height: 'auto',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  textLabel: {
    // 카드 위뿐 아니라 화면 배경 위에 바로 놓이는 경우도 있어 textSecondary(카드 전용,
    // 배경 위 4.1:1)가 아닌 text(캐롭, 배경 위 4.8:1)로 어디서든 AA를 보장한다.
    color: Warm.text,
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
