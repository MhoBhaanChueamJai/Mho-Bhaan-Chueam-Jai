/**
 * เปลี่ยนรหัสผ่าน — กรอกรหัสเดิม (ยืนยันตัวตน) · รหัสใหม่อย่างน้อย 6 ตัว · ยืนยันรหัสใหม่
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Alert } from '../../lib/alert';
import { TextInput } from '../../components/AppText';
import { Sym, ios } from '../../components/ios';
import { FormSheet } from '../../components/FormSheet';
import { PressableScale, T, useHaptic } from '../../components/ui';
import { changePassword } from '../../lib/account';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

function Secret({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const [focus, setFocus] = useState(false);
  const [show, setShow] = useState(false);
  return (
    <View>
      <T v="subhead" color={ios.secondary} style={styles.label}>{label}</T>
      <View style={[styles.input, focus && styles.inputFocus]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          placeholder={label}
          placeholderTextColor={ios.tertiary}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{ flex: 1, fontSize: 17, color: palette.ink }}
          accessibilityLabel={label}
        />
        <PressableScale haptic="select" onPress={() => setShow((x) => !x)} hitSlop={10} accessibilityLabel={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
          <Sym name={show ? 'eye.slash' : 'eye'} size={17} color={ios.secondary} />
        </PressableScale>
      </View>
      {hint ? <T v="caption" color={palette.coral} style={{ marginTop: 6, marginLeft: 6 }}>{hint}</T> : null}
    </View>
  );
}

export default function ChangePassword() {
  const { demo } = useApp();
  const h = useHaptic();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const short = next.length > 0 && next.length < 6;
  const mismatch = again.length >= next.length && again.length > 0 && again !== next;
  const can = !!cur && next.length >= 6 && again === next && !busy && !demo;

  const save = async () => {
    if (!can) return;
    setBusy(true);
    setErr('');
    const r = await changePassword(cur, next).catch(() => 'error' as const);
    setBusy(false);
    if (r === 'ok') {
      h.success();
      Alert.alert('เปลี่ยนรหัสผ่านแล้ว', 'ครั้งหน้าเข้าสู่ระบบด้วยรหัสผ่านใหม่', [{ text: 'ตกลง', onPress: () => router.back() }]);
      return;
    }
    h.warn();
    setErr(r === 'wrong' ? 'รหัสผ่านปัจจุบันไม่ถูกต้อง' : r === 'same' ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม' : 'เปลี่ยนรหัสผ่านไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  };

  return (
    <FormSheet title="เปลี่ยนรหัสผ่าน" canSave={can} busy={busy} onSave={save}>
      {demo ? (
        <View style={styles.note}>
          <Sym name="info.circle.fill" size={15} color="#B26A12" />
          <T v="subhead" color="#8A5A26" style={{ flex: 1 }}>บัญชีทดลองใช้เปลี่ยนรหัสผ่านไม่ได้</T>
        </View>
      ) : null}
      <View style={[styles.card, elevation.e1]}>
        <Secret label="รหัสผ่านปัจจุบัน" value={cur} onChange={(v) => (setCur(v), setErr(''))} />
        <Secret label="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)" value={next} onChange={(v) => (setNext(v), setErr(''))} hint={short ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว' : undefined} />
        <Secret label="ยืนยันรหัสผ่านใหม่" value={again} onChange={(v) => (setAgain(v), setErr(''))} hint={mismatch ? 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' : undefined} />
      </View>
      {err ? (
        <View style={styles.err}>
          <Sym name="exclamationmark.circle.fill" size={15} color={palette.coral} />
          <T v="subhead" color={palette.coral} style={{ flex: 1 }}>{err}</T>
        </View>
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 16, gap: 14 },
  label: { marginBottom: 6, marginLeft: 4, fontWeight: '600' },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, borderWidth: 1.5, borderColor: 'transparent' },
  inputFocus: { backgroundColor: palette.surface, borderColor: palette.primary },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, backgroundColor: '#FBF1E2' },
  err: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
});
