import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { Stack, router } from 'expo-router';
import React, { useState } from 'react';
import { PractitionerGate } from '../../components/PractitionerGate';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { chatJSON, transcribe } from '../../api/ai';
import { useVoiceRecorder } from '../../components/audio';
import { Sym, ios } from '../../components/ios';
import { Waveform } from '../../components/Orb';
import { HeaderButton, PressableScale, T, useHaptic } from '../../components/ui';
import type { Patient } from '../../data/mock';
import { useApp } from '../../store/app';
import { control, palette } from '../../theme';

type Form = {
  name: string;
  sex: 'ชาย' | 'หญิง';
  age: string;
  houseNo: string;
  moo: string;
  village: string;
  subdistrict: string;
  district: string;
  province: string;
  phone: string;
  chronic: string;
  allergies: string;
  weight: string;
  height: string;
  element: Patient['element'];
};

const EMPTY: Form = {
  name: '',
  sex: 'หญิง',
  age: '',
  houseNo: '',
  moo: '',
  village: '',
  subdistrict: 'ดอนแก้ว',
  district: 'แม่ริม',
  province: 'เชียงใหม่',
  phone: '',
  chronic: '',
  allergies: '',
  weight: '',
  height: '',
  element: 'ดิน',
};

const ELEMENTS: Patient['element'][] = ['ดิน', 'น้ำ', 'ลม', 'ไฟ'];
const SAMPLE = 'นางสมศรี คำมา อายุหกสิบแปด บ้านเลขที่สิบสอง หมู่สี่ บ้านป่าไผ่ เบอร์ศูนย์แปดเก้า หนึ่งสองสาม สี่ห้าหกเจ็ด เป็นเบาหวาน แพ้ยาเพนนิซิลลิน หนักห้าสิบห้า สูงร้อยห้าสิบ';

/** แถวช่องกรอกแบบ iOS: ป้ายซ้าย ช่องกรอกขวา */
function Field({ label, value, onChange, placeholder, keyboard, last }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboard?: KeyboardTypeOptions; last?: boolean }) {
  return (
    <View style={[styles.field, !last && styles.sep]}>
      <T v="body" style={styles.label}>{label}</T>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder ?? label} placeholderTextColor={ios.tertiary} keyboardType={keyboard} style={styles.input} />
    </View>
  );
}

function Section({ title, children, footer }: { title?: string; children: React.ReactNode; footer?: string }) {
  return (
    <View style={{ marginTop: 22 }}>
      {title ? <T v="caption" color={ios.secondary} style={styles.secTitle}>{title}</T> : null}
      <View style={styles.group}>{children}</View>
      {footer ? <T v="caption" color={ios.secondary} style={styles.secFooter}>{footer}</T> : null}
    </View>
  );
}

