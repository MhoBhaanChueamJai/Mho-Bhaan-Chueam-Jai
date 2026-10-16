/**
 * อินโทรเปิดตัวแอปแบบ Apple keynote (วนซ้ำ ~13 วินาที)
 * 1) เวทีมืดเขียวเข้ม แสงค่อยๆ เรืองจากกลาง
 * 2) ไอคอนแอปปรากฏ + แสงวาบพาดผ่าน
 * 3) ชื่อแอปลอยขึ้น + คำโปรย
 * 4) โทรศัพท์ 3 เครื่อง (หน้าจอจริงของแอป) ลอยขึ้นแบบเอียง 3 มิติ แล้วค่อยๆ ลอยไหว
 * 5) จางหาย แล้วเริ่มใหม่
 */
import { BlurMask, Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Extrapolation, cancelAnimation, interpolate, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

const ICON = require('../../assets/icon.png');
const SHOTS = {
  home: require('../../assets/intro/home.jpg'),
  patient: require('../../assets/intro/patient.jpg'),
  capture: require('../../assets/intro/capture.jpg'),
};
const LOOP = 13000;
const clamp = Extrapolation.CLAMP;

/** ช่วงเวลา a→b บนไทม์ไลน์ 0–1 แปลงเป็น 0→1 */
const seg = (t: number, a: number, b: number) => {
  'worklet';
  return interpolate(t, [a, b], [0, 1], clamp);
};
/** fade-out ตอนท้ายลูป */
const outro = (t: number) => {
  'worklet';
  return interpolate(t, [0.9, 0.98], [1, 0], clamp);
};
const ease = (x: number) => {
  'worklet';
  return 1 - Math.pow(1 - x, 3);
};

function Phone({ t, src, w, h, from, x, rotY, z, delay }: { t: SharedValue<number>; src: number; w: number; h: number; from: number; x: number; rotY: number; z: number; delay: number }) {
  const st = useAnimatedStyle(() => {
    const p = ease(seg(t.value, 0.4 + delay, 0.56 + delay));
    const drift = Math.sin((t.value - 0.5) * Math.PI * 4) * 2.5;
    return {
      opacity: p * outro(t.value),
      transform: [
        { perspective: 900 },
        { translateX: x * p },
        { translateY: from * (1 - p) },
        { rotateY: `${rotY * p + drift * (rotY === 0 ? 0.6 : 1)}deg` },
        { rotateX: `${(1 - p) * 18}deg` },
        { scale: z * (0.92 + 0.08 * p) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.phoneWrap, { width: w, height: h, borderRadius: w * 0.17, zIndex: rotY === 0 ? 3 : 1 }, st]}>
      <View style={[styles.phone, { borderRadius: w * 0.17 }]}>
        <ExpoImage source={src} style={{ width: w - 8, height: h - 8 }} contentFit="cover" />
        <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.4 }} style={StyleSheet.absoluteFill} />
      </View>
    </Animated.View>
  );
}

/** inset = ความสูง status bar: พื้นหลังลากเต็มถึงขอบบน ส่วนเนื้อหาเลื่อนลงพ้นแถบ */
export function KeynoteIntro({ width, height, inset = 0 }: { width: number; height: number; inset?: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: LOOP, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t]);

  const cx = width / 2;
  const cy = height * 0.42;
  // แสงเรืองกลางเวที
  const bloomR = useDerivedValue(() => width * (0.25 + 0.55 * ease(seg(t.value, 0, 0.16))));
  const bloomO = useDerivedValue(() => 0.85 * seg(t.value, 0, 0.1) * outro(t.value));

  // ไอคอน: ปรากฏ → เลื่อนขึ้นย่อเมื่อโทรศัพท์เข้า
  const iconSt = useAnimatedStyle(() => {
    const inP = ease(seg(t.value, 0.06, 0.16));
    const up = ease(seg(t.value, 0.36, 0.46));
    return {
      opacity: inP * outro(t.value),
      transform: [{ translateY: interpolate(up, [0, 1], [0, -height * 0.3]) }, { scale: interpolate(inP, [0, 1], [0.6, 1]) * interpolate(up, [0, 1], [1, 0.5]) }],
    };
  });
  // แสงวาบพาดไอคอน
  const sweepSt = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(seg(t.value, 0.14, 0.24), [0, 1], [-140, 140]) }, { rotate: '20deg' }] }));
  // ชื่อแอป + คำโปรย
  const titleSt = useAnimatedStyle(() => {
    const inP = ease(seg(t.value, 0.18, 0.27));
    const up = ease(seg(t.value, 0.36, 0.46));
    return {
      opacity: inP * interpolate(up, [0, 1], [1, 0]) * outro(t.value),
      transform: [{ translateY: interpolate(inP, [0, 1], [18, 0]) - up * 40 }],
    };
  });
  const tagSt = useAnimatedStyle(() => {
    const inP = ease(seg(t.value, 0.25, 0.33));
    const up = ease(seg(t.value, 0.36, 0.44));
    return { opacity: inP * (1 - up) * outro(t.value), transform: [{ translateY: interpolate(inP, [0, 1], [12, 0]) }] };
  });
  // คำบรรยายใต้โทรศัพท์
  const capSt = useAnimatedStyle(() => ({ opacity: ease(seg(t.value, 0.62, 0.7)) * outro(t.value) }));

  const ph = height * 0.56;
  const pw = ph * (540 / 1174);
  const phonesTop = height * 0.22;

  return (
    <View style={{ width, height: height + inset, overflow: 'hidden' }}>
      <LinearGradient colors={['#04150E', '#0A3A27', '#072A1C']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cy + inset} r={bloomR} opacity={bloomO}>
          <RadialGradient c={vec(cx, cy + inset)} r={width * 0.8} colors={['rgba(80,220,150,0.55)', 'rgba(20,144,92,0.28)', 'rgba(14,53,36,0)']} />
          <BlurMask blur={30} style="normal" />
        </Circle>
      </Canvas>
      <View style={{ position: 'absolute', top: inset, left: 0, width, height }}>
      {/* ไอคอน + แสงวาบ */}
      <Animated.View style={[styles.center, { top: cy - 52 }, iconSt]}>
        <View style={styles.iconWrap}>
          <Image source={ICON} style={styles.icon} />
          <Animated.View style={[styles.sweep, sweepSt]}>
            <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.center, { top: cy + 70 }, titleSt]}>
        <Text style={styles.title}>หมอบ้านเชื่อมใจ</Text>
      </Animated.View>
      <Animated.View style={[styles.center, { top: cy + 118 }, tagSt]}>
        <Text style={styles.tag}>ภูมิปัญญาไทย  ·  เชื่อมใจด้วย AI</Text>
      </Animated.View>

      {/* โทรศัพท์ 3 เครื่อง */}
      <View style={[styles.stage, { top: phonesTop, height: ph }]} pointerEvents="none">
        <Phone t={t} src={SHOTS.patient} w={pw} h={ph} from={height} x={-pw * 0.72} rotY={28} z={0.84} delay={0.06} />
        <Phone t={t} src={SHOTS.capture} w={pw} h={ph} from={height} x={pw * 0.72} rotY={-28} z={0.84} delay={0.08} />
        <Phone t={t} src={SHOTS.home} w={pw} h={ph} from={height} x={0} rotY={0} z={1} delay={0} />
      </View>

      <Animated.View style={[styles.center, { bottom: 40 }, capSt]}>
        <Text style={styles.caption}>พูด · บันทึก · ดูแล  ในแอปเดียว</Text>
      </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  iconWrap: { width: 104, height: 104, borderRadius: 24, overflow: 'hidden', shadowColor: '#5ED696', shadowOpacity: 0.5, shadowRadius: 30 },
  icon: { width: 104, height: 104, borderRadius: 24 },
  sweep: { position: 'absolute', top: -40, bottom: -40, width: 46 },
  title: { color: '#FFFFFF', fontSize: 34, fontWeight: '700', letterSpacing: 0.5 },
  tag: { color: 'rgba(214,240,224,0.85)', fontSize: 16, fontWeight: '500' },
  caption: { color: 'rgba(214,240,224,0.75)', fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  stage: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  phoneWrap: { position: 'absolute', shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 28, shadowOffset: { width: 0, height: 22 } },
  phone: { flex: 1, overflow: 'hidden', borderWidth: 4, borderColor: '#0B120E', backgroundColor: '#000' },
});
