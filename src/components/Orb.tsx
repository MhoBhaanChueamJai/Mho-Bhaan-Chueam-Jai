/**
 * เอฟเฟกต์ AI แบบ Apple Intelligence (วาดด้วย Skia บน GPU)
 *  - Orb      : ลูกแก้ว Siri — ก้อนสีน้ำเงิน/ม่วง/ชมพู/ส้ม ไหลวนในทรงกลม, ขยายตามเสียงจริง
 *  - AIGlow   : ขอบจอเรืองแสงไล่สีวิ่งรอบ เมื่อ AI กำลังฟัง/คิด/พูด
 *  - AIBorder : ขอบการ์ดไล่สีหมุน (การ์ด "ครูปัญญา")
 *  - Waveform : แท่งคลื่นเสียงไล่สี
 */
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient as SkLinear,
  Oval,
  RadialGradient,
  Path as SkPath,
  Points,
  RoundedRect,
  Skia,
  SweepGradient,
  rrect,
  rect,
  vec,
} from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { palette } from '../theme';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

/** สเปกตรัม AI โทนสมุนไพร: ใบยา → ใบเตย → ขมิ้น → ดินเผา → อัญชัน */
export const AI_COLORS = ['#2E7D57', '#2AB08F', '#E0B030', '#E07A4F', '#7A5CC8', '#2E7D57'];

function useClock(duration: number) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [duration, t]);
  return t;
}

/* ───────────── Siri Orb ───────────── */
export function Orb({ size = 200, state, level }: { size?: number; state: OrbState; level?: SharedValue<number> }) {
  const box = size * 2.2; // พื้นที่วาดใหญ่กว่า footprint เพื่อให้แสงจางเป็นวงกลม ไม่ถูกตัดเป็นสี่เหลี่ยม
  const foot = size * 1.5;
  const c = box / 2;
  const r = size / 2;
  const t = useClock(state === 'thinking' ? 2600 : state === 'idle' ? 9000 : 4200);
  const energy = useSharedValue(0);
  useEffect(() => {
    energy.value = withSpring(state === 'idle' ? 0 : 1, { damping: 14, stiffness: 90 });
  }, [state, energy]);

  const lv = useDerivedValue(() => (level ? level.value : 0));
  const orbTransform = useDerivedValue(() => [{ scale: 1 + lv.value * 0.12 * energy.value + Math.sin(t.value * Math.PI * 2) * 0.01 }]);

  // ก้อนสี 4 ก้อนโคจร
  const pos = (phase: number, orbitK: number, axis: 'x' | 'y') => {
    'worklet';
    const a = (t.value + phase) * Math.PI * 2;
    const o = r * orbitK * (0.6 + energy.value * 0.4);
    return axis === 'x' ? c + Math.cos(a) * o : c + Math.sin(a * 1.3) * o;
  };
  const b1x = useDerivedValue(() => pos(0, 0.45, 'x'));
  const b1y = useDerivedValue(() => pos(0, 0.45, 'y'));
  const b2x = useDerivedValue(() => pos(0.33, 0.5, 'x'));
  const b2y = useDerivedValue(() => pos(0.33, 0.5, 'y'));
  const b3x = useDerivedValue(() => pos(0.66, 0.42, 'x'));
  const b3y = useDerivedValue(() => pos(0.66, 0.42, 'y'));
  const b4x = useDerivedValue(() => pos(0.15, 0.3, 'x'));
  const b4y = useDerivedValue(() => pos(0.5, 0.3, 'y'));
  const sweepT = useDerivedValue(() => [{ rotate: t.value * Math.PI * 2 }]);
  const haloR = useDerivedValue(() => r * (1.02 + lv.value * 0.12 * energy.value + energy.value * 0.03));
  const haloOpacity = useDerivedValue(() => 0.18 + energy.value * 0.2);
  const clip = rrect(rect(c - r, c - r, r * 2, r * 2), r, r);

  return (
    <View style={{ width: foot, height: foot, overflow: 'visible' }} pointerEvents="none">
      <Canvas style={{ position: 'absolute', width: box, height: box, left: (foot - box) / 2, top: (foot - box) / 2 }}>
        <Group opacity={haloOpacity}>
          <Circle cx={c} cy={c} r={haloR}>
            <SweepGradient c={vec(c, c)} colors={AI_COLORS} transform={sweepT} origin={vec(c, c)} />
            <BlurMask blur={size * 0.1} style="normal" />
          </Circle>
        </Group>
        <Group transform={orbTransform} origin={vec(c, c)}>
          <Circle cx={c} cy={c} r={r}>
            <RadialGradient c={vec(c, c - r * 0.3)} r={r * 1.3} colors={['#5FBF8A', '#1F6B4A', '#0E2E21']} />
          </Circle>
          <Group clip={clip}>
            <Circle cx={b1x} cy={b1y} r={r * 0.62} color="#2AB08F">
              <BlurMask blur={r * 0.35} style="normal" />
            </Circle>
            <Circle cx={b2x} cy={b2y} r={r * 0.55} color="#E07A4F">
              <BlurMask blur={r * 0.35} style="normal" />
            </Circle>
            <Circle cx={b3x} cy={b3y} r={r * 0.5} color="#7A5CC8">
              <BlurMask blur={r * 0.3} style="normal" />
            </Circle>
            <Circle cx={b4x} cy={b4y} r={r * 0.4} color="#E0B030" opacity={0.9}>
              <BlurMask blur={r * 0.3} style="normal" />
            </Circle>
            <Oval x={c - r * 0.55} y={c - r * 0.9} width={r * 1.1} height={r * 0.6}>
              <SkLinear start={vec(c, c - r * 0.9)} end={vec(c, c - r * 0.3)} colors={['rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']} />
            </Oval>
          </Group>
          <Circle cx={c} cy={c} r={r - 1} style="stroke" strokeWidth={2} color="rgba(255,255,255,0.45)" />
        </Group>
      </Canvas>
    </View>
  );
}