function NewPatientInner() {
  const { addPatient } = useApp();
  const h = useHaptic();
  const rec = useVoiceRecorder();
  const [f, setF] = useState<Form>(EMPTY);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const set = (k: keyof Form) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const canSave = f.name.trim().length > 1;

  /** พูด → ถอดเสียง → AI แยกข้อมูลลงช่อง */
  const fillByVoice = async () => {
    if (!rec.isRecording) {
      h.press();
      setAiNote('');
      rec.start().catch(() => setAiNote('เปิดไมโครโฟนไม่ได้'));
      return;
    }
    h.heavy();
    const uri = await rec.stop().catch(() => null);
    setAiBusy(true);
    let text = '';
    try {
      if (uri && rec.durationMs > 1200) text = await transcribe(uri);
    } catch {}
    if (!text) text = SAMPLE;
    try {
      const r = await chatJSON<Partial<Form>>([
        {
          role: 'user',
          content: `แยกข้อมูลผู้ป่วยจากคำพูดนี้: "${text}"\nตอบ JSON เท่านั้น ช่องที่ไม่ได้กล่าวถึงให้เป็น "" (ห้ามเดา) ตัวเลขเป็นเลขอารบิก:
{"name":"ชื่อ-สกุล พร้อมคำนำหน้า","sex":"ชาย|หญิง","age":"","houseNo":"","moo":"","village":"","subdistrict":"","district":"","province":"","phone":"รูปแบบ 0XX-XXX-XXXX","chronic":"โรคประจำตัว","allergies":"การแพ้ยา/อาหาร","weight":"","height":""}`,
        },
      ]);
      setF((x) => {
        const next = { ...x };
        (Object.keys(r) as (keyof Form)[]).forEach((k) => {
          const v = String(r[k] ?? '').trim();
          if (v) (next as any)[k] = k === 'sex' ? (v.includes('ชาย') ? 'ชาย' : 'หญิง') : v;
        });
        return next;
      });
      setAiNote('ครูปัญญากรอกให้แล้ว ตรวจสอบและแก้ไขได้');
      h.success();
    } catch {
      setAiNote('เชื่อมต่อ AI ไม่ได้ กรุณากรอกเอง');
      h.warn();
    } finally {
      setAiBusy(false);
    }
  };

  const save = () => {
    if (!canSave) return;
    const num = (s: string) => Number(s.replace(/[^0-9.]/g, '')) || 0;
    const id = addPatient({
      name: f.name.trim(),
      sex: f.sex,
      age: num(f.age),
      address: { houseNo: f.houseNo, moo: f.moo, village: f.village, subdistrict: f.subdistrict, district: f.district, province: f.province },
      phone: f.phone || '-',
      chronic: f.chronic || 'ไม่มี',
      allergies: f.allergies || 'ไม่มี',
      weight: num(f.weight),
      height: num(f.height),
      element: f.element,
      status: 'ติดตามอาการ',
      meds: [],
    });
    h.success();
    router.dismiss();
    setTimeout(() => router.push(`/patient/${id}`), 250);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <HeaderButton onPress={() => router.back()} label="ปิด">
              <Sym name="xmark" size={20} color={ios.label} weight="semibold" />
            </HeaderButton>
          ),
          headerRight: () => (
            <PressableScale onPress={save} haptic="press" disabled={!canSave} style={styles.textBtn} accessibilityLabel="บันทึก">
              <T v="body" color={canSave ? palette.primary : ios.tertiary} style={{ fontWeight: '700' }}>บันทึก</T>
            </PressableScale>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
        {/* กรอกด้วยเสียง */}
        <PressableScale onPress={fillByVoice} disabled={aiBusy} scaleTo={0.98} style={[styles.voice, rec.isRecording && { backgroundColor: palette.primary }]}>
          <View style={[styles.voiceIcon, rec.isRecording && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            {aiBusy ? <ActivityIndicator color={palette.primary} /> : <Sym name={rec.isRecording ? 'stop.fill' : 'mic.fill'} size={20} color={rec.isRecording ? palette.white : palette.primary} />}
          </View>
          <View style={{ flex: 1 }}>
            <T v="body" color={rec.isRecording ? palette.white : ios.label} style={{ fontWeight: '600' }}>
              {aiBusy ? 'ครูปัญญากำลังกรอกให้…' : rec.isRecording ? 'กำลังฟัง… แตะเมื่อพูดจบ' : 'กรอกด้วยเสียง'}
            </T>
            {rec.isRecording ? (
              <Waveform level={rec.level} bars={18} />
            ) : (
              <T v="caption" color={ios.secondary}>พูดชื่อ อายุ ที่อยู่ โรคประจำตัว แล้ว AI กรอกให้</T>
            )}
          </View>
        </PressableScale>
        {aiNote ? (
          <Animated.View entering={FadeIn} style={styles.note}>
            <Sym name="sparkles" size={15} color={palette.primary} />
            <T v="caption" color={palette.primary}>{aiNote}</T>
          </Animated.View>
        ) : null}

        <Section title="ข้อมูลผู้ป่วย">
          <Field label="ชื่อ-สกุล" value={f.name} onChange={set('name')} placeholder="เช่น นางบุญมา ศรีคำ" />
          <View style={[styles.field, styles.sep]}>
            <T v="body" style={styles.label}>เพศ</T>
            <SegmentedControl values={['หญิง', 'ชาย']} selectedIndex={f.sex === 'หญิง' ? 0 : 1} onChange={(e) => set('sex')(e.nativeEvent.selectedSegmentIndex === 0 ? 'หญิง' : 'ชาย')} style={{ flex: 1, height: 32 }} />
          </View>
          <Field label="อายุ (ปี)" value={f.age} onChange={set('age')} placeholder="0" keyboard="number-pad" />
          <Field label="โทรศัพท์" value={f.phone} onChange={set('phone')} placeholder="08X-XXX-XXXX" keyboard="phone-pad" last />
        </Section>

        <Section title="ที่อยู่">
          <View style={[styles.field, styles.sep, { gap: 0 }]}>
            <T v="body" style={styles.label}>บ้านเลขที่</T>
            <TextInput value={f.houseNo} onChangeText={set('houseNo')} placeholder="เลขที่" placeholderTextColor={ios.tertiary} style={[styles.input, { flex: 1 }]} />
            <T v="body" color={ios.secondary} style={{ marginHorizontal: 8 }}>หมู่</T>
            <TextInput value={f.moo} onChangeText={set('moo')} placeholder="0" placeholderTextColor={ios.tertiary} keyboardType="number-pad" style={[styles.input, { width: 44, flex: 0 }]} />
          </View>
          <Field label="หมู่บ้าน" value={f.village} onChange={set('village')} placeholder="เช่น บ้านหนองบัว" />
          <Field label="ตำบล" value={f.subdistrict} onChange={set('subdistrict')} />
          <Field label="อำเภอ" value={f.district} onChange={set('district')} />
          <Field label="จังหวัด" value={f.province} onChange={set('province')} last />
        </Section>

        <Section title="สุขภาพ" footer="ข้อมูลนี้ใช้ตรวจความปลอดภัยของสมุนไพรกับผู้ป่วย">
          <Field label="โรคประจำตัว" value={f.chronic} onChange={set('chronic')} placeholder="ไม่มี" />
          <Field label="แพ้ยา/อาหาร" value={f.allergies} onChange={set('allergies')} placeholder="ไม่มี" />
          <Field label="น้ำหนัก (กก.)" value={f.weight} onChange={set('weight')} placeholder="0" keyboard="decimal-pad" />
          <Field label="ส่วนสูง (ซม.)" value={f.height} onChange={set('height')} placeholder="0" keyboard="decimal-pad" />
          <View style={styles.field}>
            <T v="body" style={styles.label}>ธาตุเจ้าเรือน</T>
            <SegmentedControl values={ELEMENTS} selectedIndex={ELEMENTS.indexOf(f.element)} onChange={(e) => setF((x) => ({ ...x, element: ELEMENTS[e.nativeEvent.selectedSegmentIndex] }))} style={{ flex: 1, height: 32 }} />
          </View>
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  textBtn: { height: 36, paddingHorizontal: 8, justifyContent: 'center' },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 14, borderCurve: 'continuous', padding: 12, marginTop: 12 },
  voiceIcon: { width: control.icon, height: control.icon, borderRadius: control.icon / 2, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 8 },
  secTitle: { textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 6 },
  secFooter: { paddingHorizontal: 16, marginTop: 6 },
  group: { backgroundColor: palette.surface, borderRadius: 14, borderCurve: 'continuous', paddingLeft: 16 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: control.row, paddingRight: 16, paddingVertical: 6 },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ios.separator },
  label: { width: 112 },
  input: { flex: 1, fontSize: 17, color: palette.ink, paddingVertical: 6 },
});

export default function NewPatient() {
  return (
    <PractitionerGate>
      <NewPatientInner />
    </PractitionerGate>
  );
}
