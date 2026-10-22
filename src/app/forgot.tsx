/**
 * ลืมรหัสผ่าน — กรอกอีเมลที่สมัครไว้ → ระบบส่งลิงก์ตั้งรหัสผ่านใหม่ทางอีเมล
 * ลิงก์เปิดหน้า /reset-password บนเว็บของแอป (ใช้ได้จากทุกเครื่อง ไม่ต้องติดตั้งอะไรเพิ่ม)
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TextInput } from '../components/AppText';
import { Sym, ios } from '../components/ios';
import { Button, T, useHaptic } from '../components/ui';
import { supabase } from '../lib/supabase';
import { elevation, palette } from '../theme';
import { column } from '../components/layout';

/** หน้าตั้งรหัสผ่านใหม่บนเว็บ (ต้องอยู่ใน Redirect URLs ของ Supabase) */
export const RESET_URL = 'https://mhobhaanchueamjai.github.io/Mho-Bhaan-Chueam-Jai/reset-password';

export default function Forgot() {
  const { email: initial } = useLocalSearchParams<{ email?: string }>();
  const h = useHaptic();
  const [email, setEmail] = useState(initial?.includes('@') ? initial : '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const send = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setError('');
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: RESET_URL });
    setBusy(false);
    if (e) {
      h.warn();
      setError(/rate|seconds|limit/i.test(e.message) ? 'ส่งอีเมลบ่อยเกินไป รอสักครู่แล้วลองใหม่' : 'ส่งอีเมลไม่สำเร็จ ตรวจสอบอีเมลแล้วลองใหม่');
      return;
    }
    h.success();
    setSent(true);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'ลืมรหัสผ่าน' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.page, column.read]} keyboardShouldPersistTaps="handled">
          <View style={styles.badge}>
            <Sym name={sent ? 'envelope.fill' : 'key.fill'} size={30} color={palette.primary} />
          </View>
          {sent ? (
            <Animated.View entering={FadeIn} style={{ gap: 10 }}>
              <T v="h2" center>ตรวจสอบอีเมลของคุณ</T>
              <T v="callout" color={ios.secondary} center>
                ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่{'\n'}
                <T v="callout" style={{ fontWeight: '700' }}>{email.trim()}</T>
                {'\n'}แล้ว กดลิงก์ในอีเมล ตั้งรหัสผ่านใหม่ แล้วกลับมาเข้าสู่ระบบ
              </T>
              <T v="caption" color={ios.tertiary} center style={{ marginTop: 6 }}>ไม่เห็นอีเมล? ดูในกล่องจดหมายขยะ (Spam) หรือรอสักครู่</T>
              <Button label="กลับไปเข้าสู่ระบบ" onPress={() => router.back()} style={{ marginTop: 18, height: 52 }} />
            </Animated.View>
          ) : (
            <>
              <T v="h2" center>ตั้งรหัสผ่านใหม่</T>
              <T v="callout" color={ios.secondary} center>กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้</T>
              <View style={[styles.field, elevation.e1]}>
                <Sym name="envelope.fill" size={17} color={ios.tertiary} />
                <TextInput
                  value={email}
                  onChangeText={(v) => (setEmail(v), setError(''))}
                  placeholder="อีเมล"
                  placeholderTextColor={ios.tertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="send"
                  onSubmitEditing={send}
                  style={styles.input}
                  accessibilityLabel="อีเมล"
                />
              </View>
              {error ? (
                <T v="caption" color={palette.coral} center>{error}</T>
              ) : (
                <T v="caption" color={ios.tertiary} center>บัญชีที่สมัครด้วยชื่อผู้ใช้ (ไม่มีอีเมล) ติดต่อผู้ดูแลระบบเพื่อตั้งรหัสใหม่</T>
              )}
              <Button label={busy ? 'กำลังส่ง…' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'} disabled={!ok || busy} onPress={send} style={{ height: 52 }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, paddingTop: 32, gap: 14 },
  badge: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft, marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, paddingHorizontal: 18, borderRadius: 27, backgroundColor: palette.surface, marginTop: 10 },
  input: { flex: 1, fontSize: 17, color: palette.ink, height: '100%' },
});
