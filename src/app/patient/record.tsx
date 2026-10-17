/**
 * บันทึกการรักษาแบบกรอกเอง (ทะเบียนการรักษา ม.บ.5) — ทางเลือกนอกจากให้ครูปัญญาบันทึกด้วยเสียง
 * ช่องเรียงตามแบบ ม.บ.5: วันที่ · อาการ · ตรวจร่างกาย · วินิจฉัย · การรักษา · ผลการรักษา · การติดตามผล · หมายเหตุ
 * พิมพ์ชื่อสมุนไพรในช่องการรักษา → เตือนข้อควรระวังของสมุนไพรนั้นทันที (เทียบกับโรคประจำตัว/ยาที่ใช้)
 */
import { usePreventRemove } from '@react-navigation/native';
import { Stack, router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { DateField } from '../../components/FormPickers';
import { NotFound } from '../../components/NotFound';
import { PractitionerGate } from '../../components/PractitionerGate';
import { Sym, ios } from '../../components/ios';
import { Button, GlassDock, PressableScale, T, useHaptic } from '../../components/ui';
import type { Patient } from '../../data/mock';
import { herbsMentioned } from '../../lib/brain';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

const RESULTS = ['หาย', 'ดีขึ้น', 'ทุเลา', 'ทรงตัว', 'แย่ลง', 'ส่งต่อ', 'รอติดตามผล'] as const;
const STATUS: { k: Patient['status']; label: string }[] = [
  { k: 'ติดตามอาการ', label: 'ติดตามอาการ' },
  { k: 'หายดี', label: 'หายดี' },
  { k: 'ส่งต่อ รพ.สต.', label: 'ส่งต่อ รพ.สต.' },
];
const SMOOTH = LinearTransition.duration(220);

/** วันที่ → วว/ดด/ปปปป (พ.ศ.) ตามทะเบียน ม.บ.5 */
const toBE = (t: Date) => `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear() + 543}`;

function Field({ label, value, onChange, placeholder, multiline, inputRef, onNext }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; inputRef?: React.Ref<TextInput>; onNext?: () => void }) {
  const [focus, setFocus] = useState(false);
  return (
    <View>
      <T v="subhead" color={ios.secondary} style={styles.label}>{label}</T>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={ios.tertiary}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        multiline={multiline}
        returnKeyType={onNext ? 'next' : 'done'}
        submitBehavior={multiline ? 'newline' : onNext ? 'submit' : 'blurAndSubmit'}
        onSubmitEditing={onNext}
        style={[styles.input, multiline && styles.inputMulti, focus && styles.inputFocus]}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <Animated.View layout={SMOOTH} style={[styles.card, elevation.e1]}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Sym name={icon as any} size={15} color={palette.primary} />
        </View>
        <T v="title">{title}</T>
      </View>
      <Animated.View layout={SMOOTH} style={{ gap: 14 }}>{children}</Animated.View>
    </Animated.View>
  );
}

