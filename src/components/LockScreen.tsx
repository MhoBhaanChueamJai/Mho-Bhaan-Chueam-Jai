/**
 * หน้าจอล็อก — แสดงทับทั้งแอปเมื่อเปิดแอปใหม่ (หรือกลับเข้าแอปหลังออกไปเกิน 1 นาที)
 * ปลดล็อกด้วย Face ID (เด้งขึ้นอัตโนมัติ) หรือรหัส PIN
 * กรอก PIN ผิดครบ 5 ครั้ง → ออกจากระบบ ต้องเข้าสู่ระบบด้วยรหัสผ่านใหม่
 */
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym } from './ios';
import { PinPad, type PinPadHandle } from './PinPad';
import { Avatar, PressableScale, T, useHaptic } from './ui';
import { avatars, doctor } from '../data/mock';
import { useApp } from '../store/app';
import { MAX_ATTEMPTS, authenticateBiometric, biometricInfo, checkPin } from '../store/security';

export function LockScreen() {
  const insets = useSafeAreaInsets();
  const { settings, update, setUnlocked } = useApp();
  const h = useHaptic();
  const pad = useRef<PinPadHandle>(null);
  const [value, setValue] = useState('');
  const [tries, setTries] = useState(0);
  const [bio, setBio] = useState({ available: false, label: 'Face ID', icon: 'faceid' as 'faceid' | 'touchid' });
  const useBio = settings.faceIdEnabled && bio.available;

  const unlock = useCallback(() => {
    h.success();
    setUnlocked(true);
  }, [h, setUnlocked]);

  const tryBio = useCallback(async () => {
    if (await authenticateBiometric()) unlock();
  }, [unlock]);

  useEffect(() => {
    biometricInfo().then((b) => {
      setBio(b);
      if (settings.faceIdEnabled && b.available) setTimeout(() => authenticateBiometric().then((ok) => ok && unlock()), 350);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    update({ loggedIn: false });
    setUnlocked(false);
    router.replace('/login');
  };

  const onComplete = async (pin: string) => {
    if (await checkPin(pin)) return unlock();
    const n = tries + 1;
    setTries(n);
    setValue('');
    pad.current?.shake();
    if (n >= MAX_ATTEMPTS) logout();
  };

  const name = settings.username && settings.username !== 'somchai' ? settings.username : doctor.short;

  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)} style={[StyleSheet.absoluteFill, styles.page, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16 }]}>
      <Avatar name={doctor.name} src={avatars.doctor} size={72} />
      <T v="h2" color="#FFFFFF" style={{ marginTop: 14, fontWeight: '700' }}>สวัสดี {name}</T>
      <T v="callout" color="rgba(214,240,224,0.8)" style={{ marginTop: 4 }}>
        {settings.pinEnabled ? 'กรอกรหัส PIN เพื่อเข้าใช้งาน' : `ใช้ ${bio.label} เพื่อเข้าใช้งาน`}
      </T>
      {tries > 0 ? (
        <T v="callout" color="#FFB4A8" style={{ marginTop: 8 }}>
          รหัส PIN ไม่ถูกต้อง (เหลืออีก {MAX_ATTEMPTS - tries} ครั้ง)
        </T>
      ) : null}

      <View style={{ flex: 1 }} />

      {settings.pinEnabled ? (
        <PinPad
          ref={pad}
          light
          value={value}
          onChange={setValue}
          onComplete={onComplete}
          leftAction={
            useBio ? (
              <PressableScale haptic="press" onPress={tryBio} style={styles.bioKey} accessibilityLabel={`ปลดล็อกด้วย ${bio.label}`}>
                <Sym name={bio.icon} size={28} color="#FFFFFF" />
              </PressableScale>
            ) : null
          }
        />
      ) : (
        <PressableScale haptic="press" onPress={tryBio} style={styles.bioBig} accessibilityLabel={`ปลดล็อกด้วย ${bio.label}`}>
          <Sym name={bio.icon} size={28} color="#FFFFFF" />
          <T v="body" color="#FFFFFF" style={{ fontWeight: '600' }}>ปลดล็อกด้วย {bio.label}</T>
        </PressableScale>
      )}

      <PressableScale onPress={logout} style={styles.forgot}>
        <T v="callout" color="rgba(214,240,224,0.85)">ลืมรหัส PIN? เข้าสู่ระบบด้วยรหัสผ่าน</T>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#0B2A1C', alignItems: 'center', zIndex: 1000 },
  bioKey: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center' },
  bioBig: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, paddingHorizontal: 28, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.14)', marginBottom: 24 },
  forgot: { minHeight: 44, justifyContent: 'center', marginTop: 18, paddingHorizontal: 12 },
});
