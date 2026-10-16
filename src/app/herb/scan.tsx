/**
 * สแกนหาสมุนไพร — เปิดกล้อง ถ่าย (หรือเลือกรูป) → ครูปัญญาดูภาพ → กล่องลอยกระจกขาวขุ่น (liquid glass) แสดงผล
 * ผลอันดับ 1 + อันดับใกล้เคียงกดสลับได้ · ตรงกับคลัง = ข้อมูลในคลัง (รส ธาตุ สรรพคุณ วิธีใช้ ข้อควรระวัง) + ปุ่มดูเต็ม
 * ไม่มีในคลัง = ข้อมูลจากครูปัญญา พร้อมคำเตือนให้ตรวจสอบ
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from '../../components/ios';
import { Button, Glass, PressableScale, T, useHaptic } from '../../components/ui';
import { tasteTone } from '../../data/herbs';
import { identifyHerb, type ScanResult } from '../../lib/herbScan';
import { elementColor, palette } from '../../theme';

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
  const [pick, setPick] = useState(0);

  // กรอบเล็ง + เส้นสแกนตอนกำลังวิเคราะห์
  const size = Math.min(W - 72, 320);
  const line = useSharedValue(0);
  useEffect(() => {
    line.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [line]);
  const lineSt = useAnimatedStyle(() => ({ transform: [{ translateY: line.value * (size - 6) }] }));

  const analyze = async (uri: string) => {
    setPhoto(uri);
    setState('busy');
    setRes(null);
    setPick(0);
    try {
      const r = await identifyHerb(uri);
      setRes(r);
      setState(r.isPlant ? 'done' : 'error');
      if (r.isPlant) h.success();
      else h.warn();
    } catch {
      setState('error');
      h.warn();
    }
  };
  const shoot = async () => {
    if (state === 'busy') return;
    h.press();
    const p = await cam.current?.takePictureAsync({ quality: 0.8, skipProcessing: false });
    if (p?.uri) analyze(p.uri);
  };
  const fromLibrary = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!r.canceled && r.assets[0]?.uri) analyze(r.assets[0].uri);
  };
  const reset = () => {
    setPhoto(null);
    setRes(null);
    setState('idle');
  };

  if (!perm) return <View style={styles.page} />;
  if (!perm.granted) {
    return (
      <View style={[styles.page, styles.center, { padding: 32 }]}>
        <StatusBar style="light" />
        <Sym name="camera.viewfinder" size={42} color="#FFFFFF" />
        <T v="h2" color="#FFFFFF" center style={{ marginTop: 14 }}>อนุญาตให้ใช้กล้อง</T>
        <T v="callout" color="rgba(255,255,255,0.75)" center style={{ marginTop: 6 }}>ใช้ถ่ายภาพต้นไม้ ใบ หรือเหง้า ให้ครูปัญญาบอกว่าเป็นสมุนไพรอะไร</T>
        <Button label="อนุญาต" onPress={requestPerm} style={{ alignSelf: 'stretch', marginTop: 24 }} />
        <PressableScale onPress={() => router.back()} style={{ padding: 16 }}>
          <T v="callout" color="#FFFFFF">ยกเลิก</T>
        </PressableScale>
      </View>
    );
  }

  const g = res?.guesses[pick];
  const herb = g?.herb;
  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />}

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
        <PressableScale onPress={() => router.back()} style={styles.round} accessibilityLabel="ปิด">
          <Sym name="xmark" size={18} color="#FFFFFF" weight="semibold" />
        </PressableScale>
        {!photo ? (
          <PressableScale onPress={() => setTorch((x) => !x)} style={[styles.round, torch && { backgroundColor: '#FFFFFF' }]} accessibilityLabel="ไฟฉาย">
            <Sym name={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'} size={18} color={torch ? '#000000' : '#FFFFFF'} />
          </PressableScale>
        ) : null}
      </View>

      {/* ล่าง: คลังรูป · ชัตเตอร์ · (ว่าง) */}
      {state === 'idle' ? (
        <View style={[styles.controls, { bottom: insets.bottom + 30 }]}>
          <PressableScale onPress={fromLibrary} style={styles.round} accessibilityLabel="เลือกรูปจากคลังภาพ">
            <Sym name="photo.on.rectangle" size={20} color="#FFFFFF" />
          </PressableScale>
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

      {/* ผลลัพธ์ */}
      {state === 'done' && res && g ? (
        <View style={[styles.modalWrap, { bottom: insets.bottom + 10 }]}>
          <Glass tint="rgba(255,255,255,0.62)" style={styles.modal}>
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
            <View style={styles.resHead}>
              <Image source={herb ? herb.image : { uri: photo ?? undefined }} style={styles.resImg} contentFit="cover" />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.confRow}>
                  <View style={[styles.conf, { backgroundColor: g.confidence >= 70 ? palette.primarySoft : '#FCEBD2' }]}>
                    <T v="micro" color={g.confidence >= 70 ? palette.primaryDeep : '#9A5A0C'} style={{ fontWeight: '700' }}>
                      {g.confidence >= 70 ? 'มั่นใจสูง' : g.confidence >= 45 ? 'น่าจะเป็น' : 'ไม่แน่ใจ'} · {g.confidence}%
                    </T>
                  </View>
                  {herb ? (
                    <View style={[styles.conf, { backgroundColor: palette.primarySoft }]}>
                      <T v="micro" color={palette.primaryDeep} style={{ fontWeight: '700' }}>มีในคลัง</T>
                    </View>
                  ) : null}
                </View>
                <T v="h2" numberOfLines={1}>{g.name}</T>
                {g.sci ? <T v="subhead" color={ios.secondary} numberOfLines={1} style={{ fontStyle: 'italic' }}>{g.sci}</T> : null}
              </View>
            </View>

            {/* อันดับใกล้เคียง: กดสลับ */}
            {res.guesses.length > 1 ? (
              <View style={styles.alts}>
                <T v="caption" color={ios.secondary} style={{ fontWeight: '600' }}>ใกล้เคียง</T>
                {res.guesses.map((x, i) => (
                  <PressableScale key={x.name} haptic="select" onPress={() => setPick(i)} style={[styles.alt, i === pick && styles.altOn]} accessibilityState={{ selected: i === pick }}>
                    <T v="subhead" color={i === pick ? '#FFFFFF' : palette.ink} style={{ fontWeight: '600' }}>{x.name}</T>
                  </PressableScale>
                ))}
              </View>
            ) : null}

            {herb ? (
              <>
                <View style={styles.pills}>
                  <View style={[styles.pill, { backgroundColor: tasteTone[herb.taste].bg }]}>
                    <T v="caption" color={tasteTone[herb.taste].fg} style={{ fontWeight: '700' }}>รส{herb.taste}</T>
                  </View>
                  <View style={[styles.pill, { backgroundColor: elementColor[herb.element].bg }]}>
                    <T v="caption" color={elementColor[herb.element].fg} style={{ fontWeight: '700' }}>{elementColor[herb.element].label}</T>
                  </View>
                  <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
                    <T v="caption" color={palette.inkSoft} style={{ fontWeight: '600' }}>ใช้ {herb.part}</T>
                  </View>
                </View>
                <Info icon="cross.case.fill" color="#3B7DD8" title="สรรพคุณ" items={herb.uses.slice(0, 4)} />
                <Info icon="drop.fill" color="#B26A12" title="วิธีใช้" text={herb.howto} />
                <Info icon="exclamationmark.triangle.fill" color={palette.coral} title="ข้อควรระวัง" text={herb.caution} />
              </>
            ) : pick === 0 && (g.uses.length || g.howto) ? (
              <>
                <View style={styles.aiNote}>
                  <Sym name="sparkles" size={13} color="#9A5A0C" />
                  <T v="caption" color="#9A5A0C" style={{ flex: 1 }}>ยังไม่มีในคลังสมุนไพร ข้อมูลด้านล่างมาจากครูปัญญา ควรตรวจสอบกับตำราก่อนใช้</T>
                </View>
                {g.uses.length ? <Info icon="cross.case.fill" color="#3B7DD8" title="สรรพคุณ" items={g.uses} /> : null}
                {g.howto ? <Info icon="drop.fill" color="#B26A12" title="วิธีใช้" text={g.howto} /> : null}
                {g.caution ? <Info icon="exclamationmark.triangle.fill" color={palette.coral} title="ข้อควรระวัง" text={g.caution} /> : null}
              </>
            ) : null}
            {g.clues ? <T v="caption" color={ios.tertiary} style={{ marginTop: 12 }}>ลักษณะที่ครูปัญญาเห็น: {g.clues}</T> : null}
            {res.tip && g.confidence < 70 ? <T v="caption" color={ios.tertiary} style={{ marginTop: 4 }}>เคล็ดลับ: {res.tip}</T> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Button kind="secondary" label="ถ่ายใหม่" onPress={reset} style={{ flex: 1, height: 52 }} />
            {herb ? (
              <Button label="ดูรายละเอียด" onPress={() => router.replace(`/herb/${herb.id}`)} style={{ flex: 1.4, height: 52 }} />
            ) : (
              <Button label="ถามครูปัญญา" icon={<Sym name="sparkles" size={16} color="#FFFFFF" />} onPress={() => router.replace({ pathname: '/assistant', params: { q: `${g.name} มีสรรพคุณและวิธีใช้ตามการแพทย์แผนไทยอย่างไร ข้อควรระวังมีอะไรบ้าง` } })} style={{ flex: 1.4, height: 52 }} />
            )}
          </View>
          </Glass>
        </View>
      ) : null}
    </View>
  );
}

function Info({ icon, color, title, text, items }: { icon: string; color: string; title: string; text?: string; items?: string[] }) {
  return (
    <View style={styles.info}>
      <View style={styles.infoHead}>
        <Sym name={icon as any} size={14} color={color} />
        <T v="subhead" style={{ fontWeight: '700' }}>{title}</T>
      </View>
      {items ? (
        items.map((x) => (
          <View key={x} style={{ flexDirection: 'row', gap: 6 }}>
            <T v="body" color={palette.inkSoft}>•</T>
            <T v="body" color={palette.inkSoft} style={{ flex: 1 }}>{x}</T>
          </View>
        ))
      ) : (
        <T v="body" color={palette.inkSoft}>{text}</T>
      )}
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
  resHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  resImg: { width: 76, height: 76, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.bgDeep },
  confRow: { flexDirection: 'row', gap: 6 },
  conf: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  alts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 14 },
  alt: { paddingHorizontal: 12, height: 32, justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(60,60,67,0.12)' },
  altOn: { backgroundColor: palette.primary, borderColor: 'transparent' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  aiNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 14, padding: 10, borderRadius: 12, backgroundColor: '#FDF3E3' },
  info: { marginTop: 14, gap: 4 },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