/* ───────────── ขอบจอเรืองแสง Apple Intelligence ───────────── */
const { width: SW, height: SH } = Dimensions.get('window');
export function AIGlow({ active, corner = 58 }: { active: boolean; corner?: number }) {
  const t = useClock(7000);
  const on = useSharedValue(0);
  useEffect(() => {
    on.value = withTiming(active ? 1 : 0, { duration: 600 });
  }, [active, on]);
  const rot = useDerivedValue(() => [{ rotate: t.value * Math.PI * 2 }]);
  const c = vec(SW / 2, SH / 2);
  const layer = (w: number, blur: number, opacity: number) => (
    <RoundedRect x={w / 2} y={w / 2} width={SW - w} height={SH - w} r={corner} style="stroke" strokeWidth={w} opacity={opacity}>
      <SweepGradient c={c} colors={AI_COLORS} transform={rot} origin={c} />
      {blur ? <BlurMask blur={blur} style="normal" /> : null}
    </RoundedRect>
  );
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group opacity={on}>
        {layer(12, 14, 0.28)}
        {layer(2.5, 0, 0.55)}
      </Group>
    </Canvas>
  );
}

/* ───────────── ขอบการ์ดไล่สีหมุน ───────────── */
export function AIBorder({ width, height, radius = 26, stroke = 2.5, style }: { width: number; height: number; radius?: number; stroke?: number; style?: StyleProp<ViewStyle> }) {
  const t = useClock(5000);
  const rot = useDerivedValue(() => [{ rotate: t.value * Math.PI * 2 }]);
  const pad = 14;
  const c = vec(pad + width / 2, pad + height / 2);
  if (!width || !height) return null;
  return (
    <Canvas style={[{ position: 'absolute', left: -pad, top: -pad, width: width + pad * 2, height: height + pad * 2 }, style]} pointerEvents="none">
      <RoundedRect x={pad} y={pad} width={width} height={height} r={radius} style="stroke" strokeWidth={10} opacity={0.4}>
        <SweepGradient c={c} colors={AI_COLORS} transform={rot} origin={c} />
        <BlurMask blur={10} style="normal" />
      </RoundedRect>
      <RoundedRect x={pad + stroke / 2} y={pad + stroke / 2} width={width - stroke} height={height - stroke} r={radius} style="stroke" strokeWidth={stroke}>
        <SweepGradient c={c} colors={AI_COLORS} transform={rot} origin={c} />
      </RoundedRect>
    </Canvas>
  );
}

/* ───────────── Waveform ไล่สี ───────────── */
export function Waveform({ level, bars = 24 }: { level: SharedValue<number>; bars?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 56 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <Bar key={i} i={i} n={bars} level={level} />
      ))}
    </View>
  );
}

