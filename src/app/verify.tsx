/**
 * ยืนยันตัวตนหมอพื้นบ้าน → ปลดล็อกการรักษาผู้ป่วย
 * ส่งข้อมูลไปตรวจที่ Edge Function `verify-practitioner` (ฝั่งเซิร์ฟเวอร์)
 * ซึ่งเทียบชื่อ–นามสกุล + เลขที่หนังสือรับรอง กับทะเบียนกรมการแพทย์แผนไทยฯ
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, Sym, ios } from '../components/ios';
import { Button, Chip, PressableScale, T, useHaptic } from '../components/ui';
import { doctorTypes } from '../data/mock';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/app';
import { control, palette } from '../theme';

const TITLES = ['นาย', 'นาง', 'นางสาว'];
const EDUCATION = ['ไม่ได้เรียนในระบบ', 'ประถมศึกษา', 'มัธยมศึกษา', 'ปวช./ปวส.', 'ปริญญาตรี', 'สูงกว่าปริญญาตรี'];
/** ประเภทหมอพื้นบ้านตามทะเบียนกรม (คีย์ตรงกับ Edge Function) */
const TYPES = [
  { k: 'herbal', l: 'หมอยาสมุนไพร' },
  { k: 'massage', l: 'หมอนวดพื้นบ้าน' },
  { k: 'bone', l: 'หมอกระดูก' },
  { k: 'midwife', l: 'หมอตำแย' },
  { k: 'venom', l: 'หมอรักษาสัตว์พิษกัด' },
  { k: 'ritual', l: 'หมอพิธีกรรม' },
];
export const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.k, t.l]));

function validThaiId(id: string) {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}
const fmtId = (d: string) => [d.slice(0, 1), d.slice(1, 5), d.slice(5, 10), d.slice(10, 12), d.slice(12, 13)].filter(Boolean).join('-');

function Field({ label, value, onChange, placeholder, keyboard, right, hint, error }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboard?: KeyboardTypeOptions; right?: React.ReactNode; hint?: string; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="caption" color={ios.secondary} style={styles.label}>{label}</T>
      <View style={[styles.field, !!error && { borderColor: palette.coral }]}>
        <TextInput value={value} onChangeText={onChange} placeholder={placeholder ?? label} placeholderTextColor={ios.tertiary} keyboardType={keyboard} style={styles.input} autoCorrect={false} />
        {right}
      </View>
      {error ? <T v="caption" color={palette.coral} style={styles.label}>{error}</T> : hint ? <T v="caption" color={ios.tertiary} style={styles.label}>{hint}</T> : null}
    </View>
  );
}

type Result = { ok: true; registry: { title: string; first_name: string; last_name: string; province: string; certificate_number: string; expiry: string | null; types: string[] } } | { ok: false; reason: string };

