import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { SeverityColors, Warm } from '@/constants/theme';

export type WarmTextInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** true면 오른쪽에 "표시/숨김" 토글이 붙는다. */
  secureTextEntry?: boolean;
  helperText?: string;
  error?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
};

export function WarmTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  helperText,
  error,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
}: WarmTextInputProps) {
  const [reveal, setReveal] = useState(false);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.field}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Warm.textTertiary}
          secureTextEntry={secureTextEntry && !reveal}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          style={styles.input}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setReveal((prev) => !prev)} hitSlop={8}>
            <ThemedText style={styles.reveal}>{reveal ? '숨김' : '표시'}</ThemedText>
          </Pressable>
        )}
      </View>
      {error ? (
        <ThemedText style={styles.error}>{error}</ThemedText>
      ) : helperText ? (
        <ThemedText style={styles.helper}>{helperText}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 7,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Warm.textDeep,
    paddingLeft: 4,
  },
  field: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: Warm.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: Warm.text,
    paddingVertical: 16,
    // react-native-web TextInput 기본 포커스 링이 둥근 필드 모서리를 사각형으로 덮어써서 제거.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  reveal: {
    fontSize: 14,
    fontWeight: '600',
    color: Warm.primaryStrong,
    opacity: 0.75,
  },
  helper: {
    fontSize: 13,
    lineHeight: 19,
    color: Warm.text,
    opacity: 0.55,
    paddingLeft: 4,
  },
  error: {
    fontSize: 13,
    lineHeight: 19,
    color: SeverityColors.severe.fill,
    paddingLeft: 4,
  },
});
