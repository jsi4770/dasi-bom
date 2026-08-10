import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Warm } from '@/constants/theme';

export type WarmSliderProps = {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  /** 값이 커질수록 진해지는 트랙 색(피스타치→차이→캐롭) — 부정적 방향(나쁨)일수록 진하게. */
  trackColorForValue: (value: number) => string;
  formatValue: (value: number) => string;
  minLabel: string;
  maxLabel: string;
};

const THUMB_SIZE = 36;
const TRACK_HEIGHT = 12;

/**
 * 50대 사용자 대상 — 숫자 입력 대신 드래그 한 번으로 끝나는 큰 슬라이더.
 * 현재 값을 항상 크게 보여주고, 트랙 양끝에 방향(나쁨→좋음) 라벨을 텍스트로 고정해
 * "어느 쪽으로 밀면 뭐가 좋아지는지"를 매번 다시 파악할 필요가 없게 했다.
 */
export function WarmSlider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  trackColorForValue,
  formatValue,
  minLabel,
  maxLabel,
}: WarmSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);

  function handleLayout(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width);
  }

  const panResponder = useMemo(() => {
    function valueFromLocationX(x: number) {
      if (trackWidth <= 0) return min;
      const ratio = Math.min(1, Math.max(0, x / trackWidth));
      const raw = min + ratio * (max - min);
      const stepped = Math.round(raw / step) * step;
      return Math.min(max, Math.max(min, stepped));
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        onChange(valueFromLocationX(e.nativeEvent.locationX));
      },
      onPanResponderMove: (e) => {
        onChange(valueFromLocationX(e.nativeEvent.locationX));
      },
    });
  }, [min, max, step, trackWidth, onChange]);

  const ratio = (value - min) / (max - min);
  const fillColor = trackColorForValue(value);
  const thumbLeft = trackWidth > 0 ? ratio * trackWidth - THUMB_SIZE / 2 : -THUMB_SIZE / 2;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        {/* 값 텍스트는 트랙 색(피스타치/차이)의 낮은 명도로는 AA를 못 채워서 항상 진한 고정색을 쓰고,
            트랙 채우기·손잡이 테두리로만 팔레트 톤 변화를 보여준다. */}
        <ThemedText style={styles.value}>{formatValue(value)}</ThemedText>
      </View>

      <View
        style={styles.trackTouchArea}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: formatValue(value) }}>
        <View style={styles.trackBg}>
          <View style={[styles.trackFill, { width: `${ratio * 100}%`, backgroundColor: fillColor }]} />
        </View>
        <View style={[styles.thumb, { left: thumbLeft, borderColor: fillColor }]} />
      </View>

      <View style={styles.endLabelRow}>
        <ThemedText style={styles.endLabel}>{minLabel}</ThemedText>
        <ThemedText style={styles.endLabel}>{maxLabel}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
    color: Warm.text,
  },
  value: {
    fontSize: 26,
    fontWeight: '900',
    color: Warm.textDeep,
  },
  trackTouchArea: {
    justifyContent: 'center',
    paddingVertical: 16,
  },
  trackBg: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: Warm.backgroundSubtle,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: Warm.card,
    borderWidth: 3,
    shadowColor: Warm.textDeep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  endLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  endLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Warm.textSecondary,
  },
});
