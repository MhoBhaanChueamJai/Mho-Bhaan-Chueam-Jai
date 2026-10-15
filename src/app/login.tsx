import * as LocalAuthentication from 'expo-local-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from '../components/ios';
import { AIFlower, IridescentPill, SoftShadow } from '../components/Orb';
import { PressableScale, T, useHaptic } from '../components/ui';
import { useApp } from '../store/app';
import { control, palette } from '../theme';

/** รหัสผ่านสาธิต — ยังไม่มีระบบบัญชีหลังบ้าน */
const DEMO_PASSWORD = '123456';
const PROMO = require('../../assets/ai/promo.mp4');

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
  const [faceId, setFaceId] = useState(false);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const canSubmit = user.trim().length >= 3 && pass.length >= 4 && !busy;

  // วิดีโอพรีเซนต์แอป เล่นวนแบบปิดเสียง
  const player = useVideoPlayer(PROMO, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    if (!settings.username) return;
    Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()])
      .then(([hw, en]) => setFaceId(hw && en))
      .catch(() => {});
  }, [settings.username]);

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

  const withFaceId = async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'เข้าสู่ระบบหมอบ้านเชื่อมใจ', cancelLabel: 'ยกเลิก' });
    if (r.success) enter(settings.username);
  };

  const heroH = Math.min(height * 0.5, 460);
  const phoneH = heroH - insets.top - 96;
  const phoneW = phoneH * (440 / 960);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#FBF8FF' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
        {/* ── ส่วนบน: วิดีโอพรีเซนต์แอป ── */}
        <View style={{ height: heroH, paddingTop: insets.top + 12, alignItems: 'center', overflow: 'hidden' }}>
          <LinearGradient colors={['#FFE6D6', '#FBDDF0', '#E7DDFF', '#DCE9FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={[styles.blob, { width: width * 0.9, height: width * 0.9, left: -width * 0.35, top: -width * 0.3, backgroundColor: 'rgba(255,190,150,0.45)' }]} />
          <View style={[styles.blob, { width: width * 0.8, height: width * 0.8, right: -width * 0.35, top: heroH * 0.35, backgroundColor: 'rgba(170,150,255,0.35)' }]} />

          <Animated.View entering={FadeInDown.duration(500)} style={styles.brand}>
            <AIFlower size={30} active />
            <T v="title" style={{ fontWeight: '700' }}>หมอบ้านเชื่อมใจ</T>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(150).duration(600)} style={{ marginTop: 14 }}>
            <SoftShadow width={phoneW} height={phoneH} radius={phoneW * 0.16} blur={22} offsetY={14} color="rgba(120,80,170,0.32)" />
            <View style={[styles.phone, { width: phoneW, height: phoneH, borderRadius: phoneW * 0.16 }]}>
              <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />
            </View>
          </Animated.View>

          <View style={[styles.tag, { left: 20, top: insets.top + 96 }]}>
            <Sym name="waveform" size={15} color="#A35DD8" />
            <T v="caption" style={{ fontWeight: '600' }}>พูดแทนพิมพ์</T>
          </View>
          <View style={[styles.tag, { right: 20, top: insets.top + 96 + phoneH * 0.45 }]}>
            <Sym name="leaf.fill" size={15} color={palette.primary} />
            <T v="caption" style={{ fontWeight: '600' }}>ภูมิปัญญาไทย</T>
          </View>
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

          <PressableScale haptic="press" disabled={!canSubmit} onPress={submit} scaleTo={0.97} style={{ opacity: canSubmit ? 1 : 0.55, marginTop: 6 }}>
            <IridescentPill style={styles.cta}>
              <T v="body" style={{ fontWeight: '700' }}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</T>
              {busy ? null : <Sym name="arrow.right" size={17} color={ios.label} weight="semibold" />}
            </IridescentPill>
          </PressableScale>

          {faceId ? (
            <PressableScale haptic="press" onPress={withFaceId} scaleTo={0.97} style={styles.faceId}>
              <Sym name="faceid" size={20} color={palette.primary} />
              <T v="body" color={palette.primary} style={{ fontWeight: '600' }}>เข้าสู่ระบบด้วย Face ID</T>
            </PressableScale>
          ) : null}

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
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.9 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.7)', paddingLeft: 6, paddingRight: 14, height: 40, borderRadius: 20 },
  phone: { overflow: 'hidden', borderWidth: 5, borderColor: '#14201A', backgroundColor: '#fff' },
  tag: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 12, height: 34, borderRadius: 17 },
  sheet: { flex: 1, marginTop: -28, backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderCurve: 'continuous', paddingHorizontal: 24, paddingTop: 28 },
  label: { marginLeft: 16, marginBottom: 6, fontWeight: '600' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, borderRadius: 27, paddingLeft: 18, paddingRight: 8, backgroundColor: '#F4F4F7', borderWidth: 1.5, borderColor: 'transparent' },
  fieldFocus: { backgroundColor: '#FFFFFF', borderColor: palette.primary },
  input: { flex: 1, fontSize: 17, color: palette.ink, height: '100%' },
  eye: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, minHeight: 36 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  forgot: { minHeight: 36, justifyContent: 'center', paddingLeft: 12 },
  cta: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  faceId: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, borderRadius: 26, borderWidth: 1.5, borderColor: palette.primarySoft },
});
