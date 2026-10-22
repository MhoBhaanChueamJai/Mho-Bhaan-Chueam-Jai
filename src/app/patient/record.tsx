/**
 * บันทึกการรักษาแบบกรอกเอง (ทะเบียนการรักษา ม.บ.5) — ทางเลือกนอกจากให้ครูปัญญาบันทึกด้วยเสียง
 * ช่องเรียงตามแบบ ม.บ.5: วันที่ · อาการ · ตรวจร่างกาย · วินิจฉัย · การรักษา · ผลการรักษา · การติดตามผล · หมายเหตุ
 * พิมพ์ชื่อสมุนไพรในช่องการรักษา → เตือนข้อควรระวังของสมุนไพรนั้นทันที (เทียบกับโรคประจำตัว/ยาที่ใช้)
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { TextInput } from '../../components/AppText';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Switch } from '../../components/AppSwitch';
import { DateField, Dropdown } from '../../components/FormPickers';
import { NotFound } from '../../components/NotFound';
import { Sym, ios } from '../../components/ios';
import { Button, GlassDock, PressableScale, T, useHaptic } from '../../components/ui';
import { FACILITIES } from '../../data/facilities';
import type { Patient } from '../../data/mock';
import { thDate } from '../../lib/referral';
import { cancelReminder, isoIn, remindCheckIn, remindFollowUp, thShort } from '../../lib/reminders';
import { stockState, useStock } from '../../lib/stock';
import { LEVEL, SRC, assess, vitalsText, type Vitals } from '../../lib/vitals';
import { clearDraft, draftWhen, loadDraft, saveDraft } from '../../lib/drafts';
import { herbsMentioned } from '../../lib/brain';
import { planToTreatment } from '../../lib/plan';
import { PlanCard } from '../../components/PlanCard';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';
import { column } from '../../components/layout';

const FU = [
  { d: 0, label: 'ไม่นัด' },
  { d: 3, label: '3 วัน' },
  { d: 7, label: '1 สัปดาห์' },
  { d: 14, label: '2 สัปดาห์' },
  { d: 30, label: '1 เดือน' },
];
const STATUS: { k: Patient['status']; label: string }[] = [
  { k: 'ติดตามอาการ', label: 'ติดตามอาการ' },
  { k: 'หายดี', label: 'หายดี' },
  { k: 'ส่งต่อ รพ.สต.', label: 'ส่งต่อ รพ.สต.' },
];
const SMOOTH = LinearTransition.duration(220);

/** วันที่ → วว/ดด/ปปปป (พ.ศ.) ตามทะเบียน ม.บ.5 */
const toBE = (t: Date) => `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear() + 543}`;

