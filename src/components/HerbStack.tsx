/**
 * การ์ดสมุนไพรแนะนำแบบซ้อนชั้น (stack) 3 ใบ — ใบบนสุดปัดซ้าย/ขวาเพื่อส่งไปไว้ท้ายกอง แตะเพื่อดูรายละเอียด
 * ใบที่อยู่ด้านหลังย่อลงและโผล่ขึ้นด้านบนทีละชั้น ให้เห็นเป็นกองการ์ด
 */
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { tasteTone } from '../data/herbs';
import type { HerbRec } from '../lib/weatherHerbs';
import { elevation, palette } from '../theme';
import { Sym } from './ios';
import { T, useHaptic } from './ui';

const CARD_H = 220;
const STEP = 14; // ระยะที่การ์ดชั้นถัดไปโผล่ด้านบน

function Card({ r, depth, n, onSwipe }: { r: HerbRec; depth: number; n: number; onSwipe: () => void }) {
  const h = useHaptic();
  const x = useSharedValue(0);
  const tone = tasteTone[r.herb.taste];
  const pan = Gesture.Pan()
    .enabled(depth === 0)
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      x.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 90 || Math.abs(e.velocityX) > 700) {
        const dir = Math.sign(e.translationX || e.velocityX);
        x.value = withTiming(dir * 420, { duration: 200 }, () => {
          runOnJS(onSwipe)();
          x.value = 0;
        });
      } else x.value = withSpring(0, { damping: 18 });
    });
  const tap = Gesture.Tap()
    .enabled(depth === 0)
    .onEnd(() => {
      runOnJS(h.select)();
      runOnJS(router.push)(`/herb/${r.herb.id}`);
    });
  const st = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { rotate: `${x.value / 28}deg` },
      { translateY: withSpring(-depth * STEP, { damping: 16 }) }, // ใบหลังโผล่ด้านบน
      { scale: withSpring(1 - depth * 0.05, { damping: 16 }) },
    ],
    opacity: withTiming(depth > 2 ? 0 : 1, { duration: 200 }), // การ์ดทึบ ไม่โปร่ง
  }));
  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View style={[styles.card, elevation.e2, { zIndex: n - depth }, st]} accessibilityLabel={`${r.herb.name} ${r.risk}`}>
        {/* ภาพเต็มใบ + ไล่เงา */}
        <Image source={r.herb.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        <LinearGradient colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0)', 'rgba(4,18,10,0.9)']} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} />
        {/* มุมบน: ป้องกันอะไร · รสยา */}
        <View style={styles.topRow}>
          <View style={styles.glassPill}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Sym name="shield.lefthalf.filled" size={11} color="#FFD5C2" />
            <T v="caption" color="#FFFFFF" numberOfLines={1} style={{ fontWeight: '700', flexShrink: 1 }}>ป้องกัน {r.risk}</T>
          </View>
          <View style={[styles.glassPill, { backgroundColor: `${tone.fg}CC` }]}>
            <T v="caption" color="#FFFFFF" style={{ fontWeight: '700' }}>รส{r.herb.taste}</T>
          </View>
        </View>
        {/* ล่าง: ชื่อ · เหตุผล · วิธีใช้ */}
        <View style={styles.bottom}>
          <T v="h2" color="#FFFFFF" numberOfLines={1}>{r.herb.name}</T>
          <T v="subhead" color="rgba(255,255,255,0.85)" numberOfLines={1}>{r.reason}</T>
          <View style={styles.tip}>
            <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
            <Sym name="leaf.fill" size={13} color="#BFF0C9" />
            <T v="subhead" color="#FFFFFF" numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>{r.tip}</T>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export function HerbStack({ recs }: { recs: HerbRec[] }) {
  const h = useHaptic();
  const [order, setOrder] = useState(() => recs.map((_, i) => i));
  const n = recs.length;
  // ปัดใบบนสุด → ไปไว้ท้ายกอง
  const next = () => {
    h.select();
    setOrder((o) => [...o.slice(1), o[0]]);
  };
  return (
    <View>
      <View style={{ height: CARD_H + STEP * Math.min(n - 1, 2) }}>
        {order
          .map((idx, depth) => ({ idx, depth }))
          .reverse()
          .map(({ idx, depth }) => (
            <Card key={recs[idx].herb.id} r={recs[idx]} depth={depth} n={n} onSwipe={next} />
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', left: 0, right: 0, bottom: 0, height: CARD_H, transformOrigin: 'center top', borderRadius: 28, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: palette.bgDeep },
  topRow: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  glassPill: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)' },
  bottom: { position: 'absolute', left: 14, right: 14, bottom: 14, gap: 2 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 12, height: 38, borderRadius: 19, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)' },
});
