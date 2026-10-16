import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from '../components/ios';
import { KeynoteIntro } from '../components/Intro';
import { Button, PressableScale, T, useHaptic } from '../components/ui';
import { supabase, usernameToEmail } from '../lib/supabase';
import { useApp } from '../store/app';
import { control, palette } from '../theme';


/** ช่องกรอกแคปซูลแยก (ชื่อผู้ใช้ / รหัสผ่าน) */
function Field({
  icon,
  label,
  value,
  onChange,
  secure,
  right,
  inputRef,
  onSubmit,
  returnKey,
  autoComplete,
}: {
  icon: any;
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  right?: React.ReactNode;
  inputRef?: React.RefObject<TextInput | null>;
  onSubmit?: () => void;
  returnKey?: 'next' | 'go';
  autoComplete?: 'username' | 'password';
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View>
      <T v="caption" color={ios.secondary} style={styles.label}>{label}</T>
      <View style={[styles.field, focus && styles.fieldFocus]}>
        <Sym name={icon} size={17} color={focus ? palette.primary : ios.tertiary} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          placeholder={label}
          placeholderTextColor={ios.tertiary}
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={autoComplete === 'password' ? 'password' : 'username'}
          returnKeyType={returnKey}
          onSubmitEditing={onSubmit}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={styles.input}
          accessibilityLabel={label}
        />
        {right}
      </View>
    </View>
  );
}

