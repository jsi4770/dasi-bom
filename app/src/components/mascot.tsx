import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Warm } from '@/constants/theme';

/** MindfulnessStep.pose 값과 그대로 맞춰야 한다(백엔드
 * apps/notifications/migrations/0003_seed_mindfulness_sessions.py 참고).
 * 알 수 없는 값이 와도 'rest'로 안전하게 처리한다. */
export type MascotPose =
  | 'rest'
  | 'tilt_left'
  | 'tilt_right'
  | 'shoulder_shrug'
  | 'chest_open'
  | 'neck_roll'
  | 'breathe'
  | 'reach_up'
  | 'side_bend'
  | 'ankle_roll'
  | 'hug_knees'
  | 'lie_relax';

const DEFAULT_ARM_ANGLE = 18;
const RESET_DURATION = 300;
const POSE_DELAY = 250;

/** 목·어깨 스트레칭 등을 단순한 원+캡슐 도형 캐릭터가 따라 하는 것처럼 보여준다.
 * 실사 캐릭터 대신 도형 기반으로 만든 이유는 warm-mockup 코멘트 참고 — 지금 시간 안에
 * 신뢰성 있게 만들 수 있는 선이 이 정도였다. pose가 바뀔 때마다 관련 없는 관절은
 * 중립 자세로 되돌리고, 그 pose에 맞는 관절만 반복 애니메이션을 새로 건다. */
export function Mascot({ pose }: { pose: string }) {
  const bob = useSharedValue(0);
  const headRotate = useSharedValue(0);
  const headX = useSharedValue(0);
  const headY = useSharedValue(0);
  const armLeftRotate = useSharedValue(DEFAULT_ARM_ANGLE);
  const armRightRotate = useSharedValue(-DEFAULT_ARM_ANGLE);
  const armLeftY = useSharedValue(0);
  const armRightY = useSharedValue(0);
  const torsoScaleY = useSharedValue(1);
  const torsoRotate = useSharedValue(0);
  const legLeftRotate = useSharedValue(0);
  const legRightRotate = useSharedValue(0);

  // 살아있는 느낌을 위한 상시 idle 흔들림 — pose와 무관하게 항상 돈다.
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const joints = [
      headRotate, headX, headY,
      armLeftRotate, armRightRotate, armLeftY, armRightY,
      torsoScaleY, torsoRotate,
      legLeftRotate, legRightRotate,
    ];
    joints.forEach(cancelAnimation);

    headRotate.value = withTiming(0, { duration: RESET_DURATION });
    headX.value = withTiming(0, { duration: RESET_DURATION });
    headY.value = withTiming(0, { duration: RESET_DURATION });
    armLeftRotate.value = withTiming(DEFAULT_ARM_ANGLE, { duration: RESET_DURATION });
    armRightRotate.value = withTiming(-DEFAULT_ARM_ANGLE, { duration: RESET_DURATION });
    armLeftY.value = withTiming(0, { duration: RESET_DURATION });
    armRightY.value = withTiming(0, { duration: RESET_DURATION });
    torsoScaleY.value = withTiming(1, { duration: RESET_DURATION });
    torsoRotate.value = withTiming(0, { duration: RESET_DURATION });
    legLeftRotate.value = withTiming(0, { duration: RESET_DURATION });
    legRightRotate.value = withTiming(0, { duration: RESET_DURATION });

    switch (pose) {
      case 'tilt_left':
        headRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withTiming(-18, { duration: 650 }), withTiming(0, { duration: 650 })), -1, false),
        );
        break;
      case 'tilt_right':
        headRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withTiming(18, { duration: 650 }), withTiming(0, { duration: 650 })), -1, false),
        );
        break;
      case 'shoulder_shrug':
        armLeftY.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withTiming(-14, { duration: 500 }), withTiming(0, { duration: 500 })), -1, false),
        );
        armRightY.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withTiming(-14, { duration: 500 }), withTiming(0, { duration: 500 })), -1, false),
        );
        break;
      case 'chest_open':
        armLeftRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withTiming(75, { duration: 700 }), withTiming(55, { duration: 700 })), -1, false),
        );
        armRightRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withTiming(-75, { duration: 700 }), withTiming(-55, { duration: 700 })), -1, false),
        );
        torsoScaleY.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withTiming(1.05, { duration: 700 }), withTiming(1, { duration: 700 })), -1, false),
        );
        break;
      case 'neck_roll':
        headX.value = withDelay(
          POSE_DELAY,
          withRepeat(
            withSequence(
              withTiming(10, { duration: 450 }),
              withTiming(0, { duration: 450 }),
              withTiming(-10, { duration: 450 }),
              withTiming(0, { duration: 450 }),
            ),
            -1,
            false,
          ),
        );
        headY.value = withDelay(
          POSE_DELAY,
          withRepeat(
            withSequence(
              withTiming(6, { duration: 450 }),
              withTiming(10, { duration: 450 }),
              withTiming(6, { duration: 450 }),
              withTiming(0, { duration: 450 }),
            ),
            -1,
            false,
          ),
        );
        break;
      case 'breathe':
        torsoScaleY.value = withDelay(
          POSE_DELAY,
          withRepeat(
            withSequence(
              withTiming(1.12, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
              withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            false,
          ),
        );
        armLeftY.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withTiming(-4, { duration: 1600 }), withTiming(0, { duration: 1600 })), -1, false),
        );
        armRightY.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withTiming(-4, { duration: 1600 }), withTiming(0, { duration: 1600 })), -1, false),
        );
        break;
      case 'reach_up':
        armLeftRotate.value = withDelay(POSE_DELAY, withTiming(165, { duration: 700, easing: Easing.out(Easing.quad) }));
        armRightRotate.value = withDelay(POSE_DELAY, withTiming(-165, { duration: 700, easing: Easing.out(Easing.quad) }));
        headY.value = withDelay(
          POSE_DELAY + 700,
          withRepeat(withSequence(withTiming(-4, { duration: 800 }), withTiming(0, { duration: 800 })), -1, false),
        );
        break;
      case 'side_bend':
        torsoRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withTiming(14, { duration: 900 }), withTiming(-14, { duration: 900 })), -1, false),
        );
        headRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withTiming(10, { duration: 900 }), withTiming(-10, { duration: 900 })), -1, false),
        );
        break;
      case 'ankle_roll':
        legLeftRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withTiming(360, { duration: 1400, easing: Easing.linear }), -1, false),
        );
        legRightRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withTiming(-360, { duration: 1400, easing: Easing.linear }), -1, false),
        );
        break;
      case 'hug_knees':
        torsoScaleY.value = withDelay(POSE_DELAY, withTiming(0.72, { duration: 600, easing: Easing.out(Easing.quad) }));
        armLeftRotate.value = withDelay(POSE_DELAY, withTiming(85, { duration: 600 }));
        armRightRotate.value = withDelay(POSE_DELAY, withTiming(-85, { duration: 600 }));
        headY.value = withDelay(POSE_DELAY, withTiming(14, { duration: 600 }));
        break;
      case 'lie_relax':
        armLeftRotate.value = withDelay(POSE_DELAY, withTiming(50, { duration: 700 }));
        armRightRotate.value = withDelay(POSE_DELAY, withTiming(-50, { duration: 700 }));
        legLeftRotate.value = withDelay(POSE_DELAY, withTiming(12, { duration: 700 }));
        legRightRotate.value = withDelay(POSE_DELAY, withTiming(-12, { duration: 700 }));
        torsoScaleY.value = withDelay(
          POSE_DELAY + 700,
          withRepeat(
            withSequence(
              withTiming(1.04, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
              withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            false,
          ),
        );
        break;
      case 'rest':
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose]);

  const headStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: headX.value },
      { translateY: headY.value + bob.value },
      { rotate: `${headRotate.value}deg` },
    ],
  }));
  const torsoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }, { rotate: `${torsoRotate.value}deg` }, { scaleY: torsoScaleY.value }],
  }));
  const armLeftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value + armLeftY.value }, { rotate: `${armLeftRotate.value}deg` }],
  }));
  const armRightStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value + armRightY.value }, { rotate: `${armRightRotate.value}deg` }],
  }));
  const legLeftStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${legLeftRotate.value}deg` }],
  }));
  const legRightStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${legRightRotate.value}deg` }],
  }));

  return (
    <View style={styles.stage}>
      <View style={styles.floorShadow} />
      <Animated.View style={[styles.arm, styles.armLeft, armLeftStyle]} />
      <Animated.View style={[styles.arm, styles.armRight, armRightStyle]} />
      <Animated.View style={[styles.leg, styles.legLeft, legLeftStyle]} />
      <Animated.View style={[styles.leg, styles.legRight, legRightStyle]} />
      <Animated.View style={[styles.torso, torsoStyle]} />
      <Animated.View style={[styles.head, headStyle]}>
        <View style={styles.eyeRow}>
          <View style={styles.eye} />
          <View style={styles.eye} />
        </View>
        <View style={styles.mouth} />
      </Animated.View>
    </View>
  );
}