export default function Verify() {
  const insets = useSafeAreaInsets();
  const { profile, reloadCloud } = useApp();
  const h = useHaptic();
  const [title, setTitle] = useState('นาย');
  const [first, setFirst] = useState(profile?.first_name ?? '');
  const [last, setLast] = useState(profile?.last_name ?? '');
  const [age, setAge] = useState('');
  const [nid, setNid] = useState('');
  const [edu, setEdu] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [cert, setCert] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const digits = nid.replace(/\D/g, '');
  const nidErr = digits.length === 13 && !validThaiId(digits) ? 'เลขบัตรประชาชนไม่ถูกต้อง' : '';
  const ageN = Number(age);
  const ageErr = age && (ageN < 20 || ageN > 110) ? 'อายุต้องอยู่ระหว่าง 20–110 ปี' : '';
  const ready = first.trim() && last.trim() && ageN >= 20 && ageN <= 110 && validThaiId(digits) && edu && types.length && cert.trim().length >= 4;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('verify-practitioner', {
        body: { title, first_name: first.trim(), last_name: last.trim(), age: ageN, national_id: digits, education: edu, healer_types: types, cert_number: cert.trim() },
      });
      const r = (data ?? { ok: false, reason: error?.message ?? 'ตรวจสอบไม่สำเร็จ' }) as Result;
      setResult(r);
      if (r.ok) {
        h.success();
        await reloadCloud();
      } else h.warn();
    } catch (e: any) {
      setResult({ ok: false, reason: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต' });
    } finally {
      setBusy(false);
    }
  };

  if (result?.ok) {
    const r = result.registry;
    return (
      <View style={[styles.page, { paddingTop: insets.top + 40, paddingHorizontal: 24, alignItems: 'center' }]}>
        <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center' }}>
          <View style={styles.okBadge}>
            <Sym name="checkmark.seal.fill" size={28} color="#FFFFFF" />
          </View>
          <T v="h1" center style={{ marginTop: 16, fontWeight: '700' }}>ยืนยันตัวตนสำเร็จ</T>
          <T v="callout" color={ios.secondary} center style={{ marginTop: 6 }}>พบข้อมูลในทะเบียนหมอพื้นบ้านที่ได้รับการรับรอง{'\n'}กรมการแพทย์แผนไทยและการแพทย์ทางเลือก</T>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.card}>
          {[
            ['ชื่อ', `${r.title}${r.first_name} ${r.last_name}`],
            ['เลขที่หนังสือ', r.certificate_number],
            ['จังหวัดที่รับรอง', r.province],
            ['ประเภท', r.types.map((t) => TYPE_LABEL[t]).join(', ') || '-'],
            ['หมดอายุ', r.expiry ?? '-'],
          ].map(([k, v], i) => (
            <View key={k} style={[styles.kv, i > 0 && styles.sep]}>
              <T v="callout" color={ios.secondary}>{k}</T>
              <T v="callout" style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{v}</T>
            </View>
          ))}
        </Animated.View>
        <View style={{ flex: 1 }} />
        <Button label="เริ่มดูแลผู้ป่วย" onPress={() => {
            router.dismissAll();
            router.navigate('/patients');
          }} style={{ alignSelf: 'stretch', marginBottom: insets.bottom + 16 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 40 }} keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <AppIcon name="person.badge.shield.checkmark.fill" bg={palette.primary} size={40} />
          <View style={{ flex: 1 }}>
            <T v="body" style={{ fontWeight: '600' }}>ยืนยันตัวตนหมอพื้นบ้าน</T>
            <T v="caption" color={ios.secondary}>
              เพื่อใช้งานการรักษาผู้ป่วย ระบบจะตรวจชื่อและเลขที่หนังสือรับรองกับทะเบียนกรมการแพทย์แผนไทยฯ
            </T>
          </View>
        </View>

        <T v="title" style={styles.sec}>ข้อมูลส่วนตัว</T>
        <T v="caption" color={ios.secondary} style={styles.label}>คำนำหน้า</T>
        <View style={styles.chips}>
          {TITLES.map((t) => (
            <Chip key={t} label={t} active={title === t} onPress={() => setTitle(t)} />
          ))}
        </View>
        <View style={{ gap: 14, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="ชื่อ" value={first} onChange={setFirst} placeholder="ตามบัตรประชาชน" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="นามสกุล" value={last} onChange={setLast} />
            </View>
          </View>
          <Field label="อายุ (ปี)" value={age} onChange={(v) => setAge(v.replace(/\D/g, '').slice(0, 3))} keyboard="number-pad" placeholder="เช่น 58" error={ageErr} />
          <Field
            label="เลขบัตรประชาชน 13 หลัก"
            value={fmtId(digits)}
            onChange={(v) => setNid(v.replace(/\D/g, '').slice(0, 13))}
            keyboard="number-pad"
            placeholder="x-xxxx-xxxxx-xx-x"
            error={nidErr}
            hint="ระบบเก็บเฉพาะค่าเข้ารหัสและ 4 หลักท้าย"
            right={digits.length === 13 && !nidErr ? <Sym name="checkmark.circle.fill" size={18} color={palette.primary} /> : undefined}
          />
        </View>

        <T v="title" style={styles.sec}>วุฒิการศึกษา</T>
        <View style={styles.chips}>
          {EDUCATION.map((e) => (
            <Chip key={e} label={e} active={edu === e} onPress={() => setEdu(e)} />
          ))}
        </View>

        <T v="title" style={styles.sec}>ประเภทหมอพื้นบ้าน</T>
        <T v="caption" color={ios.secondary} style={[styles.label, { marginBottom: 8 }]}>เลือกได้มากกว่า 1 — ต้องตรงกับที่ระบุในหนังสือรับรอง</T>
        <View style={styles.chips}>
          {TYPES.map((t) => (
            <Chip key={t.k} label={t.l} active={types.includes(t.k)} onPress={() => setTypes((x) => (x.includes(t.k) ? x.filter((y) => y !== t.k) : [...x, t.k]))} />
          ))}
        </View>

        <T v="title" style={styles.sec}>หนังสือรับรองการเป็นหมอพื้นบ้าน</T>
        <Field label="เลขที่หนังสือรับรอง" value={cert} onChange={setCert} placeholder="เช่น นพ 00106" hint="อักษรย่อจังหวัด + เลข 5 หลัก ตามหนังสือรับรอง" />

        {result && !result.ok ? (
          <Animated.View entering={FadeIn} style={styles.fail}>
            <Sym name="exclamationmark.triangle.fill" size={18} color={palette.coral} />
            <T v="callout" style={{ flex: 1 }}>{result.reason}</T>
          </Animated.View>
        ) : null}

        <Button
          label={busy ? 'กำลังตรวจสอบกับทะเบียน…' : 'ยืนยันตัวตน'}
          disabled={!ready || busy}
          onPress={submit}
          icon={busy ? <ActivityIndicator color="#FFFFFF" /> : undefined}
          style={{ marginTop: 24 }}
        />
        <PressableScale onPress={() => router.back()} style={styles.later}>
          <T v="callout" color={palette.primary}>ไว้ทีหลัง</T>
        </PressableScale>
        <T v="caption" color={ios.tertiary} center style={{ marginTop: 8 }}>
          อ้างอิงทะเบียน: dtam.moph.go.th/traditional-cert
        </T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  intro: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: palette.primarySoft, padding: 14, borderRadius: 16 },
  sec: { marginTop: 26, marginBottom: 10, fontWeight: '700' },
  label: { paddingHorizontal: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { flexDirection: 'row', alignItems: 'center', minHeight: control.field + 6, borderRadius: 14, backgroundColor: '#F4F5F2', borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, gap: 8 },
  input: { flex: 1, fontSize: 17, color: palette.ink, paddingVertical: 10 },
  fail: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: palette.coralSoft, padding: 14, borderRadius: 14, marginTop: 20 },
  later: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: 6 },
  okBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  card: { alignSelf: 'stretch', marginTop: 28, backgroundColor: '#F6F7F4', borderRadius: 18, paddingHorizontal: 16 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 13 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
});
