import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Warm } from '@/constants/theme';

export type WarmBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * 저녁 체크인 등 짧은 입력용 바텀시트.
 * 슬라이드 인/아웃은 직접 Animated로 만들지 않고 RN Modal의 animationType="slide"를 그대로 쓴다 —
 * 자체 구현은 "닫히는 애니메이션이 끝난 뒤에만 언마운트"하려고 mount 상태를 애니메이션 콜백과 맞물려
 * 관리해야 하는데, 그 콜백 타이밍이 플랫폼마다 달라 오히려 예측 불가능한 버그(다시 열어도 다시 안
 * 열리는 등)로 이어지기 쉬웠다. Modal 내장 애니메이션은 플랫폼이 보장하는 대신 항상 같은 속도/방향으로
 * 동작해 50대 사용자에게 더 예측 가능하다.
 * 드래그로 닫는 제스처도 넣지 않았다 — 오조작하기 쉬워서 "닫기" 버튼 + 배경 탭으로만 닫히게 했다.
 */
export function WarmBottomSheet({ visible, onClose, title, children }: WarmBottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} accessibilityLabel="닫기" onPress={onClose} />
        <View style={[styles.sheetOuter, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetInner}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <ThemedText style={styles.title}>{title}</ThemedText>
              <Pressable
                onPress={onClose}
                accessibilityLabel="닫기"
                hitSlop={8}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <ThemedText style={styles.closeButtonText}>✕ 닫기</ThemedText>
              </Pressable>
            </View>
            {children}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 61, 44, 0.35)',
  },
  sheetOuter: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: Warm.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  sheetInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Warm.border,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Warm.text,
  },
  closeButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Warm.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
