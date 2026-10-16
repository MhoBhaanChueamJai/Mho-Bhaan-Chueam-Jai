/**
 * สแกนคิวอาร์โค้ดรับตำราจากเพื่อน — เปิดกล้องทันที กรอบสี่เหลี่ยมกลางจอ
 * เจอรหัสแชร์ → ไปหน้ารับตำรา (ดูตัวอย่างก่อนเก็บเข้าคลัง)
 * แท็บด้านล่างสลับโหมด: สแกน | รหัส (กรอกรหัสแชร์ 8 ตัวในหน้านี้เลย)
 * สแกนเจอ/กรอกครบ 8 ตัว → อ่านรหัสอัตโนมัติ → เด้งแผ่นล่าง (bottom sheet) แสดงปก ชื่อ ผู้แชร์ ประเภท เนื้อหา 5 บรรทัด + ปุ่มเพิ่มลงคลัง
 */
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym } from '../../components/ios';
import { Button, PressableScale, T, useHaptic } from '../../components/ui';
import { BookCover } from '../../components/BookCover';
import { KindIcon } from '../../components/KindIcon';
import type { Wisdom } from '../../data/mock';
import { plainText } from '../../lib/wisdomKinds';
import { cleanCode, codeFromScan, fetchShare, type ReceivedShare } from '../../lib/wisdomShare';
import { useApp } from '../../store/app';
import { palette } from '../../theme';

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
  const { addWisdom, wisdoms } = useApp();
  const [sheet, setSheet] = useState<null | { code: string; state: 'loading' | 'error' | 'ok'; got?: ReceivedShare; err?: string; savedId?: string }>(null);
  const look = async (c: string) => {
    Keyboard.dismiss();
    setSheet({ code: c, state: 'loading' });
    try {
      const got = await fetchShare(c);
      if (!got) {
        h.warn();
        setSheet({ code: c, state: 'error', err: 'ไม่พบตำราจากรหัสนี้ หรือรหัสหมดอายุแล้ว' });
      } else {
        h.success();
        setSheet({ code: c, state: 'ok', got });
      }
    } catch {
      h.warn();
      setSheet({ code: c, state: 'error', err: 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง' });
    }
  };
  const closeSheet = () => {
    setSheet(null);
    done.current = false;
    if (mode === 'code') {
      setCode('');
      setTimeout(() => input.current?.focus(), 250);
    }
  };
  useEffect(() => {
    if (mode === 'code' && code.length === 8 && !sheet) look(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, mode]);
  const save = () => {
    if (!sheet?.got) return;
    const g = sheet.got;
    const t = new Date();
    const id = `w${Date.now()}`;
    addWisdom({
      ...g.wisdom,
      id,
      source: 'เพื่อนแชร์',
      sharedBy: g.fromName,
      shareCode: cleanCode(sheet.code),
      date: `${t.getDate()}/${t.getMonth() + 1}/${t.getFullYear() + 543}`,
      summary: g.wisdom.summary ?? '',
      verified: false,
    });
    h.success();
    setSheet({ ...sheet, savedId: id });
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
        <PressableScale onPress={() => router.back()} style={styles.round} accessibilityLabel="ปิด">
          <Sym name="xmark" size={18} color="#FFFFFF" weight="semibold" />
        </PressableScale>
        {mode === 'scan' ? (
          <PressableScale onPress={() => setTorch((x) => !x)} style={[styles.round, torch && { backgroundColor: '#FFFFFF' }]} accessibilityLabel="ไฟฉาย">
            <Sym name={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'} size={18} color={torch ? '#000000' : '#FFFFFF'} />
          </PressableScale>
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

      {/* แผ่นล่าง: ตัวอย่างตำราที่ได้รับ */}
      {sheet ? (
        <>
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(180)} style={[StyleSheet.absoluteFill, styles.backdrop]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} accessibilityLabel="ปิด" />
          </Animated.View>
          <Animated.View entering={SlideInDown.springify().damping(18).mass(0.8)} exiting={SlideOutDown.duration(220)} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />
            {sheet.state === 'loading' ? (
              <View style={styles.sheetCenter}>
                <ActivityIndicator color={palette.primary} />
                <T v="subhead" color={palette.inkSoft} style={{ marginTop: 10 }}>กำลังอ่านรหัส {sheet.code.slice(0, 4)}-{sheet.code.slice(4)}…</T>
              </View>
            ) : sheet.state === 'error' ? (
              <View style={styles.sheetCenter}>
                <Sym name="exclamationmark.circle.fill" size={30} color={palette.coral} />
                <T v="title" center style={{ marginTop: 10 }}>{sheet.err}</T>
                <Button kind="secondary" label="ลองรหัสอื่น" onPress={closeSheet} style={{ alignSelf: 'stretch', height: 52, marginTop: 18 }} />
              </View>
            ) : sheet.got ? (
              (() => {
                const g = sheet.got;
                const pw = { ...g.wisdom, id: 'preview', source: 'เพื่อนแชร์', date: '', verified: true, summary: g.wisdom.summary ?? '' } as Wisdom;
                const dup = wisdoms.some((x) => x.title === g.wisdom.title && x.sharedBy === g.fromName);
                return (
                  <View style={{ gap: 16 }}>
                    <View style={styles.sheetHead}>
                      <BookCover w={pw} width={92} />
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={styles.kindPill}>
                          <KindIcon kind={g.wisdom.kind} size={12} color={palette.primaryDeep} />
                          <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '700' }}>{g.wisdom.kind}</T>
                        </View>
                        <T v="h3" numberOfLines={3}>{g.wisdom.title}</T>
                        <View style={styles.byRow}>
                          <Sym name="person.crop.circle.fill" size={14} color={palette.inkSoft} />
                          <T v="subhead" color={palette.inkSoft} numberOfLines={1} style={{ flex: 1 }}>เพิ่มโดย {g.fromName}</T>
                        </View>
                      </View>
                    </View>
                    {g.wisdom.summary ? (
                      <T v="body" color={palette.inkSoft} numberOfLines={5}>{plainText(g.wisdom.summary).replace(/\n*(ได้รับสืบทอดจาก|แหล่งที่มา):.*$/, '').trim()}</T>
                    ) : null}
                    {sheet.savedId ? (
                      <Button label="เปิดดูในคลัง" icon={<Sym name="book.fill" size={17} color="#FFFFFF" />} onPress={() => router.replace(`/wisdom/${sheet.savedId}`)} style={{ height: 52 }} />
                    ) : (
                      <Button label={dup ? 'มีในคลังแล้ว · เพิ่มอีกครั้ง' : 'เพิ่มลงคลัง'} icon={<Sym name="plus" size={17} color="#FFFFFF" weight="semibold" />} onPress={save} style={{ height: 52 }} />
                    )}
                  </View>
                );
              })()
            ) : null}
          </Animated.View>
        </>
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
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: palette.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderCurve: 'continuous', paddingHorizontal: 20, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(60,60,67,0.25)', marginBottom: 16 },
  sheetCenter: { alignItems: 'center', paddingVertical: 24 },
  sheetHead: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  kindPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: palette.primarySoft },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  codePage: { alignItems: 'center', paddingHorizontal: 24 },
  boxes: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 28 },
  box: { width: 36, height: 48, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  boxOn: { borderColor: '#7CF0A8' },
  boxFilled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
