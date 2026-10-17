/**
 * โครงสร้างสมุนไพรทั้งต้น — ภาพพฤกษศาสตร์ + ป้ายชี้ส่วนประกอบ (เส้นนำ + จุดเต้น) + เอียงเครื่อง/ลากนิ้วเห็นมิติ
 * แตะป้ายหรือจุด → ดูคำอธิบายส่วนนั้น และการใช้เป็นยา (ส่วนที่ใช้เป็นยาเป็นสีเขียวเด่น)
 * มิติ: ภาพเอียงตามเครื่อง (DeviceMotion) · ป้ายลอยเหนือภาพเคลื่อนมากกว่าภาพ (parallax) · เงาเลื่อนตามมุม
 */
import { Image } from 'expo-image';
import { DeviceMotion } from 'expo-sensors';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import type { Anatomy } from '../data/herbAnatomy';
import { palette } from '../theme';
import { Sym, ios } from './ios';
import { PressableScale, T } from './ui';

const RATIO = 1052 / 720;
const MED = '#1E8A5E'; // ส่วนที่ใช้เป็นยา
const PLAIN = '#5B6B80';

/** จุดเต้นบนส่วนประกอบ */
function Pulse({ x, y, color, on }: { x: number; y: number; color: string; on: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [p]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - p.value), transform: [{ scale: 1 + p.value * 1.6 }] }));
  return (
    <View pointerEvents="none" style={[styles.dotWrap, { left: x - 12, top: y - 12 }]}>
      <Animated.View style={[styles.ring, { borderColor: color }, ring]} />
      <View style={[styles.dot, { backgroundColor: color, transform: [{ scale: on ? 1.25 : 1 }] }]} />
    </View>
  );
}

