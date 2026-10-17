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
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ElementIcon } from './ElementPicker';
import { Sym } from './ios';
import { Avatar, PressableScale, T } from './ui';
import type { Patient } from '../data/mock';
import { statusLabel } from '../data/tones';
import { ELEMENT_PROFILE, ageSamutthan, seasonNow } from '../lib/elements';
import { elementColor } from '../theme';

const MAX_TILT = 9; // องศา

export function PatientCard({ p, avatar, onCall }: { p: Patient; avatar: number; onCall?: () => void }) {
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

  const st = STATUS_DARK[p.status] ?? STATUS_DARK['ติดตามอาการ'];
  const el = elementColor[p.element];
  const glow = ELEMENT_GLOW[p.element] ?? MINT;
  const bmi = p.weight && p.height ? (p.weight / (p.height / 100) ** 2).toFixed(1) : '-';
  const prof = ELEMENT_PROFILE[p.element];
  const ag = ageSamutthan(p.age);
  const ss = seasonNow();
  // เลขประจำตัวบนบัตร (จากรหัสผู้ป่วย) — แสดงแบบเลขบัตร 4-4
  const hn = (p.id.replace(/\D/g, '').slice(-8) || '0').padStart(8, '0');
  const allergic = p.allergies && p.allergies !== 'ไม่มี';
  const chronic = p.chronic && p.chronic !== 'ไม่มี';

  const Glare = () => (
    <Animated.View pointerEvents="none" style={[styles.glare, { width: cw * 0.7, height: ch * 2, top: -ch * 0.5, left: cw * 0.15 }, glareSt]}>
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );

  /** พื้นบัตรสีเข้ม: ไล่เฉดเขียวเกือบดำ + แสงเรืองสีธาตุ + ลายวงกิโยเช่บางๆ */
  const Base = ({ back }: { back?: boolean }) => (
    <>
      <LinearGradient colors={back ? ['#06100C', '#0C1F17', '#050B08'] : ['#0D1D16', '#0A1712', '#050C09']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* แสงเรืองสีธาตุ (ไล่เฉดวงกลมนุ่มๆ) */}
      <Svg width={ch * 1.8} height={ch * 1.8} style={{ position: 'absolute', ...(back ? { left: -ch * 0.7, bottom: -ch * 0.9 } : { right: -ch * 0.6, top: -ch * 0.95 }) }} pointerEvents="none">
        <Defs>
          <RadialGradient id={back ? 'auraB' : 'auraF'} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={glow} stopOpacity={0.34} />
            <Stop offset="0.55" stopColor={glow} stopOpacity={0.1} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={ch * 0.9} cy={ch * 0.9} r={ch * 0.9} fill={`url(#${back ? 'auraB' : 'auraF'})`} />
      </Svg>
      {[0.62, 0.82, 1.02, 1.22].map((k) => (
        <View key={k} style={[styles.guilloche, { width: ch * k * 2, height: ch * k * 2, borderRadius: ch * k, ...(back ? { left: -ch * k, bottom: -ch * k } : { right: -ch * k * 0.95, top: -ch * k * 0.95 }) }]} />
      ))}
      <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }} style={StyleSheet.absoluteFill} />
    </>
  );

  return (
    <View style={{ height: ch + 20, alignItems: 'center' }}>
      <PressableScale haptic="press" scaleTo={0.98} onPress={toggle} accessibilityLabel={flipped ? 'พลิกกลับด้านหน้าบัตร' : 'พลิกดูธาตุเจ้าเรือน'}>
        <Animated.View style={[{ width: cw, height: ch }, tiltSt]}>
          {/* ── ด้านหน้า ── */}
          {/* เงาอยู่ที่แต่ละหน้า หมุนไปพร้อมบัตร (ไม่เหลือเงาค้างเป็นบัตรซ้อน) */}
          <Animated.View style={[styles.faceOuter, frontSt]}>
            <View style={styles.face}>
              <Base />
              <View style={styles.cardHead}>
                <View style={styles.logo}>
                  <Sym name="leaf.fill" size={11} color="#04150E" />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="micro" color="rgba(255,255,255,0.55)" style={styles.brand}>หมอบ้านเชื่อมใจ</T>
                  <T v="caption" color="#FFFFFF" style={{ fontWeight: '700' }}>บัตรผู้ป่วย</T>
                </View>
                {/* โทรหาผู้ป่วย (อยู่บนบัตร) */}
                {onCall ? (
                  <PressableScale haptic="press" scaleTo={0.92} onPress={onCall} hitSlop={8} style={styles.call} accessibilityLabel={`โทรหา ${p.name}`}>
                    <Sym name="phone.fill" size={13} color="#04150E" />
                    <T v="caption" color="#04150E" style={{ fontWeight: '700' }}>โทร</T>
                  </PressableScale>
                ) : null}
              </View>

              <View style={styles.frontBody}>
                <View style={[styles.avatarRing, { borderColor: glow }]}>
                  <Avatar name={p.name} src={avatar} size={ch * 0.32} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <T v="h3" color="#FFFFFF" numberOfLines={2}>{p.name}</T>
                  <View style={[styles.status, { backgroundColor: st.bg, borderColor: st.border }]}>
                    <View style={[styles.statusDot, { backgroundColor: st.fg }]} />
                    <T v="caption" color={st.fg} style={{ fontWeight: '700' }}>{statusLabel(p.status)}</T>
                  </View>
                  <T v="micro" color="rgba(255,255,255,0.45)" style={styles.hn}>HN  {hn.slice(0, 4)} {hn.slice(4)}</T>
                </View>
              </View>

              <View style={styles.stats}>
                <View style={styles.stat}>
                  <T v="micro" color="rgba(255,255,255,0.5)">เพศ · อายุ</T>
                  <T v="title" color="#FFFFFF">{p.sex} {p.age} ปี</T>
                </View>
                <View style={styles.statSep} />
                <View style={styles.stat}>
                  <T v="micro" color="rgba(255,255,255,0.5)">ธาตุเจ้าเรือน</T>
                  <T v="title" color={glow}>{el.label}</T>
                </View>
                <View style={styles.statSep} />
                <View style={styles.stat}>
                  <T v="micro" color="rgba(255,255,255,0.5)">BMI</T>
                  <T v="title" color="#FFFFFF">{bmi}</T>
                </View>
              </View>
              <View style={styles.flipHint}>
                <Sym name="arrow.triangle.2.circlepath" size={11} color="rgba(255,255,255,0.45)" />
              </View>
              <Glare />
            </View>
          </Animated.View>

          {/* ── ด้านหลัง: ธาตุเจ้าเรือน + ข้อควรระวังของผู้ป่วย ── */}
          <Animated.View style={[styles.faceOuter, backSt]}>
            <View style={styles.face}>
              <Base back />
              {/* แถบแม่เหล็กแบบบัตรจริง */}
              <LinearGradient colors={['#000000', '#151A18', '#000000']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.stripe} />
              <View style={styles.backBody}>
                <View style={styles.elWrap}>
                  <ElementIcon el={p.element} active={flipped} size={ch * 0.36} />
                  <T v="subhead" color={glow} center style={{ fontWeight: '700', marginTop: 2 }}>{el.label}</T>
                </View>
                <View style={{ flex: 1, gap: 7 }}>
                  <View>
                    <T v="micro" color="rgba(255,255,255,0.5)">มักมีปัญหา</T>
                    <T v="caption" color="#FFFFFF" numberOfLines={1}>{prof.prone.slice(0, 2).join(' · ')}</T>
                  </View>
                  <View>
                    <T v="micro" color="rgba(255,255,255,0.5)">รสยาที่เหมาะ</T>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                      {prof.tastes.map((t) => (
                        <View key={t} style={[styles.taste, { backgroundColor: `${glow}26` }]}>
                          <T v="micro" color={glow} style={{ fontWeight: '700' }}>รส{t}</T>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View>
                    <T v="micro" color="rgba(255,255,255,0.5)">วัย · ฤดู</T>
                    <T v="caption" color="#FFFFFF" numberOfLines={1}>{ag.stage} ({ag.dosha.split(' ')[0]}) · {ss.name.split(' ')[0]}</T>
                  </View>
                  {allergic || chronic ? (
                    <View style={styles.alertRow}>
                      <Sym name="exclamationmark.triangle.fill" size={11} color="#FF8A7A" />
                      <T v="micro" color="#FFB4A8" numberOfLines={1} style={{ flex: 1, fontWeight: '700' }}>
                        {[allergic ? `แพ้ ${p.allergies.replace(/^แพ้\s*/, '')}` : '', chronic ? p.chronic : ''].filter(Boolean).join(' · ')}
                      </T>
                    </View>
                  ) : null}
                </View>
              </View>
              <Glare />
            </View>
          </Animated.View>
        </Animated.View>
      </PressableScale>
    </View>
  );
}

const MINT = '#7CF0A8';
/** สีธาตุบนพื้นเข้ม (สว่างขึ้นจากสีบนพื้นขาว) */
const ELEMENT_GLOW: Record<Patient['element'], string> = { ดิน: '#E8B26A', น้ำ: '#6CCBF2', ลม: '#8FE3C8', ไฟ: '#FF8A6A' };
/** สถานะบนพื้นเข้ม */
const STATUS_DARK: Record<Patient['status'], { fg: string; bg: string; border: string }> = {
  นัดวันนี้: { fg: '#7CF0A8', bg: 'rgba(124,240,168,0.12)', border: 'rgba(124,240,168,0.3)' },
  ติดตามอาการ: { fg: '#F5C46B', bg: 'rgba(245,196,107,0.12)', border: 'rgba(245,196,107,0.3)' },
  หายดี: { fg: '#9BE38A', bg: 'rgba(155,227,138,0.12)', border: 'rgba(155,227,138,0.3)' },
  'ส่งต่อ รพ.สต.': { fg: '#FF8A7A', bg: 'rgba(255,138,122,0.13)', border: 'rgba(255,138,122,0.32)' },
};

const styles = StyleSheet.create({
  call: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: MINT },
  faceOuter: { ...StyleSheet.absoluteFillObject, borderRadius: 24, backfaceVisibility: 'hidden', boxShadow: '0px 14px 30px rgba(4,21,14,0.35)' },
  face: { flex: 1, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', backfaceVisibility: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  glare: { position: 'absolute' },
  guilloche: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 18, paddingTop: 16 },
  brand: { letterSpacing: 0.6, fontWeight: '600' },
  logo: { width: 26, height: 26, borderRadius: 13, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' },
  frontBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18 },
  avatarRing: { padding: 3, borderRadius: 999, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  hn: { letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginBottom: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statSep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.14)' },
  flipHint: { position: 'absolute', right: 14, bottom: 14 + 58, opacity: 0.8 },
  stripe: { position: 'absolute', left: 0, right: 0, top: 18, height: 30, opacity: 0.85 },
  backBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingTop: 52, paddingBottom: 16 },
  elWrap: { alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  taste: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,138,122,0.12)' },
});
