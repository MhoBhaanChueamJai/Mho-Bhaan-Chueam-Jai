/**
 * การ์ดสมุนไพรแนะนำแบบซ้อนชั้น (stack) 3 ใบ — ใบบนสุดปัดซ้าย/ขวาเพื่อส่งไปไว้ท้ายกอง แตะเพื่อดูรายละเอียด
 * ใบที่อยู่ด้านหลังย่อลงและโผล่ขึ้นด้านบนทีละชั้น ให้เห็นเป็นกองการ์ด
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { Herb } from '../data/herbs';
import type { HerbRec } from '../lib/weatherHerbs';
import { elevation } from '../theme';
import { Sym } from './ios';
import { T, useHaptic } from './ui';

const CARD_H = 214;
/** สีบัตรตามธาตุ (ไล่เฉดเข้ม) */
const PASS: Record<Herb['element'], { bg: [string, string] }> = {
  ดิน: { bg: ['#B5793A', '#7A4A1E'] },
  น้ำ: { bg: ['#2E8B67', '#145A43'] },
  ลม: { bg: ['#2F8AA6', '#185A73'] },
  ไฟ: { bg: ['#D4553F', '#93281C'] },
};
const STEP = 18; // ระยะที่บัตรชั้นถัดไปโผล่ด้านบน (แบบ Wallet)

function Card({ r, depth, n, onSwipe }: { r: HerbRec; depth: number; n: number; onSwipe: () => void }) {
  const h = useHaptic();
  const x = useSharedValue(0);
  const pass = PASS[r.herb.element] ?? PASS['น้ำ'];
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
        {/* บัตรแบบ Apple Wallet: สีตามธาตุ ไล่เฉด + ลายใบไม้จางๆ */}
        <LinearGradient colors={pass.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.watermark}>
          <Sym name="leaf.fill" size={150} color="rgba(255,255,255,0.07)" />
        </View>
        {/* หัวบัตร (ส่วนที่โผล่เมื่อซ้อน) */}
        <View style={styles.head}>
          <View style={styles.brand}>
            <Sym name="leaf.fill" size={12} color="#FFFFFF" />
            <T v="caption" color="#FFFFFF" style={{ fontWeight: '700' }}>สมุนไพรแนะนำ</T>
          </View>
          <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
            <T v="micro" color="rgba(255,255,255,0.7)" style={{ fontWeight: '600' }}>ช่วยป้องกัน</T>
            <T v="subhead" color="#FFFFFF" numberOfLines={1} style={{ fontWeight: '700' }}>{r.risk}</T>
          </View>
        </View>
        {/* ชื่อ + รูปวงกลม */}
        <View style={styles.mid}>
          <View style={{ flex: 1 }}>
            <T v="h1" color="#FFFFFF" numberOfLines={1}>{r.herb.name}</T>
            <T v="caption" color="rgba(255,255,255,0.75)" numberOfLines={1} style={{ fontStyle: 'italic' }}>{r.herb.sci}</T>
          </View>
          <Image source={r.herb.image} style={styles.photo} contentFit="cover" transition={200} />
        </View>
        {/* ช่องข้อมูลแบบบัตร */}
        <View style={styles.fields}>
          {[
            { k: 'รสยา', v: r.herb.taste },
            { k: 'ธาตุ', v: r.herb.element },
            { k: 'ส่วนที่ใช้', v: r.herb.part.split(/[,，]/)[0] },
          ].map((f) => (
            <View key={f.k} style={{ flex: 1 }}>
              <T v="micro" color="rgba(255,255,255,0.7)" style={{ fontWeight: '600' }}>{f.k}</T>
              <T v="subhead" color="#FFFFFF" numberOfLines={1} style={{ fontWeight: '700' }}>{f.v}</T>
            </View>
          ))}
        </View>
        <View style={styles.tipRow}>
          <T v="caption" color="rgba(255,255,255,0.9)" numberOfLines={1} style={{ flex: 1 }}>{r.tip}</T>
          <Sym name="chevron.right" size={11} color="rgba(255,255,255,0.8)" weight="semibold" />
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
  card: { position: 'absolute', left: 0, right: 0, bottom: 0, height: CARD_H, transformOrigin: 'center top', borderRadius: 22, borderCurve: 'continuous', overflow: 'hidden', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  watermark: { position: 'absolute', right: -24, bottom: -30, transform: [{ rotate: '-18deg' }] },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, height: 34 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 2 },
  mid: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  photo: { width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(0,0,0,0.2)' },
  fields: { flexDirection: 'row', gap: 10, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.3)' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 'auto' },
});