function Bar({ i, n, level }: { i: number; n: number; level: SharedValue<number> }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 650 + ((i * 97) % 450), easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [i, t]);
  const center = 1 - Math.abs(i - n / 2) / (n / 2);
  const st = useAnimatedStyle(() => ({
    height: withSpring(6 + level.value * 46 * (0.4 + center * 0.6) * (0.55 + t.value * 0.45), { damping: 12, stiffness: 200 }),
  }));
  const color = palette.primary;
  return <Animated.View style={[{ width: 5, borderRadius: 3, backgroundColor: color, opacity: 0.45 + center * 0.55 }, st]} />;
}

/** แถบไล่สีวิ่ง (shimmer) ระหว่าง AI กำลังสร้างคำตอบ */
export function AIShimmer({ height = 16, width = '100%', radius = 8 }: { height?: number; width?: number | `${number}%`; radius?: number }) {
  const t = useClock(1400);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: -300 + t.value * 700 }] }));
  return (
    <View style={{ height, width, borderRadius: radius, backgroundColor: palette.bgDeep, overflow: 'hidden' }}>
      <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: 300 }, st]}>
        <LinearGradient colors={['rgba(46,125,87,0)', 'rgba(46,125,87,0.28)', 'rgba(224,176,48,0.3)', 'rgba(224,176,48,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

/**
 * เงานุ่มสำหรับชิ้นกระจก — วาดเฉพาะ "นอก" ขอบ (invertClip) จึงไม่ทำให้กระจกขุ่น
 * วางเป็น sibling ก่อน GlassView ในตำแหน่งเดียวกัน
 */
export function SoftShadow({ width, height, radius, blur = 18, offsetY = 8, color = 'rgba(120,135,118,0.36)' }: { width: number; height: number; radius: number; blur?: number; offsetY?: number; color?: string }) {
  if (!width || !height) return null;
  const pad = blur * 2 + offsetY;
  const inner = rrect(rect(pad, pad, width, height), radius, radius);
  return (
    <Canvas style={{ position: 'absolute', left: -pad, top: -pad, width: width + pad * 2, height: height + pad * 2 }} pointerEvents="none">
      <Group clip={inner} invertClip>
        <RoundedRect x={pad} y={pad + offsetY} width={width} height={height} r={radius} color={color}>
          <BlurMask blur={blur} style="normal" />
        </RoundedRect>
      </Group>
    </Canvas>
  );
}

/* ═════════════ เอฟเฟกต์ AI แบบ Natural AI (พาสเทลสีรุ้ง) ═════════════ */

/** สีรุ้งพาสเทล: พีช → ชมพู → ลาเวนเดอร์ → ฟ้า → พีช */
export const IRIS = ['#FFB38A', '#FF8FC7', '#C08BFF', '#8FB8FF', '#9EE6F0', '#FFB38A'];

/** สุ่มแบบกำหนดค่าได้ (ให้ตำแหน่งจุดคงที่ทุกเฟรม) */
const seeded = (n: number) => {
  let s = 1234567;
  return Array.from({ length: n }, () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  });
};

/**
 * วงแหวนอนุภาค — จุดหลายพันจุดเรียงเป็นวงหยัก สีรุ้งพาสเทล ขยับตลอดเวลา
 * level (0–1) ทำให้คลื่นแรงขึ้นตามเสียงพูดจริง
 */
export function ParticleRing({ size = 220, level, children }: { size?: number; level?: SharedValue<number>; children?: React.ReactNode }) {
  const N = 1400;
  const c = size / 2;
  const R = size * 0.36;
  const rnd = React.useMemo(() => seeded(N * 3), []);
  const t = useClock(9000);
  const pts = useDerivedValue(() => {
    const lv = level ? level.value : 0;
    const time = t.value * Math.PI * 2;
    const out: { x: number; y: number }[] = new Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + rnd[i * 3] * 0.02;
      const wave = Math.sin(a * 3 + time) * 0.07 + Math.sin(a * 7 - time * 2) * 0.04 + Math.sin(a * 5 + time * 3) * (0.03 + lv * 0.14);
      const spread = (rnd[i * 3 + 1] - 0.5) * (0.16 + lv * 0.1);
      const r = R * (1 + wave + spread);
      out[i] = { x: c + Math.cos(a) * r, y: c + Math.sin(a) * r };
    }
    return out;
  });
  const rot = useDerivedValue(() => [{ rotate: t.value * Math.PI * 2 }]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Points points={pts} mode="points" strokeWidth={2.2} strokeCap="round" opacity={0.85}>
          <SweepGradient c={vec(c, c)} colors={IRIS} transform={rot} origin={vec(c, c)} />
        </Points>
      </Canvas>
      {children}
    </View>
  );
}

