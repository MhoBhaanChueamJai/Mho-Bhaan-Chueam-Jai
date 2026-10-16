/**
 * เพิ่มผู้ป่วยใหม่ — หน้าเต็ม (push จากแท็บผู้ป่วย) ตาม DESIGN_SYSTEM.md
 * บนสุด: การ์ดพูดแนะนำผู้ป่วย (AI กรอกให้) → ฟอร์มแบ่งการ์ด ป้ายอยู่เหนือช่องแคปซูล → ปุ่มบันทึกติดล่าง
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { PractitionerGate } from '../../components/PractitionerGate';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatJSON, transcribe } from '../../api/ai';
import { useVoiceRecorder } from '../../components/audio';
import { Sym, ios } from '../../components/ios';
import { Waveform } from '../../components/Orb';
import { Button, Glass, PressableScale, T, useHaptic } from '../../components/ui';
import type { Patient } from '../../data/mock';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

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

/** ช่องกรอก: ป้ายด้านบน + ช่องแคปซูลพื้นมิ้นต์ (โฟกัส = พื้นขาว ขอบเขียว) */
function Field({ label, value, onChange, placeholder, keyboard, flex }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboard?: KeyboardTypeOptions; flex?: number }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={flex ? { flex } : undefined}>
      <T v="subhead" color={ios.secondary} style={styles.label}>{label}</T>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={ios.tertiary}
        keyboardType={keyboard}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[styles.input, focus && styles.inputFocus]}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** ตัวเลือกแบบปุ่มแคปซูล (เพศ / ธาตุ) */
