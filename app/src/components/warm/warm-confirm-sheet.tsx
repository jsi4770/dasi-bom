import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WarmButton } from '@/components/warm/warm-button';
import { WarmBottomSheet } from '@/components/warm/warm-bottom-sheet';
import { Warm } from '@/constants/theme';

export type WarmConfirmSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
};

/** 제목 + 본문 + 취소/확인 두 버튼짜리 확인창. WarmBottomSheet(RN Modal 기반이라 웹에서도
 * 동작)를 그대로 감싼 것 — settings.tsx 로그아웃 확인창과 같은 구조를 재사용 가능하게 뺐다. */
export function WarmConfirmSheet({
  visible,
  onClose,
  title,
  message,
  confirmLabel,
  onConfirm,
  cancelLabel = '취소',
}: WarmConfirmSheetProps) {
  return (
    <WarmBottomSheet visible={visible} onClose={onClose} title={title}>
      <ThemedText style={styles.message}>{message}</ThemedText>
      <WarmButton label={confirmLabel} onPress={onConfirm} />
      <WarmButton label={cancelLabel} variant="secondary" onPress={onClose} />
    </WarmBottomSheet>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: Warm.text,
  },
});
