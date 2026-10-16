import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp, LinearTransition, useAnimatedKeyboard, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from '../components/ios';
import { KeynoteIntro } from '../components/Intro';
import { Button, PressableScale, T, useHaptic } from '../components/ui';
import { supabase, usernameToEmail } from '../lib/supabase';
import { PRIVACY_VERSION } from './privacy';
import { useApp } from '../store/app';
import { control, palette } from '../theme';


/** ช่องกรอกแยกแต่ละช่อง (ไม่มีป้ายด้านบน ใช้ placeholder) */
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
  icon?: any;
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  right?: React.ReactNode;
  inputRef?: React.RefObject<TextInput | null>;
  onSubmit?: () => void;
  returnKey?: 'next' | 'go';
  autoComplete?: 'username' | 'password' | 'email' | 'new-password' | 'name';
  placeholder?: string;
  keyboard?: 'email-address' | 'default';
  half?: boolean;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[styles.field, focus && styles.fieldFocus, half && { flex: 1 }]}>
      {icon ? <Sym name={icon} size={17} color={focus ? palette.primary : ios.tertiary} /> : null}
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
          ({ password: 'password', 'new-password': 'newPassword', email: 'emailAddress', name: 'name', username: 'username' } as const)[autoComplete ?? 'username']
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
  const [fullName, setFullName] = useState('');
  // ชื่อ–นามสกุลกรอกช่องเดียว: คำแรกเป็นชื่อ ที่เหลือเป็นนามสกุล
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest.join(' ');
  const [email, setEmail] = useState('');
  const [pass2, setPass2] = useState('');
  const [agree, setAgree] = useState(false);
  const [info, setInfo] = useState('');
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit =
    !busy &&
    (mode === 'login'
      ? user.trim().length >= 3 && pass.length >= 6
      : !!first && !!last && emailOk && pass.length >= 6 && pass2.length >= 6 && agree);

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
        name = `${first} ${last}`;
        const { data, error: e } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password: pass,
          options: { data: { first_name: first, last_name: last, display_name: name, privacy_version: PRIVACY_VERSION, privacy_accepted_at: new Date().toISOString() } },
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

  // จอเดียวไม่เลื่อน: อินโทรเต็มจอด้านหลัง แผ่นกรอกข้อมูลสูงเท่าเนื้อหา ยึดขอบล่าง และยกตามคีย์บอร์ด
  // ความสูงอินโทรวัดจากแผ่นโหมดเข้าสู่ระบบครั้งแรก (โหมดสมัครแผ่นสูงขึ้นทับอินโทร ไม่ทำให้อินโทรกระตุก)
  const [sheetH, setSheetH] = useState(0);
  const heroH = sheetH ? height - sheetH + 28 : Math.round(height * 0.5);
  const kb = useAnimatedKeyboard();
  const signup = mode === 'signup';
  // โหมดเข้าสู่ระบบ: แผ่นยกตามคีย์บอร์ด / โหมดสมัคร: แผ่นเต็มจอแบบ sheet เนื้อหาเลื่อนหลบคีย์บอร์ดเอง
  const lift = useAnimatedStyle(
    () => ({ transform: [{ translateY: !signup && kb.height.value > 0 ? -Math.max(0, kb.height.value - insets.bottom + 8) : 0 }] }),
    [signup],
  );
  // อินโทรด้านหลังถอยลึกเล็กน้อยเมื่อเปิด sheet สมัคร (แบบ iOS sheet)
  const heroSt = useAnimatedStyle(
    () => ({ opacity: withTiming(signup ? 0.45 : 1, { duration: 280 }), transform: [{ scale: withTiming(signup ? 0.94 : 1, { duration: 280 }) }] }),
    [signup],
  );
  const toggle = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setInfo('');
  };
  const eye = (
    <PressableScale haptic="select" hitSlop={control.hitSlop} onPress={() => setShow((x) => !x)} style={styles.eye} accessibilityLabel={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
      <Sym name={show ? 'eye.slash' : 'eye'} size={17} color={ios.secondary} />
    </PressableScale>
  );

  const body = (
    <>
        <T v="h1">{mode === 'login' ? 'ยินดีต้อนรับ' : 'สร้างบัญชีใหม่'}</T>
        <T v="callout" color={ios.secondary} style={{ marginTop: 2 }}>
          {mode === 'login' ? 'เข้าสู่ระบบด้วยอีเมลหรือชื่อผู้ใช้' : 'สมัครฟรี ใช้คลังสมุนไพร ภูมิปัญญา และครูปัญญา AI'}
        </T>

        {/* ช่องกรอก */}
        <Animated.View style={[styles.group, shakeStyle]}>
          {mode === 'signup' ? (
            <>
              <Field icon="person.fill" label="ชื่อ นามสกุล" placeholder="ชื่อ นามสกุล" value={fullName} onChange={(v) => { setFullName(v); setError(''); }} autoComplete="name" returnKey="next" />
              <Field icon="envelope.fill" label="อีเมล" keyboard="email-address" value={email} onChange={(v) => { setEmail(v); setError(''); }} autoComplete="email" returnKey="next" />
            </>
          ) : (
            <>
              <Field
                icon="person.fill"
                label="อีเมล หรือชื่อผู้ใช้"
                keyboard="email-address"
                value={user}
                onChange={(v) => { setUser(v); setError(''); }}
                returnKey="next"
                onSubmit={() => passRef.current?.focus()}
                autoComplete="username"
              />
            </>
          )}
          <Field
            icon="lock.fill"
            label="รหัสผ่าน"
            placeholder={mode === 'signup' ? 'ตั้งรหัสผ่าน (อย่างน้อย 6 ตัว)' : 'รหัสผ่าน'}
            value={pass}
            onChange={(v) => { setPass(v); setError(''); }}
            secure={!show}
            inputRef={passRef}
            returnKey={mode === 'signup' ? 'next' : 'go'}
            onSubmit={mode === 'signup' ? undefined : submit}
            autoComplete={mode === 'signup' ? 'new-password' : 'password'}
            right={eye}
          />
          {mode === 'signup' ? (
            <>
              <Field
                icon="checkmark.shield.fill"
                label="ยืนยันรหัสผ่าน"
                value={pass2}
                onChange={(v) => { setPass2(v); setError(''); }}
                secure={!show}
                returnKey="go"
                onSubmit={submit}
                autoComplete="new-password"
                right={
                  pass2 ? (
                    <View style={styles.eye}>
                      <Sym name={pass2 === pass ? 'checkmark.circle.fill' : 'xmark.circle.fill'} size={17} color={pass2 === pass ? palette.primary : palette.coral} />
                    </View>
                  ) : undefined
                }
              />
            </>
          ) : null}
        </Animated.View>

        {/* ยอมรับนโยบายความเป็นส่วนตัว */}
        {signup ? (
          <View style={styles.consent}>
            <PressableScale
              haptic="select"
              hitSlop={control.hitSlop}
              onPress={() => setAgree((x) => !x)}
              style={[styles.check, agree && styles.checkOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agree }}
              accessibilityLabel="ยอมรับนโยบายความเป็นส่วนตัว"
            >
              {agree ? <Sym name="checkmark" size={13} color="#FFFFFF" weight="bold" /> : null}
            </PressableScale>
            <T v="callout" color={ios.secondary} style={{ flex: 1 }} onPress={() => setAgree((x) => !x)}>
              ฉันได้อ่านและยอมรับ{' '}
              <T v="callout" color={palette.primary} style={{ fontWeight: '700' }} onPress={() => router.push('/privacy')}>
                นโยบายความเป็นส่วนตัว
              </T>
            </T>
          </View>
        ) : null}

        {/* ข้อความแจ้ง */}
        <View style={styles.msg}>
          {error ? (
            <Animated.View entering={FadeIn} style={styles.error}>
              <Sym name="exclamationmark.circle.fill" size={14} color={palette.coral} />
              <T v="caption" color={palette.coral} style={{ flex: 1 }}>{error}</T>
            </Animated.View>
          ) : info ? (
            <T v="caption" color={palette.primary}>{info}</T>
          ) : signup && first && !last ? (
            <T v="caption" color={ios.secondary}>เว้นวรรคระหว่างชื่อกับนามสกุล เช่น สมชาย ใจดี</T>
          ) : null}
        </View>

        <Button
          label={busy ? 'กำลังดำเนินการ…' : mode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}
          disabled={!canSubmit}
          onPress={submit}
          style={{ height: 54 }}
        />

        {mode === 'login' ? (
          <PressableScale haptic="select" onPress={() => setError('ติดต่อ สสจ. หรือ รพ.สต. เพื่อตั้งรหัสผ่านใหม่')} style={styles.link}>
            <T v="callout" color={palette.primary}>ลืมรหัสผ่าน?</T>
          </PressableScale>
        ) : (
          <T v="caption" color={ios.tertiary} center style={styles.note}>
            สมาชิกใช้งานได้ทุกส่วน ยกเว้นการรักษาผู้ป่วย ซึ่งต้องยืนยันตัวตนหมอพื้นบ้านก่อน
          </T>
        )}

        {/* สลับโหมด: เส้นคั่น + ข้อความ ไม่แย่งความเด่นจากปุ่มหลัก */}
        {signup ? <View style={{ flex: 1, minHeight: 16 }} /> : null}
        <View style={styles.divider} />
        <PressableScale haptic="select" onPress={toggle} style={styles.alt}>
          <T v="callout" color={ios.secondary} center>
            {mode === 'login' ? 'ยังไม่มีบัญชีเข้าใช้งานใช่ไหม? ' : 'มีบัญชีอยู่แล้วใช่ไหม? '}
            <T v="callout" color={palette.primary} style={{ fontWeight: '700' }}>{mode === 'login' ? 'สมัครบัญชี' : 'เข้าสู่ระบบ'}</T>
          </T>
        </PressableScale>
    </>
  );

  return (
    <View style={styles.root}>
      {/* ── ส่วนบน: อินโทรเปิดตัวแอปแบบ keynote ── */}
      <Animated.View style={heroSt}>
        <Pressable onPress={Keyboard.dismiss} accessible={false} style={{ height: heroH }}>
          <KeynoteIntro width={width} height={heroH - insets.top} inset={insets.top} />
        </Pressable>
      </Animated.View>

      {/* ── ส่วนล่าง: กรอกข้อมูล ── */}
      <Animated.View
        entering={FadeInUp.delay(100).duration(500)}
        layout={LinearTransition.duration(280)}
        onLayout={(e) => {
          if (mode === 'login' && !sheetH) setSheetH(Math.round(e.nativeEvent.layout.height));
        }}
        style={[styles.sheet, { paddingBottom: insets.bottom + 8 }, signup && { top: insets.top + 10, paddingTop: 8 }, lift]}
      >
        {signup ? <View style={styles.grabber} /> : null}
        {signup ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingTop: 16 }}
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B6E45', overflow: 'hidden' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderCurve: 'continuous', paddingHorizontal: 24, paddingTop: 28 },
  group: { marginTop: 20, gap: 12 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, borderRadius: 27, paddingLeft: 18, paddingRight: 6, backgroundColor: palette.mint, borderWidth: 1.5, borderColor: 'transparent' },
  fieldFocus: { backgroundColor: '#FFFFFF', borderColor: palette.primary },
  input: { flex: 1, fontSize: 17, color: palette.ink, height: '100%' },
  eye: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  msg: { minHeight: 30, justifyContent: 'center', paddingHorizontal: 4 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, marginTop: 2 },
  note: { minHeight: 44, marginTop: 6, paddingHorizontal: 12 },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingHorizontal: 4 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(60,60,67,0.3)', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: palette.primary, borderColor: palette.primary },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(60,60,67,0.3)' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginTop: 10 },
  alt: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, marginTop: 6 },
});
