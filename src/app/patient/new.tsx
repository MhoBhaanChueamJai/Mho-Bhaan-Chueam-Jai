/**
 * เพิ่มผู้ป่วยใหม่ — หน้าเต็ม (push จากแท็บผู้ป่วย) ตาม DESIGN_SYSTEM.md
 * บนสุด: การ์ดพูดแนะนำผู้ป่วย (AI กรอกให้) → ฟอร์มแบ่งการ์ด ป้ายอยู่เหนือช่องแคปซูล → ปุ่มบันทึกติดล่าง
 */
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { PractitionerGate } from '../../components/PractitionerGate';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { chatJSON, transcribe } from '../../api/ai';
import { useVoiceRecorder } from '../../components/audio';
import { Sym, ios } from '../../components/ios';
import { Waveform } from '../../components/Orb';
import { Button, GlassDock, HeaderButton, PressableScale, T, useHaptic } from '../../components/ui';
import { takeIdScanResult, type IdCardData } from '../../lib/idScan';
import { ageFrom, elementFromMonth, toISO } from '../../lib/birth';
import { DateField, Dropdown } from '../../components/FormPickers';
import { formatAddress, parseAddress } from '../../lib/address';
import type { Patient } from '../../data/mock';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

type Form = {
  prefix: string;
  name: string;
  sex: 'ชาย' | 'หญิง';
  age: string;
  bDay: string;
  bMonth: string;
  bYear: string; // พ.ศ.
  houseNo: string;
  moo: string;
  village: string;
  subdistrict: string;
  district: string;
  province: string;
  phone: string;
  address: string; // ที่อยู่ช่องเดียว
  chronic: string;
  allergies: string;
  weight: string;
  height: string;
  element: Patient['element'];
};

const EMPTY: Form = {
  prefix: '',
  name: '',
  sex: 'หญิง',
  age: '',
  bDay: '',
  bMonth: '',
  bYear: '',
  houseNo: '',
  moo: '',
  village: '',
  subdistrict: '',
  district: '',
  province: '',
  phone: '',
  address: '',
  chronic: '',
  allergies: '',
  weight: '',
  height: '',
  element: 'ดิน',
};

const ELEMENTS: Patient['element'][] = ['ดิน', 'น้ำ', 'ลม', 'ไฟ'];
/** คำนำหน้า → เพศ (เลือกคำนำหน้าแล้วกำหนดเพศให้อัตโนมัติ) */
const PREFIXES: { label: string; sex: 'ชาย' | 'หญิง' }[] = [
  { label: 'นาย', sex: 'ชาย' },
  { label: 'นาง', sex: 'หญิง' },
  { label: 'นางสาว', sex: 'หญิง' },
  { label: 'ด.ช.', sex: 'ชาย' },
  { label: 'ด.ญ.', sex: 'หญิง' },
];
/** แยกคำนำหน้าออกจากชื่อเต็ม (เช่น "นาย ณัฐนนท์ ภูมิศรีแก้ว", "นางสาวสมศรี") */
function splitPrefix(full: string): { prefix: string; name: string } {
  const t = full.trim().replace(/^เด็กชาย/, 'ด.ช.').replace(/^เด็กหญิง/, 'ด.ญ.');
  const p = [...PREFIXES].sort((a, b) => b.label.length - a.label.length).find((x) => t.startsWith(x.label));
  return p ? { prefix: p.label, name: t.slice(p.label.length).trim() } : { prefix: '', name: t };
}
const SAMPLE = 'นางสมศรี คำมา อายุหกสิบแปด บ้านเลขที่สิบสอง หมู่สี่ บ้านป่าไผ่ เบอร์ศูนย์แปดเก้า หนึ่งสองสาม สี่ห้าหกเจ็ด เป็นเบาหวาน แพ้ยาเพนนิซิลลิน หนักห้าสิบห้า สูงร้อยห้าสิบ';

