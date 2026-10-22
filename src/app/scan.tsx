/**
 * สแกนตำราโบราณ (สมุดข่อย ใบลาน ตำรายา) — เปิดกล้องทันที แบบเดียวกับสแกนบัตรประชาชน
 * - กรอบหน้ากระดาษ + มุมกรอบ, แตะเพื่อโฟกัส, ไฟฉาย, เลือกจากคลังรูป, ลองตัวอย่าง
 * - ถ่ายแล้ว: ตัดพอดีขอบกระดาษ + ดัดให้ตรง (Apple Vision document segmentation)
 *   ภาพเต็มกลายเป็นพื้นหลังเบลอ ตำราลอยมากลางจอ ออร่ารุ้ง + แสงสแกนวิ่ง (สไตล์ครูปัญญา)
 * - Typhoon OCR อ่าน → ครูปัญญาถอดความ → แผ่นผลลัพธ์เลื่อนขึ้น: ถอดความ/ต้นฉบับ · ตัวยา · หมายเหตุ
 * - fill=1 (เปิดจากหน้าเพิ่มภูมิปัญญา) → "ใช้ข้อมูลนี้" ส่งกลับไปเติมฟอร์ม แทนการเก็บเข้าคลังทันที
 */
import { Asset } from 'expo-asset';
import { BlurView } from '../components/Blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { CAMERA_HTTPS_MSG, cameraBlocked, withRealSize } from '../lib/cameraWeb';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image as RNImage, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, SlideInDown, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { BlurMask, Canvas, RoundedRect, SweepGradient, vec } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SYSTEM_PROMPT, chatJSON, ocrImage } from '../api/ai';
import { AIGlow, AI_COLORS } from '../components/Orb';
import { AISphere } from '../components/AISphere';
import { Sym, ios } from '../components/ios';
import { Button, GlassDock, PressableScale, T, useHaptic } from '../components/ui';
import { extractDoc } from '../../modules/card-detect';
import { manuscriptImage } from '../data/herbs';
import { setWisdomResult } from '../lib/wisdomTalk';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';
import { column } from '../components/layout';

type Reading = { title: string; modern: string; ingredients: string[]; kind: string; note: string };
type Rect = { x: number; y: number; w: number; h: number };

const FALLBACK: Reading = {
  title: 'ตำรายาแก้ไข้ป่า (ถอดความ)',
  modern:
    'ให้เอาบอระเพ็ด ฟ้าทะลายโจร รากย่านาง และจันทน์แดง อย่างละเท่ากัน ต้มกับน้ำ 3 ส่วน เคี่ยวให้เหลือ 1 ส่วน กินครั้งละครึ่งถ้วยชา เช้าและเย็น แก้ไข้จับสั่น ไข้ป่า',
  ingredients: ['บอระเพ็ด', 'ฟ้าทะลายโจร', 'รากย่านาง', 'จันทน์แดง'],
  kind: 'ตำรับยา',
  note: 'อักษรบางส่วนเลือนราง ควรให้ผู้รู้อักษรโบราณตรวจทานอีกครั้ง',
};
const KINDS = ['ตำรับยา', 'วิธีรักษา', 'คาถา/พิธี', 'ตำราโบราณ'];
const STEPS = ['อ่านตัวอักษร', 'ถอดความ', 'จัดหมวด'];
const R = 16;
const AURA_PAD = 110;

const sizeOf = (uri: string) => new Promise<{ w: number; h: number }>((res) => RNImage.getSize(uri, (w, h) => res({ w, h }), () => res({ w: 3, h: 4 })));

