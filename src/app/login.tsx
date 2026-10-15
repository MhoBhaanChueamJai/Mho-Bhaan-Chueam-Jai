import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from '../components/ios';
import { KeynoteIntro } from '../components/Intro';
import { Button, PressableScale, T, useHaptic } from '../components/ui';
import { useApp } from '../store/app';
import { control, palette } from '../theme';

/** รหัสผ่านสาธิต — ยังไม่มีระบบบัญชีหลังบ้าน */
const DEMO_PASSWORD = '123456';

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
  const { settings, update } = useApp();
  const h = useHaptic();
  const passRef = useRef<TextInput>(null);
  const [user, setUser] = useState(settings.username);
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const canSubmit = user.trim().length >= 3 && pass.length >= 4 && !busy;

  const enter = (name: string) => {
    h.success();
    update({ loggedIn: true, username: name });
    router.replace('/home');
  };

  const submit = () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    setTimeout(() => {
      if (pass !== DEMO_PASSWORD) {
        setBusy(false);
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        setPass('');
        h.warn();
        shake.value = withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 }));
        return;
      }
      enter(user.trim());
    }, 600);
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
          <T v="h1" style={{ fontWeight: '700' }}>ยินดีต้อนรับ</T>
          <T v="callout" color={ios.secondary} style={{ marginTop: 2 }}>เข้าสู่ระบบเพื่อดูแลผู้ป่วยและภูมิปัญญาของคุณ</T>

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
            ) : (
              <View />
            )}
            <PressableScale haptic="select" onPress={() => setError('ติดต่อ สสจ. หรือ รพ.สต. เพื่อตั้งรหัสผ่านใหม่')} style={styles.forgot}>
              <T v="callout" color={palette.primary}>ลืมรหัสผ่าน?</T>
            </PressableScale>
          </View>

          <Button
            label={busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            disabled={!canSubmit}
            onPress={submit}
            icon={busy ? undefined : <Sym name="arrow.right" size={17} color="#FFFFFF" weight="semibold" />}
            style={{ marginTop: 6, height: 54 }}
          />


          <View style={{ flex: 1 }} />
          <T v="caption" center color={ios.tertiary} style={{ marginTop: 22 }}>
            ทดลองใช้งาน: ชื่อผู้ใช้ใดก็ได้ · รหัสผ่าน {DEMO_PASSWORD}
          </T>
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
  forgot: { minHeight: 36, justifyContent: 'center', paddingLeft: 12 },
});
