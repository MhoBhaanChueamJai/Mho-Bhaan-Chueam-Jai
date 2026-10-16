/**
 * หน้าจอล็อก — แสดงทับทั้งแอปเมื่อเปิดแอปใหม่ (หรือกลับเข้าแอปหลังออกไปเกิน 1 นาที)
 * ปลดล็อกด้วย Face ID (เด้งขึ้นอัตโนมัติ) หรือรหัส PIN
 * กรอก PIN ผิดครบ 5 ครั้ง → ออกจากระบบ ต้องเข้าสู่ระบบด้วยรหัสผ่านใหม่
 */
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Sym } from './ios';
import { PinPad, type PinPadHandle } from './PinPad';
import { HeroRing, PinShell } from './PinShell';
import { Avatar, PressableScale, T, useHaptic } from './ui';
import { avatars, doctor } from '../data/mock';
import { useApp } from '../store/app';
import { palette } from '../theme';
import { MAX_ATTEMPTS, authenticateBiometric, biometricInfo, checkPin } from '../store/security';

export function LockScreen() {
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
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)} style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
      <PinShell
        hero={
          <HeroRing>
            <Avatar name={doctor.name} src={avatars.doctor} size={76} />
          </HeroRing>
        }
        title={`สวัสดี ${name}`}
        subtitle={settings.pinEnabled ? 'กรอกรหัส PIN เพื่อเข้าใช้งาน' : `ใช้ ${bio.label} เพื่อเข้าใช้งาน`}
        message={tries > 0 ? `รหัส PIN ไม่ถูกต้อง · เหลืออีก ${MAX_ATTEMPTS - tries} ครั้ง` : undefined}
        footer={
          <PressableScale onPress={logout} style={styles.forgot}>
            <T v="callout" color={palette.primary} style={{ fontWeight: '600' }}>ลืมรหัส PIN?</T>
          </PressableScale>
        }
      >
        {settings.pinEnabled ? (
          <PinPad
            ref={pad}
            value={value}
            onChange={setValue}
            onComplete={onComplete}
            leftAction={
              useBio ? (
                <PressableScale haptic="press" onPress={tryBio} style={styles.bioKey} accessibilityLabel={`ปลดล็อกด้วย ${bio.label}`}>
                  <Sym name={bio.icon} size={28} color={palette.primary} />
                </PressableScale>
              ) : null
            }
          />
        ) : (
          <PressableScale haptic="press" onPress={tryBio} style={styles.bioBig} accessibilityLabel={`ปลดล็อกด้วย ${bio.label}`}>
            <Sym name={bio.icon} size={22} color="#FFFFFF" />
            <T v="body" color="#FFFFFF" style={{ fontWeight: '600' }}>ปลดล็อกด้วย {bio.label}</T>
          </PressableScale>
        )}
      </PinShell>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bioKey: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center' },
  bioBig: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, paddingHorizontal: 28, borderRadius: 27, backgroundColor: palette.primary, marginTop: 40 },
  forgot: { minHeight: 44, justifyContent: 'center', marginTop: 10, paddingHorizontal: 12 },
});