const STAGE_WIDTH = 200;
const STAGE_HEIGHT = 220;

const styles = StyleSheet.create({
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    alignSelf: 'center',
  },
  floorShadow: {
    position: 'absolute',
    bottom: 6,
    left: STAGE_WIDTH / 2 - 40,
    width: 80,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(46, 42, 36, 0.08)',
  },
  torso: {
    position: 'absolute',
    top: 80,
    left: (STAGE_WIDTH - 70) / 2,
    width: 70,
    height: 90,
    borderRadius: 30,
    backgroundColor: Warm.primarySoft,
    borderWidth: 1.5,
    borderColor: Warm.primarySoftBorder,
  },
  head: {
    position: 'absolute',
    top: 20,
    left: (STAGE_WIDTH - 60) / 2,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Warm.card,
    borderWidth: 1.5,
    borderColor: Warm.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  eyeRow: {
    flexDirection: 'row',
    gap: 14,
  },
  eye: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Warm.textDeep,
  },
  mouth: {
    width: 14,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: Warm.textDeep,
  },
  arm: {
    position: 'absolute',
    top: 88,
    width: 16,
    height: 68,
    borderRadius: 8,
    backgroundColor: Warm.primary,
  },
  armLeft: {
    left: 42,
  },
  armRight: {
    left: STAGE_WIDTH - 42 - 16,
  },
  leg: {
    position: 'absolute',
    top: 162,
    width: 18,
    height: 56,
    borderRadius: 9,
    backgroundColor: Warm.secondaryStrong,
  },
  legLeft: {
    left: 76,
  },
  legRight: {
    left: STAGE_WIDTH - 76 - 18,
  },
});
