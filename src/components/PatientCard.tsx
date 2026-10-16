/**
 * บัตรผู้ป่วย 3 มิติ
 * - ด้านหน้า: รูป ชื่อ สถานะ เลขประจำตัว ข้อมูลสรุป (เพศ/อายุ · ธาตุ · BMI) แถบโฮโลแกรม
 * - ด้านหลัง: ไอคอนธาตุพร้อมแอนิเมชัน + วิเคราะห์ธาตุเจ้าเรือน
 * - แตะเพื่อพลิกบัตร (หมุนรอบแกน Y แบบมีมุมมอง)
 * - เอียงมือถือ (DeviceMotion): บัตรเอียงตาม แสงสะท้อนบนผิวบัตรเลื่อนตามมุมแสง
 */
import { DeviceMotion } from 'expo-sensors';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ElementIcon } from './ElementPicker';
import { Sym } from './ios';
import { Avatar, PressableScale, T } from './ui';
import type { Patient } from '../data/mock';
import { statusLabel, statusTone } from '../data/tones';
import { ELEMENT_PROFILE, ageSamutthan, seasonNow } from '../lib/elements';
import { elementColor, palette } from '../theme';

const MAX_TILT = 9; // องศา

export function PatientCard({ p, avatar }: { p: Patient; avatar: number }) {
  const { width: W } = useWindowDimensions();
  const cw = W - 40;
  const ch = Math.round(cw / 1.42);
  const [flipped, setFlipped] = useState(false);

  // ── เอียงตามมือถือ ──
  const tx = useSharedValue(0); // เอียงซ้ายขวา (-1..1)
  const ty = useSharedValue(0); // เอียงหน้าหลัง (-1..1)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let base: { b: number; g: number } | null = null;
    DeviceMotion.setUpdateInterval(33);
    const sub = DeviceMotion.addListener((m) => {
      const r = m.rotation;
      if (!r) return;
      // จำท่าถือเริ่มต้นไว้เป็นจุดศูนย์ (คนถือเอียงไม่เท่ากัน)
      if (!base) base = { b: r.beta, g: r.gamma };
      // ค่อยๆ เลื่อนจุดศูนย์ตามท่าถือใหม่ (ถือนิ่งนาน → กลับกลาง)
      base = { b: base.b + (r.beta - base.b) * 0.01, g: base.g + (r.gamma - base.g) * 0.01 };
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      tx.value = withSpring(clamp((r.gamma - base.g) / 0.45), { damping: 18, stiffness: 120 });
      ty.value = withSpring(clamp((r.beta - base.b) / 0.45), { damping: 18, stiffness: 120 });
    });
    return () => sub.remove();
  }, [tx, ty]);

  // ── พลิกบัตร ──
  const flip = useSharedValue(0);
  const toggle = () => {
    setFlipped((f) => !f);
    flip.value = withTiming(flipped ? 0 : 1, { duration: 650, easing: Easing.inOut(Easing.cubic) });
  };

  const tiltSt = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateX: `${-ty.value * MAX_TILT}deg` }, { rotateY: `${tx.value * MAX_TILT}deg` }],
  }));
  const frontSt = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180}deg` }, { scale: 1 - Math.sin(flip.value * Math.PI) * 0.04 }],
    opacity: flip.value < 0.5 ? 1 : 0,
  }));
  const backSt = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180 - 180}deg` }, { scale: 1 - Math.sin(flip.value * Math.PI) * 0.04 }],
    opacity: flip.value >= 0.5 ? 1 : 0,
  }));
  // แสงสะท้อน: แถบแสงเลื่อนตามมุมเอียง
  const glareSt = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(tx.value, [-1, 1], [-cw * 0.55, cw * 0.55]) }, { translateY: interpolate(ty.value, [-1, 1], [-ch * 0.35, ch * 0.35]) }, { rotate: '-20deg' }],
    opacity: 0.55 + Math.abs(tx.value) * 0.25,
  }));

  const st = statusTone[p.status];
  const el = elementColor[p.element];
  const bmi = p.weight && p.height ? (p.weight / (p.height / 100) ** 2).toFixed(1) : '-';
  const prof = ELEMENT_PROFILE[p.element];
  const ag = ageSamutthan(p.age);
  const ss = seasonNow();

  const Glare = () => (
    <Animated.View pointerEvents="none" style={[styles.glare, { width: cw * 0.7, height: ch * 2, top: -ch * 0.5, left: cw * 0.15 }, glareSt]}>
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );

  return (
    <View style={{ height: ch + 20, alignItems: 'center' }}>
      <PressableScale haptic="press" scaleTo={0.98} onPress={toggle} accessibilityLabel={flipped ? 'พลิกกลับด้านหน้าบัตร' : 'พลิกดูธาตุเจ้าเรือน'}>
        <Animated.View style={[{ width: cw, height: ch }, styles.cardShadow, tiltSt]}>
          {/* ── ด้านหน้า ── */}
          <Animated.View style={[styles.face, frontSt]}>
            <LinearGradient colors={['#FFFFFF', '#F2FAF6', '#E3F2EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            {/* ลายวงจาง + แถบโฮโลแกรม */}
            <View style={[styles.ring, { width: ch * 1.3, height: ch * 1.3, right: -ch * 0.45, top: -ch * 0.35 }]} />
            <LinearGradient colors={['rgba(124,240,168,0.0)', 'rgba(124,240,168,0.35)', 'rgba(122,92,200,0.25)', 'rgba(224,176,48,0.3)', 'rgba(124,240,168,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.holo} />
            <View style={styles.cardHead}>
              <View style={styles.logo}>
                <Sym name="leaf.fill" size={12} color="#FFFFFF" />
              </View>
              <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '700', flex: 1 }}>บัตรผู้ป่วย · หมอบ้านเชื่อมใจ</T>
            </View>
            <View style={styles.frontBody}>
              <View style={styles.avatarRing}>
                <Avatar name={p.name} src={avatar} size={ch * 0.36} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <T v="h3" numberOfLines={2}>{p.name}</T>
                <View style={[styles.status, { backgroundColor: st.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: st.fg }]} />
                  <T v="caption" color={st.fg} style={{ fontWeight: '700' }}>{statusLabel(p.status)}</T>
                </View>
              </View>
            </View>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <T v="micro" color="rgba(31,42,36,0.5)">เพศ · อายุ</T>
                <T v="title">{p.sex} {p.age} ปี</T>
              </View>
              <View style={styles.statSep} />
              <View style={styles.stat}>
                <T v="micro" color="rgba(31,42,36,0.5)">ธาตุเจ้าเรือน</T>
                <T v="title" color={el.fg}>{el.label}</T>
              </View>
              <View style={styles.statSep} />
              <View style={styles.stat}>
                <T v="micro" color="rgba(31,42,36,0.5)">BMI</T>
                <T v="title">{bmi}</T>
              </View>
            </View>
            <View style={styles.flipHint}>
              <Sym name="arrow.triangle.2.circlepath" size={11} color="rgba(31,42,36,0.4)" />
            </View>
            <Glare />
          </Animated.View>

          {/* ── ด้านหลัง: ธาตุเจ้าเรือน ── */}
          <Animated.View style={[styles.face, backSt]}>
            <LinearGradient colors={['#04150E', '#0B3B28', '#062218']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={[styles.ring, { width: ch * 1.2, height: ch * 1.2, left: -ch * 0.5, bottom: -ch * 0.5, borderColor: 'rgba(124,240,168,0.06)' }]} />
            <View style={styles.backBody}>
              <View style={styles.elWrap}>
                <ElementIcon el={p.element} active={flipped} size={ch * 0.42} />
                <T v="title" color="#FFFFFF" center style={{ marginTop: 2 }}>{el.label}</T>
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <View>
                  <T v="micro" color="rgba(255,255,255,0.5)">มักมีปัญหา</T>
                  <T v="caption" color="#FFFFFF" numberOfLines={2}>{prof.prone.slice(0, 2).join(' · ')}</T>
                </View>
                <View>
                  <T v="micro" color="rgba(255,255,255,0.5)">รสยาที่เหมาะ</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                    {prof.tastes.map((t) => (
                      <View key={t} style={styles.taste}>
                        <T v="micro" color="#7CF0A8">รส{t}</T>
                      </View>
                    ))}
                  </View>
                </View>
                <View>
                  <T v="micro" color="rgba(255,255,255,0.5)">วัย · ฤดู</T>
                  <T v="caption" color="#FFFFFF" numberOfLines={2}>{ag.stage} ({ag.dosha.split(' ')[0]}) · {ss.name.split(' ')[0]}</T>
                </View>
              </View>
            </View>
            <Glare />
          </Animated.View>
        </Animated.View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  // เงาเดียว นุ่ม (ไม่ซ้อน)
  cardShadow: { borderRadius: 24, boxShadow: '0px 10px 24px rgba(11,61,38,0.14)' },
  face: { ...StyleSheet.absoluteFillObject, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', backfaceVisibility: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.8)' },
  glare: { position: 'absolute' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 18, borderColor: 'rgba(20,144,92,0.06)' },
  holo: { position: 'absolute', left: 0, right: 0, top: 48, height: 3 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 16 },
  logo: { width: 22, height: 22, borderRadius: 11, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  frontBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18 },
  avatarRing: { padding: 3, borderRadius: 999, backgroundColor: '#FFFFFF', boxShadow: '0px 4px 12px rgba(11,61,38,0.18)' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  stats: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginBottom: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.75)' },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statSep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(20,80,50,0.15)' },
  flipHint: { position: 'absolute', right: 14, bottom: 14 + 58, opacity: 0.8 },
  backBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  elWrap: { alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)' },
  taste: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(124,240,168,0.14)' },
});
