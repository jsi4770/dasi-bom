import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Warm } from '@/constants/theme';

export type WarmHeaderProps = {
  title: string;
  onBack?: () => void;
  /**
   * 'bar'(기본) — 기존처럼 구분선+센터 타이틀이 있는 전체 폭 헤더바.
   * 'minimal' — 시안(다시봄 온보딩/증상기록.dc.html)처럼 바/타이틀 없이 뒤로가기 버튼만 콘텐츠
   * 위쪽에 가볍게 얹는 형태. 화면 제목은 본문 첫 헤드라인이 대신하는 화면에서 사용.
   */
  variant?: 'bar' | 'minimal';
};

export function WarmHeader({ title, onBack, variant = 'bar' }: WarmHeaderProps) {
  if (variant === 'minimal') {
    return (
      <View style={styles.minimalHeader}>
        {onBack && (
          <Pressable onPress={onBack} accessibilityLabel="뒤로가기" style={styles.backButton}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={20}
              tintColor={Warm.primaryStrong}
            />
          </Pressable>
        )}
      </View>
    );
  }

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
  minimalHeader: {
    flexShrink: 0,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    minHeight: 44,
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
