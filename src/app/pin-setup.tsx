/**
 * ตั้งรหัส PIN → ยืนยัน → (ถ้าเครื่องรองรับ) ชวนเปิด Face ID
 *  mode=onboard : หลังเข้าสู่ระบบครั้งแรก มีปุ่ม "ไว้ทีหลัง" แล้วไปหน้าหลัก
 *  mode=change  : จากหน้าตั้งค่า (ตั้งใหม่/เปลี่ยน PIN) เสร็จแล้วปิดหน้า
 *  mode=face    : จากหน้าตั้งค่า เปิดเฉพาะ Face ID
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Sym } from '../components/ios';
import { PinPad, type PinPadHandle } from '../components/PinPad';
import { HeroRing, PinShell } from '../components/PinShell';
import { Button, PressableScale, T, useHaptic } from '../components/ui';
import { useApp } from '../store/app';
import { authenticateBiometric, biometricInfo, savePin } from '../store/security';
import { palette } from '../theme';

type Step = 'create' | 'confirm' | 'face';

export default function PinSetup() {
  const { mode = 'onboard' } = useLocalSearchParams<{ mode?: 'onboard' | 'change' | 'face' }>();
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

  const topLeft =
    mode !== 'onboard' ? (
      <PressableScale onPress={() => router.back()} style={styles.topBtn} accessibilityLabel="ยกเลิก">
        <T v="body" color="#FFFFFF">ยกเลิก</T>
      </PressableScale>
    ) : null;
  const topRight =
    mode === 'onboard' ? (
      <PressableScale onPress={skip} style={styles.topBtn} accessibilityLabel="ไว้ทีหลัง">
        <T v="body" color="#FFFFFF" style={{ fontWeight: '600' }}>ไว้ทีหลัง</T>
      </PressableScale>
    ) : null;

  return (
    <PinShell
      topLeft={topLeft}
      topRight={topRight}
      hero={
        <HeroRing>
          <View style={styles.badge}>
            <Sym name={step === 'face' ? bio.icon : 'lock.fill'} size={24} color={palette.primary} />
          </View>
        </HeroRing>
      }
      title={title}
      subtitle={sub}
      message={error || undefined}
      footer={
        step !== 'face' ? (
          <View style={styles.steps}>
            <View style={[styles.stepDot, styles.stepOn]} />
            <View style={[styles.stepDot, step === 'confirm' && styles.stepOn]} />
          </View>
        ) : null
      }
    >
      {step === 'face' ? (
        <Animated.View entering={FadeInDown.duration(300)} style={{ width: '100%', gap: 12, paddingHorizontal: 24, marginTop: 24 }}>
          <View style={styles.faceArt}>
            <Sym name={bio.icon} size={28} color={palette.primary} />
          </View>
          <Button label={`เปิดใช้ ${bio.label}`} onPress={enableFace} />
          <PressableScale onPress={skip} style={styles.later}>
            <T v="body" color={palette.primary} style={{ fontWeight: '600' }}>ไว้ทีหลัง</T>
          </PressableScale>
        </Animated.View>
      ) : (
        <PinPad ref={pad} value={value} onChange={(v) => { setValue(v); setError(''); }} onComplete={onComplete} />
      )}
    </PinShell>
  );
}

const styles = StyleSheet.create({
  topBtn: { height: 44, justifyContent: 'center', paddingHorizontal: 8 },
  badge: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  faceArt: { alignSelf: 'center', width: 112, height: 112, borderRadius: 30, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  later: { height: 50, alignItems: 'center', justifyContent: 'center' },
  steps: { flexDirection: 'row', gap: 6, marginTop: 18 },
  stepDot: { width: 18, height: 4, borderRadius: 2, backgroundColor: 'rgba(120,135,118,0.25)' },
  stepOn: { backgroundColor: palette.primary },
});
