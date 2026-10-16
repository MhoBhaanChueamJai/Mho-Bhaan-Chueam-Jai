import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp, LinearTransition, useAnimatedKeyboard, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from '../components/ios';
import { KeynoteIntro } from '../components/Intro';
import { Button, PressableScale, T, useHaptic } from '../components/ui';
import { supabase, usernameToEmail } from '../lib/supabase';
import { useApp } from '../store/app';
import { control, palette } from '../theme';


/** ช่องกรอกแคปซูล (ไม่มีป้ายด้านบน ใช้ placeholder แทน เพื่อให้พอดีจอโดยไม่ต้องเลื่อน) */
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
  placeholder,
  keyboard,
  half,
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
  autoComplete?: 'username' | 'password' | 'email' | 'new-password' | 'given-name' | 'family-name';
  placeholder?: string;
  keyboard?: 'email-address' | 'default';
  half?: boolean;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={half ? { flex: 1 } : undefined}>
      <View style={[styles.field, focus && styles.fieldFocus]}>
        <Sym name={icon} size={17} color={focus ? palette.primary : ios.tertiary} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? label}
          keyboardType={keyboard}
          placeholderTextColor={ios.tertiary}
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={
            ({ password: 'password', 'new-password': 'newPassword', email: 'emailAddress', 'given-name': 'givenName', 'family-name': 'familyName', username: 'username' } as const)[autoComplete ?? 'username']
          }
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
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [pass2, setPass2] = useState('');
  const [info, setInfo] = useState('');
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit =
    !busy &&
    (mode === 'login'
      ? user.trim().length >= 3 && pass.length >= 6
      : first.trim().length >= 1 && last.trim().length >= 1 && emailOk && pass.length >= 6 && pass2.length >= 6);

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
    try {
      let name = user.trim();
      if (mode === 'signup') {
        if (pass !== pass2) return fail('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
        name = `${first.trim()} ${last.trim()}`;
        const { data, error: e } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password: pass,
          options: { data: { first_name: first.trim(), last_name: last.trim(), display_name: name } },
        });
        if (e) return fail(e.message.toLowerCase().includes('already') ? 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบ' : `สมัครไม่สำเร็จ: ${e.message}`);
        if (!data.session) {
          setBusy(false);
          setMode('login');
          setUser(email.trim());
          setInfo('สร้างบัญชีแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
          return;
        }
      } else {
        // ช่องเดียวรับได้ทั้งอีเมลและชื่อผู้ใช้
        const login = name.includes('@') ? name.toLowerCase() : usernameToEmail(name);
        const { data, error: e } = await supabase.auth.signInWithPassword({ email: login, password: pass });
        if (e) {
          setPass('');
          return fail(e.message.toLowerCase().includes('invalid') ? 'อีเมล/ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง' : `เข้าสู่ระบบไม่สำเร็จ: ${e.message}`);
        }
        const md = data.user?.user_metadata ?? {};
        if (md.first_name) name = `${md.first_name} ${md.last_name ?? ''}`.trim();
        else if (md.username) name = md.username;
      }
      await reloadCloud();
      enter(name);
    } catch {
      fail(`เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต`);
    }
  };

  // จอเดียวไม่เลื่อน: อินโทรตรึงด้านบน, แผ่นกรอกข้อมูลยึดขอบล่าง และยกขึ้นตามคีย์บอร์ด
  const heroH = Math.round(height * 0.52);
  const kb = useAnimatedKeyboard();
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: kb.height.value > 0 ? -Math.max(0, kb.height.value - insets.bottom + 8) : 0 }] }));

  return (
    <View style={styles.root}>
      {/* ── ส่วนบน: อินโทรเปิดตัวแอปแบบ keynote ── */}
      <Pressable onPress={Keyboard.dismiss} accessible={false} style={{ height: heroH, paddingTop: insets.top }}>
        <KeynoteIntro width={width} height={heroH - insets.top} />
      </Pressable>

      {/* ── ส่วนล่าง: กรอกข้อมูลเข้าสู่ระบบ ── */}
      <Animated.View
        entering={FadeInUp.delay(100).duration(500)}
        layout={LinearTransition.duration(280)}
        style={[styles.sheet, { minHeight: height - heroH + 28, paddingBottom: insets.bottom + 12 }, lift]}
      >
          <T v="h1" style={{ fontWeight: '700' }}>{mode === 'login' ? 'ยินดีต้อนรับ' : 'สร้างบัญชีใหม่'}</T>
          <T v="callout" color={ios.secondary} style={{ marginTop: 2 }}>
            {mode === 'login' ? 'เข้าสู่ระบบเพื่อดูแลผู้ป่วยและภูมิปัญญาของคุณ' : 'สมัครสมาชิกเพื่อใช้งานคลังสมุนไพร ภูมิปัญญา และครูปัญญา AI'}
          </T>

          <Animated.View style={[{ gap: 12, marginTop: 20 }, shakeStyle]}>
            {mode === 'signup' ? (
              <>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Field half icon="person.fill" label="ชื่อ" placeholder="ชื่อ" value={first} onChange={(v) => { setFirst(v); setError(''); }} autoComplete="given-name" returnKey="next" />
                  <Field half icon="person.fill" label="นามสกุล" placeholder="นามสกุล" value={last} onChange={(v) => { setLast(v); setError(''); }} autoComplete="family-name" returnKey="next" />
                </View>
                <Field icon="envelope.fill" label="อีเมล" placeholder="อีเมล" keyboard="email-address" value={email} onChange={(v) => { setEmail(v); setError(''); }} autoComplete="email" returnKey="next" />
              </>
            ) : (
              <Field
                icon="person.fill"
                label="อีเมล หรือชื่อผู้ใช้"
                placeholder="อีเมล หรือชื่อผู้ใช้"
                keyboard="email-address"
                value={user}
                onChange={(v) => {
                  setUser(v);
                  setError('');
                }}
                returnKey="next"
                onSubmit={() => passRef.current?.focus()}
                autoComplete="username"
              />
            )}
            <Field
              icon="lock.fill"
              label={mode === 'signup' ? 'ตั้งรหัสผ่าน' : 'รหัสผ่าน'}
              placeholder={mode === 'signup' ? 'ตั้งรหัสผ่าน (อย่างน้อย 6 ตัว)' : 'รหัสผ่าน'}
              value={pass}
              onChange={(v) => {
                setPass(v);
                setError('');
              }}
              secure={!show}
              inputRef={passRef}
              returnKey={mode === 'signup' ? 'next' : 'go'}
              onSubmit={mode === 'signup' ? undefined : submit}
              autoComplete={mode === 'signup' ? 'new-password' : 'password'}
              right={
                <PressableScale haptic="select" hitSlop={control.hitSlop} onPress={() => setShow((x) => !x)} style={styles.eye} accessibilityLabel={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
                  <Sym name={show ? 'eye.slash' : 'eye'} size={17} color={ios.secondary} />
                </PressableScale>
              }
            />
            {mode === 'signup' ? (
              <Field
                icon="lock.fill"
                label="ยืนยันรหัสผ่าน"
                placeholder="ยืนยันรหัสผ่าน"
                value={pass2}
                onChange={(v) => {
                  setPass2(v);
                  setError('');
                }}
                secure={!show}
                returnKey="go"
                onSubmit={submit}
                autoComplete="new-password"
                right={pass2 ? <Sym name={pass2 === pass ? 'checkmark.circle.fill' : 'xmark.circle.fill'} size={17} color={pass2 === pass ? palette.primary : palette.coral} /> : undefined}
              />
            ) : null}
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
            style={{ marginTop: 4, height: 54 }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071A11', overflow: 'hidden' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderCurve: 'continuous', paddingHorizontal: 24, paddingTop: 28 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, borderRadius: 27, paddingLeft: 18, paddingRight: 8, backgroundColor: '#F4F4F7', borderWidth: 1.5, borderColor: 'transparent' },
  fieldFocus: { backgroundColor: '#FFFFFF', borderColor: palette.primary },
  input: { flex: 1, fontSize: 17, color: palette.ink, height: '100%' },
  eye: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, minHeight: 36 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  switch: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, marginTop: 8 },
  forgot: { minHeight: 36, justifyContent: 'center', paddingLeft: 12 },
});
