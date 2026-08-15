import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

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

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// 탄성 있는 스프링 3종 -- 관절 성격에 맞게 골라 쓴다(느슨한 몸통/숨쉬기엔 SLOW, 어깨처럼
// 빠르게 튕기는 동작엔 SNAPPY). neck_roll·ankle_roll처럼 정해진 궤적을 따라 일정한
// 속도로 도는 동작만 예외적으로 withTiming을 그대로 쓴다 -- 스프링을 쓰면 궤적이
// 튀어서 원을 그리는 느낌이 깨진다.
const SPRING_SOFT = { damping: 10, stiffness: 90 } as const;
const SPRING_SNAPPY = { damping: 9, stiffness: 160 } as const;
const SPRING_SLOW = { damping: 7, stiffness: 45 } as const;

const DEFAULT_ARM_ANGLE = 18;
const POSE_DELAY = 200;
const REST_BLUSH = 0.15;

/** 목·어깨 스트레칭 등을 SVG 도형 캐릭터가 따라 하는 것처럼 보여준다. pose가 바뀔 때마다
 * 관련 없는 관절은 중립 자세로 되돌리고, 그 pose에 맞는 관절만 반복 애니메이션을 새로 건다. */
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
  const blush = useSharedValue(REST_BLUSH);
  const eyeScale = useSharedValue(1);

  // 상시 idle 흔들림 + 눈 깜빡임 -- pose와 무관하게 항상 돈다.
  useEffect(() => {
    bob.value = withRepeat(withSequence(withSpring(-5, SPRING_SLOW), withSpring(0, SPRING_SLOW)), -1, false);

    const blinkTimer = setInterval(() => {
      eyeScale.value = withSequence(withTiming(0.15, { duration: 90 }), withTiming(1, { duration: 130 }));
    }, 4200);
    return () => clearInterval(blinkTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const joints = [
      headRotate, headX, headY,
      armLeftRotate, armRightRotate, armLeftY, armRightY,
      torsoScaleY, torsoRotate,
      legLeftRotate, legRightRotate, blush,
    ];
    joints.forEach(cancelAnimation);

    headRotate.value = withSpring(0, SPRING_SOFT);
    headX.value = withSpring(0, SPRING_SOFT);
    headY.value = withSpring(0, SPRING_SOFT);
    armLeftRotate.value = withSpring(DEFAULT_ARM_ANGLE, SPRING_SOFT);
    armRightRotate.value = withSpring(-DEFAULT_ARM_ANGLE, SPRING_SOFT);
    armLeftY.value = withSpring(0, SPRING_SOFT);
    armRightY.value = withSpring(0, SPRING_SOFT);
    torsoScaleY.value = withSpring(1, SPRING_SOFT);
    torsoRotate.value = withSpring(0, SPRING_SOFT);
    legLeftRotate.value = withSpring(0, SPRING_SOFT);
    legRightRotate.value = withSpring(0, SPRING_SOFT);
    blush.value = withTiming(REST_BLUSH, { duration: 400 });

    switch (pose) {
      case 'tilt_left':
        headRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withSpring(-18, SPRING_SOFT), withSpring(0, SPRING_SOFT)), -1, false),
        );
        break;
      case 'tilt_right':
        headRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withSpring(18, SPRING_SOFT), withSpring(0, SPRING_SOFT)), -1, false),
        );
        break;
      case 'shoulder_shrug':
        armLeftY.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withSpring(-14, SPRING_SNAPPY), withSpring(0, SPRING_SNAPPY)), -1, false),
        );
        armRightY.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withSpring(-14, SPRING_SNAPPY), withSpring(0, SPRING_SNAPPY)), -1, false),
        );
        break;
      case 'chest_open':
        armLeftRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withSpring(75, SPRING_SOFT), withSpring(55, SPRING_SOFT)), -1, false),
        );
        armRightRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withSpring(-75, SPRING_SOFT), withSpring(-55, SPRING_SOFT)), -1, false),
        );
        torsoScaleY.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withSpring(1.05, SPRING_SOFT), withSpring(1, SPRING_SOFT)), -1, false),
        );
        blush.value = withDelay(POSE_DELAY, withTiming(0.45, { duration: 500 }));
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
          withRepeat(withSequence(withSpring(1.12, SPRING_SLOW), withSpring(1, SPRING_SLOW)), -1, false),
        );
        armLeftY.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withSpring(-4, SPRING_SLOW), withSpring(0, SPRING_SLOW)), -1, false),
        );
        armRightY.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withSpring(-4, SPRING_SLOW), withSpring(0, SPRING_SLOW)), -1, false),
        );
        blush.value = withDelay(POSE_DELAY, withTiming(0.3, { duration: 800 }));
        break;
      case 'reach_up':
        armLeftRotate.value = withDelay(POSE_DELAY, withSpring(165, SPRING_SOFT));
        armRightRotate.value = withDelay(POSE_DELAY, withSpring(-165, SPRING_SOFT));
        headY.value = withDelay(
          POSE_DELAY + 400,
          withRepeat(withSequence(withSpring(-4, SPRING_SNAPPY), withSpring(0, SPRING_SNAPPY)), -1, false),
        );
        blush.value = withDelay(POSE_DELAY, withTiming(0.4, { duration: 500 }));
        break;
      case 'side_bend':
        torsoRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withSpring(14, SPRING_SOFT), withSpring(-14, SPRING_SOFT)), -1, false),
        );
        headRotate.value = withDelay(
          POSE_DELAY,
          withRepeat(withSequence(withSpring(10, SPRING_SOFT), withSpring(-10, SPRING_SOFT)), -1, false),
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
        torsoScaleY.value = withDelay(POSE_DELAY, withSpring(0.72, SPRING_SNAPPY));
        armLeftRotate.value = withDelay(POSE_DELAY, withSpring(85, SPRING_SNAPPY));
        armRightRotate.value = withDelay(POSE_DELAY, withSpring(-85, SPRING_SNAPPY));
        headY.value = withDelay(POSE_DELAY, withSpring(14, SPRING_SNAPPY));
        break;
      case 'lie_relax':
        armLeftRotate.value = withDelay(POSE_DELAY, withSpring(50, SPRING_SOFT));
        armRightRotate.value = withDelay(POSE_DELAY, withSpring(-50, SPRING_SOFT));
        legLeftRotate.value = withDelay(POSE_DELAY, withSpring(12, SPRING_SOFT));
        legRightRotate.value = withDelay(POSE_DELAY, withSpring(-12, SPRING_SOFT));
        torsoScaleY.value = withDelay(
          POSE_DELAY + 500,
          withRepeat(withSequence(withSpring(1.04, SPRING_SLOW), withSpring(1, SPRING_SLOW)), -1, false),
        );
        blush.value = withDelay(POSE_DELAY, withTiming(0.25, { duration: 600 }));
        break;
      case 'rest':
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose]);

  const headProps = useAnimatedProps(() => ({
    transform: [
      { translateX: headX.value },
      { translateY: headY.value + bob.value },
      { rotate: `${headRotate.value}deg` },
    ],
  }));
  const torsoProps = useAnimatedProps(() => ({
    transform: [{ translateY: bob.value }, { rotate: `${torsoRotate.value}deg` }, { scaleY: torsoScaleY.value }],
  }));
  const armLeftProps = useAnimatedProps(() => ({
    transform: [{ translateY: bob.value + armLeftY.value }, { rotate: `${armLeftRotate.value}deg` }],
  }));
  const armRightProps = useAnimatedProps(() => ({
    transform: [{ translateY: bob.value + armRightY.value }, { rotate: `${armRightRotate.value}deg` }],
  }));
  const legLeftProps = useAnimatedProps(() => ({ transform: [{ rotate: `${legLeftRotate.value}deg` }] }));
  const legRightProps = useAnimatedProps(() => ({ transform: [{ rotate: `${legRightRotate.value}deg` }] }));
  const eyeLeftProps = useAnimatedProps(() => ({ transform: [{ scaleY: eyeScale.value }] }));
  const eyeRightProps = useAnimatedProps(() => ({ transform: [{ scaleY: eyeScale.value }] }));
  const blushLeftProps = useAnimatedProps(() => ({ opacity: blush.value }));
  const blushRightProps = useAnimatedProps(() => ({ opacity: blush.value }));

  return (
    <View style={styles.stage}>
      <Svg width={STAGE_WIDTH} height={STAGE_HEIGHT} viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}>
        <Defs>
          <RadialGradient id="torsoGrad" cx="50%" cy="35%" r="75%">
            <Stop offset="0%" stopColor="#F4F7EF" />
            <Stop offset="100%" stopColor={Warm.primarySoft} />
          </RadialGradient>
        </Defs>

        <Ellipse cx={STAGE_WIDTH / 2} cy={STAGE_HEIGHT - 14} rx={40} ry={7} fill="rgba(46, 42, 36, 0.08)" />

        <AnimatedG animatedProps={armLeftProps} origin="50,88">
          <Rect x={42} y={88} width={16} height={68} rx={8} fill={Warm.primary} />
        </AnimatedG>
        <AnimatedG animatedProps={armRightProps} origin="150,88">
          <Rect x={142} y={88} width={16} height={68} rx={8} fill={Warm.primary} />
        </AnimatedG>

        <AnimatedG animatedProps={legLeftProps} origin="85,162">
          <Rect x={76} y={162} width={18} height={56} rx={9} fill={Warm.secondaryStrong} />
        </AnimatedG>
        <AnimatedG animatedProps={legRightProps} origin="115,162">
          <Rect x={106} y={162} width={18} height={56} rx={9} fill={Warm.secondaryStrong} />
        </AnimatedG>

        <AnimatedG animatedProps={torsoProps} origin="100,125">
          <Rect
            x={65}
            y={80}
            width={70}
            height={90}
            rx={30}
            fill="url(#torsoGrad)"
            stroke={Warm.primarySoftBorder}
            strokeWidth={1.5}
          />
        </AnimatedG>

        <AnimatedG animatedProps={headProps} origin="100,80">
          <Circle cx={100} cy={50} r={30} fill={Warm.card} stroke={Warm.border} strokeWidth={1.5} />
          <AnimatedCircle animatedProps={blushLeftProps} cx={80} cy={56} r={6} fill={Warm.secondary} />
          <AnimatedCircle animatedProps={blushRightProps} cx={120} cy={56} r={6} fill={Warm.secondary} />
          <AnimatedG animatedProps={eyeLeftProps} origin="92,48">
            <Circle cx={92} cy={48} r={3} fill={Warm.textDeep} />
          </AnimatedG>
          <AnimatedG animatedProps={eyeRightProps} origin="108,48">
            <Circle cx={108} cy={48} r={3} fill={Warm.textDeep} />
          </AnimatedG>
          <Path d="M90,60 Q100,67 110,60" stroke={Warm.textDeep} strokeWidth={2.5} strokeLinecap="round" fill="none" />
        </AnimatedG>
      </Svg>
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
});
