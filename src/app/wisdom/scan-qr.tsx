/**
 * สแกนคิวอาร์โค้ดรับตำราจากเพื่อน — เปิดกล้องทันที กรอบสี่เหลี่ยมกลางจอ
 * เจอรหัสแชร์ → ไปหน้ารับตำรา (ดูตัวอย่างก่อนเก็บเข้าคลัง)
 * แท็บด้านล่างสลับโหมด: สแกน | รหัส (กรอกรหัสแชร์ 8 ตัวในหน้านี้เลย)
 */
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedKeyboard, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym } from '../../components/ios';
import { Button, PressableScale, T, useHaptic } from '../../components/ui';
import { cleanCode, codeFromScan } from '../../lib/wisdomShare';

export default function ScanQr() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const h = useHaptic();
  const [perm, requestPerm] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [bad, setBad] = useState(false);
  const done = useRef(false);
  const [mode, setMode] = useState<'scan' | 'code'>('scan');
  const [code, setCode] = useState('');
  const input = useRef<TextInput>(null);
  // แท็บและปุ่มยกขึ้นตามคีย์บอร์ด (โหมดกรอกรหัส)
  const kb = useAnimatedKeyboard();
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.max(0, kb.height.value - insets.bottom - 8) }] }));
  const switchMode = (m: 'scan' | 'code') => {
    if (m === mode) return;
    h.select();
    setMode(m);
    if (m === 'code') setTimeout(() => input.current?.focus(), 250);
    else input.current?.blur();
  };
  const submit = () => {
    if (code.length < 8) return;
    h.success();
    router.replace({ pathname: '/wisdom/receive', params: { code } });
  };
  const size = Math.min(W - 96, 300);
  const fx = (W - size) / 2, fy = H * 0.42 - size / 2;

  // เส้นสแกนวิ่งขึ้นลง
  const line = useSharedValue(0);
  useEffect(() => {
    line.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [line]);
  const lineSt = useAnimatedStyle(() => ({ transform: [{ translateY: line.value * (size - 6) }] }));

  const onScan = ({ data }: { data: string }) => {
    if (done.current) return;
    const code = codeFromScan(data);
    if (!code) {
      if (!bad) {
        setBad(true);
        h.warn();
        setTimeout(() => setBad(false), 1800);
      }
      return;
    }
    done.current = true;
    h.success();
    router.replace({ pathname: '/wisdom/receive', params: { code } });
  };

  if (!perm) return <View style={styles.page} />;
  if (!perm.granted) {
    return (
      <View style={[styles.page, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <StatusBar style="light" />
        <Sym name="qrcode.viewfinder" size={40} color="#FFFFFF" />
        <T v="h2" color="#FFFFFF" center style={{ marginTop: 14 }}>อนุญาตให้ใช้กล้อง</T>
        <T v="callout" color="rgba(255,255,255,0.75)" center style={{ marginTop: 6 }}>ใช้สแกนคิวอาร์โค้ดตำราที่เพื่อนหมอแชร์ให้</T>
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
      <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={mode === 'scan' ? onScan : undefined} />
      {/* ม่านมืดรอบกรอบ */}
      {mode === 'scan' ? (
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.dim, { top: 0, left: 0, right: 0, height: fy }]} />
        <View style={[styles.dim, { top: fy + size, left: 0, right: 0, bottom: 0 }]} />
        <View style={[styles.dim, { top: fy, left: 0, width: fx, height: size }]} />
        <View style={[styles.dim, { top: fy, right: 0, width: fx, height: size }]} />
        <View style={[styles.frame, { left: fx, top: fy, width: size, height: size }, bad && { borderColor: '#FF6B5E' }]}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View key={c} style={[styles.corner, styles[c], bad && { borderColor: '#FF6B5E' }]} />
          ))}
          <Animated.View style={[styles.line, lineSt]} />
        </View>
        <View style={[styles.guide, { top: fy - 70 }]}>
          <T v="title" color="#FFFFFF" center>สแกนคิวอาร์โค้ดรับตำรา</T>
          <T v="subhead" color="rgba(255,255,255,0.8)" center style={{ marginTop: 4 }}>{bad ? 'ไม่ใช่คิวอาร์โค้ดตำราของหมอบ้านเชื่อมใจ' : 'ให้เพื่อนเปิดหน้าแชร์ตำรา แล้วส่องกล้องที่คิวอาร์โค้ด'}</T>
        </View>
      </Animated.View>
      ) : (
        // โหมดกรอกรหัส: ม่านทึบ + ช่องรหัส 8 ตัว (ABCD-EFGH)
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, styles.codePage, { paddingTop: insets.top + 110 }]}>
          <Sym name="number" size={30} color="#7CF0A8" />
          <T v="title" color="#FFFFFF" center style={{ marginTop: 12 }}>กรอกรหัสรับตำรา</T>
          <T v="subhead" color="rgba(255,255,255,0.7)" center style={{ marginTop: 4 }}>รหัส 8 ตัวที่เพื่อนส่งให้ทาง LINE หรือข้อความ</T>
          <PressableScale onPress={() => input.current?.focus()} style={styles.boxes} accessibilityLabel="ช่องกรอกรหัส">
            {Array.from({ length: 8 }, (_, i) => (
              <React.Fragment key={i}>
                {i === 4 ? <T v="title" color="rgba(255,255,255,0.4)">–</T> : null}
                <View style={[styles.box, i === code.length && styles.boxOn, !!code[i] && styles.boxFilled]}>
                  <T v="h2" color="#FFFFFF">{code[i] ?? ''}</T>
                </View>
              </React.Fragment>
            ))}
          </PressableScale>
          <TextInput
            ref={input}
            value={code}
            onChangeText={(t) => setCode(cleanCode(t).slice(0, 8))}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="ascii-capable"
            returnKeyType="done"
            onSubmitEditing={submit}
            style={styles.hiddenInput}
            accessibilityLabel="รหัสรับตำรา"
          />
        </Animated.View>
      )}

      <View style={[styles.top, { top: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} style={styles.round} accessibilityLabel="ปิด">
          <Sym name="xmark" size={18} color="#FFFFFF" weight="semibold" />
        </PressableScale>
        <PressableScale onPress={() => setTorch((x) => !x)} style={[styles.round, torch && { backgroundColor: '#FFFFFF' }]} accessibilityLabel="ไฟฉาย">
          <Sym name={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'} size={18} color={torch ? '#000000' : '#FFFFFF'} />
        </PressableScale>
      </View>

      <Animated.View style={[styles.bottom, { bottom: insets.bottom + 24 }, lift]}>
        {mode === 'code' ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ alignSelf: 'stretch', paddingHorizontal: 24, marginBottom: 14 }}>
            <Button label="รับตำรา" icon={<Sym name="tray.and.arrow.down.fill" size={17} color="#04150E" />} disabled={code.length < 8} onPress={submit} style={{ height: 52, backgroundColor: '#7CF0A8' }} />
          </Animated.View>
        ) : null}
        {/* แท็บสลับโหมดแบบ iOS (UISegmentedControl) */}
        <SegmentedControl
          values={['สแกน', 'รหัส']}
          selectedIndex={mode === 'scan' ? 0 : 1}
          onChange={(e) => switchMode(e.nativeEvent.selectedSegmentIndex === 0 ? 'scan' : 'code')}
          appearance="dark"
          style={styles.seg}
        />
      </Animated.View>
    </View>
  );
}

const C = 30;
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  frame: { position: 'absolute', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  corner: { position: 'absolute', width: C, height: C, borderColor: '#7CF0A8' },
  tl: { left: -1, top: -1, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 22 },
  tr: { right: -1, top: -1, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 22 },
  bl: { left: -1, bottom: -1, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 22 },
  br: { right: -1, bottom: -1, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 22 },
  line: { position: 'absolute', left: 12, right: 12, top: 3, height: 3, borderRadius: 2, backgroundColor: '#7CF0A8', boxShadow: '0px 0px 12px rgba(124,240,168,0.9)' },
  guide: { position: 'absolute', left: 32, right: 32, alignItems: 'center' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  seg: { width: 240, height: 36 },
  codePage: { backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', paddingHorizontal: 24 },
  boxes: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 28 },
  box: { width: 36, height: 48, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  boxOn: { borderColor: '#7CF0A8' },
  boxFilled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
