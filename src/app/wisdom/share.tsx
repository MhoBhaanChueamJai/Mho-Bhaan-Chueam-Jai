/**
 * แชร์ตำราให้เพื่อน — สร้างรหัสแชร์ แล้วแสดงคิวอาร์โค้ดให้เพื่อนสแกน (คลังภูมิ → สแกนรับตำรา)
 * หรือส่งต่อทาง LINE/ข้อความด้วยปุ่มด้านล่าง
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { Sym, ios } from '../../components/ios';
import { Button, PressableScale, T } from '../../components/ui';
import { createShare, prettyCode, qrPayload, shareCodeText } from '../../lib/wisdomShare';
import { doctor } from '../../data/mock';
import { useApp } from '../../store/app';
import { NotFound } from '../../components/NotFound';
import { elevation, palette } from '../../theme';
import { SheetFrame } from '../../components/nav/SheetFrame';

export default function ShareWisdom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wisdoms, profile } = useApp();
  const w = wisdoms.find((x) => x.id === id);
  const me = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || doctor.name;
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  const make = () => {
    if (!w) return;
    setErr(false);
    createShare(w, me).then(setCode).catch(() => setErr(true));
  };
  useEffect(make, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!w) return <NotFound title="ไม่พบตำรานี้" />;
  return (
    <SheetFrame>
    <View style={styles.page}>
      <View style={styles.grab} />
      <View style={styles.head}>
        <T v="h2">แชร์ตำราให้เพื่อน</T>
        <PressableScale onPress={() => router.back()} style={styles.close} accessibilityLabel="ปิด">
          <Sym name="xmark" size={15} color={ios.secondary} weight="bold" />
        </PressableScale>
      </View>
      <T v="callout" color={ios.secondary} numberOfLines={2}>{w ? `“${w.title}”` : ''}</T>

      <View style={[styles.qrCard, elevation.e2]}>
        {code ? (
          <Animated.View entering={ZoomIn.duration(380)} style={{ alignItems: 'center' }}>
            <QRCode value={qrPayload(code)} size={230} color="#0B1F15" backgroundColor="#FFFFFF" logo={require('../../../assets/icon.png')} logoSize={46} logoBorderRadius={12} logoBackgroundColor="#FFFFFF" logoMargin={4} ecl="M" />
            <T v="caption" color={ios.secondary} style={{ marginTop: 16 }}>หรือกรอกรหัส</T>
            <T v="h1" style={styles.code}>{prettyCode(code)}</T>
          </Animated.View>
        ) : err ? (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 40 }}>
            <Sym name="wifi.exclamationmark" size={30} color={palette.coral} />
            <T v="callout" color={palette.coral} center>สร้างรหัสแชร์ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต</T>
            <Button kind="secondary" label="ลองใหม่" onPress={make} />
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 90 }}>
            <ActivityIndicator color={palette.primary} />
            <T v="subhead" color={ios.secondary}>กำลังสร้างคิวอาร์โค้ด…</T>
          </View>
        )}
      </View>

      <Animated.View entering={FadeIn.delay(200)} style={styles.steps}>
        <Sym name="info.circle.fill" size={15} color={palette.primary} />
        <T v="subhead" color={ios.secondary} style={{ flex: 1 }}>ให้เพื่อนเปิด คลังภูมิ → สแกนรับตำรา แล้วส่องคิวอาร์โค้ดนี้ · ใช้ได้ 30 วัน</T>
      </Animated.View>

      <Button label="ส่งทาง LINE / ข้อความ" icon={<Sym name="square.and.arrow.up" size={17} color="#FFFFFF" />} disabled={!code} onPress={() => code && w && shareCodeText(w.title, me, code)} style={{ height: 52, marginTop: 'auto' }} />
    </View>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34 },
  grab: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.15)', marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
  qrCard: { marginTop: 20, alignSelf: 'center', alignItems: 'center', padding: 24, borderRadius: 28, borderCurve: 'continuous', backgroundColor: '#FFFFFF', minWidth: 300 },
  code: { letterSpacing: 4, marginTop: 2 },
  steps: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 18, paddingHorizontal: 4 },
});
