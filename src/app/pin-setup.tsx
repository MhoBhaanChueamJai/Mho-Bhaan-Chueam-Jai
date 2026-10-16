/**
 * ตั้งรหัส PIN → ยืนยัน → (ถ้าเครื่องรองรับ) ชวนเปิด Face ID
 *  mode=onboard : หลังเข้าสู่ระบบครั้งแรก มีปุ่ม "ไว้ทีหลัง" แล้วไปหน้าหลัก
 *  mode=change  : จากหน้าตั้งค่า (ตั้งใหม่/เปลี่ยน PIN) เสร็จแล้วปิดหน้า
 *  mode=face    : จากหน้าตั้งค่า เปิดเฉพาะ Face ID
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym } from '../components/ios';
import { PinPad, type PinPadHandle } from '../components/PinPad';
import { Button, PressableScale, T, useHaptic } from '../components/ui';
import { useApp } from '../store/app';
import { authenticateBiometric, biometricInfo, savePin } from '../store/security';
import { palette } from '../theme';

type Step = 'create' | 'confirm' | 'face';

export default function PinSetup() {
  const { mode = 'onboard' } = useLocalSearchParams<{ mode?: 'onboard' | 'change' | 'face' }>();
  const insets = useSafeAreaInsets();
  const { update, setUnlocked } = useApp();
  const h = useHaptic();
  const pad = useRef<PinPadHandle>(null);
  const [step, setStep] = useState<Step>(mode === 'face' ? 'face' : 'create');
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [bio, setBio] = useState({ available: false, label: 'Face ID', icon: 'faceid' as 'faceid' | 'touchid' });

  useEffect(() => {
    biometricInfo().then(setBio);
  }, []);

  const finish = () => {
    setUnlocked(true);
    if (mode === 'onboard') router.replace('/home');
    else router.back();
  };

  const onComplete = async (pin: string) => {
    if (step === 'create') {
      setFirst(pin);
      setValue('');
      setError('');
      setStep('confirm');
      return;
    }
    if (pin !== first) {
      pad.current?.shake();
      setValue('');
      setError('รหัส PIN ไม่ตรงกัน ลองตั้งใหม่อีกครั้ง');
      setFirst('');
      setStep('create');
      return;
    }
    await savePin(pin);
    update({ pinEnabled: true });
    h.success();
    if (bio.available && mode === 'onboard') setStep('face');
    else finish();
  };

  const enableFace = async () => {
    const ok = await authenticateBiometric(`เปิดใช้ ${bio.label} สำหรับหมอบ้านเชื่อมใจ`);
    if (ok) {
      update({ faceIdEnabled: true });
      h.success();
      finish();
    }
  };

  const skip = () => {
    if (step === 'face') return finish();
    // ข้ามการตั้ง PIN ตอนเข้าสู่ระบบครั้งแรก
    setUnlocked(true);
    router.replace('/home');
  };

  const title = step === 'create' ? (mode === 'change' ? 'ตั้งรหัส PIN ใหม่' : 'ตั้งรหัส PIN') : step === 'confirm' ? 'ยืนยันรหัส PIN' : `ใช้ ${bio.label}`;
  const sub =
    step === 'create'
      ? 'ใช้ปลดล็อกแอปครั้งถัดไป โดยไม่ต้องกรอกรหัสผ่านใหม่'
      : step === 'confirm'
        ? 'กรอกรหัส PIN เดิมอีกครั้ง'
        : `ปลดล็อกแอปได้ทันทีด้วย${bio.label} รวดเร็วและปลอดภัย`;

  return (
    <View style={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.top}>
        {mode !== 'onboard' ? (
          <PressableScale onPress={() => router.back()} style={styles.topBtn} accessibilityLabel="ยกเลิก">
            <T v="body" color="#FFFFFF">ยกเลิก</T>
          </PressableScale>
        ) : (
          <View />
        )}
        {mode === 'onboard' ? (
          <PressableScale onPress={skip} style={styles.topBtn} accessibilityLabel="ไว้ทีหลัง">
            <T v="body" color="rgba(255,255,255,0.75)">ไว้ทีหลัง</T>
          </PressableScale>
        ) : null}
      </View>

      <Animated.View key={step} entering={FadeInDown.duration(300)} style={styles.head}>
        <View style={styles.badge}>
          <Sym name={step === 'face' ? bio.icon : 'lock.shield.fill'} size={28} color="#FFFFFF" />
        </View>
        <T v="h2" color="#FFFFFF" center style={{ marginTop: 16, fontWeight: '700' }}>{title}</T>
        <T v="callout" color="rgba(214,240,224,0.8)" center style={{ marginTop: 6, maxWidth: 300 }}>{sub}</T>
        {error ? (
          <Animated.View entering={FadeIn}>
            <T v="callout" color="#FFB4A8" center style={{ marginTop: 10 }}>{error}</T>
          </Animated.View>
        ) : null}
      </Animated.View>

      <View style={{ flex: 1 }} />

      {step === 'face' ? (
        <Animated.View entering={FadeInDown.duration(300)} style={{ width: '100%', gap: 12, paddingHorizontal: 24 }}>
          <View style={styles.faceArt}>
            <Sym name={bio.icon} size={28} color="#5ED696" />
          </View>
          <Button kind="secondary" label={`เปิดใช้ ${bio.label}`} onPress={enableFace} />
          <PressableScale onPress={skip} style={styles.later}>
            <T v="body" color="rgba(255,255,255,0.8)">ไว้ทีหลัง</T>
          </PressableScale>
        </Animated.View>
      ) : (
        <PinPad ref={pad} light value={value} onChange={(v) => { setValue(v); setError(''); }} onComplete={onComplete} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0B2A1C', alignItems: 'center' },
  top: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 44 },
  topBtn: { height: 44, justifyContent: 'center', paddingHorizontal: 8 },
  head: { alignItems: 'center', marginTop: 28, paddingHorizontal: 24 },
  badge: { width: 64, height: 64, borderRadius: 20, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  faceArt: { alignSelf: 'center', width: 120, height: 120, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(94,214,150,0.5)', alignItems: 'center', justifyContent: 'center', marginBottom: 24, transform: [{ scale: 1.2 }] },
  later: { height: 50, alignItems: 'center', justifyContent: 'center' },
});