export default function Login() {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { settings, update, setUnlocked, reloadCloud } = useApp();
  const h = useHaptic();
  const passRef = useRef<TextInput>(null);
  const [user, setUser] = useState(settings.username);
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [info, setInfo] = useState('');
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const canSubmit = user.trim().length >= 3 && pass.length >= 6 && !busy;

  const enter = (name: string) => {
    h.success();
    update({ loggedIn: true, username: name });
    setUnlocked(true);
    // ยังไม่ได้ตั้ง PIN → ชวนตั้ง PIN / Face ID ไว้ใช้ครั้งถัดไป
    if (!settings.pinEnabled && !settings.faceIdEnabled) router.replace({ pathname: '/pin-setup', params: { mode: 'onboard' } });
    else router.replace('/home');
  };


  const fail = (msg: string) => {
    setBusy(false);
    setError(msg);
    h.warn();
    shake.value = withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 }));
  };

  /** เข้าสู่ระบบ / สมัครบัญชี ด้วย Supabase Auth (ชื่อผู้ใช้ → อีเมลภายในแอป) */
  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    setInfo('');
    const name = user.trim();
    const email = usernameToEmail(name);
    try {
      if (mode === 'signup') {
        const { data, error: e } = await supabase.auth.signUp({ email, password: pass, options: { data: { username: name, display_name: name } } });
        if (e) return fail(e.message.includes('already') ? 'ชื่อผู้ใช้นี้มีผู้ใช้แล้ว' : `สมัครไม่สำเร็จ: ${e.message}`);
        if (!data.session) {
          setBusy(false);
          setMode('login');
          setInfo('สร้างบัญชีแล้ว แต่ระบบยังต้องยืนยันอีเมล — ผู้ดูแลต้องปิด Confirm email ใน Supabase');
          return;
        }
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (e) {
          setPass('');
          return fail(e.message.toLowerCase().includes('invalid') ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' : `เข้าสู่ระบบไม่สำเร็จ: ${e.message}`);
        }
      }
      await reloadCloud();
      enter(name);
    } catch (e: any) {
      fail(`เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต`);
    }
  };

  const heroH = Math.min(height * 0.56, 500) + insets.top;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#071A11' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
        {/* ── ส่วนบน: อินโทรเปิดตัวแอปแบบ keynote ── */}
        <View style={{ height: heroH, paddingTop: insets.top }}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#071A11' }]} />
          <KeynoteIntro width={width} height={heroH - insets.top} />
        </View>

        {/* ── ส่วนล่าง: กรอกข้อมูลเข้าสู่ระบบ ── */}
        <Animated.View entering={FadeInUp.delay(100).duration(500)} style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <T v="h1" style={{ fontWeight: '700' }}>{mode === 'login' ? 'ยินดีต้อนรับ' : 'สร้างบัญชีใหม่'}</T>
          <T v="callout" color={ios.secondary} style={{ marginTop: 2 }}>
            {mode === 'login' ? 'เข้าสู่ระบบเพื่อดูแลผู้ป่วยและภูมิปัญญาของคุณ' : 'ตั้งชื่อผู้ใช้และรหัสผ่าน (อย่างน้อย 6 ตัว)'}
          </T>

          <Animated.View style={[{ gap: 14, marginTop: 22 }, shakeStyle]}>
            <Field
              icon="person.fill"
              label="ชื่อผู้ใช้"
              value={user}
              onChange={(v) => {
                setUser(v);
                setError('');
              }}
              returnKey="next"
              onSubmit={() => passRef.current?.focus()}
              autoComplete="username"
            />
            <Field
              icon="lock.fill"
              label="รหัสผ่าน"
              value={pass}
              onChange={(v) => {
                setPass(v);
                setError('');
              }}
              secure={!show}
              inputRef={passRef}
              returnKey="go"
              onSubmit={submit}
              autoComplete="password"
              right={
                <PressableScale haptic="select" hitSlop={control.hitSlop} onPress={() => setShow((x) => !x)} style={styles.eye} accessibilityLabel={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
                  <Sym name={show ? 'eye.slash' : 'eye'} size={17} color={ios.secondary} />
                </PressableScale>
              }
            />
          </Animated.View>

          <View style={styles.row}>
            {error ? (
              <Animated.View entering={FadeIn} style={styles.error}>
                <Sym name="exclamationmark.circle.fill" size={15} color={palette.coral} />
                <T v="caption" color={palette.coral}>{error}</T>
              </Animated.View>
            ) : info ? (
              <T v="caption" color={palette.primary} style={{ flex: 1 }}>{info}</T>
            ) : (
              <View />
            )}
            {mode === 'login' ? (
              <PressableScale haptic="select" onPress={() => setError('ติดต่อ สสจ. หรือ รพ.สต. เพื่อตั้งรหัสผ่านใหม่')} style={styles.forgot}>
                <T v="callout" color={palette.primary}>ลืมรหัสผ่าน?</T>
              </PressableScale>
            ) : null}
          </View>

          <Button
            label={busy ? 'กำลังดำเนินการ…' : mode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}
            disabled={!canSubmit}
            onPress={submit}
            icon={busy ? undefined : <Sym name="arrow.right" size={17} color="#FFFFFF" weight="semibold" />}
            style={{ marginTop: 6, height: 54 }}
          />


          <View style={{ flex: 1 }} />
          <PressableScale
            haptic="select"
            onPress={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
              setInfo('');
            }}
            style={styles.switch}
          >
            <T v="callout" color={ios.secondary}>
              {mode === 'login' ? 'ยังไม่มีบัญชี? ' : 'มีบัญชีแล้ว? '}
              <T v="callout" color={palette.primary} style={{ fontWeight: '700' }}>{mode === 'login' ? 'สมัครใช้งาน' : 'เข้าสู่ระบบ'}</T>
            </T>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, marginTop: -28, backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderCurve: 'continuous', paddingHorizontal: 24, paddingTop: 28 },
  label: { marginLeft: 16, marginBottom: 6, fontWeight: '600' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, borderRadius: 27, paddingLeft: 18, paddingRight: 8, backgroundColor: '#F4F4F7', borderWidth: 1.5, borderColor: 'transparent' },
  fieldFocus: { backgroundColor: '#FFFFFF', borderColor: palette.primary },
  input: { flex: 1, fontSize: 17, color: palette.ink, height: '100%' },
  eye: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, minHeight: 36 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  switch: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, marginTop: 16 },
  forgot: { minHeight: 36, justifyContent: 'center', paddingLeft: 12 },
});