/**
 * วงแหวนความคืบหน้าแบบกระจกพาสเทล — วงซ้อนเบลอนุ่ม + เส้นความคืบหน้าสีม่วงบาง + จุดหัวเส้น + %
 * children = ไอคอนตรงกลาง (เปลี่ยนตามขั้นตอน)
 */
export function ProgressHalo({ size = 220, progress, children }: { size?: number; progress: number; children?: React.ReactNode }) {
  const c = size / 2;
  const rOuter = size * 0.46;
  const rArc = size * 0.33;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(Math.max(0.02, Math.min(1, progress)), { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, p]);
  const t = useClock(8000);
  const rot = useDerivedValue(() => [{ rotate: t.value * Math.PI * 2 }]);
  const arc = React.useMemo(() => {
    const path = Skia.Path.Make();
    path.addArc({ x: c - rArc, y: c - rArc, width: rArc * 2, height: rArc * 2 }, -90, 359.9);
    return path;
  }, [c, rArc]);
  const dotX = useDerivedValue(() => c + Math.cos(-Math.PI / 2 + p.value * Math.PI * 2) * rArc);
  const dotY = useDerivedValue(() => c + Math.sin(-Math.PI / 2 + p.value * Math.PI * 2) * rArc);
  const [pct, setPct] = React.useState(0);
  useEffect(() => {
    const target = Math.round(Math.min(1, progress) * 100);
    const id = setInterval(() => setPct((v) => (v >= target ? target : v + 1)), 12);
    return () => clearInterval(id);
  }, [progress]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* วงนอกกระจกพาสเทล */}
        <Circle cx={c} cy={c} r={rOuter} opacity={0.55}>
          <SweepGradient c={vec(c, c)} colors={IRIS} transform={rot} origin={vec(c, c)} />
          <BlurMask blur={size * 0.06} style="normal" />
        </Circle>
        <Circle cx={c} cy={c} r={rOuter * 0.92} color="rgba(255,255,255,0.82)" />
        <Circle cx={c} cy={c} r={rArc} style="stroke" strokeWidth={1.5} color="rgba(160,120,220,0.18)" />
        {/* เส้นความคืบหน้า */}
        <SkPath path={arc} style="stroke" strokeWidth={2.5} strokeCap="round" color="#A35DD8" start={0} end={p} />
        <Circle cx={dotX} cy={dotY} r={4.5} color="#FFFFFF" />
        <Circle cx={dotX} cy={dotY} r={4.5} style="stroke" strokeWidth={2} color="#A35DD8" />
        {/* แผ่นกลาง */}
        <Circle cx={c} cy={c} r={rArc * 0.74} color="rgba(255,255,255,0.95)" />
        <Circle cx={c} cy={c} r={rArc * 0.74} opacity={0.35}>
          <SweepGradient c={vec(c, c)} colors={['#F4E8FF', '#FFE9F4', '#E6F0FF', '#F4E8FF']} />
        </Circle>
      </Canvas>
      {children}
      <Animated.Text style={{ position: 'absolute', top: size * 0.04, right: size * 0.06, fontSize: 15, fontWeight: '600', color: '#7A6A8A', fontVariant: ['tabular-nums'] }}>
        {pct}%
      </Animated.Text>
    </View>
  );
}

/** ปุ่มแคปซูลไล่สีรุ้งพาสเทล (ตัวอักษรเข้ม) */
export function IridescentPill({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={['#FFE1D0', '#FFD1EA', '#E6D6FF', '#D6E6FF']}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[{ borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', overflow: 'hidden' }, style]}
    >
      {children}
    </LinearGradient>
  );
}

/** ดอกไม้ AI (ภาพสร้างด้วย Qwen-Image) — หมุนช้าและหายใจ, active = เร็วขึ้นและขยายตามเสียง */
const FLOWER = require('../../assets/ai/flower.png');
export function AIFlower({ size = 120, active, level }: { size?: number; active?: boolean; level?: SharedValue<number> }) {
  const spin = useClock(active ? 6000 : 22000);
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breathe);
  }, [breathe]);
  const st = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }, { scale: 0.94 + breathe.value * 0.06 + (level ? level.value * 0.18 : 0) }],
  }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      <Animated.Image source={FLOWER} style={[{ width: size, height: size }, st]} resizeMode="contain" />
    </View>
  );
}
