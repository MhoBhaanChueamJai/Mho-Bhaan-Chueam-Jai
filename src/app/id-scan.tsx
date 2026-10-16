/**
 * กล้องสแกนบัตรประชาชน — เปิดกล้องทันที
 * - กรอบสัดส่วนบัตรจริง (85.6 × 54 มม.) พร้อมมุมกรอบ ให้วางบัตรพอดีกรอบ = ระยะที่เหมาะ
 * - โฟกัสอัตโนมัติต่อเนื่อง (แตะเพื่อโฟกัสจุดนั้นได้), เปิดไฟฉายได้
 * - ถ่ายอัตโนมัติ: ถ่ายภาพเล็กเงียบๆ ทุก ~0.4 วิ ให้ Apple Vision หาบัตร (modules/card-detect)
 *   ถ้ากรอบบัตรตรงกับกรอบบนจอ 2 ครั้งติด → ถ่ายจริงเอง
 * - ถ่ายแล้วครอปเฉพาะส่วนในกรอบ ส่งกลับไปให้ AI อ่าน
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym } from '../components/ios';
import { Button, PressableScale, T, useHaptic } from '../components/ui';
import { cardDetectAvailable, detectCard } from '../../modules/card-detect';
import { setIdScanResult } from '../lib/idScan';
import { palette } from '../theme';

const CARD_RATIO = 85.6 / 54;

export default function IdScan() {
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

  const done = (uri: string, mime = 'image/jpeg') => {
    setIdScanResult({ uri, mime });
    router.back();
  };

  const shoot = async () => {
    if (!cam.current || busyRef.current) return;
    busyRef.current = true;
    h.heavy();
    setBusy(true);
    try {
      const p = await cam.current.takePictureAsync({ quality: 0.9 });
      if (!p) {
        busyRef.current = false;
        return setBusy(false);
      }
      // ภาพตัวอย่างแสดงแบบ cover → แปลงพิกัดกรอบบนจอเป็นพิกัดบนรูปจริง แล้วครอป (เผื่อขอบ 4%)
      const scale = Math.max(W / p.width, H / p.height);
      const ox = (p.width * scale - W) / 2;
      const oy = (p.height * scale - H) / 2;
      const pad = fw * 0.04;
      const crop = {
        originX: Math.max(0, (fx - pad + ox) / scale),
        originY: Math.max(0, (fy - pad + oy) / scale),
        width: Math.min(p.width, (fw + pad * 2) / scale),
        height: Math.min(p.height, (fh + pad * 2) / scale),
      };
      crop.width = Math.min(crop.width, p.width - crop.originX);
      crop.height = Math.min(crop.height, p.height - crop.originY);
      const out = await ImageManipulator.manipulateAsync(p.uri, [{ crop }], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
      done(out.uri);
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
  }, [ready]);

  const fromLibrary = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, mediaTypes: ['images'] });
    if (!r.canceled) done(r.assets[0].uri, r.assets[0].mimeType ?? 'image/jpeg');
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

      {/* ปุ่มบน: ปิด / ไฟฉาย */}
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
    </View>
  );
}

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
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)' },
  ring: { position: 'absolute', width: 72, height: 72, borderRadius: 12, borderWidth: 2, borderColor: '#FFD60A' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  bottom: { position: 'absolute', left: 32, right: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
