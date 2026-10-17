/**
 * การ์ดสมุนไพรแนะนำแบบซ้อนชั้น (stack) 3 ใบ — ใบบนสุดปัดซ้าย/ขวาเพื่อส่งไปไว้ท้ายกอง แตะเพื่อดูรายละเอียด
 * ใบที่อยู่ด้านหลังย่อลงและโผล่ขึ้นด้านบนทีละชั้น ให้เห็นเป็นกองการ์ด
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { tasteTone } from '../data/herbs';
import type { HerbRec } from '../lib/weatherHerbs';
import { elevation, palette } from '../theme';
import { Sym, ios } from './ios';
import { T, useHaptic } from './ui';

const CARD_H = 196;
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
    opacity: withTiming(depth > 2 ? 0 : 1 - depth * 0.12, { duration: 200 }),
  }));
  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View style={[styles.card, elevation.e2, { zIndex: n - depth }, st]} accessibilityLabel={`${r.herb.name} ${r.risk}`}>
        <View style={styles.top}>
          <Image source={r.herb.image} style={styles.img} contentFit="cover" transition={200} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={styles.riskPill}>
              <Sym name="shield.lefthalf.filled" size={11} color="#B4471F" />
              <T v="micro" color="#B4471F" numberOfLines={1} style={{ fontWeight: '700', flexShrink: 1 }}>ป้องกัน {r.risk}</T>
            </View>
            <View style={styles.nameRow}>
              <T v="h3" numberOfLines={1} style={{ flexShrink: 1 }}>{r.herb.name}</T>
              <View style={[styles.taste, { backgroundColor: tone.bg }]}>
                <T v="micro" color={tone.fg} style={{ fontWeight: '700' }}>รส{r.herb.taste}</T>
              </View>
            </View>
            <T v="caption" color={ios.secondary} numberOfLines={2}>{r.reason}</T>
          </View>
        </View>
        <View style={styles.tip}>
          <Sym name="leaf.fill" size={12} color={palette.primary} />
          <T v="subhead" color={palette.ink} numberOfLines={2} style={{ flex: 1 }}>{r.tip}</T>
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
      {/* ตัวบอกลำดับ */}
      <View style={styles.dots}>
        {recs.map((r, i) => (
          <View key={r.herb.id} style={[styles.dot, order[0] === i && styles.dotOn]} />
        ))}
        <T v="caption" color={ios.tertiary} style={{ marginLeft: 6 }}>ปัดเพื่อดูตัวถัดไป</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', left: 0, right: 0, bottom: 0, height: CARD_H, transformOrigin: 'center top', padding: 14, gap: 12, borderRadius: 26, borderCurve: 'continuous', backgroundColor: palette.surface },
  top: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  img: { width: 84, height: 84, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.bgDeep },
  riskPill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#FCE8DF' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taste: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999 },
  tip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: palette.mint },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(60,60,67,0.2)' },
  dotOn: { width: 16, backgroundColor: palette.primary },
});
