/**
 * กล้องสแกนบัตรประชาชน — เปิดกล้องทันที
 * - กรอบสัดส่วนบัตรจริง (85.6 × 54 มม.) พร้อมมุมกรอบ ให้วางบัตรพอดีกรอบ = ระยะที่เหมาะ
 * - โฟกัสอัตโนมัติต่อเนื่อง (แตะเพื่อโฟกัสจุดนั้นได้), เปิดไฟฉายได้
 * - ถ่ายอัตโนมัติ: ถ่ายภาพเล็กเงียบๆ ทุก ~0.4 วิ ให้ Apple Vision หาบัตร (modules/card-detect)
 *   ถ้ากรอบบัตรตรงกับกรอบบนจอ 2 ครั้งติด → ถ่ายจริงเอง
 * - ถ่ายแล้ว: ภาพเต็มกลายเป็นพื้นหลังเบลอ, บัตรคมชัดตรงกรอบ (โฟกัสบัตร) เคลือบแสงรุ้ง + ขอบ AI หมุน
 *   แบบเดียวกับครูปัญญา → อ่านเสร็จปิดหน้าแล้วเติมข้อมูลลงฟอร์ม
 * - ถ่ายแล้วครอปเฉพาะส่วนในกรอบ ส่งกลับไปให้ AI อ่าน
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { BlurMask, Canvas, RoundedRect, SweepGradient, vec } from '@shopify/react-native-skia';
import { AIGlow, AI_COLORS } from '../components/Orb';
import { AISphere } from '../components/AISphere';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym } from '../components/ios';
import { Button, PressableScale, T, useHaptic } from '../components/ui';
import { cardDetectAvailable, detectCard, extractCard } from '../../modules/card-detect';
import { readIdCard, setIdScanResult } from '../lib/idScan';
import { palette } from '../theme';

const CARD_RATIO = 85.6 / 54;
/** มุมโค้งบัตรจริง 3.18 มม. → สัดส่วนกับความกว้าง */
const CARD_R = 14;
/** พื้นที่เผื่อรอบบัตรให้ออร่าเบลอจางหมด (≥ 3× blur) */
const AURA_PAD = 110;