/** ช่องกรอก: ป้ายด้านบน + ช่องแคปซูลพื้นมิ้นต์ (โฟกัส = พื้นขาว ขอบเขียว) */
function Field({ label, value, onChange, placeholder, keyboard, flex, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboard?: KeyboardTypeOptions; flex?: number; multiline?: boolean }) {
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
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMulti, focus && styles.inputFocus]}
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
  const { addPatient } = useApp();
  const h = useHaptic();
  const rec = useVoiceRecorder();
  const [f, setF] = useState<Form>(EMPTY);
  const [aiBusy, setAiBusy] = useState<'' | 'voice' | 'card'>('');
  const [aiNote, setAiNote] = useState('');
  const set = (k: keyof Form) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const canSave = f.name.trim().length > 1;
  // วันเกิดครบ → คำนวณอายุและธาตุเจ้าเรือนให้อัตโนมัติ (แก้เองได้)
  const birthISO = toISO(f.bDay, f.bMonth, f.bYear);
  useEffect(() => {
    if (!birthISO) return;
    setF((x) => ({ ...x, age: String(ageFrom(birthISO)), element: elementFromMonth(Number(x.bMonth)) }));
  }, [birthISO]);

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
    setAiBusy('voice');
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
{"name":"ชื่อ-สกุล พร้อมคำนำหน้า","sex":"ชาย|หญิง","age":"","bDay":"วันเกิด 1-31","bMonth":"เดือนเกิด 1-12","bYear":"ปีเกิด พ.ศ. 4 หลัก","address":"ที่อยู่เต็มตามที่พูด รวมเลขที่ หมู่ ซอย ถนน หมู่บ้าน ตำบล อำเภอ จังหวัด","phone":"รูปแบบ 0XX-XXX-XXXX","chronic":"โรคประจำตัว","allergies":"การแพ้ยา/อาหาร","weight":"","height":""}`,
        },
      ]);
      setF((x) => {
        const next = { ...x };
        (Object.keys(r) as (keyof Form)[]).forEach((k) => {
          const v = String(r[k] ?? '').trim();
          if (!v) return;
          if (k === 'name') {
            const sp = splitPrefix(v);
            next.name = sp.name;
            if (sp.prefix) {
              next.prefix = sp.prefix;
              next.sex = PREFIXES.find((x) => x.label === sp.prefix)!.sex;
            }
          } else (next as any)[k] = k === 'sex' ? (v.includes('ชาย') ? 'ชาย' : 'หญิง') : v;
        });
        // ใช้ข้อความที่อยู่เต็มตามที่พูด (มีซอย/ถนนได้) — ถ้าไม่มีค่อยประกอบจากส่วนย่อย
        if (!String(r.address ?? '').trim()) {
          const addr = formatAddress(next);
          if (addr) next.address = addr;
        }
        return next;
      });
      setAiNote('');
      h.success();
    } catch {
      setAiNote('เชื่อมต่อ AI ไม่ได้ กรุณากรอกเอง');
      h.warn();
    } finally {
      setAiBusy('');
    }
  };

  /** ใส่ข้อมูลที่อ่านจากบัตร (หน้ากล้องอ่านให้แล้ว) ลงฟอร์ม */
  const applyCard = (r: IdCardData) => {
    setF((x) => {
      const next = { ...x };
      (['bDay', 'bMonth', 'bYear', 'houseNo', 'moo', 'village', 'subdistrict', 'district', 'province'] as (keyof Form)[]).forEach((k) => {
        const v = String((r as any)[k] ?? '').trim();
        if (v) (next as any)[k] = v;
      });
      if (r.sex) next.sex = String(r.sex).includes('ชาย') ? 'ชาย' : 'หญิง';
      // ที่อยู่เต็มตามบัตร (รวมซอย ถนน) ไม่แยกช่อง
      const addr = String(r.address ?? '').trim() || formatAddress(next);
      if (addr) next.address = addr;
      if (r.name) {
        const sp = splitPrefix(r.name);
        next.name = sp.name;
        if (sp.prefix) {
          next.prefix = sp.prefix;
          next.sex = PREFIXES.find((x) => x.label === sp.prefix)!.sex;
        }
      }
      return next;
    });
    setAiNote('');
    h.success();
  };

  /** สแกนบัตรประชาชน → เปิดกล้องพร้อมกรอบบัตรทันที */
  const scanIdCard = () => router.push('/id-scan');
  // กลับมาจากหน้ากล้อง → ใส่ข้อมูลที่อ่านได้
  useFocusEffect(
    useCallback(() => {
      const r = takeIdScanResult();
      if (r) applyCard(r);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const save = () => {
    if (!canSave) return;
    const num = (s: string) => Number(s.replace(/[^0-9.]/g, '')) || 0;
    const id = addPatient({
      name: [f.prefix, f.name.trim()].filter(Boolean).join(' '),
      sex: f.sex,
      age: num(f.age),
      birthDate: birthISO ?? undefined,
      address: { ...parseAddress(f.address), full: f.address.trim() },
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
      {/* เครื่องมือบนหัวจอ (แบบหน้าผู้ป่วย): พูดให้ AI กรอก · สแกนบัตรประชาชน */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label={recording ? 'หยุดฟัง' : 'พูดให้ AI กรอก'} onPress={aiBusy ? undefined : fillByVoice}>
                {aiBusy === 'voice' ? <ActivityIndicator color={palette.primary} /> : <Sym name={recording ? 'stop.fill' : 'mic.fill'} size={20} color={recording ? palette.coral : palette.primary} weight="semibold" />}
              </HeaderButton>
              <HeaderButton label="สแกนบัตรประชาชน" onPress={aiBusy || recording ? undefined : scanIdCard}>
                {aiBusy === 'card' ? <ActivityIndicator color={palette.primary} /> : <Sym name="person.text.rectangle" size={20} color={palette.primary} weight="semibold" />}
              </HeaderButton>
            </View>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* สถานะ AI (แสดงเมื่อกำลังฟัง/ประมวลผล/มีผล) — ปุ่มพูดและสแกนบัตรอยู่ในแถบเครื่องมือด้านล่าง */}
        {recording || aiBusy ? (
          <Animated.View entering={FadeIn} style={[styles.status, recording && styles.statusOn, elevation.e1]}>
            {recording ? <Sym name="waveform" size={20} color={palette.white} /> : <ActivityIndicator color={palette.primary} />}
            <View style={{ flex: 1, gap: 2 }}>
              <T v="title" color={recording ? palette.white : palette.ink}>
                {recording ? 'กำลังฟัง… แตะปุ่มหยุดมุมขวาบนเมื่อพูดจบ' : aiBusy === 'card' ? 'กำลังอ่านบัตรประชาชน…' : 'ครูปัญญากำลังกรอกให้…'}
              </T>
              {recording ? <Waveform level={rec.level} bars={22} /> : null}
            </View>
          </Animated.View>
        ) : aiNote ? (
          <Animated.View entering={FadeIn} style={styles.note}>
            <Sym name="sparkles" size={14} color={palette.primary} />
            <T v="caption" color={palette.primary} style={{ flex: 1 }}>{aiNote}</T>
          </Animated.View>
        ) : null}

        <Section title="ข้อมูลผู้ป่วย" icon="person.fill">
          {/* คำนำหน้า (dropdown → กำหนดเพศอัตโนมัติ) + ชื่อ-สกุล */}
          <View style={styles.row2}>
            <Dropdown label="คำนำหน้า" value={f.prefix} options={PREFIXES.map((p) => p.label)} onChange={(v) => setF((x) => ({ ...x, prefix: v, sex: PREFIXES.find((p) => p.label === v)!.sex }))} flex={1.1} />
            <Field label="ชื่อ-สกุล" value={f.name} onChange={set('name')} placeholder="เช่น บุญมา ศรีคำ" flex={2.3} />
          </View>

          {/* วันเดือนปีเกิด (ปฏิทิน) + อายุต่อท้าย */}
          <View>
            <View style={styles.row2}>
              <DateField
                label="วันเดือนปีเกิด"
                value={birthISO ? new Date(birthISO + 'T00:00:00') : null}
                onChange={(d) => setF((x) => ({ ...x, bDay: String(d.getDate()), bMonth: String(d.getMonth() + 1), bYear: String(d.getFullYear() + 543) }))}
                flex={2.3}
              />
              <Field label="อายุ (ปี)" value={f.age} onChange={set('age')} placeholder="0" keyboard="number-pad" flex={1.1} />
            </View>
          </View>

          <Field label="โทรศัพท์" value={f.phone} onChange={set('phone')} placeholder="08X-XXX-XXXX" keyboard="phone-pad" />
        </Section>

        <Section title="ที่อยู่" icon="house.fill">
          <Field label="ที่อยู่" value={f.address} onChange={set('address')} placeholder="เช่น 12 หมู่ 4 บ้านป่าไผ่ ต.ดอนแก้ว อ.แม่ริม จ.เชียงใหม่" multiline />
        </Section>

        <Section title="สุขภาพ" icon="heart.fill" footer="ใช้ตรวจความปลอดภัยของสมุนไพรกับผู้ป่วย">
          <Field label="โรคประจำตัว" value={f.chronic} onChange={set('chronic')} placeholder="ไม่มี" />
          <Field label="แพ้ยา / อาหาร" value={f.allergies} onChange={set('allergies')} placeholder="ไม่มี" />
          <View style={styles.row2}>
            <Field label="น้ำหนัก (กก.)" value={f.weight} onChange={set('weight')} placeholder="0" keyboard="decimal-pad" flex={1} />
            <Field label="ส่วนสูง (ซม.)" value={f.height} onChange={set('height')} placeholder="0" keyboard="decimal-pad" flex={1} />
          </View>
          <Choice label={birthISO ? 'ธาตุเจ้าเรือน (คำนวณจากเดือนเกิด แก้ได้)' : 'ธาตุเจ้าเรือน'} options={ELEMENTS} value={f.element} onChange={(v) => setF((x) => ({ ...x, element: v }))} />
        </Section>
      </ScrollView>

      {/* ปุ่มบันทึกแบบแถบลอย (GlassDock) */}
      {/* ปุ่มบันทึกแบบแถบลอย */}
      <GlassDock>
        <Button label="บันทึกผู้ป่วย" disabled={!canSave} onPress={save} style={{ flex: 1, height: 52 }} />
      </GlassDock>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 130, gap: 14 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 16 },
  statusOn: { backgroundColor: palette.primary },
  birthNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginLeft: 4 },
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  label: { marginBottom: 6, marginLeft: 4, fontWeight: '600' },
  input: { height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, fontSize: 17, color: palette.ink, borderWidth: 1.5, borderColor: 'transparent' },
  inputMulti: { height: undefined, minHeight: 76, borderRadius: 22, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' },
  inputFocus: { backgroundColor: palette.surface, borderColor: palette.primary },
  row2: { flexDirection: 'row', gap: 10 },
  choices: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, height: 48, borderRadius: 24, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  choiceOn: { backgroundColor: palette.primary },
});

export default function NewPatient() {
  return (
    <PractitionerGate>
      <NewPatientInner />
    </PractitionerGate>
  );
}
