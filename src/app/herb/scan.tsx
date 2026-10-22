/**
 * สแกนหาสมุนไพร — เปิดกล้อง ถ่าย (หรือเลือกรูป) → ครูปัญญาดูภาพ → กล่องลอยกระจกขาวขุ่น (liquid glass) แสดงผล
 * ผลอันดับ 1 + อันดับใกล้เคียงกดสลับได้ · ตรงกับคลัง = ข้อมูลในคลัง (รส ธาตุ สรรพคุณ วิธีใช้ ข้อควรระวัง) + ปุ่มดูเต็ม
 * ไม่มีในคลัง = ข้อมูลจากครูปัญญา พร้อมคำเตือนให้ตรวจสอบ
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { CAMERA_HTTPS_MSG, cameraBlocked } from '../../lib/cameraWeb';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, cancelAnimation, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from '../../components/ios';
import { GlassCircle, Button, Glass, PressableScale, T, useHaptic } from '../../components/ui';
import { identifyHerb, setLastScan, type ScanResult } from '../../lib/herbScan';
import { palette } from '../../theme';
import { AiDownBanner } from '../../components/AiDownBanner';

const MINT = '#7CF0A8';

export default function HerbScan() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const h = useHaptic();
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [torch, setTorch] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [res, setRes] = useState<ScanResult | null>(null);

  // กรอบเล็ง + เส้นสแกนตอนกำลังวิเคราะห์
  const size = Math.min(W - 72, 320);
  const line = useSharedValue(0);
  // เส้นสแกนวิ่งเฉพาะตอนกำลังวิเคราะห์ (ไม่วิ่งค้างตลอด)
  useEffect(() => {
    if (state !== 'busy') {
      cancelAnimation(line);
      return;
    }
    line.value = 0;
    line.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [line, state]);
  // กันสแกนซ้อน / ผลมาถึงหลังปิดหน้า (เดิมเด้งแผ่นผลลัพธ์ทับหน้าอื่นได้)
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const reqId = useRef(0);
  useEffect(
    () => () => {
      mounted.current = false;
      reqId.current++;
    },
    [],
  );
  const lineSt = useAnimatedStyle(() => ({ transform: [{ translateY: line.value * (size - 6) }] }));

  const analyze = async (uri: string) => {
    const my = ++reqId.current;
    setPhoto(uri);
    setState('busy');
    setRes(null);
    try {
      const r = await identifyHerb(uri);
      if (my !== reqId.current || !mounted.current) return;
      setRes(r);
      if (r.isPlant) {
        // เจอสมุนไพร → เปิดแผ่นผลลัพธ์ (Sheet ของ iOS แบบหน้าสมุนไพร)
        h.success();
        setLastScan(uri, r);
        setState('done');
        router.push('/herb/found');
      } else {
        setState('error');
        h.warn();
      }
    } catch {
      if (my !== reqId.current || !mounted.current) return;
      setState('error');
      h.warn();
    } finally {
      busyRef.current = false;
    }
  };
  const shoot = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    h.press();
    try {
      const p = await cam.current?.takePictureAsync({ quality: 0.8, skipProcessing: false });
      if (p?.uri) return analyze(p.uri);
    } catch {}
    busyRef.current = false;
  };
  const fromLibrary = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (!r.canceled && r.assets[0]?.uri) return analyze(r.assets[0].uri);
    } catch {}
    busyRef.current = false;
  };
  const reset = () => {
    reqId.current++;
    busyRef.current = false;
    setPhoto(null);
    setRes(null);
    setState('idle');
  };
  // ปิดแผ่นผลลัพธ์กลับมา → พร้อมถ่ายใหม่
  const shown = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (shown.current) reset();
      shown.current = true;
    }, []),
  );

  if (!perm) return <View style={styles.page} />;
  if (!perm.granted) {
    const blocked = cameraBlocked();
    return (
      <View style={[styles.page, styles.center, { padding: 32 }]}>
        <StatusBar style="light" />
        <Sym name="camera.viewfinder" size={42} color="#FFFFFF" />
        <T v="h2" color="#FFFFFF" center style={{ marginTop: 14 }}>อนุญาตให้ใช้กล้อง</T>
        <T v="callout" color="rgba(255,255,255,0.75)" center style={{ marginTop: 6 }}>{blocked ? CAMERA_HTTPS_MSG : 'ใช้ถ่ายภาพต้นไม้ ใบ หรือเหง้า ให้ครูปัญญาบอกว่าเป็นสมุนไพรอะไร'}</T>
        {blocked ? null : <Button label={perm.canAskAgain ? 'อนุญาต' : 'เปิดการตั้งค่า'} onPress={perm.canAskAgain ? requestPerm : () => Linking.openSettings()} style={{ alignSelf: 'stretch', marginTop: 24 }} />}
        <PressableScale onPress={() => router.back()} style={{ padding: 16 }}>
          <T v="callout" color="#FFFFFF">ยกเลิก</T>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />}

      <AiDownBanner dark style={{ position: 'absolute', top: insets.top + 64, left: 16, right: 16, zIndex: 5 }} />
      {/* กรอบเล็ง */}
      {state !== 'done' ? (
        <View pointerEvents="none" style={[styles.frame, { width: size, height: size, left: (W - size) / 2, top: H * 0.4 - size / 2 }]}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View key={c} style={[styles.corner, styles[c]]} />
          ))}
          {state === 'busy' ? <Animated.View style={[styles.line, lineSt]} /> : null}
        </View>
      ) : null}
      {state === 'idle' ? (
        <View pointerEvents="none" style={[styles.guide, { top: H * 0.4 - size / 2 - 78 }]}>
          <T v="title" color="#FFFFFF" center>สแกนหาสมุนไพร</T>
          <T v="subhead" color="rgba(255,255,255,0.85)" center style={{ marginTop: 4 }}>ส่องให้เห็นใบ ดอก หรือเหง้าชัดๆ แล้วกดถ่าย</T>
        </View>
      ) : null}
      {state === 'busy' ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[styles.busy, { top: H * 0.4 + size / 2 + 20 }]}>
          <ActivityIndicator color="#FFFFFF" />
          <T v="subhead" color="#FFFFFF">ครูปัญญากำลังดูภาพ…</T>
        </Animated.View>
      ) : null}

      {/* หัว: ปิด · ไฟฉาย */}
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <GlassCircle label="ปิด" onPress={() => router.back()} size={48} tint="rgba(255,255,255,0.08)">
          <Sym name="xmark" size={18} color="#FFFFFF" weight="semibold" />
        </GlassCircle>
        {!photo ? (
          <GlassCircle label="ไฟฉาย" onPress={() => setTorch((x) => !x)} size={48} tint={torch ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.08)'}>
            <Sym name={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'} size={18} color={torch ? '#000000' : '#FFFFFF'} />
          </GlassCircle>
        ) : null}
      </View>

      {/* ล่าง: คลังรูป · ชัตเตอร์ · (ว่าง) */}
      {state === 'idle' ? (
        <View style={[styles.controls, { bottom: insets.bottom + 30 }]}>
          <GlassCircle label="เลือกรูปจากคลังภาพ" onPress={fromLibrary} size={52} tint="rgba(255,255,255,0.08)">
            <Sym name="photo.on.rectangle" size={20} color="#FFFFFF" />
          </GlassCircle>
          <PressableScale onPress={shoot} scaleTo={0.92} style={styles.shutter} accessibilityLabel="ถ่ายภาพ">
            <View style={styles.shutterIn} />
          </PressableScale>
          <View style={{ width: 48 }} />
        </View>
      ) : null}

      {/* อ่านไม่ได้ */}
      {state === 'error' ? (
        <View style={[styles.modalWrap, { bottom: insets.bottom + 10 }]}>
          <Glass tint="rgba(255,255,255,0.62)" style={styles.modal}>
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Sym name="leaf.circle" size={38} color={palette.coral} />
            <T v="title" center style={{ marginTop: 10 }}>{res && !res.isPlant ? 'ไม่พบพืชในภาพ' : 'ดูภาพไม่สำเร็จ'}</T>
            <T v="subhead" color={ios.secondary} center style={{ marginTop: 4 }}>ลองถ่ายใกล้ขึ้น ให้เห็นใบหรือเหง้าชัดๆ ในที่แสงพอ</T>
          </View>
          <Button label="ถ่ายใหม่" icon={<Sym name="camera.fill" size={17} color="#FFFFFF" />} onPress={reset} style={{ height: 52, marginTop: 14 }} />
          </Glass>
        </View>
      ) : null}

    </View>
  );
}

const C = 30;
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  frame: { position: 'absolute', borderRadius: 26, overflow: 'hidden' },
  corner: { position: 'absolute', width: C, height: C, borderColor: MINT },
  tl: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 26 },
  tr: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 26 },
  bl: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 26 },
  br: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 26 },
  line: { position: 'absolute', left: 12, right: 12, top: 3, height: 3, borderRadius: 2, backgroundColor: MINT, boxShadow: '0px 0px 12px rgba(124,240,168,0.9)' },
  guide: { position: 'absolute', left: 32, right: 32, alignItems: 'center' },
  busy: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  controls: { position: 'absolute', left: 32, right: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },
  modalWrap: { position: 'absolute', left: 12, right: 12, borderRadius: 38, borderCurve: 'continuous', boxShadow: '0px 18px 48px rgba(0,0,0,0.35)' },
  modal: { borderRadius: 38, borderCurve: 'continuous', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 },
});