export default function IdScan() {
  const { then } = useLocalSearchParams<{ then?: string }>();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const h = useHaptic();
  const cam = useRef<CameraView>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  // expo-camera: 'off' = โฟกัสอัตโนมัติต่อเนื่อง, 'on' = โฟกัสครั้งเดียวแล้วล็อก
  const [focus, setFocus] = useState<'on' | 'off'>('off');
  const [ready, setReady] = useState(false);
  const [loopKey, setLoopKey] = useState(0);
  // หลังถ่าย: แสดงบัตรลอยขึ้น + AI อ่านข้อมูล
  const [shot, setShot] = useState<string | null>(null);
  const [bg, setBg] = useState<string | null>(null);
  const [stage, setStage] = useState<'reading' | 'done' | 'error'>('reading');
  const [step, setStep] = useState(0);
  const [hint, setHint] = useState<'search' | 'adjust' | 'hold'>('search');
  const busyRef = useRef(false);

  // กรอบบัตร: กว้างเต็มจอเว้น 24, อยู่กึ่งกลางค่อนบน
  const fw = W - 48;
  const fh = fw / CARD_RATIO;
  const fx = 24;
  const fy = Math.round(H * 0.42 - fh / 2);

  // วงโฟกัสเมื่อแตะ
  const ring = useSharedValue(0);
  const [ringAt, setRingAt] = useState({ x: 0, y: 0 });
  const ringSt = useAnimatedStyle(() => ({ opacity: ring.value, transform: [{ scale: 1.4 - ring.value * 0.4 }] }));
  const tapFocus = (x: number, y: number) => {
    setRingAt({ x, y });
    ring.value = withSequence(withTiming(1, { duration: 150 }), withTiming(1, { duration: 500 }), withTiming(0, { duration: 250 }));
    h.select();
    // โฟกัสครั้งเดียว ณ ตอนแตะ แล้วกลับไปโฟกัสต่อเนื่อง
    setFocus('on');
    setTimeout(() => setFocus('off'), 1500);
  };

  // ── หลังถ่าย: บัตรที่ดัดตรงแล้ว ลอยจากตำแหน่งจริงในภาพ → กลางจอ, เคลือบรุ้ง, ออร่า AI ──
  // ตำแหน่งปลายทางของบัตร (กลางจอค่อนบน)
  const cw = W - 40;
  const ch = cw / CARD_RATIO;
  const cx = 20;
  const cy = Math.round(H * 0.36 - ch / 2);
  const [from, setFrom] = useState({ x: cx, y: cy, w: cw, h: ch });

  const fly = useSharedValue(0); // 0 = ตำแหน่งบัตรในภาพ, 1 = กลางจอ
  const idle = useSharedValue(0); // ลอยขึ้นลง + เอียง 3D เบาๆ
  const sheen = useSharedValue(0); // แสงรุ้งวิ่งพาดบัตร
  const back = useSharedValue(0); // พื้นหลังเบลอ
  const aura = useSharedValue(0); // ออร่ารุ้งหลังบัตร
  const spin = useSharedValue(0); // หมุนสีออร่า
  const out = useSharedValue(1); // ปิดฉาก
  const flySt = useAnimatedStyle(() => {
    const f = fly.value;
    const sx = from.w / cw, sy = from.h / ch;
    const k = 1 - f;
    const wob = Math.sin(idle.value * Math.PI * 2);
    return {
      opacity: out.value,
      transform: [
        { translateX: (from.x + from.w / 2 - (cx + cw / 2)) * k },
        { translateY: (from.y + from.h / 2 - (cy + ch / 2)) * k + wob * 6 * f - (1 - out.value) * 120 },
        // ไม่ใช้ rotateX/rotateY: การหมุน 3D ทำให้ครึ่งบัตรไปอยู่หลังชั้นพื้นหลังเบลอ
        { rotate: `${wob * 0.6 * f}deg` },
        { scaleX: (sx + (1 - sx) * f) * (0.85 + 0.15 * out.value) },
        { scaleY: (sy + (1 - sy) * f) * (0.85 + 0.15 * out.value) },
      ],
    };
  });
  const sheenSt = useAnimatedStyle(() => ({ transform: [{ translateX: -cw * 0.9 + sheen.value * cw * 2.2 }, { rotate: '22deg' }] }));
  const backSt = useAnimatedStyle(() => ({ opacity: back.value }));
  const auraSt = useAnimatedStyle(() => ({ opacity: aura.value * out.value * 0.75 }));
  const auraRot = useDerivedValue(() => [{ rotate: spin.value * Math.PI * 2 }]);

  const done = async ({ card, full, start, mime = 'image/jpeg' }: { card: string; full: string; start?: { x: number; y: number; w: number; h: number }; mime?: string }) => {
    busyRef.current = true;
    setFrom(start ?? { x: cx + cw * 0.1, y: cy + ch * 0.1, w: cw * 0.8, h: ch * 0.8 });
    setBg(full);
    setShot(card);
    setStage('reading');
    setStep(0);
    out.value = 1;
    fly.value = 0;
    back.value = withTiming(1, { duration: 500 });
    fly.value = withDelay(150, withSpring(1, { damping: 14, stiffness: 90, mass: 0.9 }));
    aura.value = withDelay(500, withTiming(1, { duration: 700 }));
    spin.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
    idle.value = withDelay(900, withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1));
    sheen.value = withDelay(700, withRepeat(withSequence(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) }), withTiming(0, { duration: 0 }), withTiming(0, { duration: 500 })), -1));
    try {
      const data = await readIdCard(card, mime);
      if (!data?.name) throw new Error('empty');
      setIdScanResult(data);
      setStage('done');
      h.success();
      // ปิดฉาก: บัตรลอยขึ้นหาย แล้วปิดหน้า → ฟอร์มเติมข้อมูลให้
      out.value = withDelay(700, withTiming(0, { duration: 450, easing: Easing.in(Easing.cubic) }));
      // เปิดจากเมนูเพิ่มผู้ป่วย → ไปฟอร์มต่อเลย (ฟอร์มรับข้อมูลที่อ่านได้) · เปิดจากฟอร์ม → กลับฟอร์มเดิม
      setTimeout(() => (then === 'new' ? router.replace('/patient/new') : router.back()), 1200);
    } catch {
      setStage('error');
      h.warn();
    }
  };

  const retry = () => {
    setShot(null);
    setBg(null);
    setBusy(false);
    busyRef.current = false;
    fly.value = 0;
    back.value = 0;
    aura.value = 0;
    setHint('search');
    setLoopKey((k) => k + 1);
  };

  // ข้อความขั้นตอนระหว่างอ่าน
  useEffect(() => {
    if (!shot || stage !== 'reading') return;
    const t = setInterval(() => setStep((x) => Math.min(x + 1, READ_STEPS.length - 1)), 1200);
    return () => clearInterval(t);
  }, [shot, stage]);

  const shoot = async () => {
    if (!cam.current || busyRef.current) return;
    busyRef.current = true;
    h.heavy();
    setBusy(true);
    try {
      const p = await cam.current.takePictureAsync({ quality: 0.92 });
      if (!p) {
        busyRef.current = false;
        return setBusy(false);
      }
      // ภาพตัวอย่างแสดงแบบ cover → แปลงพิกัดระหว่างจอกับรูปจริง
      const scale = Math.max(W / p.width, H / p.height);
      const ox = (p.width * scale - W) / 2;
      const oy = (p.height * scale - H) / 2;
      const hint = { x: (fx + ox) / scale / p.width, y: (fy + oy) / scale / p.height, width: fw / scale / p.width, height: fh / scale / p.height };
      // ตัดพอดีขอบบัตร + ดัดให้ตรง ด้วย Apple Vision
      const ex = await extractCard(p.uri, hint);
      if (ex) {
        const start = { x: ex.x * p.width * scale - ox, y: ex.y * p.height * scale - oy, w: ex.boxWidth * p.width * scale, h: ex.boxHeight * p.height * scale };
        return done({ card: ex.uri, full: p.uri, start });
      }
      // หาขอบไม่เจอ → ครอปตามกรอบแทน
      const crop = {
        originX: Math.max(0, (fx + ox) / scale),
        originY: Math.max(0, (fy + oy) / scale),
        width: Math.min(p.width, fw / scale),
        height: Math.min(p.height, fh / scale),
      };
      crop.width = Math.min(crop.width, p.width - crop.originX);
      crop.height = Math.min(crop.height, p.height - crop.originY);
      const cropped = await ImageManipulator.manipulateAsync(p.uri, [{ crop }], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
      done({ card: cropped.uri, full: p.uri, start: { x: fx, y: fy, w: fw, h: fh } });
    } catch {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // ── ถ่ายอัตโนมัติเมื่อบัตรอยู่ในกรอบ ──
  useEffect(() => {
    if (!ready || !cardDetectAvailable) return;
    let alive = true;
    let stable = 0;
    const loop = async () => {
      while (alive) {
        await new Promise((r) => setTimeout(r, 350));
        if (!alive || busyRef.current || !cam.current) continue;
        try {
          const snap = await cam.current.takePictureAsync({ quality: 0.15, shutterSound: false, skipProcessing: true });
          if (!alive || busyRef.current || !snap) continue;
          const rc = await detectCard(snap.uri);
          if (!rc) {
            stable = 0;
            setHint('search');
            continue;
          }
          // กรอบบนจอ → พิกัด normalized บนรูป (ภาพตัวอย่างแสดงแบบ cover)
          const iw = rc.imageWidth, ih = rc.imageHeight;
          const sc = Math.max(W / iw, H / ih);
          const ox = (iw * sc - W) / 2, oy = (ih * sc - H) / 2;
          const nx = (fx + ox) / sc / iw, ny = (fy + oy) / sc / ih;
          const nw = fw / sc / iw, nh = fh / sc / ih;
          const ok = Math.abs(rc.x - nx) < nw * 0.12 && Math.abs(rc.y - ny) < nh * 0.15 && rc.width / nw > 0.82 && rc.width / nw < 1.15;
          if (ok) {
            stable += 1;
            setHint('hold');
            if (stable >= 2) {
              alive = false;
              shoot();
            }
          } else {
            stable = 0;
            setHint('adjust');
          }
        } catch {}
      }
    };
    loop();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, loopKey]);

  const fromLibrary = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, mediaTypes: ['images'] });
    if (r.canceled) return;
    const uri = r.assets[0].uri;
    const ex = await extractCard(uri);
    done({ card: ex?.uri ?? uri, full: uri, mime: ex ? 'image/jpeg' : (r.assets[0].mimeType ?? 'image/jpeg') });
  };

  if (!perm) return <View style={styles.page} />;
  if (!perm.granted) {
    return (
      <View style={[styles.page, styles.center, { paddingHorizontal: 32 }]}>
        <StatusBar style="light" />
        <Sym name="camera.fill" size={36} color="#FFFFFF" />
        <T v="h2" color="#FFFFFF" center style={{ marginTop: 14 }}>อนุญาตให้ใช้กล้อง</T>
        <T v="callout" color="rgba(255,255,255,0.75)" center style={{ marginTop: 6 }}>ใช้ถ่ายบัตรประชาชนเพื่อกรอกข้อมูลผู้ป่วยอัตโนมัติ</T>
        <Button label="อนุญาต" onPress={requestPerm} style={{ alignSelf: 'stretch', marginTop: 24 }} />
        <PressableScale onPress={() => router.back()} style={{ padding: 16 }}>
          <T v="callout" color="#FFFFFF">ยกเลิก</T>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" autofocus={focus} enableTorch={torch} animateShutter={false} onCameraReady={() => setReady(true)} />

      {/* แตะเพื่อโฟกัส */}
      <Pressable style={StyleSheet.absoluteFill} onPress={(e) => tapFocus(e.nativeEvent.locationX, e.nativeEvent.locationY)} accessibilityLabel="แตะเพื่อโฟกัส" />

      {/* ม่านมืดรอบกรอบบัตร */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.dim, { top: 0, left: 0, right: 0, height: fy }]} />
        <View style={[styles.dim, { top: fy + fh, left: 0, right: 0, bottom: 0 }]} />
        <View style={[styles.dim, { top: fy, left: 0, width: fx, height: fh }]} />
        <View style={[styles.dim, { top: fy, right: 0, width: fx, height: fh }]} />

        {/* กรอบบัตร + มุม */}
        <View style={[styles.frame, { left: fx, top: fy, width: fw, height: fh }]}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View key={c} style={[styles.corner, styles[c], hint === 'hold' && { borderColor: '#34C759' }]} />
          ))}
          {/* ตำแหน่งรูปถ่ายบนบัตร ช่วยจัดแนวบัตร */}
          <View style={[styles.photoHint, { width: fw * 0.22, height: fh * 0.42 }]} />
        </View>

        <View style={[styles.guide, { top: fy - 64 }]}>
          <View style={[styles.pill, hint === 'hold' && { backgroundColor: '#34C759' }]}>
            <T v="title" color="#FFFFFF" center>
              {busy ? 'กำลังถ่าย…' : hint === 'hold' ? 'ถือนิ่งๆ กำลังถ่ายให้อัตโนมัติ' : hint === 'adjust' ? 'ขยับบัตรให้พอดีกรอบ' : 'วางบัตรประชาชนให้พอดีกรอบ'}
            </T>
          </View>
        </View>
        <View style={[styles.guide, { top: fy + fh + 18 }]}>
          <T v="subhead" color="rgba(255,255,255,0.85)" center>ด้านหน้าบัตร · ขอบบัตรชิดมุมกรอบ (ห่างประมาณ 15–20 ซม.)</T>
          <T v="caption" color="rgba(255,255,255,0.65)" center style={{ marginTop: 4 }}>{cardDetectAvailable ? 'ถ่ายให้อัตโนมัติเมื่อบัตรพอดีกรอบ · ' : ''}แตะที่ภาพเพื่อโฟกัส · ไม่เก็บเลขบัตรประชาชน</T>
        </View>

        <Animated.View style={[styles.ring, { left: ringAt.x - 36, top: ringAt.y - 36 }, ringSt]} />
      </View>

      {/* ปุ่มบน: ปิด / ไฟฉาย (ซ่อนระหว่างอ่านบัตร) */}
      {shot ? null : (
      <>
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} style={styles.round} accessibilityLabel="ปิด">
          <Sym name="xmark" size={18} color="#FFFFFF" weight="semibold" />
        </PressableScale>
        <PressableScale onPress={() => setTorch((x) => !x)} style={[styles.round, torch && { backgroundColor: '#FFFFFF' }]} accessibilityLabel="ไฟฉาย">
          <Sym name={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'} size={18} color={torch ? '#000000' : '#FFFFFF'} />
        </PressableScale>
      </View>

      {/* ปุ่มล่าง: คลังรูป / ถ่าย */}
      <View style={[styles.bottom, { bottom: insets.bottom + 24 }]}>
        <PressableScale onPress={fromLibrary} style={styles.round} accessibilityLabel="เลือกจากคลังรูป">
          <Sym name="photo.on.rectangle" size={20} color="#FFFFFF" />
        </PressableScale>
        <PressableScale haptic="press" scaleTo={0.9} onPress={shoot} style={styles.shutter} accessibilityLabel="ถ่ายบัตร">
          <View style={styles.shutterIn}>{busy ? <ActivityIndicator color={palette.primary} /> : null}</View>
        </PressableScale>
        <View style={{ width: 48 }} />
      </View>
      </>
      )}

      {/* ── หลังถ่าย: พื้นหลังเบลอ · บัตรดัดตรงลอยมากลางจอ · ออร่ารุ้ง + เคลือบโฮโลแกรม (สไตล์ครูปัญญา) ── */}
      {shot ? (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, backSt]}>
            {bg ? <Image source={{ uri: bg }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(4,21,14,0.55)', 'rgba(4,21,14,0.25)', 'rgba(4,21,14,0.7)']} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <AIGlow active={stage === 'reading'} />

          <Animated.View style={[{ position: 'absolute', left: cx, top: cy, width: cw, height: ch }, flySt]}>
            {/* ออร่ารุ้งหมุนหลังบัตร */}
            {/* ผืนผ้าใบใหญ่กว่าบัตรมาก (AURA_PAD) ให้แสงเบลอจางหายหมดก่อนถึงขอบ — ไม่เห็นเส้นตัด */}
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -AURA_PAD, top: -AURA_PAD, width: cw + AURA_PAD * 2, height: ch + AURA_PAD * 2 }, auraSt]}>
              <Canvas style={{ flex: 1 }}>
                <RoundedRect x={AURA_PAD + 6} y={AURA_PAD + 6} width={cw - 12} height={ch - 12} r={CARD_R}>
                  <SweepGradient c={vec(AURA_PAD + cw / 2, AURA_PAD + ch / 2)} colors={AI_COLORS} transform={auraRot} origin={vec(AURA_PAD + cw / 2, AURA_PAD + ch / 2)} />
                  <BlurMask blur={28} style="normal" />
                </RoundedRect>
                {/* ขอบรุ้งคม รอบบัตร (วาดในผืนผ้าใบเดียวกับออร่า จึงไม่มีขอบโดนตัด) */}
                <RoundedRect x={AURA_PAD - 1} y={AURA_PAD - 1} width={cw + 2} height={ch + 2} r={CARD_R + 1} style="stroke" strokeWidth={2.5}>
                  <SweepGradient c={vec(AURA_PAD + cw / 2, AURA_PAD + ch / 2)} colors={AI_COLORS} transform={auraRot} origin={vec(AURA_PAD + cw / 2, AURA_PAD + ch / 2)} />
                </RoundedRect>
              </Canvas>
            </Animated.View>
            <View style={styles.cardClip}>
              <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {/* เคลือบรุ้งโฮโลแกรม: ไล่สีจางทั้งใบ + แถบแสงรุ้งวาววิ่งพาด */}
              <LinearGradient colors={AI_COLORS.map((c) => c + '22') as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Animated.View style={[styles.sheen, { width: cw * 0.6, height: ch * 2.4, top: -ch * 0.7 }, sheenSt]}>
                <LinearGradient
                  colors={['rgba(255,255,255,0)', 'rgba(124,240,168,0.28)', 'rgba(255,255,255,0.7)', 'rgba(224,176,48,0.32)', 'rgba(122,92,200,0.3)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              {/* เงาแสงขอบบนแบบกระจก */}
              <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} end={{ x: 0.5, y: 0.35 }} style={StyleSheet.absoluteFill} />
            </View>
          </Animated.View>

          <View style={[styles.readBox, { top: cy + ch + 48 }]}>
            {stage === 'reading' ? (
              <Animated.View entering={FadeInDown.delay(300).duration(420)} style={{ alignItems: 'center' }}>
                <AISphere size={44} active />
                <T v="h3" color="#FFFFFF" center style={{ marginTop: 10 }}>ครูปัญญากำลังอ่านบัตร</T>
                {/* ขั้นตอนเป็นเส้นทาง: ผ่านแล้ว ✓ · กำลังทำ (เรือง) · ยังไม่ถึง (จาง) */}
                <View style={styles.steps}>
                  {READ_STEPS.map((t, i) => {
                    const st = i < step ? 'done' : i === step ? 'now' : 'todo';
                    return (
                      <View key={t} style={styles.stepItem}>
                        <View style={[styles.stepDot, st === 'done' && styles.stepDone, st === 'now' && styles.stepNow]}>
                          {st === 'done' ? <Sym name="checkmark" size={10} color="#04150E" weight="bold" /> : null}
                        </View>
                        <T v="caption" color={st === 'todo' ? 'rgba(255,255,255,0.4)' : '#FFFFFF'} style={{ fontWeight: st === 'now' ? '700' : '400' }}>{t}</T>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            ) : stage === 'done' ? (
              <Animated.View entering={FadeIn.duration(320)} style={{ alignItems: 'center', gap: 10 }}>
                <View style={styles.okBadge}>
                  <Sym name="checkmark" size={24} color="#FFFFFF" weight="bold" />
                </View>
                <T v="h3" color="#FFFFFF">อ่านข้อมูลเรียบร้อย</T>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: 12, alignSelf: 'stretch' }}>
                <T v="h3" color="#FFFFFF" center>อ่านบัตรไม่สำเร็จ</T>
                <T v="callout" color="rgba(255,255,255,0.8)" center>ลองถ่ายใหม่ให้บัตรอยู่ในกรอบและไม่สะท้อนแสง</T>
                <Button label="ถ่ายใหม่" onPress={retry} style={{ alignSelf: 'stretch', marginTop: 8 }} />
                <PressableScale onPress={() => router.back()} style={{ padding: 10 }}>
                  <T v="callout" color="#FFFFFF">กรอกเอง</T>
                </PressableScale>
              </Animated.View>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const READ_STEPS = ['ชื่อ-สกุล', 'วันเกิด', 'ที่อยู่', 'ตรวจทาน'];
const C = 28;
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  frame: { position: 'absolute', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  corner: { position: 'absolute', width: C, height: C, borderColor: '#FFFFFF' },
  tl: { left: -2, top: -2, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 14 },
  tr: { right: -2, top: -2, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 14 },
  bl: { left: -2, bottom: -2, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 14 },
  br: { right: -2, bottom: -2, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 14 },
  photoHint: { position: 'absolute', right: '6%', bottom: '10%', borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', borderStyle: 'dashed' },
  guide: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  cardClip: { ...StyleSheet.absoluteFillObject, borderRadius: CARD_R, overflow: 'hidden', backgroundColor: '#111', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.5)' },
  sheen: { position: 'absolute', left: 0 },
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
  readBox: { position: 'absolute', left: 32, right: 32, alignItems: 'center' },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  steps: { flexDirection: 'row', gap: 14, marginTop: 14 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: '#7CF0A8', borderColor: '#7CF0A8' },
  stepNow: { borderColor: '#7CF0A8', backgroundColor: 'rgba(124,240,168,0.25)', boxShadow: '0px 0px 8px rgba(124,240,168,0.9)' },
  okBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)' },
  ring: { position: 'absolute', width: 72, height: 72, borderRadius: 12, borderWidth: 2, borderColor: '#FFD60A' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  bottom: { position: 'absolute', left: 32, right: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