function RecordInner() {
  const { pid } = useLocalSearchParams<{ pid: string }>();
  const { patients, addVisit, updatePatient } = useApp();
  const p = patients.find((x) => x.id === pid);
  const h = useHaptic();
  const [date, setDate] = useState<Date>(() => new Date());
  const [symptoms, setSymptoms] = useState('');
  const [duration, setDuration] = useState('');
  const [exam, setExam] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [result, setResult] = useState<(typeof RESULTS)[number]>('รอติดตามผล');
  const [followUp, setFollowUp] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<Patient['status'] | null>(null);
  const saved = useRef(false);
  const durRef = useRef<TextInput>(null);
  const diagRef = useRef<TextInput>(null);

  // สมุนไพรที่พิมพ์ในช่องการรักษา → ข้อควรระวัง
  const herbsUsed = useMemo(() => herbsMentioned(treatment), [treatment]);
  const navigation = useNavigation();

  const canSave = !!(symptoms.trim() || diagnosis.trim() || treatment.trim());
  const dirty = !!(canSave || exam.trim() || followUp.trim() || note.trim());
  // กรอกไว้แล้วกดย้อนกลับ/ปัดกลับ → ถามก่อน (กันข้อมูลหายโดยไม่ตั้งใจ)
  usePreventRemove(dirty, ({ data }) => {
    // บันทึกแล้ว → ออกได้เลย
    if (saved.current) return navigation.dispatch(data.action);
    Alert.alert('ยังไม่ได้บันทึก', 'ข้อมูลที่กรอกไว้จะหายไป', [
      { text: 'กรอกต่อ', style: 'cancel' },
      { text: 'ทิ้ง', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  if (!p) return <NotFound title="ไม่พบผู้ป่วย" />;
  const no = (p.visits[0]?.no ?? 0) + 1;

  const save = () => {
    if (!canSave || saved.current) return;
    saved.current = true;
    addVisit(p.id, {
      date: toBE(date),
      symptoms: [symptoms.trim(), duration.trim() ? `เป็นมา ${duration.trim()}` : ''].filter(Boolean).join(' · ') || '-',
      exam: exam.trim() || '-',
      diagnosis: diagnosis.trim() || '-',
      treatment: treatment.trim() || '-',
      result,
      followUp: followUp.trim() || '-',
      note: note.trim() || undefined,
    });
    // ผลการรักษา "ส่งต่อ" / "หาย" → ปรับสถานะผู้ป่วยให้ตรง (เลือกเองได้)
    const st = status ?? (result === 'ส่งต่อ' ? 'ส่งต่อ รพ.สต.' : result === 'หาย' ? 'หายดี' : null);
    if (st && st !== p.status) updatePatient(p.id, { status: st });
    h.success();
    router.back();
  };


  return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* หน้าแบบเดียวกับเพิ่มผู้ป่วย: ปุ่มย้อนกลับมุมซ้าย · ปุ่มบันทึกลอยด้านล่าง */}
      <Stack.Screen options={{ title: `บันทึกการรักษาครั้งที่ ${no}` }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Section title="อาการ" icon="stethoscope">
          {/* ปฏิทินแบบเดียวกับวันเกิดในหน้าเพิ่มผู้ป่วย (ปี พ.ศ.) */}
          <DateField label="วันที่รักษา" value={date} onChange={setDate} />
          <Field label="อาการเจ็บป่วย" value={symptoms} onChange={setSymptoms} placeholder="เช่น ปวดเข่าสองข้าง ขึ้นลงบันไดลำบาก" multiline />
          <Field inputRef={durRef} label="เป็นมานานเท่าไร" value={duration} onChange={setDuration} placeholder="เช่น 3 วัน, 2 เดือน" onNext={() => diagRef.current?.focus()} />
        </Section>

        <Section title="ตรวจและวินิจฉัย" icon="hand.raised.fill">
          <Field label="ตรวจร่างกาย" value={exam} onChange={setExam} placeholder="เช่น เข่าบวม กดเจ็บ ชีพจร" multiline />
          <Field inputRef={diagRef} label="วินิจฉัยโรค" value={diagnosis} onChange={setDiagnosis} placeholder="เช่น ลมจับโปง (ข้อเข่าเสื่อม)" />
        </Section>

        <Section title="การรักษา" icon="leaf.fill">
          <Field label="การรักษา / ยาที่ให้" value={treatment} onChange={setTreatment} placeholder="เช่น นวด ประคบสมุนไพร ยาประสะไพล ครั้งละ 1 กรัม" multiline />
          {herbsUsed.length ? (
            <Animated.View entering={FadeIn.duration(200)} layout={SMOOTH} style={styles.herbWarn}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sym name="sparkles" size={13} color={palette.primary} />
                <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '700' }}>ครูปัญญา: ข้อควรระวังของสมุนไพรที่ใช้</T>
              </View>
              {herbsUsed.slice(0, 4).map((x) => (
                <T key={x.id} v="caption" color={palette.inkSoft}>• {x.name}: {x.caution}</T>
              ))}
            </Animated.View>
          ) : null}
          <View>
            <T v="subhead" color={ios.secondary} style={styles.label}>ผลการรักษา</T>
            <View style={styles.chips}>
              {RESULTS.map((r) => {
                const on = result === r;
                return (
                  <PressableScale key={r} haptic="select" scaleTo={0.95} onPress={() => setResult(r)} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: on }} accessibilityLabel={`ผลการรักษา ${r}`}>
                    <T v="subhead" color={on ? '#FFFFFF' : palette.ink} style={{ fontWeight: '600' }}>{r}</T>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        </Section>

        <Section title="ติดตามผล" icon="calendar">
          <Field label="การติดตามผล" value={followUp} onChange={setFollowUp} placeholder="เช่น นัด 1 สัปดาห์ งดของแสลง" multiline />
          <Field label="หมายเหตุ / ข้อห้าม" value={note} onChange={setNote} placeholder="ของแสลง ข้อห้าม หรือเรื่องที่ต้องจำ" multiline />
          <View>
            <T v="subhead" color={ios.secondary} style={styles.label}>สถานะผู้ป่วย</T>
            <View style={styles.chips}>
              {STATUS.map((s) => {
                const on = (status ?? p.status) === s.k;
                return (
                  <PressableScale key={s.k} haptic="select" scaleTo={0.95} onPress={() => setStatus(s.k)} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: on }} accessibilityLabel={`สถานะ ${s.label}`}>
                    <T v="subhead" color={on ? '#FFFFFF' : palette.ink} style={{ fontWeight: '600' }}>{s.label}</T>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        </Section>
      </ScrollView>

      <GlassDock>
        <Button label="บันทึกการรักษา" icon={<Sym name="checkmark" size={17} color="#FFFFFF" weight="bold" />} disabled={!canSave} onPress={save} style={{ flex: 1, height: 52 }} />
      </GlassDock>
    </KeyboardAvoidingView>
  );
}

export default function RecordVisit() {
  return (
    <PractitionerGate>
      <RecordInner />
    </PractitionerGate>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 130, gap: 14 },
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  label: { marginBottom: 6, marginLeft: 4, fontWeight: '600' },
  input: { height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, fontSize: 17, color: palette.ink, borderWidth: 1.5, borderColor: 'transparent' },
  inputMulti: { height: undefined, minHeight: 76, borderRadius: 22, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' },
  inputFocus: { backgroundColor: palette.surface, borderColor: palette.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: palette.primary },
  herbWarn: { gap: 4, padding: 12, borderRadius: 16, backgroundColor: palette.primarySoft },
});
