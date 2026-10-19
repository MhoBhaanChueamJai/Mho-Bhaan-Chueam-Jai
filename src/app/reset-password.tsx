/**
 * ตั้งรหัสผ่านใหม่ — เปิดจากลิงก์ในอีเมล "ลืมรหัสผ่าน" (หน้าเว็บของแอป)
 * ลิงก์มี token ของ Supabase ใน # (หรือ ?code=) → ตั้ง session ชั่วคราว → ตั้งรหัสใหม่ → ออกจากระบบ ให้กลับไปเข้าสู่ระบบในแอป
 */
import { Stack, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TextInput } from '../components/AppText';
import { Sym, ios } from '../components/ios';
import { Button, T, useHaptic } from '../components/ui';
import { supabase } from '../lib/supabase';
import { elevation, palette } from '../theme';

// เก็บ URL ตอนโหลดหน้า (ก่อน router เปลี่ยน)
const START_URL = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : '';

export default function ResetPassword() {
  const h = useHaptic();
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const u = new URL(START_URL || 'about:blank');
        const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
        const code = u.searchParams.get('code');
        if (hash.get('error') || u.searchParams.get('error')) return setState('invalid');
        if (code) {
          const { error: e } = await supabase.auth.exchangeCodeForSession(code);
          if (e) return setState('invalid');
        } else if (hash.get('access_token') && hash.get('refresh_token')) {
          const { error: e } = await supabase.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! });
          if (e) return setState('invalid');
        } else return setState('invalid');
        try {
          window.history.replaceState(null, '', window.location.pathname);
        } catch {}
        setState('ready');
      } catch {
        setState('invalid');
      }
    })();
  }, []);

  const can = pass.length >= 6 && pass === pass2 && !busy;
  const save = async () => {
    if (!can) return;
    setBusy(true);
    setError('');
    const { error: e } = await supabase.auth.updateUser({ password: pass });
    setBusy(false);
    if (e) {
      h.warn();
      return setError(/different|same/i.test(e.message) ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม' : 'ตั้งรหัสผ่านไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
    h.success();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setState('done');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.badge}>
          <Sym name={state === 'done' ? 'checkmark.circle.fill' : state === 'invalid' ? 'exclamationmark.triangle.fill' : 'key.fill'} size={30} color={state === 'invalid' ? palette.coral : palette.primary} />
        </View>
        {state === 'checking' ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : state === 'invalid' ? (
          <Animated.View entering={FadeIn} style={{ gap: 10 }}>
            <T v="h2" center>ลิงก์หมดอายุหรือใช้ไปแล้ว</T>
            <T v="callout" color={ios.secondary} center>ขอลิงก์ใหม่ได้ที่หน้าเข้าสู่ระบบ → ลืมรหัสผ่าน?</T>
            <Button label="ไปหน้าเข้าสู่ระบบ" onPress={() => router.replace('/login')} style={{ marginTop: 16, height: 52 }} />
          </Animated.View>
        ) : state === 'done' ? (
          <Animated.View entering={FadeIn} style={{ gap: 10 }}>
            <T v="h2" center>ตั้งรหัสผ่านใหม่แล้ว</T>
            <T v="callout" color={ios.secondary} center>กลับไปที่แอปหมอบ้านเชื่อมใจ แล้วเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย</T>
            <Button label="ไปหน้าเข้าสู่ระบบ" onPress={() => router.replace('/login')} style={{ marginTop: 16, height: 52 }} />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn} style={{ gap: 12 }}>
            <T v="h2" center>ตั้งรหัสผ่านใหม่</T>
            <T v="callout" color={ios.secondary} center>อย่างน้อย 6 ตัว</T>
            <View style={[styles.field, elevation.e1]}>
              <Sym name="lock.fill" size={17} color={ios.tertiary} />
              <TextInput value={pass} onChangeText={(v) => (setPass(v), setError(''))} placeholder="รหัสผ่านใหม่" placeholderTextColor={ios.tertiary} secureTextEntry autoFocus style={styles.input} accessibilityLabel="รหัสผ่านใหม่" />
            </View>
            <View style={[styles.field, elevation.e1]}>
              <Sym name="checkmark.shield.fill" size={17} color={ios.tertiary} />
              <TextInput value={pass2} onChangeText={(v) => (setPass2(v), setError(''))} placeholder="ยืนยันรหัสผ่านใหม่" placeholderTextColor={ios.tertiary} secureTextEntry onSubmitEditing={save} style={styles.input} accessibilityLabel="ยืนยันรหัสผ่านใหม่" />
            </View>
            {error ? <T v="caption" color={palette.coral} center>{error}</T> : pass2.length >= pass.length && pass2 && pass !== pass2 ? <T v="caption" color={palette.coral} center>รหัสผ่านทั้งสองช่องไม่ตรงกัน</T> : null}
            <Button label={busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'} disabled={!can} onPress={save} style={{ height: 52, marginTop: 6 }} />
          </Animated.View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, paddingTop: 90, gap: 12, maxWidth: 480, width: '100%', alignSelf: 'center' },
  badge: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft, marginBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, paddingHorizontal: 18, borderRadius: 27, backgroundColor: palette.surface },
  input: { flex: 1, fontSize: 17, color: palette.ink, height: '100%' },
});
