import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { TextInput } from '../components/AppText';
import Animated, { FadeIn, FadeInUp, LinearTransition, useAnimatedKeyboard, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from '../components/ios';
import { LoginFilm } from '../components/LoginFilm';
import { Button, PressableScale, T, useHaptic } from '../components/ui';
import { Alert } from '../lib/alert';
import { DEMO_ACCOUNTS, supabase, usernameToEmail, type DemoAccount } from '../lib/supabase';
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
  const { height } = useWindowDimensions();
  const { settings, update, setUnlocked, reloadCloud } = useApp();
  const h = useHaptic();
  const passRef = useRef<TextInput>(null);
  const [user, setUser] = useState(settings.loginId ?? '');
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

  const enter = (name: string, loginId?: string) => {
    h.success();
    update({ loggedIn: true, username: name, ...(loginId ? { loginId } : {}) });
    setUnlocked(true);
    // ประเภทผู้ใช้ก่อน → ยังไม่ได้ตั้ง PIN ชวนตั้ง PIN / Face ID → หน้าหลัก
    const next = !settings.pinEnabled && !settings.faceIdEnabled ? 'pin' : 'home';
    // ถามประเภทผู้ใช้ / บทบาทครั้งเดียว (เคยเลือกแล้วหน้านั้นข้ามไปเอง)
    router.replace({ pathname: '/role', params: { mode: 'onboard', next } });
  };


  const fail = (msg: string) => {
    setBusy(false);
    setError(msg);
    h.warn();
    shake.value = withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 }));
  };

  /** เข้าสู่ระบบ / สมัครบัญชี ด้วย Supabase Auth (ชื่อผู้ใช้ → อีเมลภายในแอป) */
  /** ทดลองใช้งานด้วยบัญชีสาธิต — เลือกฝั่งแพทย์ (พ่อหมอสมบัติ) หรือประชาชน (สมศรี) ไม่ต้องสมัคร */
  const pickDemo = () => {
    if (busy) return;
    Alert.alert('ทดลองใช้งาน', 'เลือกบัญชีทดลอง (ไม่ต้องสมัคร · ข้อมูลเก็บในเครื่องนี้เท่านั้น)', [
      ...DEMO_ACCOUNTS.map((d) => ({ text: d.label, onPress: () => demo(d) })),
      { text: 'ยกเลิก', style: 'cancel' as const },
    ]);
  };
  const demo = async (acct: DemoAccount) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const { data, error: e } = await supabase.auth.signInWithPassword({ email: usernameToEmail(acct.username), password: acct.password });
      if (e) return fail('เข้าโหมดทดลองไม่สำเร็จ ลองใหม่อีกครั้ง');
      const md = data.user?.user_metadata ?? {};
      // ประเภทผู้ใช้ตามบัญชีทดลอง → ไม่ต้องถามในหน้าเลือกประเภท
      update({ userKind: acct.kind });
      await reloadCloud();
      enter(md.first_name ? `${md.first_name} ${md.last_name ?? ''}`.trim() : acct.username);
    } catch {
      fail('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต');
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      let name = user.trim();
      let loginId = email.trim().toLowerCase();
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
        loginId = name;
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
      enter(name, loginId);
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
          ) : signup && email.trim().length > 3 && !emailOk ? (
            <T v="caption" color={palette.coral}>รูปแบบอีเมลไม่ถูกต้อง เช่น somchai@gmail.com</T>
          ) : signup && pass.length > 0 && pass.length < 6 ? (
            <T v="caption" color={ios.secondary}>รหัสผ่านอย่างน้อย 6 ตัว</T>
          ) : signup && pass2.length >= pass.length && pass2 && pass !== pass2 ? (
            <T v="caption" color={palette.coral}>รหัสผ่านทั้งสองช่องไม่ตรงกัน</T>
          ) : null}
        </View>

        <Button
          label={busy ? 'กำลังดำเนินการ…' : mode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}
          disabled={!canSubmit}
          onPress={submit}
          style={{ height: 54 }}
        />


        {mode === 'login' ? (
          <View style={styles.linkRow}>
            <PressableScale haptic="select" onPress={() => { setError(''); setInfo(''); router.push({ pathname: '/forgot', params: { email: user.trim() } }); }} style={styles.link}>
              <T v="callout" color={palette.primary}>ลืมรหัสผ่าน?</T>
            </PressableScale>
          </View>
        ) : (
          <T v="caption" color={ios.tertiary} center style={styles.note}>
            ใช้งานได้ทุกส่วนทันที สำหรับแพทย์แผนไทย แพทย์แผนปัจจุบัน หมอพื้นบ้าน และประชาชนทั่วไป
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
        {/* ทดลองใช้: เลือกบัญชีสาธิต แพทย์ (พ่อหมอสมบัติ) / ประชาชน (สมศรี) — อยู่ใต้บรรทัดสมัคร */}
        {mode === 'login' ? (
          <PressableScale haptic="select" onPress={pickDemo} disabled={busy} style={[styles.demo, { alignSelf: 'center' }]} accessibilityLabel="ทดลองใช้งาน">
            <Sym name="play.circle.fill" size={15} color={palette.primaryDeep} />
            <T v="subhead" color={palette.primaryDeep} style={{ fontWeight: '600' }}>ทดลองใช้</T>
          </PressableScale>
        ) : null}
    </>
  );

  return (
    <View style={styles.root}>
      {/* ── ส่วนบน: วิดีโอแนะนำแอป 2 นาที (เล่นวนแบบเงียบ) ── */}
      <Animated.View style={heroSt}>
        <Pressable onPress={Keyboard.dismiss} accessible={false} style={{ height: heroH }}>
          <LoginFilm height={heroH} />
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
            <View style={styles.form}>{body}</View>
          </ScrollView>
        ) : (
          // แตะพื้นที่ว่างบนแผ่น → ปิดคีย์บอร์ด
          <Pressable onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.form}>{body}</View>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F8F4', overflow: 'hidden' },
  // จอกว้าง (iPad / เว็บ): แผ่นขาวเต็มกว้าง · ช่องกรอกกว้างไม่เกิน 480 อยู่กึ่งกลาง
  form: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderCurve: 'continuous', paddingHorizontal: 24, paddingTop: 28 },
  group: { marginTop: 20, gap: 12 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, borderRadius: 27, paddingLeft: 18, paddingRight: 6, backgroundColor: palette.mint, borderWidth: 1.5, borderColor: 'transparent' },
  fieldFocus: { backgroundColor: '#FFFFFF', borderColor: palette.primary },
  input: { flex: 1, fontSize: 17, color: palette.ink, height: '100%' },
  eye: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  msg: { minHeight: 30, justifyContent: 'center', paddingHorizontal: 4 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 2 },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: palette.primarySoft },
  note: { minHeight: 44, marginTop: 6, paddingHorizontal: 12 },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingHorizontal: 4 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(60,60,67,0.3)', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: palette.primary, borderColor: palette.primary },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(60,60,67,0.3)' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginTop: 10 },
  alt: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, marginTop: 6 },
});
