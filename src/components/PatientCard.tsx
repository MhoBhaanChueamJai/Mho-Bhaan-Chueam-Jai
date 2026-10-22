/**
 * บัตรผู้ป่วย 3 มิติ — สีบัตรตามธาตุเจ้าเรือน (ดิน=น้ำตาลทอง · น้ำ=น้ำเงินคราม · ลม=เขียวหยก · ไฟ=แดงชาด)
 * มิติ: ลายประจำยามสีทองแบบฟอยล์ (เลื่อนสวนการเอียง) · แถบโฮโลแกรมรุ้งไหลตามมุมเอียง · ขอบโลหะทอง · รูปผู้ป่วยลอยเหนือพื้น
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
import Svg, { Circle, Defs, G, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
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
  // จอกว้าง: บัตรไม่ใหญ่เกิน 560 (สัดส่วนบัตรจริง) อยู่กึ่งกลาง
  const cw = Math.min(W - 40, 560);
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
    opacity: 0.5 + Math.abs(tx.value) * 0.3,
  }));
  // ชั้นลายพื้นเลื่อนสวนทางการเอียง (ลึกกว่าผิวบัตร) · รูปผู้ป่วยเลื่อนตาม (ลอยเหนือผิว)
  const deepSt = useAnimatedStyle(() => ({ transform: [{ translateX: -tx.value * 7 }, { translateY: -ty.value * 5 }] }));
  const liftSt = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value * 5 }, { translateY: ty.value * 4 }] }));
  // โฮโลแกรม: แถบรุ้งไหลข้ามบัตรตามมุมเอียง สีเข้มขึ้นเมื่อเอียงมาก
  const holoSt = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(tx.value, [-1, 1], [-cw * 0.7, cw * 0.7]) }, { rotate: '24deg' }],
    opacity: 0.22 + Math.abs(tx.value) * 0.35 + Math.abs(ty.value) * 0.15,
  }));

  const th = THEME[p.element] ?? THEME['น้ำ'];
  const st = STATUS_DARK[p.status] ?? STATUS_DARK['ติดตามอาการ'];
  const el = elementColor[p.element];
  const bmi = p.weight && p.height ? (p.weight / (p.height / 100) ** 2).toFixed(1) : '-';
  const prof = ELEMENT_PROFILE[p.element];
  const ag = ageSamutthan(p.age);
  const ss = seasonNow();
  const allergic = p.allergies && p.allergies !== 'ไม่มี';
  // เบอร์โทรบนบัตร (แบบ 081-234-5678)
  const tel = (p.phone ?? '').replace(/\D/g, '');
  const phone = tel.length === 10 ? `${tel.slice(0, 3)}-${tel.slice(3, 6)}-${tel.slice(6)}` : tel.length >= 9 ? tel : '';
  const chronic = p.chronic && p.chronic !== 'ไม่มี';

  const Glare = () => (
    <Animated.View pointerEvents="none" style={[styles.glare, { width: cw * 0.6, height: ch * 2, top: -ch * 0.5, left: cw * 0.2 }, glareSt]}>
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );

  /** พื้นบัตร: ไล่เฉดสีธาตุ + แสงเรือง + ลายประจำยามทอง (ชั้นลึก) + กรอบลายทอง + โฮโลแกรม */
  const Base = ({ back }: { back?: boolean }) => (
    <>
      <LinearGradient colors={th.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, { margin: -12 }, deepSt]} pointerEvents="none">
        <Svg width={cw + 24} height={ch + 24}>
          <Defs>
            <RadialGradient id={`aura${back ? 'B' : 'F'}`} cx={back ? '15%' : '85%'} cy={back ? '90%' : '10%'} r="70%">
              <Stop offset="0" stopColor={th.glow} stopOpacity={0.55} />
              <Stop offset="0.5" stopColor={th.glow} stopOpacity={0.12} />
              <Stop offset="1" stopColor={th.glow} stopOpacity={0} />
            </RadialGradient>
            {/* ลายดอกประจำยาม (กลีบ 4 ทิศ + เม็ดกลาง) ซ้ำเป็นตาราง */}
            <Pattern id={`thai${back ? 'B' : 'F'}`} width={34} height={34} patternUnits="userSpaceOnUse">
              {[0, 90, 180, 270].map((r) => (
                <Path key={r} d="M17 17 C 13.5 13.5 13.5 8 17 5 C 20.5 8 20.5 13.5 17 17 Z" fill="none" stroke={GOLD} strokeWidth={0.7} transform={`rotate(${r} 17 17)`} />
              ))}
              <Circle cx={17} cy={17} r={1.6} fill={GOLD} />
              <Circle cx={0} cy={0} r={1.1} fill={GOLD} />
              <Circle cx={34} cy={0} r={1.1} fill={GOLD} />
              <Circle cx={0} cy={34} r={1.1} fill={GOLD} />
              <Circle cx={34} cy={34} r={1.1} fill={GOLD} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={cw + 24} height={ch + 24} fill={`url(#aura${back ? 'B' : 'F'})`} />
          <Rect x={0} y={0} width={cw + 24} height={ch + 24} fill={`url(#thai${back ? 'B' : 'F'})`} opacity={back ? 0.16 : 0.12} />
        </Svg>
      </Animated.View>
      {/* ไล่มืดด้านล่าง ให้ตัวหนังสือเด่น */}
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']} start={{ x: 0, y: 0.35 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* กรอบลายทองด้านใน + ดอกประจำยามที่มุม */}
      <Svg width={cw} height={ch} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Rect x={7} y={7} width={cw - 14} height={ch - 14} rx={17} fill="none" stroke={GOLD} strokeOpacity={0.45} strokeWidth={0.8} />
        <Rect x={10.5} y={10.5} width={cw - 21} height={ch - 21} rx={14} fill="none" stroke={GOLD} strokeOpacity={0.2} strokeWidth={0.6} />
        {[
          [7, 7],
          [cw - 7, 7],
          [7, ch - 7],
          [cw - 7, ch - 7],
        ].map(([x, y]) => (
          <G key={`${x}-${y}`} transform={`translate(${x - 9} ${y - 9}) scale(0.53)`}>
            {[0, 90, 180, 270].map((r) => (
              <Path key={r} d="M17 17 C 13.5 13.5 13.5 8 17 5 C 20.5 8 20.5 13.5 17 17 Z" fill={GOLD} fillOpacity={0.75} transform={`rotate(${r} 17 17)`} />
            ))}
          </G>
        ))}
      </Svg>
      {/* แถบโฮโลแกรมรุ้ง */}
      <Animated.View pointerEvents="none" style={[styles.holo, { width: cw * 0.45, height: ch * 2.2, left: cw * 0.28, top: -ch * 0.6 }, holoSt]}>
        <LinearGradient colors={['rgba(255,255,255,0)', '#FF8AD6', '#8AB4FF', '#7CF0D0', '#FFE38A', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </>
  );

  /** ขอบโลหะทอง (ไล่เฉดเงาโลหะ) ห่อผิวบัตร */
  const Metal = ({ children }: { children: React.ReactNode }) => (
    <LinearGradient colors={['#F7E2A8', '#B8893E', '#FBEFC8', '#8E6526', '#E9C77E']} locations={[0, 0.3, 0.5, 0.75, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.metal}>
      <View style={styles.face}>{children}</View>
    </LinearGradient>
  );

  return (
    <View style={{ height: ch + 20, alignItems: 'center' }}>
      <PressableScale haptic="press" scaleTo={0.98} onPress={toggle} accessibilityLabel={flipped ? 'พลิกกลับด้านหน้าบัตร' : 'พลิกดูธาตุเจ้าเรือน'}>
        <Animated.View style={[{ width: cw, height: ch }, tiltSt]}>
          {/* ── ด้านหน้า ── */}
          <Animated.View style={[styles.faceOuter, { boxShadow: `0px 16px 34px ${th.shadow}` }, frontSt]}>
            <Metal>
              <Base />
              <View style={styles.cardHead}>
                <View style={styles.logo}>
                  <Sym name="leaf.fill" size={11} color={th.bg[1]} />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="micro" color={GOLD} style={styles.brand}>หมอบ้านเชื่อมใจ</T>
                  <T v="caption" color="#FFFFFF" style={{ fontWeight: '700' }}>บัตรผู้ป่วย · {el.label}</T>
                </View>
                {onCall ? (
                  <PressableScale haptic="press" scaleTo={0.92} onPress={onCall} hitSlop={8} style={styles.call} accessibilityLabel={`โทรหา ${p.name}`}>
                    <Sym name="phone.fill" size={13} color="#2A1D08" />
                    <T v="caption" color="#2A1D08" style={{ fontWeight: '700' }}>โทร</T>
                  </PressableScale>
                ) : null}
              </View>

              <View style={styles.frontBody}>
                {/* รูปลอยเหนือผิวบัตร (เลื่อนตามการเอียง) */}
                <Animated.View style={liftSt}>
                  <LinearGradient colors={['#FBEFC8', '#B8893E', '#F7E2A8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
                    <View style={[styles.avatarInner, { backgroundColor: th.bg[2] }]}>
                      <Avatar name={p.name} src={avatar} size={ch * 0.3} />
                    </View>
                  </LinearGradient>
                </Animated.View>
                <View style={{ flex: 1, gap: 6 }}>
                  <T v="h3" color="#FFFFFF" numberOfLines={2} style={styles.emboss}>{p.name}</T>
                  <View style={[styles.status, { backgroundColor: st.bg, borderColor: st.border }]}>
                    <View style={[styles.statusDot, { backgroundColor: st.fg }]} />
                    <T v="caption" color={st.fg} style={{ fontWeight: '700' }}>{statusLabel(p.status)}</T>
                  </View>
                  {phone ? (
                    <View style={styles.phoneRow}>
                      <Sym name="phone.fill" size={10} color="rgba(247,226,168,0.75)" />
                      <T v="caption" color="rgba(247,226,168,0.85)" style={styles.phone}>{phone}</T>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.stats}>
                <View style={styles.stat}>
                  <T v="micro" color="rgba(255,255,255,0.55)">เพศ · อายุ</T>
                  <T v="title" color="#FFFFFF">{p.sex} {p.age} ปี</T>
                </View>
                <View style={styles.statSep} />
                <View style={styles.stat}>
                  <T v="micro" color="rgba(255,255,255,0.55)">ธาตุเจ้าเรือน</T>
                  <T v="title" color={th.accent}>{el.label}</T>
                </View>
                <View style={styles.statSep} />
                <View style={styles.stat}>
                  <T v="micro" color="rgba(255,255,255,0.55)">BMI</T>
                  <T v="title" color="#FFFFFF">{bmi}</T>
                </View>
              </View>
              <View style={styles.flipHint}>
                <Sym name="arrow.triangle.2.circlepath" size={11} color="rgba(247,226,168,0.6)" />
              </View>
              <Glare />
            </Metal>
          </Animated.View>

          {/* ── ด้านหลัง: ธาตุเจ้าเรือน + ข้อควรระวังของผู้ป่วย ── */}
          <Animated.View style={[styles.faceOuter, { boxShadow: `0px 16px 34px ${th.shadow}` }, backSt]}>
            <Metal>
              <Base back />
              <View style={styles.backBody}>
                {/* เหรียญธาตุ: วงทองล้อมไอคอนธาตุ */}
                <LinearGradient colors={['#FBEFC8', '#B8893E', '#F7E2A8', '#8E6526']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.medal}>
                  <View style={[styles.medalInner, { backgroundColor: th.bg[2] }]}>
                    <ElementIcon el={p.element} size={ch * 0.34} />
                    <T v="caption" color={th.accent} center style={{ fontWeight: '700' }}>{el.label}</T>
                  </View>
                </LinearGradient>
                <View style={{ flex: 1, gap: 7 }}>
                  <View>
                    <T v="micro" color={GOLD}>มักมีปัญหา</T>
                    <T v="caption" color="#FFFFFF" numberOfLines={1}>{prof.prone.slice(0, 2).join(' · ')}</T>
                  </View>
                  <View>
                    <T v="micro" color={GOLD}>รสยาที่เหมาะ</T>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                      {prof.tastes.map((t) => (
                        <View key={t} style={styles.taste}>
                          <T v="micro" color="#FBEFC8" style={{ fontWeight: '700' }}>รส{t}</T>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View>
                    <T v="micro" color={GOLD}>วัย · ฤดู</T>
                    <T v="caption" color="#FFFFFF" numberOfLines={1}>{ag.stage} ({ag.dosha.split(' ')[0]}) · {ss.name.split(' ')[0]}</T>
                  </View>
                  {allergic || chronic ? (
                    <View style={styles.alertRow}>
                      <Sym name="exclamationmark.triangle.fill" size={11} color="#FFB4A8" />
                      <T v="micro" color="#FFD2CA" numberOfLines={1} style={{ flex: 1, fontWeight: '700' }}>
                        {[allergic ? `แพ้ ${p.allergies.replace(/^แพ้\s*/, '')}` : '', chronic ? p.chronic : ''].filter(Boolean).join(' · ')}
                      </T>
                    </View>
                  ) : null}
                </View>
              </View>
              <Glare />
            </Metal>
          </Animated.View>
        </Animated.View>
      </PressableScale>
    </View>
  );
}

const GOLD = '#E9C77E';
/** สีบัตรตามธาตุ: พื้นไล่เฉด 3 สี · แสงเรือง · สีเน้น · เงา */
const THEME: Record<Patient['element'], { bg: [string, string, string]; glow: string; accent: string; shadow: string }> = {
  ดิน: { bg: ['#3B2410', '#5E3A16', '#1E1208'], glow: '#F2B65E', accent: '#F5CF8A', shadow: 'rgba(94,58,22,0.45)' },
  น้ำ: { bg: ['#0A1A48', '#123279', '#060F2C'], glow: '#5FA8FF', accent: '#9CCBFF', shadow: 'rgba(18,50,121,0.45)' },
  ลม: { bg: ['#06352B', '#0E5A48', '#03201A'], glow: '#5FE3B8', accent: '#8FF0CF', shadow: 'rgba(14,90,72,0.45)' },
  ไฟ: { bg: ['#4A0B12', '#7E1621', '#2A060B'], glow: '#FF7A55', accent: '#FFAF8F', shadow: 'rgba(126,22,33,0.45)' },
};
/** สถานะบนพื้นเข้ม */
const STATUS_DARK: Record<Patient['status'], { fg: string; bg: string; border: string }> = {
  นัดวันนี้: { fg: '#7CF0A8', bg: 'rgba(124,240,168,0.14)', border: 'rgba(124,240,168,0.35)' },
  ติดตามอาการ: { fg: '#FFD27A', bg: 'rgba(255,210,122,0.14)', border: 'rgba(255,210,122,0.35)' },
  หายดี: { fg: '#A7EE95', bg: 'rgba(167,238,149,0.14)', border: 'rgba(167,238,149,0.35)' },
  'ส่งต่อ รพ.สต.': { fg: '#FFB0A3', bg: 'rgba(255,176,163,0.16)', border: 'rgba(255,176,163,0.4)' },
};

const styles = StyleSheet.create({
  call: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: GOLD },
  faceOuter: { ...StyleSheet.absoluteFillObject, borderRadius: 24, backfaceVisibility: 'hidden' },
  metal: { flex: 1, borderRadius: 24, borderCurve: 'continuous', padding: 1.6, backfaceVisibility: 'hidden' },
  face: { flex: 1, borderRadius: 22.5, borderCurve: 'continuous', overflow: 'hidden', backfaceVisibility: 'hidden' },
  glare: { position: 'absolute' },
  holo: { position: 'absolute' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 20, paddingTop: 18 },
  brand: { letterSpacing: 0.8, fontWeight: '700' },
  logo: { width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  frontBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
  avatarRing: { padding: 2.5, borderRadius: 999, boxShadow: '0px 8px 18px rgba(0,0,0,0.45)' },
  avatarInner: { padding: 2, borderRadius: 999 },
  emboss: { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 3 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  phone: { letterSpacing: 1, fontVariant: ['tabular-nums'], fontWeight: '600' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  stats: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.28)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,199,126,0.4)' },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statSep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(233,199,126,0.35)' },
  flipHint: { position: 'absolute', right: 18, bottom: 16 + 60 },
  backBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 18 },
  medal: { padding: 2.5, borderRadius: 26, boxShadow: '0px 8px 18px rgba(0,0,0,0.45)' },
  medalInner: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, borderRadius: 24 },
  taste: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(233,199,126,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,199,126,0.45)' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,138,122,0.18)' },
});