export function HerbAnatomy({ data }: { data: Anatomy }) {
  const { width: SW } = useWindowDimensions();
  const W = SW - 32 - 36; // กว้างภายในการ์ด (ขอบการ์ด 18)
  const H = W * RATIO;
  const [sel, setSel] = useState(() => Math.max(0, data.parts.findIndex((p) => p.medicinal)));

  // ── ตำแหน่งป้าย: ซ้าย/ขวาตามฝั่งของจุด เรียงตามแนวตั้งไม่ให้ทับกัน ──
  const labels = useMemo(() => {
    const pts = data.parts.map((p, i) => ({ i, px: p.x * W, py: p.y * H, side: p.x < 0.5 ? ('L' as const) : ('R' as const) }));
    const place = (side: 'L' | 'R') => {
      const g = pts.filter((p) => p.side === side).sort((a, b) => a.py - b.py);
      let last = -999;
      return g.map((p) => {
        const ly = Math.min(H - 20, Math.max(p.py, last + 34, 18));
        last = ly;
        return { ...p, ly };
      });
    };
    return [...place('L'), ...place('R')];
  }, [data, W, H]);

  // ── มิติ: เอียงตามเครื่อง + ลากนิ้ว ──
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const drag = useSharedValue(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    DeviceMotion.setUpdateInterval(50);
    const sub = DeviceMotion.addListener((m) => {
      if (drag.value) return;
      const beta = m.rotation?.beta ?? 0; // ก้ม-เงย
      const gamma = m.rotation?.gamma ?? 0; // เอียงซ้าย-ขวา
      rx.value = withSpring(Math.max(-10, Math.min(10, -(beta - 0.9) * 14)), { damping: 20 });
      ry.value = withSpring(Math.max(-12, Math.min(12, gamma * 16)), { damping: 20 });
    });
    return () => sub.remove();
  }, [rx, ry, drag]);
  const pan = Gesture.Pan()
    .onBegin(() => {
      drag.value = 1;
    })
    .onUpdate((e) => {
      ry.value = Math.max(-14, Math.min(14, e.translationX / 8));
      rx.value = Math.max(-12, Math.min(12, -e.translationY / 8));
    })
    .onFinalize(() => {
      drag.value = 0;
      rx.value = withSpring(0);
      ry.value = withSpring(0);
    });
  const plate = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }],
    boxShadow: `${-ry.value * 0.8}px ${10 + rx.value * 0.8}px 24px rgba(40,30,20,0.22)`,
  }));
  // ป้ายลอยเหนือภาพ → เลื่อนมากกว่า (parallax)
  const float = useAnimatedStyle(() => ({ transform: [{ translateX: ry.value * 0.9 }, { translateY: -rx.value * 0.9 }] }));

  const p = data.parts[sel];
  return (
    <View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.plate, { width: W, height: H, backgroundColor: data.bg }, plate]}>
          <Image source={data.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          <Animated.View style={[StyleSheet.absoluteFill, float]}>
            {/* เส้นนำจากจุดไปป้าย */}
            <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
              {labels.map((l) => {
                const part = data.parts[l.i];
                const c = part.medicinal ? MED : PLAIN;
                const ex = l.side === 'L' ? 10 + 8 : W - 18;
                return (
                  <React.Fragment key={l.i}>
                    <Line x1={l.px} y1={l.py} x2={ex} y2={l.ly} stroke={c} strokeWidth={sel === l.i ? 2 : 1.2} strokeOpacity={sel === l.i ? 0.95 : 0.6} />
                    <Circle cx={ex} cy={l.ly} r={2.5} fill={c} />
                  </React.Fragment>
                );
              })}
            </Svg>
            {labels.map((l) => {
              const part = data.parts[l.i];
              const c = part.medicinal ? MED : PLAIN;
              return <Pulse key={`d${l.i}`} x={l.px} y={l.py} color={c} on={sel === l.i} />;
            })}
            {labels.map((l) => {
              const part = data.parts[l.i];
              const on = sel === l.i;
              const c = part.medicinal ? MED : PLAIN;
              return (
                <PressableScale
                  key={`c${l.i}`}
                  haptic="select"
                  scaleTo={0.94}
                  onPress={() => setSel(l.i)}
                  style={[styles.chip, l.side === 'L' ? { left: 6 } : { right: 6 }, { top: l.ly - 14 }, on && { backgroundColor: c, borderColor: c }]}
                  accessibilityLabel={`${part.name}${part.medicinal ? ' ใช้เป็นยา' : ''}`}
                >
                  {part.medicinal ? <Sym name="leaf.fill" size={10} color={on ? '#FFFFFF' : MED} /> : null}
                  <T v="caption" color={on ? '#FFFFFF' : c} style={{ fontWeight: '700' }}>{part.name}</T>
                </PressableScale>
              );
            })}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* คำอธิบายส่วนที่เลือก */}
      {p ? (
        <Animated.View key={sel} entering={FadeIn.duration(220)} style={styles.info}>
          <View style={styles.infoHead}>
            <T v="title">{p.name}</T>
            {p.medicinal ? (
              <View style={styles.medPill}>
                <Sym name="leaf.fill" size={10} color={MED} />
                <T v="micro" color={MED} style={{ fontWeight: '700' }}>ใช้เป็นยา</T>
              </View>
            ) : null}
          </View>
          <T v="body" color={palette.inkSoft} style={{ lineHeight: 24 }}>{p.desc}</T>
          {p.use ? (
            <View style={styles.useRow}>
              <Sym name="cross.case.fill" size={13} color={MED} />
              <T v="subhead" color={palette.ink} style={{ flex: 1 }}>{p.use}</T>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
      <View style={styles.hint}>
        <Sym name="hand.draw" size={12} color={ios.tertiary} />
        <T v="caption" color={ios.tertiary}>แตะป้ายเพื่อดูรายละเอียด · เอียงเครื่องหรือลากภาพเพื่อดูมิติ</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { alignSelf: 'center', borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' },
  dotWrap: { position: 'absolute', width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: '#FFFFFF' },
  chip: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: 'rgba(60,60,67,0.12)', boxShadow: '0px 2px 6px rgba(0,0,0,0.12)' },
  info: { marginTop: 14, gap: 6 },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#E1F3EA' },
  useRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 2, padding: 10, borderRadius: 12, backgroundColor: palette.mint },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
});
