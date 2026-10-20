/**
 * เพิ่มผู้ป่วยใหม่ — หน้าเต็ม (push จากแท็บผู้ป่วย) ตาม DESIGN_SYSTEM.md
 * บนสุด: การ์ดพูดแนะนำผู้ป่วย (AI กรอกให้) → ฟอร์มแบ่งการ์ด ป้ายอยู่เหนือช่องแคปซูล → ปุ่มบันทึกติดล่าง
 */
import { Stack, router, useFocusEffect } from 'expo-router';
import { Alert } from '../../lib/alert';
import { clearDraft, draftWhen, loadDraft, saveDraft } from '../../lib/drafts';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PractitionerGate } from '../../components/PractitionerGate';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type KeyboardTypeOptions } from 'react-native';
import { TextInput } from '../../components/AppText';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Sym, ios } from '../../components/ios';
import { Button, GlassDock, HeaderButton, PressableScale, T, useHaptic } from '../../components/ui';
import { takeIdScanResult, type IdCardData } from '../../lib/idScan';
import { onIntakeResult, takeIntakeResult, type IntakeData } from '../../lib/intake';
import { ageFrom, elementFromMonth, normalizeBirth, toISO } from '../../lib/birth';
import { DateField, Dropdown } from '../../components/FormPickers';
import { ElementInsight, ElementPicker } from '../../components/ElementPicker';
import { formatAddress, parseAddress } from '../../lib/address';
import type { Patient } from '../../data/mock';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

/** แอนิเมชันเลย์เอาต์มาตรฐาน: ส่วนที่ขยาย/หด และส่วนข้างเคียงเลื่อนตามแบบสปริงนุ่ม */
const SMOOTH = LinearTransition.duration(280);

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

function Section({ title, icon, footer, children }: { title: string; icon: string; footer?: string; children: React.ReactNode }) {
  return (
    <Animated.View layout={SMOOTH} style={[styles.card, elevation.e1]}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Sym name={icon as any} size={15} color={palette.primary} />
        </View>
        <T v="title">{title}</T>
      </View>
      <Animated.View layout={SMOOTH} style={{ gap: 14 }}>{children}</Animated.View>
      {footer ? <T v="caption" color={ios.secondary} style={{ marginTop: 12 }}>{footer}</T> : null}
    </Animated.View>
  );
}

