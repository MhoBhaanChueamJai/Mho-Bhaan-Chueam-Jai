/**
 * สแกนคิวอาร์โค้ดรับตำราจากเพื่อน — เปิดกล้องทันที กรอบสี่เหลี่ยมกลางจอ
 * เจอรหัสแชร์ → ไปหน้ารับตำรา (ดูตัวอย่างก่อนเก็บเข้าคลัง) · ไม่มี QR กรอกรหัสเองได้
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym } from '../../components/ios';
import { Button, PressableScale, T, useHaptic } from '../../components/ui';
import { codeFromScan } from '../../lib/wisdomShare';

export default function ScanQr() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const h = useHaptic();
  const [perm, requestPerm] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [bad, setBad] = useState(false);
  const done = useRef(false);
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
      <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
      {/* ม่านมืดรอบกรอบ */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
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
      </View>

      <View style={[styles.top, { top: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} style={styles.round} accessibilityLabel="ปิด">
          <Sym name="xmark" size={18} color="#FFFFFF" weight="semibold" />
        </PressableScale>
        <PressableScale onPress={() => setTorch((x) => !x)} style={[styles.round, torch && { backgroundColor: '#FFFFFF' }]} accessibilityLabel="ไฟฉาย">
          <Sym name={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'} size={18} color={torch ? '#000000' : '#FFFFFF'} />
        </PressableScale>
      </View>

      <View style={[styles.bottom, { bottom: insets.bottom + 28 }]}>
        <PressableScale haptic="select" onPress={() => router.replace('/wisdom/receive')} style={styles.manual} accessibilityLabel="กรอกรหัสเอง">
          <Sym name="keyboard" size={17} color="#FFFFFF" />
          <T v="bodyStrong" color="#FFFFFF">กรอกรหัสเอง</T>
        </PressableScale>
      </View>
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
  manual: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingHorizontal: 24, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.18)' },
});