function Choice<V extends string>({ label, options, value, onChange }: { label: string; options: V[]; value: V; onChange: (v: V) => void }) {
  return (
    <View>
      <T v="subhead" color={ios.secondary} style={styles.label}>{label}</T>
      <View style={styles.choices}>
        {options.map((o) => {
          const on = o === value;
          return (
            <PressableScale key={o} haptic="select" scaleTo={0.96} onPress={() => onChange(o)} style={[styles.choice, on && styles.choiceOn]} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${label} ${o}`}>
              <T v="body" color={on ? palette.white : palette.ink} style={{ fontWeight: on ? '600' : '400' }}>{o}</T>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function Section({ title, icon, footer, children }: { title: string; icon: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={[styles.card, elevation.e1]}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Sym name={icon as any} size={15} color={palette.primary} />
        </View>
        <T v="title">{title}</T>
      </View>
      <View style={{ gap: 14 }}>{children}</View>
      {footer ? <T v="caption" color={ios.secondary} style={{ marginTop: 12 }}>{footer}</T> : null}
    </View>
  );
}

function NewPatientInner() {
  const insets = useSafeAreaInsets();
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
    router.replace(`/patient/${id}`);
  };

  const recording = rec.isRecording;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* พูดแนะนำผู้ป่วย — ทางหลักสำหรับหมอที่ไม่ถนัดพิมพ์ */}
        <PressableScale onPress={fillByVoice} disabled={aiBusy} scaleTo={0.98} style={[styles.voice, recording && styles.voiceOn, elevation.e1]} accessibilityLabel={recording ? 'หยุดฟัง' : 'พูดแนะนำผู้ป่วย'}>
          <View style={[styles.mic, recording && { backgroundColor: palette.white }]}>
            {aiBusy ? <ActivityIndicator color={palette.white} /> : <Sym name={recording ? 'stop.fill' : 'mic.fill'} size={26} color={recording ? palette.primary : palette.white} />}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="title" color={recording ? palette.white : palette.ink}>
              {aiBusy ? 'ครูปัญญากำลังกรอกให้…' : recording ? 'กำลังฟัง… แตะเมื่อพูดจบ' : 'พูดแนะนำผู้ป่วย'}
            </T>
            {recording ? (
              <Waveform level={rec.level} bars={18} />
            ) : (
              <T v="subhead" color={ios.secondary}>บอกชื่อ อายุ ที่อยู่ โรคประจำตัว แล้ว AI กรอกให้</T>
            )}
          </View>
        </PressableScale>
        {aiNote ? (
          <Animated.View entering={FadeIn} style={styles.note}>
            <Sym name="sparkles" size={14} color={palette.primary} />
            <T v="caption" color={palette.primary}>{aiNote}</T>
          </Animated.View>
        ) : null}

        <Section title="ข้อมูลผู้ป่วย" icon="person.fill">
          <Field label="ชื่อ-สกุล" value={f.name} onChange={set('name')} placeholder="เช่น นางบุญมา ศรีคำ" />
          <Choice label="เพศ" options={['หญิง', 'ชาย'] as ('หญิง' | 'ชาย')[]} value={f.sex} onChange={(v) => setF((x) => ({ ...x, sex: v }))} />
          <View style={styles.row2}>
            <Field label="อายุ (ปี)" value={f.age} onChange={set('age')} placeholder="0" keyboard="number-pad" flex={1} />
            <Field label="โทรศัพท์" value={f.phone} onChange={set('phone')} placeholder="08X-XXX-XXXX" keyboard="phone-pad" flex={2} />
          </View>
        </Section>

        <Section title="ที่อยู่" icon="house.fill">
          <View style={styles.row2}>
            <Field label="บ้านเลขที่" value={f.houseNo} onChange={set('houseNo')} placeholder="เลขที่" flex={2} />
            <Field label="หมู่" value={f.moo} onChange={set('moo')} placeholder="0" keyboard="number-pad" flex={1} />
          </View>
          <Field label="หมู่บ้าน" value={f.village} onChange={set('village')} placeholder="เช่น บ้านหนองบัว" />
          <View style={styles.row2}>
            <Field label="ตำบล" value={f.subdistrict} onChange={set('subdistrict')} flex={1} />
            <Field label="อำเภอ" value={f.district} onChange={set('district')} flex={1} />
          </View>
          <Field label="จังหวัด" value={f.province} onChange={set('province')} />
        </Section>

        <Section title="สุขภาพ" icon="heart.fill" footer="ใช้ตรวจความปลอดภัยของสมุนไพรกับผู้ป่วย">
          <Field label="โรคประจำตัว" value={f.chronic} onChange={set('chronic')} placeholder="ไม่มี" />
          <Field label="แพ้ยา / อาหาร" value={f.allergies} onChange={set('allergies')} placeholder="ไม่มี" />
          <View style={styles.row2}>
            <Field label="น้ำหนัก (กก.)" value={f.weight} onChange={set('weight')} placeholder="0" keyboard="decimal-pad" flex={1} />
            <Field label="ส่วนสูง (ซม.)" value={f.height} onChange={set('height')} placeholder="0" keyboard="decimal-pad" flex={1} />
          </View>
          <Choice label="ธาตุเจ้าเรือน" options={ELEMENTS} value={f.element} onChange={(v) => setF((x) => ({ ...x, element: v }))} />
        </Section>
      </ScrollView>

      {/* ปุ่มบันทึกแบบแถบลอย (กระจกขุ่น + เงา e3) */}
      <View pointerEvents="box-none" style={[styles.floatWrap, { bottom: insets.bottom + 8 }]}>
        <Glass tint="rgba(255,255,255,0.75)" style={[styles.floatBar, elevation.e3]}>
          <View style={{ flex: 1, paddingLeft: 6 }}>
            <T v="subhead" style={{ fontWeight: '600' }} numberOfLines={1}>{f.name.trim() || 'ยังไม่ได้กรอกชื่อ'}</T>
            <T v="caption" color={ios.secondary} numberOfLines={1}>{canSave ? `${f.sex}${f.age ? ` · ${f.age} ปี` : ''}${f.village ? ` · ${f.village}` : ''}` : 'กรอกชื่อเพื่อบันทึก'}</T>
          </View>
          <Button label="บันทึก" disabled={!canSave} onPress={save} style={{ height: 48, paddingHorizontal: 26 }} />
        </Glass>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 130, gap: 14 },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 16 },
  voiceOn: { backgroundColor: palette.primary },
  mic: { width: 56, height: 56, borderRadius: 28, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, marginTop: -6 },
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  label: { marginBottom: 6, marginLeft: 4, fontWeight: '600' },
  input: { height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, fontSize: 17, color: palette.ink, borderWidth: 1.5, borderColor: 'transparent' },
  inputFocus: { backgroundColor: palette.surface, borderColor: palette.primary },
  row2: { flexDirection: 'row', gap: 10 },
  choices: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, height: 48, borderRadius: 24, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  choiceOn: { backgroundColor: palette.primary },
  floatWrap: { position: 'absolute', left: 16, right: 16 },
  floatBar: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 32, borderCurve: 'continuous', padding: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.9)' },
});

export default function NewPatient() {
  return (
    <PractitionerGate>
      <NewPatientInner />
    </PractitionerGate>
  );
}
