/**
 * สแกนคิวอาร์โค้ดรับตำราจากเพื่อน — เปิดกล้องทันที กรอบสี่เหลี่ยมกลางจอ
 * เจอรหัสแชร์ → ไปหน้ารับตำรา (ดูตัวอย่างก่อนเก็บเข้าคลัง)
 * แท็บด้านล่างสลับโหมด: สแกน | รหัส (กรอกรหัสแชร์ 8 ตัวในหน้านี้เลย)
 * สแกนเจอ/กรอกครบ 8 ตัว → อ่านรหัสอัตโนมัติ → เปิดแผ่นล่างแบบ iOS (wisdom/got) ตัวอย่างตำรา + ปุ่มเพิ่มลงคลัง
 */
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym } from '../../components/ios';
import { GlassCircle, Button, PressableScale, T, useHaptic } from '../../components/ui';
import { cleanCode, codeFromScan, fetchShare } from '../../lib/wisdomShare';

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
  const switchMode = (m: 'scan' | 'code') => {
    if (m === mode) return;
    h.select();
    setMode(m);
    if (m === 'code') setTorch(false);
    if (m === 'code') setTimeout(() => input.current?.focus(), 250);
    else input.current?.blur();
  };
  // ── อ่านรหัสอัตโนมัติ → แผ่นล่างแสดงตัวอย่างตำรา ──
  // สถานะการอ่านรหัส: กำลังอ่าน / อ่านไม่ได้ (เจอตำรา → เปิดแผ่นล่างแบบ iOS หน้า wisdom/got)
  const [status, setStatus] = useState<null | { code: string; state: 'loading' | 'error'; err?: string }>(null);
  const look = async (c: string) => {
    Keyboard.dismiss();
    setStatus({ code: c, state: 'loading' });
    try {
      const got = await fetchShare(c);
      if (!got) {
        h.warn();
        setStatus({ code: c, state: 'error', err: 'ไม่พบตำราจากรหัสนี้ หรือรหัสหมดอายุแล้ว' });
      } else {
        h.success();
        setStatus(null);
        router.push({ pathname: '/wisdom/got', params: { code: c } });
      }
    } catch {
      h.warn();
      setStatus({ code: c, state: 'error', err: 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง' });
    }
  };
  const retry = () => {
    setStatus(null);
    done.current = false;
    if (mode === 'code') {
      setCode('');
      setTimeout(() => input.current?.focus(), 200);
    }
  };
  // ปิดแผ่นล่างกลับมาหน้านี้ → พร้อมสแกน/กรอกรหัสใหม่
  useFocusEffect(
    useCallback(() => {
      done.current = false;
      setStatus(null);
      setCode('');
    }, []),
  );
  useEffect(() => {
    if (mode === 'code' && code.length === 8 && !status) look(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, mode]);
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
    look(code);
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
          {/* เบลอภาพกล้องด้านหลัง */}
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
          {/* แตะพื้นที่ว่างเพื่อปิดคีย์บอร์ด */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => Keyboard.dismiss()} accessibilityLabel="ปิดคีย์บอร์ด" />
          <Image source={require('../../../assets/icons/books.png')} style={{ width: 32, height: 32 }} tintColor="#7CF0A8" />
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
            onSubmitEditing={() => code.length === 8 && look(code)}
            style={styles.hiddenInput}
            accessibilityLabel="รหัสรับตำรา"
          />
        </Animated.View>
      )}

      <View style={[styles.top, { top: insets.top + 8 }]}>
        <GlassCircle label="ปิด" onPress={() => router.back()} size={48} tint="rgba(255,255,255,0.08)">
          <Sym name="xmark" size={18} color="#FFFFFF" weight="semibold" />
        </GlassCircle>
        {mode === 'scan' ? (
          <GlassCircle label="ไฟฉาย" onPress={() => setTorch((x) => !x)} size={48} tint={torch ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.08)'}>
            <Sym name={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'} size={18} color={torch ? '#000000' : '#FFFFFF'} />
          </GlassCircle>
        ) : null}
      </View>

      {/* แท็บสลับโหมดแบบ iOS (UISegmentedControl) — อยู่กับที่ คีย์บอร์ดเลื่อนขึ้นมาทับได้ */}
      <View style={[styles.bottom, { bottom: insets.bottom + 24 }]}>
        <SegmentedControl
          values={['สแกน', 'รหัส']}
          selectedIndex={mode === 'scan' ? 0 : 1}
          onChange={(e) => switchMode(e.nativeEvent.selectedSegmentIndex === 0 ? 'scan' : 'code')}
          appearance="dark"
          style={styles.seg}
        />
      </View>

      {/* กำลังอ่านรหัส / อ่านไม่ได้ */}
      {status ? (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[styles.loading, { bottom: insets.bottom + 90 }, status.state === 'error' && styles.errPill]}>
          {status.state === 'loading' ? (
            <>
              <ActivityIndicator color="#FFFFFF" />
              <T v="subhead" color="#FFFFFF">กำลังอ่านรหัส {status.code.slice(0, 4)}-{status.code.slice(4)}…</T>
            </>
          ) : (
            <PressableScale onPress={retry} style={styles.errRow} accessibilityLabel="ลองใหม่">
              <Sym name="exclamationmark.circle.fill" size={16} color="#FFFFFF" />
              <T v="subhead" color="#FFFFFF" style={{ flexShrink: 1 }}>{status.err}</T>
              <T v="subhead" color="#FFFFFF" style={{ fontWeight: '700' }}>ลองใหม่</T>
            </PressableScale>
          )}
        </Animated.View>
      ) : null}
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
  errPill: { backgroundColor: 'rgba(217,83,74,0.9)' },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loading: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)' },
  codePage: { alignItems: 'center', paddingHorizontal: 24 },
  boxes: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 28 },
  box: { width: 36, height: 48, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  boxOn: { borderColor: '#7CF0A8' },
  boxFilled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