export default function Scan() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const { settings, addWisdom } = useApp();
  const { fill } = useLocalSearchParams<{ fill?: string }>();
  const h = useHaptic();
  const cam = useRef<CameraView>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [focus, setFocus] = useState<'on' | 'off'>('off');
  const [busy, setBusy] = useState(false);

  // หลังถ่าย
  const [doc, setDoc] = useState<string | null>(null);
  const [bg, setBg] = useState<string | null>(null);
  const [stage, setStage] = useState<'camera' | 'reading' | 'result'>('camera');
  const [step, setStep] = useState(0);
  const [raw, setRaw] = useState('');
  const [reading, setReading] = useState<Reading | null>(null);
  const [tab, setTab] = useState<'modern' | 'raw'>('modern');
  const [demo, setDemo] = useState(false);
  const [saved, setSaved] = useState(false);

  // กรอบหน้ากระดาษ: กว้างเต็มจอเว้น 24 แนวตั้ง
  const fw = W - 48;
  const fh = Math.min(fw * 1.3, H * 0.56);
  const fx = 24;
  const fy = Math.round(H * 0.45 - fh / 2);

  // ตำแหน่งตำราลอยกลางจอ (คำนวณตามสัดส่วนภาพที่ตัดได้)
  const [to, setTo] = useState<Rect>({ x: fx, y: fy, w: fw, h: fh });
  const [from, setFrom] = useState<Rect>({ x: fx, y: fy, w: fw, h: fh });

  // วงโฟกัสเมื่อแตะ
  const ring = useSharedValue(0);
  const [ringAt, setRingAt] = useState({ x: 0, y: 0 });
  const ringSt = useAnimatedStyle(() => ({ opacity: ring.value, transform: [{ scale: 1.4 - ring.value * 0.4 }] }));
  const tapFocus = (x: number, y: number) => {
    setRingAt({ x, y });
    ring.value = withSequence(withTiming(1, { duration: 150 }), withTiming(1, { duration: 500 }), withTiming(0, { duration: 250 }));
    h.select();
    setFocus('on');
    setTimeout(() => setFocus('off'), 1500);
  };

  const fly = useSharedValue(0);
  const idle = useSharedValue(0);
  const scan = useSharedValue(0); // แสงสแกนวิ่งบนกระดาษ
  const back = useSharedValue(0);
  const aura = useSharedValue(0);
  const spin = useSharedValue(0);
  const out = useSharedValue(1);
  const flySt = useAnimatedStyle(() => {
    const f = fly.value;
    const k = 1 - f;
    const sx = from.w / to.w, sy = from.h / to.h;
    const wob = Math.sin(idle.value * Math.PI * 2);
    return {
      opacity: out.value,
      transform: [
        { translateX: (from.x + from.w / 2 - (to.x + to.w / 2)) * k },
        { translateY: (from.y + from.h / 2 - (to.y + to.h / 2)) * k + wob * 5 * f - (1 - out.value) * 140 },
        { rotate: `${wob * 0.5 * f}deg` },
        { scaleX: (sx + (1 - sx) * f) * (0.8 + 0.2 * out.value) },
        { scaleY: (sy + (1 - sy) * f) * (0.8 + 0.2 * out.value) },
      ],
    };
  });
  const scanSt = useAnimatedStyle(() => ({ transform: [{ translateY: -60 + scan.value * (to.h + 60) }] }));
  const backSt = useAnimatedStyle(() => ({ opacity: back.value }));
  const auraSt = useAnimatedStyle(() => ({ opacity: aura.value * out.value * 0.75 }));
  const auraRot = useDerivedValue(() => [{ rotate: spin.value * Math.PI * 2 }]);

  /** ตำราที่ตัดแล้ว → ลอยมากลางจอ → OCR → ถอดความ */
  const process = async ({ img, full, start, size, mime = 'image/jpeg' }: { img: string; full: string; start: Rect; size: { w: number; h: number }; mime?: string }) => {
    const ar = size.w / size.h;
    const maxW = W - 64, maxH = H * 0.5;
    const w = Math.min(maxW, maxH * ar);
    const hh = w / ar;
    setTo({ x: (W - w) / 2, y: Math.round(H * 0.4 - hh / 2), w, h: hh });
    setFrom(start);
    setBg(full);
    setDoc(img);
    setStage('reading');
    setStep(0);
    setSaved(false);
    out.value = 1;
    fly.value = 0;
    back.value = withTiming(1, { duration: 500 });
    fly.value = withDelay(150, withSpring(1, { damping: 15, stiffness: 90, mass: 0.9 }));
    aura.value = withDelay(500, withTiming(1, { duration: 700 }));
    spin.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
    idle.value = withDelay(900, withRepeat(withTiming(1, { duration: 3400, easing: Easing.linear }), -1));
    scan.value = withDelay(700, withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) }), -1, true));

    let text = '';
    try {
      text = await ocrImage(img, mime);
    } catch {}
    setRaw(text);
    setStep(1);
    let r: Reading = FALLBACK;
    let isDemo = false;
    try {
      if (!text) throw new Error('empty');
      r = await chatJSON<Reading>(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `ข้อความนี้ได้จากการ OCR ตำรา/สมุดข่อย/ใบลานโบราณ อาจมีคำผิด:\n"""${text.slice(0, 12000)}"""\n\nถอดความเป็นภาษาไทยปัจจุบันที่อ่านง่าย ตอบเป็น JSON เท่านั้น:
{"title":"ชื่อเรื่อง/ตำรับ","modern":"ถอดความเป็นภาษาปัจจุบันให้ครบทุกส่วนของต้นฉบับ ห้ามย่อ แบ่งย่อหน้าตามเนื้อหา","ingredients":["สมุนไพร/ตัวยาที่พบ (ถ้ามี)"],"kind":"ตำรับยา|วิธีรักษา|คาถา/พิธี|ตำราโบราณ","note":"หมายเหตุสำหรับผู้ตรวจทาน"}`,
          },
        ],
        settings.model,
      );
      r = { ...r, ingredients: Array.isArray(r.ingredients) ? r.ingredients.filter(Boolean) : [] };
    } catch {
      if (!text) setRaw('๏ ยาแก้ไข้ป่า ท่านให้เอา บรเพช ฟ้าทลายโจร รากย่านาง จันแดง สิ่งละส่วน ต้มสามเอาหนึ่ง กินแก้ไข้จับสั่น หายแล ฯ');
      isDemo = true;
    }
    setStep(2);
    setReading(r);
    setDemo(isDemo);
    h.success();
    // ปิดฉาก: ตำราลอยขึ้นหาย → แผ่นผลลัพธ์เลื่อนขึ้น
    out.value = withDelay(500, withTiming(0, { duration: 420, easing: Easing.in(Easing.cubic) }));
    setTimeout(() => {
      setTab('modern');
      setStage('result');
    }, 900);
  };

  const shoot = async () => {
    if (!cam.current || busy) return;
    h.heavy();
    setBusy(true);
    try {
      const raw = await cam.current.takePictureAsync({ quality: 0.92 });
      const p = raw && (await withRealSize(raw));
      if (!p) return setBusy(false);
      const scale = Math.max(W / p.width, H / p.height);
      const ox = (p.width * scale - W) / 2;
      const oy = (p.height * scale - H) / 2;
      // ตัดพอดีขอบกระดาษ + ดัดให้ตรง
      const ex = await extractDoc(p.uri);
      if (ex) {
        return process({ img: ex.uri, full: p.uri, size: { w: ex.width, h: ex.height }, start: { x: ex.x * p.width * scale - ox, y: ex.y * p.height * scale - oy, w: ex.boxWidth * p.width * scale, h: ex.boxHeight * p.height * scale } });
      }
      // หาขอบไม่เจอ → ครอปตามกรอบ
      const crop = { originX: Math.max(0, (fx + ox) / scale), originY: Math.max(0, (fy + oy) / scale), width: fw / scale, height: fh / scale };
      crop.width = Math.min(crop.width, p.width - crop.originX);
      crop.height = Math.min(crop.height, p.height - crop.originY);
      const c = await ImageManipulator.manipulateAsync(p.uri, [{ crop }], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
      process({ img: c.uri, full: p.uri, size: { w: c.width, h: c.height }, start: { x: fx, y: fy, w: fw, h: fh } });
    } catch {
      setBusy(false);
    }
  };

  const fromLibrary = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, mediaTypes: ['images'] });
    if (r.canceled) return;
    const a = r.assets[0];
    const ex = await extractDoc(a.uri);
    process({ img: ex?.uri ?? a.uri, full: a.uri, size: ex ? { w: ex.width, h: ex.height } : { w: a.width, h: a.height }, start: { x: fx, y: fy, w: fw, h: fh }, mime: ex ? 'image/jpeg' : (a.mimeType ?? 'image/jpeg') });
  };
  const fromSample = async () => {
    const a = Asset.fromModule(manuscriptImage);
    await a.downloadAsync();
    const uri = a.localUri ?? a.uri;
    process({ img: uri, full: uri, size: await sizeOf(uri), start: { x: fx, y: fy, w: fw, h: fh } });
  };

  const again = () => {
    setDoc(null);
    setBg(null);
    setReading(null);
    setBusy(false);
    fly.value = 0;
    back.value = 0;
    aura.value = 0;
    out.value = 1;
    setStage('camera');
  };

  const save = () => {
    if (!reading || demo) return;
    const kind = KINDS.includes(reading.kind) ? reading.kind : 'ตำราโบราณ';
    if (fill) {
      setWisdomResult({ title: reading.title, kind, summary: reading.modern, ingredients: reading.ingredients?.join(', '), source: 'สแกนตำรา' });
      h.success();
      router.back();
      return;
    }
    addWisdom({ id: `w${Date.now()}`, title: reading.title, kind: kind as any, source: 'สแกนตำรา', date: (() => { const t = new Date(); return `${t.getDate()}/${t.getMonth() + 1}/${t.getFullYear() + 543}`; })(), summary: reading.modern, ingredients: reading.ingredients, verified: false });
    h.success();
    setSaved(true);
  };

  if (!perm) return <View style={styles.page} />;
  if (!perm.granted) {
    const blocked = cameraBlocked();
    return (
      <View style={[styles.page, styles.center, { padding: 32 }]}>
        <StatusBar style="light" />
        <Sym name="camera.fill" size={36} color="#FFFFFF" />
        <T v="h2" color="#FFFFFF" center style={{ marginTop: 14 }}>อนุญาตให้ใช้กล้อง</T>
        <T v="callout" color="rgba(255,255,255,0.75)" center style={{ marginTop: 6 }}>{blocked ? CAMERA_HTTPS_MSG : 'ใช้ถ่ายสมุดข่อย ใบลาน หรือตำรายา เพื่อถอดความเก็บเข้าคลังภูมิปัญญา'}</T>
        {blocked ? null : <Button label="อนุญาต" onPress={requestPerm} style={{ alignSelf: 'stretch', marginTop: 24 }} />}
        <PressableScale onPress={() => router.back()} style={{ padding: 16 }}>
          <T v="callout" color="#FFFFFF">ยกเลิก</T>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      {stage === 'camera' ? (
        <>
          <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" autofocus={focus} enableTorch={torch} animateShutter={false} />
          <Pressable style={StyleSheet.absoluteFill} onPress={(e) => tapFocus(e.nativeEvent.locationX, e.nativeEvent.locationY)} accessibilityLabel="แตะเพื่อโฟกัส" />

          {/* ม่านมืดรอบกรอบ + มุมกรอบ */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: fy }]} />
            <View style={[styles.dim, { top: fy + fh, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.dim, { top: fy, left: 0, width: fx, height: fh }]} />
            <View style={[styles.dim, { top: fy, right: 0, width: fx, height: fh }]} />
            <View style={[styles.frame, { left: fx, top: fy, width: fw, height: fh }]}>
              {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                <View key={c} style={[styles.corner, styles[c]]} />
              ))}
            </View>
            <View style={[styles.guide, { top: fy - 56 }]}>
              <View style={styles.pill}>
                <T v="title" color="#FFFFFF" center>{busy ? 'กำลังถ่าย…' : 'วางตำราให้อยู่ในกรอบ'}</T>
              </View>
            </View>
            <View style={[styles.guide, { top: fy + fh + 16 }]}>
              <T v="subhead" color="rgba(255,255,255,0.85)" center>สมุดข่อย ใบลาน ตำรายา · ถ่ายตรงหน้า แสงสว่างพอ</T>
            </View>
            <Animated.View style={[styles.ring, { left: ringAt.x - 36, top: ringAt.y - 36 }, ringSt]} />
          </View>

          <View style={[styles.top, { top: insets.top + 8 }]}>
            <PressableScale onPress={() => router.back()} style={styles.round} accessibilityLabel="ปิด">
              <Sym name="xmark" size={18} color="#FFFFFF" weight="semibold" />
            </PressableScale>
            <T v="title" color="#FFFFFF">สแกนตำราโบราณ</T>
            <PressableScale onPress={() => setTorch((x) => !x)} style={[styles.round, torch && { backgroundColor: '#FFFFFF' }]} accessibilityLabel="ไฟฉาย">
              <Sym name={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'} size={18} color={torch ? '#000000' : '#FFFFFF'} />
            </PressableScale>
          </View>

          <View style={[styles.bottom, { bottom: insets.bottom + 24 }]}>
            <PressableScale onPress={fromLibrary} style={styles.round} accessibilityLabel="เลือกจากคลังรูป">
              <Sym name="photo.on.rectangle" size={20} color="#FFFFFF" />
            </PressableScale>
            <PressableScale haptic="press" scaleTo={0.9} onPress={shoot} style={styles.shutter} accessibilityLabel="ถ่ายตำรา">
              <View style={styles.shutterIn}>{busy ? <ActivityIndicator color={palette.primary} /> : null}</View>
            </PressableScale>
            <PressableScale onPress={fromSample} style={styles.round} accessibilityLabel="ลองตัวอย่าง">
              <Sym name="scroll.fill" size={19} color="#FFFFFF" />
            </PressableScale>
          </View>
        </>
      ) : null}

      {/* ── หลังถ่าย: พื้นหลังเบลอ · ตำราลอยกลางจอ · ออร่ารุ้ง + แสงสแกน ── */}
      {doc ? (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, backSt]}>
            {bg ? <Image source={{ uri: bg }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(4,21,14,0.55)', 'rgba(4,21,14,0.25)', 'rgba(4,21,14,0.75)']} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <AIGlow active={stage === 'reading'} />

          <Animated.View style={[{ position: 'absolute', left: to.x, top: to.y, width: to.w, height: to.h }, flySt]}>
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -AURA_PAD, top: -AURA_PAD, width: to.w + AURA_PAD * 2, height: to.h + AURA_PAD * 2 }, auraSt]}>
              <Canvas style={{ flex: 1 }}>
                <RoundedRect x={AURA_PAD + 6} y={AURA_PAD + 6} width={to.w - 12} height={to.h - 12} r={R}>
                  <SweepGradient c={vec(AURA_PAD + to.w / 2, AURA_PAD + to.h / 2)} colors={AI_COLORS} transform={auraRot} origin={vec(AURA_PAD + to.w / 2, AURA_PAD + to.h / 2)} />
                  <BlurMask blur={28} style="normal" />
                </RoundedRect>
                <RoundedRect x={AURA_PAD - 1} y={AURA_PAD - 1} width={to.w + 2} height={to.h + 2} r={R + 1} style="stroke" strokeWidth={2.5}>
                  <SweepGradient c={vec(AURA_PAD + to.w / 2, AURA_PAD + to.h / 2)} colors={AI_COLORS} transform={auraRot} origin={vec(AURA_PAD + to.w / 2, AURA_PAD + to.h / 2)} />
                </RoundedRect>
              </Canvas>
            </Animated.View>
            <View style={styles.docClip}>
              <Image source={{ uri: doc }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient colors={AI_COLORS.map((c) => c + '1A') as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              {/* แสงสแกนวิ่งขึ้นลง */}
              <Animated.View style={[styles.scan, scanSt]}>
                <LinearGradient colors={['rgba(124,240,168,0)', 'rgba(124,240,168,0.35)', 'rgba(255,255,255,0.9)']} style={{ flex: 1 }} />
              </Animated.View>
              <LinearGradient colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']} end={{ x: 0.5, y: 0.3 }} style={StyleSheet.absoluteFill} />
            </View>
          </Animated.View>

          {stage === 'reading' ? (
            <View style={[styles.readBox, { top: to.y + to.h + 44 }]}>
              <Animated.View entering={FadeInDown.delay(300).duration(420)} style={{ alignItems: 'center' }}>
                <AISphere size={44} active />
                <T v="h3" color="#FFFFFF" center style={{ marginTop: 10 }}>ครูปัญญากำลังอ่านตำรา</T>
                <View style={styles.steps}>
                  {STEPS.map((t, i) => {
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
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── ผลการถอดความ: แผ่นพื้นสว่างเลื่อนขึ้นจากล่าง ── */}
      {stage === 'result' && reading ? (
        <>
          <View style={[styles.top, { top: insets.top + 8 }]}>
            <PressableScale onPress={() => router.back()} style={styles.round} accessibilityLabel="ปิด">
              <Sym name="xmark" size={18} color="#FFFFFF" weight="semibold" />
            </PressableScale>
            <T v="title" color="#FFFFFF">ถอดความแล้ว</T>
            <View style={{ width: 48 }} />
          </View>
          <Animated.View entering={SlideInDown.duration(420).easing(Easing.out(Easing.cubic))} style={[styles.sheet, { top: insets.top + 72 }]}>
            <ScrollView contentContainerStyle={[{ padding: 20, paddingBottom: insets.bottom + 130, gap: 14 }, column.read]} showsVerticalScrollIndicator={false}>
              <View style={styles.head}>
                {doc ? <Image source={{ uri: doc }} style={styles.thumb} contentFit="cover" /> : null}
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={styles.badges}>
                    <View style={[styles.badge, { backgroundColor: palette.primarySoft }]}>
                      <T v="micro" color={palette.primaryDeep} style={{ fontWeight: '700' }}>{reading.kind}</T>
                    </View>
                    {demo ? (
                      <View style={[styles.badge, { backgroundColor: palette.coralSoft }]}>
                        <T v="micro" color={palette.coral} style={{ fontWeight: '700' }}>โหมดสาธิต</T>
                      </View>
                    ) : null}
                  </View>
                  <T v="h2">{reading.title}</T>
                </View>
              </View>

              {/* ถอดความ / ต้นฉบับ */}
              <View style={styles.seg}>
                {[
                  { k: 'modern' as const, l: 'ถอดความ', i: 'sparkles' },
                  { k: 'raw' as const, l: 'ต้นฉบับ', i: 'doc.text.fill' },
                ].map((s) => (
                  <PressableScale key={s.k} haptic="select" onPress={() => setTab(s.k)} style={[styles.segItem, tab === s.k && styles.segOn]} accessibilityState={{ selected: tab === s.k }}>
                    <Sym name={s.i as any} size={14} color={tab === s.k ? palette.primary : ios.secondary} />
                    <T v="callout" color={tab === s.k ? palette.ink : ios.secondary} style={{ fontWeight: '600' }}>{s.l}</T>
                  </PressableScale>
                ))}
              </View>
              <Animated.View key={tab} entering={FadeIn.duration(220)} style={[styles.card, elevation.e1, tab === 'raw' && styles.rawCard]}>
                <T v="body" color={tab === 'raw' ? '#5B4A2A' : palette.ink}>{tab === 'modern' ? reading.modern : raw}</T>
              </Animated.View>

              {reading.ingredients.length ? (
                <View style={[styles.card, elevation.e1]}>
                  <T v="title" style={{ marginBottom: 10 }}>ตัวยาที่พบในตำรา</T>
                  <View style={styles.ings}>
                    {reading.ingredients.map((x) => (
                      <View key={x} style={styles.ing}>
                        <Sym name="leaf.fill" size={12} color={palette.primary} />
                        <T v="callout" color={palette.primaryDeep}>{x}</T>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {reading.note ? (
                <View style={styles.note}>
                  <Sym name="exclamationmark.triangle.fill" size={16} color="#B07A2A" />
                  <T v="subhead" color="#7A5418" style={{ flex: 1 }}>{reading.note}</T>
                </View>
              ) : null}
            </ScrollView>
            <GlassDock>
              <Button style={{ flex: 1, height: 52 }} kind="secondary" label="สแกนต่อ" icon={<Sym name="camera.fill" size={17} color={palette.primary} />} onPress={again} />
              <Button
                style={{ flex: 1.3, height: 52 }}
                kind={saved ? 'secondary' : 'primary'}
                label={demo ? 'อ่านไม่สำเร็จ · ถ่ายใหม่' : saved ? 'ดูในคลัง' : fill ? 'ใช้ข้อมูลนี้' : 'เก็บเข้าคลัง'}
                icon={<Sym name={demo ? 'arrow.clockwise' : saved ? 'checkmark' : 'book.closed.fill'} size={17} color={saved ? palette.primary : palette.white} />}
                // อ่านไม่สำเร็จ (ข้อมูลตัวอย่าง) → ห้ามเก็บ/ใช้ ให้ถ่ายใหม่แทน
                onPress={demo ? again : saved ? () => (router.canDismiss() ? router.dismissTo('/vault') : router.navigate('/vault')) : save}
              />
            </GlassDock>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const C = 28;
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  frame: { position: 'absolute', borderRadius: R, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  corner: { position: 'absolute', width: C, height: C, borderColor: '#FFFFFF' },
  tl: { left: -2, top: -2, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: R },
  tr: { right: -2, top: -2, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: R },
  bl: { left: -2, bottom: -2, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: R },
  br: { right: -2, bottom: -2, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: R },
  guide: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)' },
  ring: { position: 'absolute', width: 72, height: 72, borderRadius: 12, borderWidth: 2, borderColor: '#FFD60A' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottom: { position: 'absolute', left: 32, right: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  docClip: { ...StyleSheet.absoluteFillObject, borderRadius: R, overflow: 'hidden', backgroundColor: '#111', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.5)' },
  scan: { position: 'absolute', left: 0, right: 0, top: 0, height: 60 },
  readBox: { position: 'absolute', left: 32, right: 32, alignItems: 'center' },
  steps: { flexDirection: 'row', gap: 14, marginTop: 14 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: '#7CF0A8', borderColor: '#7CF0A8' },
  stepNow: { borderColor: '#7CF0A8', backgroundColor: 'rgba(124,240,168,0.25)', boxShadow: '0px 0px 8px rgba(124,240,168,0.9)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: palette.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous', overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: { width: 72, height: 92, borderRadius: 12, borderCurve: 'continuous', backgroundColor: palette.bgDeep },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: palette.mint },
  segItem: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999 },
  segOn: { backgroundColor: palette.surface, boxShadow: '0px 1px 4px rgba(0,0,0,0.1)' },
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 16 },
  rawCard: { backgroundColor: '#FBF4E4' },
  ings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ing: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: palette.primarySoft },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#FCF1DE' },
});