function NewPatientInner() {
  const { addPatient } = useApp();
  const h = useHaptic();
  const [f, setF] = useState<Form>(EMPTY);
  const aiBusy = '' as '' | 'voice' | 'card';
  const [aiNote, setAiNote] = useState('');
  // เลือกธาตุแล้วหรือยัง (จากวันเกิดอัตโนมัติ หรือหมอเลือกเอง)
  const [elPicked, setElPicked] = useState(false);
  const set = (k: keyof Form) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  // ── ดราฟต์: กรอกไว้แล้วกดกลับ/ปิดแอป → เก็บไว้ในเครื่อง เปิดหน้าเพิ่มผู้ป่วยอีกครั้งกรอกต่อได้ ──
  const [restored, setRestored] = useState<number | null>(null);
  const loaded = useRef(false);
  const done = useRef(false);
  useEffect(() => {
    loadDraft<{ f: Form; elPicked: boolean }>('patient.new').then((r) => {
      if (r && !done.current) {
        setF({ ...EMPTY, ...r.data.f });
        setElPicked(!!r.data.elPicked);
        setRestored(r.at);
      }
      loaded.current = true;
    });
  }, []);
  useEffect(() => {
    if (!loaded.current || done.current) return;
    const filled = (Object.keys(f) as (keyof Form)[]).some((k) => f[k] !== EMPTY[k]);
    if (filled) saveDraft('patient.new', { f, elPicked });
    else clearDraft('patient.new');
  }, [f, elPicked]);
  const startOver = () => {
    clearDraft('patient.new');
    setF(EMPTY);
    setElPicked(false);
    setRestored(null);
  };
  // ค่าฟอร์มล่าสุด (ให้ callback ที่ลงทะเบียนไว้ก่อนอ่านค่าปัจจุบันได้)
  const fRef = useRef(f);
  fRef.current = f;
  const canSave = f.name.trim().length > 1;
  // วันเกิดครบ → คำนวณอายุและธาตุเจ้าเรือนให้อัตโนมัติ (แก้เองได้)
  const birthISO = toISO(f.bDay, f.bMonth, f.bYear);
  useEffect(() => {
    if (!birthISO) return;
    setF((x) => ({ ...x, age: String(ageFrom(birthISO)), element: elementFromMonth(Number(x.bMonth)) }));
    setElPicked(true);
  }, [birthISO]);

  /** ใส่ข้อมูลจากครูปัญญาซักประวัติ (โหมดเสียง) ลงฟอร์ม */
  const applyIntake = (d: IntakeData & { save?: boolean }) => {
    const next = { ...fRef.current };
    (['age', 'phone', 'address', 'chronic', 'allergies', 'weight', 'height'] as const).forEach((k) => {
      const v = String(d[k] ?? '').trim();
      if (v) (next as any)[k] = v;
    });
    // วันเกิด: แปลงชื่อเดือน/ปี ค.ศ./วันที่ทั้งก้อน → วัน/เดือนเลข/ปี พ.ศ.
    const b = normalizeBirth(d);
    if (b.bDay && b.bMonth && b.bYear) Object.assign(next, b);
    else if (b.bYear && !next.age) next.age = String(new Date().getFullYear() + 543 - Number(b.bYear));
    if (d.name) {
      const sp = splitPrefix([d.prefix, d.name].filter(Boolean).join(' '));
      next.name = sp.name;
      if (sp.prefix) {
        next.prefix = sp.prefix;
        next.sex = PREFIXES.find((p) => p.label === sp.prefix)!.sex;
      }
    }
    // วันเกิดครบ → อายุ + ธาตุเจ้าเรือน
    const iso = toISO(next.bDay, next.bMonth, next.bYear);
    if (iso) {
      next.age = String(ageFrom(iso));
      next.element = elementFromMonth(Number(next.bMonth));
      setElPicked(true);
    }
    setF(next);
    h.success();
    // ตอบ "ใช้" ในโหมดเสียง → บันทึกผู้ป่วยเลย
    if (d.save && next.name.trim().length > 1) setTimeout(() => saveForm(next), 350);
  };

  /** ใส่ข้อมูลที่อ่านจากบัตร (หน้ากล้องอ่านให้แล้ว) ลงฟอร์ม */
  const applyCard = (r: IdCardData) => {
    setF((x) => {
      const next = { ...x };
      const b = normalizeBirth(r);
      if (b.bDay && b.bMonth && b.bYear) Object.assign(next, b);
      (['houseNo', 'moo', 'village', 'subdistrict', 'district', 'province'] as (keyof Form)[]).forEach((k) => {
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

  // เลิกรับผลซักประวัติเมื่อออกจากหน้า
  useEffect(() => () => onIntakeResult(null), []);

  /** สแกนบัตรประชาชน → เปิดกล้องพร้อมกรอบบัตรทันที */
  const scanIdCard = () => router.push('/id-scan');
  // กลับมาจากหน้ากล้อง → ใส่ข้อมูลที่อ่านได้
  useFocusEffect(
    useCallback(() => {
      const r = takeIdScanResult();
      if (r) applyCard(r);
      const it = takeIntakeResult();
      if (it) applyIntake(it);
      onIntakeResult(applyIntake);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const savedRef = useRef(false); // กันกดบันทึกซ้ำ / AI สั่งบันทึกพร้อมกดเอง → ผู้ป่วยซ้ำ
  const saveForm = (f: Form) => {
    if (f.name.trim().length <= 1 || savedRef.current) return;
    savedRef.current = true;
    const num = (s: string) => Number(s.replace(/[^0-9.]/g, '')) || 0;
    const iso = toISO(f.bDay, f.bMonth, f.bYear);
    const id = addPatient({
      name: [f.prefix, f.name.trim()].filter(Boolean).join(' '),
      sex: f.sex,
      age: num(f.age),
      birthDate: iso ?? undefined,
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
    done.current = true;
    clearDraft('patient.new');
    h.success();
    router.replace(`/patient/${id}`);
    // ผู้ป่วยใหม่ → ชวนให้ลงชื่อใบยินยอมเก็บข้อมูล (PDPA) ตอนนี้
    setTimeout(
      () =>
        Alert.alert('ใบยินยอมเก็บข้อมูล', 'ให้ผู้ป่วยลงชื่อยินยอมให้เก็บข้อมูลการรักษาตอนนี้ไหม (ทำภายหลังได้ที่หน้าผู้ป่วย)', [
          { text: 'ภายหลัง', style: 'cancel' },
          { text: 'ลงชื่อเลย', onPress: () => router.push({ pathname: '/patient/consent', params: { pid: id } }) },
        ]),
      600,
    );
  };
  const save = () => canSave && saveForm(f);

  const recording = false;

  return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* เครื่องมือบนหัวจอ (แบบหน้าผู้ป่วย): พูดให้ AI กรอก · สแกนบัตรประชาชน */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label="ครูปัญญาซักประวัติด้วยเสียง" onPress={aiBusy ? undefined : () => router.push('/patient/voice')}>
                {aiBusy === 'voice' ? <ActivityIndicator color={palette.ink} /> : <Sym name={recording ? 'stop.fill' : 'mic.fill'} size={20} color={recording ? palette.coral : palette.ink} weight="semibold" />}
              </HeaderButton>
              <HeaderButton label="สแกนบัตรประชาชน" onPress={aiBusy || recording ? undefined : scanIdCard}>
                {aiBusy === 'card' ? <ActivityIndicator color={palette.ink} /> : <Sym name="person.text.rectangle" size={20} color={palette.ink} weight="semibold" />}
              </HeaderButton>
            </View>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {restored ? (
          <Animated.View entering={FadeIn} style={styles.draft}>
            <Sym name="doc.badge.clock" size={18} color={palette.primaryDeep} />
            <T v="subhead" color={palette.primaryDeep} style={{ flex: 1 }}>กรอกต่อจากร่างที่เก็บไว้ {draftWhen(restored)}</T>
            <PressableScale haptic="select" onPress={startOver} hitSlop={8} accessibilityLabel="ล้างร่างและเริ่มใหม่">
              <T v="subhead" color={palette.primary} style={{ fontWeight: '700' }}>เริ่มใหม่</T>
            </PressableScale>
          </Animated.View>
        ) : null}
        {/* สถานะ AI (แสดงเมื่อกำลังฟัง/ประมวลผล/มีผล) — ปุ่มพูดและสแกนบัตรอยู่ในแถบเครื่องมือด้านล่าง */}
        {recording || aiBusy ? (
          <Animated.View entering={FadeInDown.duration(420)} exiting={FadeOut.duration(180)} layout={SMOOTH} style={[styles.status, recording && styles.statusOn, elevation.e1]}>
            {recording ? <Sym name="waveform" size={20} color={palette.white} /> : <ActivityIndicator color={palette.primary} />}
            <View style={{ flex: 1, gap: 2 }}>
              <T v="title" color={recording ? palette.white : palette.ink}>
                {recording ? 'กำลังฟัง… แตะปุ่มหยุดมุมขวาบนเมื่อพูดจบ' : aiBusy === 'card' ? 'กำลังอ่านบัตรประชาชน…' : 'ครูปัญญากำลังกรอกให้…'}
              </T>
            </View>
          </Animated.View>
        ) : aiNote ? (
          <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} layout={SMOOTH} style={styles.note}>
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
          <Field label="ที่อยู่" value={f.address} onChange={set('address')} placeholder="เช่น 12 หมู่ 4 บ้านป่าไผ่ ต.ดอนแก้ว อ.แม่ริม จ.เชียงใหม่" multiline />
        </Section>

        {/* ธาตุเจ้าเรือน: มีวันเกิด → ครูปัญญาวิเคราะห์ให้อัตโนมัติ · ไม่มี → เลือกเอง */}
        <Section title="ธาตุเจ้าเรือน" icon="sparkles">
          <View style={styles.elHint}>
            {birthISO ? (
              <>
                <Sym name="sparkles" size={13} color={palette.primary} />
                <T v="subhead" color={palette.primaryDeep} style={{ flex: 1 }}>ครูปัญญาวิเคราะห์จากวันเกิด: ธาตุ{f.element}</T>
              </>
            ) : (
              <T v="subhead" color={ios.secondary} style={{ flex: 1 }}>ยังไม่ระบุวันเกิด เลือกธาตุเจ้าเรือนของผู้ป่วย</T>
            )}
          </View>
          <ElementPicker
            value={elPicked ? f.element : null}
            onChange={(el) => {
              setF((x) => ({ ...x, element: el }));
              setElPicked(true);
            }}
          />
          {elPicked ? <ElementInsight el={f.element} age={birthISO ? ageFrom(birthISO) : Number(f.age) || undefined} /> : null}
        </Section>

        <Section title="สุขภาพ" icon="heart.fill" footer="ใช้ตรวจความปลอดภัยของสมุนไพรกับผู้ป่วย">
          <Field label="โรคประจำตัว" value={f.chronic} onChange={set('chronic')} placeholder="ไม่มี" />
          <Field label="แพ้ยา / อาหาร" value={f.allergies} onChange={set('allergies')} placeholder="ไม่มี" />
          <View style={styles.row2}>
            <Field label="น้ำหนัก (กก.)" value={f.weight} onChange={set('weight')} placeholder="0" keyboard="decimal-pad" flex={1} />
            <Field label="ส่วนสูง (ซม.)" value={f.height} onChange={set('height')} placeholder="0" keyboard="decimal-pad" flex={1} />
          </View>
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
  draft: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, backgroundColor: palette.primarySoft },
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 130, gap: 14 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 16 },
  statusOn: { backgroundColor: palette.primary },
  elHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
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