function Field({ label, value, onChange, placeholder, multiline, inputRef, onNext, keyboard, flex }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; inputRef?: React.Ref<TextInput>; onNext?: () => void; keyboard?: 'number-pad' | 'decimal-pad' | 'numbers-and-punctuation'; flex?: number }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={flex ? { flex } : undefined}>
      <T v="subhead" color={ios.secondary} style={styles.label}>{label}</T>
      <TextInput
        ref={inputRef}
        keyboardType={keyboard}
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
  // ค่าสุขภาพ (ถ้าวัด) — ประเมินตามแนวทางเวชปฏิบัติทันทีที่กรอก
  const [vt, setVt] = useState<Record<keyof Vitals, string>>({ sys: '', dia: '', pulse: '', sugar: '', weight: '' });
  const [bpRaw, setBpRaw] = useState('');
  const vitals: Vitals = Object.fromEntries(Object.entries(vt).map(([k, v]) => [k, Number(v) || undefined])) as Vitals;
  const checks = assess(vitals);
  // ความดันช่องเดียว "120/80": พิมพ์ตัวเลขติดกันบนแป้นตัวเลขได้เลย
  const onBp = (x: string) => {
    // แป้นตัวเลขไม่มี "/" → ใส่ให้เอง: ตัวบนขึ้นต้นด้วย 1–2 = 3 หลัก (เช่น 120/80) · อื่นๆ = 2 หลัก (เช่น 90/60)
    const digits = x.replace(/\D/g, '');
    const n = /^[12]/.test(digits) ? 3 : 2;
    let t = digits.length > n ? `${digits.slice(0, n)}/${digits.slice(n, n + 3)}` : digits;
    // ลบถอยหลังจนเหลือ "120/" → ตัด / ทิ้งด้วย ไม่ให้ค้าง
    if (x.endsWith('/') && x.length < bpRaw.length) t = digits;
    const [s1 = '', d1 = ''] = t.split('/');
    setBpRaw(t);
    setVt((o) => ({ ...o, sys: s1.slice(0, 3), dia: d1.replace(/\//g, '').slice(0, 3) }));
  };
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [result, setResult] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [note, setNote] = useState('');
  // สถานะหลังการรักษาครั้งนี้ (เลือกก่อน แล้วถามเฉพาะช่องที่ต้องใช้) — มารักษาใหม่ = เริ่มที่ติดตามอาการ
  const [status, setStatus] = useState<Patient['status']>('ติดตามอาการ');
  // ส่งต่อ: เลือกสถานะ "ส่งต่อ รพ.สต." → กรอกปลายทางในหน้านี้ แล้วบันทึกและส่งข้อมูลทีเดียว
  const [fid, setFid] = useState(FACILITIES[0].id);
  const [referReason, setReferReason] = useState('');
  const [urgent, setUrgent] = useState(false);
  // ยาในคลังของหมอ (ยังไม่หมดอายุและยังเหลือ) → แตะเพื่อใส่ในช่องการรักษา
  const [stock] = useStock();
  const ready = stock.filter((x) => !['expired', 'out'].includes(stockState(x).k));
  // นัดติดตามอาการ (วัน) — 0 = ไม่นัด · แจ้งเตือนเช้าวันนัด
  const [fuDays, setFuDays] = useState(7);
  const referring = status === 'ส่งต่อ รพ.สต.';
  const saved = useRef(false);
  const durRef = useRef<TextInput>(null);
  const diagRef = useRef<TextInput>(null);

  // สมุนไพรที่พิมพ์ในช่องการรักษา → ข้อควรระวัง
  const herbsUsed = useMemo(() => herbsMentioned(treatment), [treatment]);

  const canSave = !!(symptoms.trim() || diagnosis.trim() || treatment.trim());
  const dirty = !!(canSave || exam.trim() || result.trim() || followUp.trim() || note.trim() || Object.values(vt).some(Boolean) || !!bpRaw);
  // ── ดราฟต์: กรอกไว้แล้วกดกลับ/ปิดแอป → เก็บไว้ในเครื่อง เปิดหน้านี้ของผู้ป่วยคนเดิมอีกครั้งกรอกต่อได้ ──
  const dkey = `visit.${pid}`;
  const [restored, setRestored] = useState<number | null>(null);
  const loaded = useRef(false);
  const snap = { date: date.getTime(), symptoms, duration, exam, vt, bpRaw, diagnosis, treatment, result, followUp, note, status, fid, referReason, urgent, fuDays };
  type Snap = typeof snap;
  const apply = (d: Partial<Snap>) => {
    setDate(d.date ? new Date(d.date) : new Date());
    setSymptoms(d.symptoms ?? '');
    setDuration(d.duration ?? '');
    setExam(d.exam ?? '');
    setVt(d.vt ?? { sys: '', dia: '', pulse: '', sugar: '', weight: '' });
    setBpRaw(d.bpRaw ?? '');
    setDiagnosis(d.diagnosis ?? '');
    setTreatment(d.treatment ?? '');
    setResult(d.result ?? '');
    setFollowUp(d.followUp ?? '');
    setNote(d.note ?? '');
    setStatus(d.status ?? 'ติดตามอาการ');
    setFid(d.fid ?? FACILITIES[0].id);
    setReferReason(d.referReason ?? '');
    setUrgent(d.urgent ?? false);
    setFuDays(d.fuDays ?? 7);
  };
  useEffect(() => {
    loadDraft<Snap>(dkey).then((r) => {
      if (r && !saved.current) {
        apply(r.data);
        setRestored(r.at);
      }
      loaded.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dkey]);
  const snapKey = JSON.stringify(snap);
  useEffect(() => {
    if (!loaded.current || saved.current) return;
    if (dirty) saveDraft(dkey, snap);
    else clearDraft(dkey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapKey]);
  const startOver = () => {
    clearDraft(dkey);
    apply({});
    setRestored(null);
  };

  if (!p) return <NotFound title="ไม่พบผู้ป่วย" />;
  const no = (p.visits[0]?.no ?? 0) + 1;

  const fac = FACILITIES.find((f) => f.id === fid)!;
  const lastRef = (p.referrals ?? []).find((r) => r.to === fac.name);

  const save = () => {
    if (!canSave || saved.current) return;
    saved.current = true;
    clearDraft(dkey);
    addVisit(p.id, {
      date: toBE(date),
      symptoms: [symptoms.trim(), duration.trim() ? `เป็นมา ${duration.trim()}` : ''].filter(Boolean).join(' · ') || '-',
      exam: [vitalsText(vitals), exam.trim()].filter(Boolean).join(' · ') || '-',
      diagnosis: diagnosis.trim() || '-',
      treatment: treatment.trim() || '-',
      result: result.trim() || '-',
      followUp: status === 'ติดตามอาการ' ? [fuDays ? `นัดติดตาม ${thShort(isoIn(fuDays, date))}` : '', followUp.trim()].filter(Boolean).join(' · ') || '-' : status === 'หายดี' ? 'หายดี ไม่ต้องติดตาม' : `ส่งต่อ ${fac.name}`,
      note: note.trim() || undefined,
    });
    // นัดติดตาม + เตือนถามอาการหลังรักษา 3 วัน (เตือนในเครื่อง)
    const fuOn = status === 'ติดตามอาการ' && fuDays ? isoIn(fuDays, date) : undefined;
    updatePatient(p.id, { status, followUpOn: fuOn, ...(vitals.weight ? { weight: vitals.weight } : {}) });
    if (fuOn) remindFollowUp(p.id, p.name, fuOn, diagnosis.trim() || symptoms.trim()).catch(() => {});
    else cancelReminder(`fu-${p.id}`).catch(() => {});
    if (status !== 'หายดี') remindCheckIn(p.id, p.name).catch(() => {});
    else cancelReminder(`ci-${p.id}`).catch(() => {});
    h.success();
    if (!referring) return router.back();
    const reason = referReason.trim() || (diagnosis.trim() ? `อาการ${diagnosis.trim()}ไม่ดีขึ้นหลังการรักษาแบบแผนไทย ควรได้รับการตรวจวินิจฉัยเพิ่มเติม` : 'ควรได้รับการตรวจวินิจฉัยเพิ่มเติม');
    router.replace({ pathname: '/patient/referral', params: { pid: p.id, fid, reason, urgent: urgent ? '1' : '0', visitNo: String(no) } });
  };


  return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* หน้าแบบเดียวกับเพิ่มผู้ป่วย: ปุ่มย้อนกลับมุมซ้าย · ปุ่มบันทึกลอยด้านล่าง */}
      <Stack.Screen options={{ title: `บันทึกการรักษาครั้งที่ ${no}` }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.page, column.read]} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {restored ? (
          <Animated.View entering={FadeIn} style={styles.draft}>
            <Sym name="doc.badge.clock" size={18} color={palette.primaryDeep} />
            <T v="subhead" color={palette.primaryDeep} style={{ flex: 1 }}>กรอกต่อจากร่างที่เก็บไว้ {draftWhen(restored)}</T>
            <PressableScale haptic="select" onPress={startOver} hitSlop={8} accessibilityLabel="ล้างร่างและเริ่มใหม่">
              <T v="subhead" color={palette.primary} style={{ fontWeight: '700' }}>เริ่มใหม่</T>
            </PressableScale>
          </Animated.View>
        ) : null}
        <Section title="อาการ" icon="stethoscope">
          {/* ปฏิทินแบบเดียวกับวันเกิดในหน้าเพิ่มผู้ป่วย (ปี พ.ศ.) */}
          <DateField label="วันที่รักษา" value={date} onChange={setDate} />
          <Field label="อาการเจ็บป่วย" value={symptoms} onChange={setSymptoms} placeholder="เช่น ปวดเข่าสองข้าง ขึ้นลงบันไดลำบาก" multiline />
          <Field inputRef={durRef} label="เป็นมานานเท่าไร" value={duration} onChange={setDuration} placeholder="เช่น 3 วัน, 2 เดือน" onNext={() => diagRef.current?.focus()} />
        </Section>

        <Section title="ตรวจและวินิจฉัย" icon="hand.raised.fill">
          <View style={{ gap: 14 }}>
            <View style={styles.vRow}>
              <Field flex={1} label="ความดัน (บน/ล่าง)" value={bpRaw} onChange={onBp} placeholder="เช่น 120/80" keyboard="number-pad" />
              <Field flex={1} label="ชีพจร (ครั้ง/นาที)" value={vt.pulse} onChange={(x) => setVt((o) => ({ ...o, pulse: x.replace(/\D/g, '').slice(0, 3) }))} placeholder="เช่น 72" keyboard="number-pad" />
            </View>
            <View style={styles.vRow}>
              <Field flex={1} label="น้ำตาล (มก./ดล.)" value={vt.sugar} onChange={(x) => setVt((o) => ({ ...o, sugar: x.replace(/\D/g, '').slice(0, 3) }))} placeholder="เช่น 100" keyboard="number-pad" />
              <Field flex={1} label="น้ำหนัก (กก.)" value={vt.weight} onChange={(x) => setVt((o) => ({ ...o, weight: x.replace(/[^\d.]/g, '').slice(0, 5) }))} placeholder={p.weight ? `ครั้งก่อน ${p.weight}` : 'เช่น 60'} keyboard="decimal-pad" />
            </View>
            {checks.length ? (
              <Animated.View entering={FadeIn.duration(200)} layout={SMOOTH} style={{ gap: 6 }}>
                {checks.map((c) => (
                  <View key={c.k} style={[styles.vCheck, { backgroundColor: LEVEL[c.level].bg }]}>
                    <Sym name={LEVEL[c.level].icon} size={15} color={LEVEL[c.level].color} />
                    <View style={{ flex: 1 }}>
                      <T v="subhead" color={LEVEL[c.level].color} style={{ fontWeight: '700' }}>{c.title}</T>
                      <T v="caption" color={palette.inkSoft}>{c.text}</T>
                    </View>
                  </View>
                ))}
                <T v="micro" color={ios.tertiary} style={{ marginLeft: 4 }}>เกณฑ์จาก{SRC}</T>
              </Animated.View>
            ) : null}
          </View>
          <Field label="ตรวจร่างกาย" value={exam} onChange={setExam} placeholder="เช่น เข่าบวม กดเจ็บ ชีพจร" multiline />
          <Field inputRef={diagRef} label="วินิจฉัยโรค" value={diagnosis} onChange={setDiagnosis} placeholder="เช่น ลมจับโปง (ข้อเข่าเสื่อม)" />
        </Section>

        <Section title="การรักษา" icon="leaf.fill">
          {/* ครูปัญญาเสนอแนวทาง: แผนไทย / แผนปัจจุบัน (ยาสามัญประจำบ้าน + ส่งต่อ) พร้อมแหล่งอ้างอิง */}
          <PlanCard
            patient={p}
            input={{ symptoms, duration, exam, vitals: vitalsText(vitals), diagnosis }}
            onUse={(plan, track) => {
              const add = planToTreatment(plan, track);
              setTreatment((t) => (t.trim() ? `${t.trim()} · ${add}` : add));
              const dx = track === 'thai' ? plan.thaiDx : plan.modernDx;
              if (!diagnosis.trim() && dx) setDiagnosis(dx);
              if (!followUp.trim() && plan.followUp) setFollowUp(plan.followUp);
              if (plan.refer.level === 'now' && !referReason.trim()) setReferReason(plan.refer.reason);
              h.success();
            }}
          />
          <Field label="การรักษา / ยาที่ให้" value={treatment} onChange={setTreatment} placeholder="เช่น นวด ประคบสมุนไพร ยาประสะไพล ครั้งละ 1 กรัม" multiline />
          {ready.length ? (
            <View>
              <T v="caption" color={ios.secondary} style={{ marginLeft: 4, marginBottom: 6, fontWeight: '600' }}>แตะเพื่อใส่ยาจากคลังของหมอ</T>
              <View style={styles.chips}>
                {ready.slice(0, 10).map((x) => (
                  <PressableScale key={x.id} haptic="select" scaleTo={0.95} onPress={() => setTreatment((t) => (t.includes(x.name) ? t : `${t.trim()}${t.trim() ? ' · ' : ''}${x.name} `))} style={[styles.chip, { height: 34, paddingHorizontal: 12 }]} accessibilityLabel={`ใส่ ${x.name}`}>
                    <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '600' }}>+ {x.name}</T>
                  </PressableScale>
                ))}
              </View>
            </View>
          ) : null}
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
          <Field label="ผลการรักษา" value={result} onChange={setResult} placeholder="เช่น ปวดลดลง เดินได้ดีขึ้น" multiline />
        </Section>

        {/* สถานะก่อน → ช่องที่ต้องกรอกเปลี่ยนตามสถานะ */}
        <Section title="สถานะผู้ป่วย" icon="flag.fill">
          <View style={styles.chips}>
            {STATUS.map((x) => {
              const on = status === x.k;
              return (
                <PressableScale key={x.k} haptic="select" scaleTo={0.95} onPress={() => setStatus(x.k)} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: on }} accessibilityLabel={`สถานะ ${x.label}`}>
                  <T v="subhead" color={on ? '#FFFFFF' : palette.ink} style={{ fontWeight: '600' }}>{x.label}</T>
                </PressableScale>
              );
            })}
          </View>
          {status === 'ติดตามอาการ' ? (
            <Animated.View key="follow" entering={FadeIn.duration(200)}>
              <View style={{ gap: 14 }}>
                <View>
                  <T v="subhead" color={ios.secondary} style={styles.label}>นัดติดตามอาการ</T>
                  <View style={styles.chips}>
                    {FU.map((x) => {
                      const on = fuDays === x.d;
                      return (
                        <PressableScale key={x.d} haptic="select" scaleTo={0.95} onPress={() => setFuDays(x.d)} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: on }} accessibilityLabel={`นัด ${x.label}`}>
                          <T v="subhead" color={on ? '#FFFFFF' : palette.ink} style={{ fontWeight: '600' }}>{x.label}</T>
                        </PressableScale>
                      );
                    })}
                  </View>
                  <T v="caption" color={ios.tertiary} style={{ marginTop: 6, marginLeft: 4 }}>
                    {fuDays ? `นัด ${thShort(isoIn(fuDays, date))} · แอปเตือนเช้าวันนัด และเตือนถามอาการหลังรักษา 3 วัน` : 'ไม่นัด · แอปยังเตือนถามอาการหลังรักษา 3 วัน'}
                  </T>
                </View>
                <Field label="การติดตามผล" value={followUp} onChange={setFollowUp} placeholder="เช่น งดของแสลง ประคบต่อที่บ้านวันละครั้ง" multiline />
              </View>
            </Animated.View>
          ) : status === 'ส่งต่อ รพ.สต.' ? (
            <Animated.View key="refer" entering={FadeIn.duration(200)} style={{ gap: 14 }}>
              <View style={{ gap: 6 }}>
                <Dropdown label="ส่งถึง" value={fac.name} options={FACILITIES.map((f) => f.name)} onChange={(n) => setFid(FACILITIES.find((f) => f.name === n)?.id ?? fid)} />
                <View style={styles.facNote}>
                  <Sym name="link" size={12} color={palette.primary} />
                  <T v="caption" color={ios.secondary}>{fac.area} · {fac.km} กม. · เชื่อมกับระบบแล้ว</T>
                </View>
                {lastRef ? (
                  <View style={styles.refWarn}>
                    <Sym name="clock.arrow.circlepath" size={14} color="#B86E00" />
                    <T v="caption" color="#7A4A00" style={{ flex: 1 }}>เคยส่งต่อให้ที่นี่แล้ว เมื่อ {thDate(lastRef.at)}{lastRef.visitNo ? ` (การรักษาครั้งที่ ${lastRef.visitNo})` : ''}</T>
                  </View>
                ) : null}
              </View>
              <Field label="เหตุผลที่ส่งต่อ" value={referReason} onChange={setReferReason} placeholder={diagnosis.trim() ? `เช่น อาการ${diagnosis.trim()}ไม่ดีขึ้น ควรตรวจเพิ่มเติม` : 'เช่น อาการไม่ดีขึ้น ควรตรวจเพิ่มเติม'} multiline />
              <View style={styles.sw}>
                <T v="body" style={{ flex: 1 }}>ส่งต่อด่วน</T>
                <Switch value={urgent} onValueChange={setUrgent} trackColor={{ true: palette.coral }} />
              </View>
            </Animated.View>
          ) : null}
          <Field label="หมายเหตุ / ข้อห้าม" value={note} onChange={setNote} placeholder={status === 'หายดี' ? 'ถ้ามี เช่น ของแสลงที่ควรเลี่ยงต่อ' : 'ของแสลง ข้อห้าม หรือเรื่องที่ต้องจำ'} multiline />
        </Section>
      </ScrollView>

      <GlassDock>
        <Button label={referring ? 'บันทึกและส่งต่อ' : 'บันทึกการรักษา'} icon={<Sym name={referring ? 'paperplane.fill' : 'checkmark'} size={17} color="#FFFFFF" weight="bold" />} disabled={!canSave} onPress={save} style={{ flex: 1, height: 52 }} />
      </GlassDock>
    </KeyboardAvoidingView>
  );
}

export default function RecordVisit() {
  return <RecordInner />;
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
  vRow: { flexDirection: 'row', gap: 10 },
  draft: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, backgroundColor: palette.primarySoft },
  vCheck: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 14 },
  facNote: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 6 },
  refWarn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, padding: 10, borderRadius: 14, backgroundColor: '#FDF1DC' },
  sw: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: palette.primary },
  herbWarn: { gap: 4, padding: 12, borderRadius: 16, backgroundColor: palette.primarySoft },
});
