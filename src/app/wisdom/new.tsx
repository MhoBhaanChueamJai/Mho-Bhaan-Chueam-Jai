/**
 * เพิ่ม/แก้ไขภูมิปัญญา — เลือกประเภทก่อน แล้วช่องกรอกเปลี่ยนตามประเภท (lib/wisdomKinds.ts)
 *   ตำรับยา: ตัวยา+ปริมาณ · วิธีปรุงทีละขั้น · วิธีใช้ | วิธีรักษา: อุปกรณ์ · ขั้นตอน · ระยะเวลา
 *   คาถา/พิธี: บทคาถา · เครื่องประกอบพิธี · ขั้นตอนพิธี | ตำราโบราณ: ข้อความต้นฉบับ · ถอดความ · แหล่งที่มา
 * เครื่องมือบนหัวจอ: เล่าให้ครูปัญญาฟัง (โหมดเสียง) · สแกนตำราโบราณ → เติมฟอร์มให้ แก้ไขได้ก่อนบันทึก
 */
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { PractitionerGate } from '../../components/PractitionerGate';
import { KindIcon } from '../../components/KindIcon';
import { Sym, ios } from '../../components/ios';
import { Button, GlassDock, HeaderButton, PressableScale, T, useHaptic } from '../../components/ui';
import { KINDS, onWisdomResult, takeWisdomResult, type WisdomResult } from '../../lib/wisdomTalk';
import { KIND_FORM, joinMethod, splitMethod } from '../../lib/wisdomKinds';
import type { Wisdom } from '../../data/mock';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

const SMOOTH = LinearTransition.duration(280);

type Row = { name: string; amount: string };
type Form = { title: string; kind: Wisdom['kind']; indication: string; rows: Row[]; steps: string[]; extra: string; summary: string; caution: string; origin: string };
const blank = (kind: Wisdom['kind'] = 'ตำรับยา'): Form => ({ title: '', kind, indication: '', rows: [{ name: '', amount: '' }], steps: [''], extra: '', summary: '', caution: '', origin: '' });
const ORIGIN_RE = /\n*(?:ได้รับสืบทอดจาก|แหล่งที่มา):\s*(.+)$/;

/** ตำราเดิม → ฟอร์ม (แยกวิธีทำเป็นขั้นตอน, ที่มาออกจากเนื้อหา) */
function fromWisdom(w: Wisdom): Form {
  const { steps, extra } = splitMethod(w.kind, w.method);
  const m = (w.summary ?? '').match(ORIGIN_RE);
  return {
    title: w.title,
    kind: w.kind,
    indication: w.indication ?? '',
    rows: (w.ingredients?.length ? w.ingredients : ['']).map((x) => ({ name: x, amount: '' })),
    steps: steps.length ? steps : [''],
    extra,
    summary: (w.summary ?? '').replace(ORIGIN_RE, '').trim(),
    caution: w.caution ?? '',
    origin: m ? m[1].trim() : '',
  };
}

/** ช่องกรอก: ป้ายด้านบน + ช่องแคปซูลพื้นมิ้นต์ (โฟกัส = พื้นขาว ขอบเขียว) */
function Field({ label, value, onChange, placeholder, multiline, big }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; big?: boolean }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ flex: label ? undefined : 1 }}>
      {label ? <T v="subhead" color={ios.secondary} style={styles.label}>{label}</T> : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={ios.tertiary}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        multiline={multiline || big}
        style={[styles.input, (multiline || big) && styles.inputMulti, big && { minHeight: 150 }, focus && styles.inputFocus]}
        accessibilityLabel={label ?? placeholder}
      />
    </View>
  );
}

function Section({ title, icon, footer, children }: { title: string; icon: string; footer?: string; children: React.ReactNode }) {
  return (
    <Animated.View layout={SMOOTH} entering={FadeIn.duration(250)} style={[styles.card, elevation.e1]}>
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

/** ปุ่มเพิ่มแถว (ตัวยา / ขั้นตอน) */
function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale haptic="select" scaleTo={0.97} onPress={onPress} style={styles.addRow} accessibilityLabel={label}>
      <Sym name="plus.circle.fill" size={18} color={palette.primary} />
      <T v="callout" color={palette.primary} style={{ fontWeight: '600' }}>{label}</T>
    </PressableScale>
  );
}
function RemoveBtn({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <PressableScale haptic="select" onPress={onPress} style={styles.remove} accessibilityLabel={label} hitSlop={6}>
      <Sym name="minus.circle.fill" size={20} color={ios.tertiary} />
    </PressableScale>
  );
}

function NewWisdomInner() {
  const { addWisdom, updateWisdom, wisdoms } = useApp();
  const h = useHaptic();
  // แก้ไข (เปิดด้วย ?id=) → เติมฟอร์มจากตำราเดิม บันทึกทับเรื่องเดิม
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const editing = editId ? wisdoms.find((x) => x.id === editId) : undefined;
  const [f, setF] = useState<Form>(() => (editing ? fromWisdom(editing) : blank()));
  const [source, setSource] = useState<Wisdom['source']>(editing?.source ?? 'พิมพ์เอง');
  const [aiNote, setAiNote] = useState('');
  const cfg = KIND_FORM[f.kind];
  const set = (k: 'title' | 'indication' | 'extra' | 'summary' | 'caution' | 'origin') => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const setRow = (i: number, k: keyof Row) => (v: string) => setF((x) => ({ ...x, rows: x.rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const setStep = (i: number) => (v: string) => setF((x) => ({ ...x, steps: x.steps.map((s, j) => (j === i ? v : s)) }));

  /** ใส่ข้อมูลจากโหมดเสียง / สแกนตำรา ลงฟอร์ม (ช่องที่ได้มาแทนที่ ช่องอื่นคงเดิม) */
  const apply = (r: WisdomResult) => {
    setF((x) => {
      const kind = (KINDS.includes(r.kind as any) ? r.kind : x.kind) as Wisdom['kind'];
      const ing = (r.ingredients ?? '').split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
      const steps = (r.method ?? '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
      return {
        ...x,
        kind,
        title: r.title || x.title,
        indication: r.indication || x.indication,
        rows: ing.length ? ing.map((name) => ({ name, amount: '' })) : x.rows,
        steps: steps.length ? steps : x.steps,
        extra: r.extra || x.extra,
        caution: r.caution || x.caution,
        origin: r.origin || x.origin,
        summary: r.summary || x.summary,
      };
    });
    if (r.source) setSource(r.source);
    setAiNote(r.source === 'สแกนตำรา' ? 'ครูปัญญาถอดความจากตำราให้แล้ว ตรวจทานก่อนบันทึกนะครับ' : 'ครูปัญญากรอกจากที่คุณหมอเล่าให้แล้ว แก้ไขได้ก่อนบันทึก');
    h.success();
  };
  useFocusEffect(
    useCallback(() => {
      const r = takeWisdomResult();
      if (r) apply(r);
      onWisdomResult(apply);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  useEffect(() => () => onWisdomResult(null), []);

  const canSave = f.title.trim().length > 1;
  const save = () => {
    if (!canSave) return;
    const t = new Date();
    const ingredients = cfg.ingredients ? f.rows.map((r) => [r.name.trim(), r.amount.trim()].filter(Boolean).join(' ')).filter(Boolean) : [];
    const method = cfg.method.steps ? joinMethod(f.kind, f.steps, f.extra) : [f.steps.join('\n').trim(), cfg.extra && f.extra.trim() ? `${cfg.extra.prefix}: ${f.extra.trim()}` : ''].filter(Boolean).join('\n');
    const originLabel = f.kind === 'ตำราโบราณ' ? 'แหล่งที่มา' : 'ได้รับสืบทอดจาก';
    const summary = [f.summary.trim(), f.origin.trim() ? `${originLabel}: ${f.origin.trim()}` : ''].filter(Boolean).join('\n\n');
    const data = {
      title: f.title.trim(),
      kind: f.kind,
      summary: summary || (f.indication.trim() ? `ใช้แก้${f.indication.trim().replace(/^แก้/, '')}` : f.title.trim()),
      ingredients: ingredients.length ? ingredients : undefined,
      method: method || undefined,
      indication: f.indication.trim() || undefined,
      caution: f.caution.trim() || undefined,
    };
    if (editing) updateWisdom(editing.id, data);
    else addWisdom({ ...data, id: `w${Date.now()}`, source, date: `${t.getDate()}/${t.getMonth() + 1}/${t.getFullYear() + 543}`, verified: false });
    h.success();
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* เครื่องมือบนหัวจอ: เล่าด้วยเสียง · สแกนตำรา */}
      <Stack.Screen
        options={{
          title: editing ? 'แก้ไขภูมิปัญญา' : 'เพิ่มภูมิปัญญา',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label="เล่าให้ครูปัญญาบันทึก" onPress={() => router.push({ pathname: '/wisdom/voice', params: { kind: f.kind } })}>
                <Sym name="mic.fill" size={20} color={palette.ink} weight="semibold" />
              </HeaderButton>
              <HeaderButton label="สแกนตำราโบราณ" onPress={() => router.push({ pathname: '/scan', params: { fill: '1' } })}>
                <Sym name="doc.viewfinder" size={20} color={palette.ink} weight="semibold" />
              </HeaderButton>
            </View>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {aiNote ? (
          <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} layout={SMOOTH} style={styles.note}>
            <Sym name="sparkles" size={14} color={palette.primary} />
            <T v="caption" color={palette.primary} style={{ flex: 1 }}>{aiNote}</T>
          </Animated.View>
        ) : null}

        {/* ── เลือกประเภทก่อน: ช่องกรอกด้านล่างเปลี่ยนตามประเภท ── */}
        <T v="subhead" color={ios.secondary} style={[styles.label, { marginBottom: -4 }]}>ประเภทภูมิปัญญา</T>
        <View style={styles.kinds}>
          {KINDS.map((k) => {
            const on = f.kind === k;
            return (
              <PressableScale key={k} haptic="select" scaleTo={0.97} onPress={() => setF((x) => ({ ...x, kind: k }))} style={[styles.kind, elevation.e1, on && styles.kindOn]} accessibilityLabel={`${k} ${KIND_FORM[k].desc}`} accessibilityState={{ selected: on }}>
                <View style={[styles.kindIcon, on && { backgroundColor: palette.primary }]}>
                  <KindIcon kind={k} size={20} color={on ? '#FFFFFF' : palette.primary} />
                </View>
                <T v="title" color={on ? palette.primaryDeep : palette.ink}>{k}</T>
                <T v="caption" color={ios.secondary} numberOfLines={1}>{KIND_FORM[k].desc}</T>
                {on ? (
                  <View style={styles.kindCheck}>
                    <Sym name="checkmark.circle.fill" size={20} color={palette.primary} />
                  </View>
                ) : null}
              </PressableScale>
            );
          })}
        </View>

        <Section title="ข้อมูลหลัก" icon="book.closed.fill">
          <Field label={cfg.title.label} value={f.title} onChange={set('title')} placeholder={cfg.title.ph} />
          <Field label={cfg.indication.label} value={f.indication} onChange={set('indication')} placeholder={cfg.indication.ph} />
        </Section>

        {/* บทคาถา / ถอดความ (ประเภทที่เนื้อหาเป็นหัวใจหลัก) */}
        {cfg.summary.big ? (
          <Section key={`sum-${f.kind}`} title={cfg.summary.label} icon={f.kind === 'คาถา/พิธี' ? 'sparkles' : 'text.book.closed.fill'}>
            <Field value={f.summary} onChange={set('summary')} placeholder={cfg.summary.ph} big />
          </Section>
        ) : null}

        {cfg.ingredients ? (
          <Section key={`ing-${f.kind}`} title={cfg.ingredients.label} icon="leaf.fill">
            {f.rows.map((r, i) => (
              <Animated.View key={i} layout={SMOOTH} entering={FadeIn.duration(200)} style={styles.row}>
                <View style={styles.rowNum}>
                  <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '700' }}>{i + 1}</T>
                </View>
                <Field value={r.name} onChange={setRow(i, 'name')} placeholder={cfg.ingredients!.ph} />
                {cfg.ingredients!.amount ? (
                  <View style={{ width: 110 }}>
                    <Field value={r.amount} onChange={setRow(i, 'amount')} placeholder="ปริมาณ" />
                  </View>
                ) : null}
                {f.rows.length > 1 ? <RemoveBtn label={`ลบรายการที่ ${i + 1}`} onPress={() => setF((x) => ({ ...x, rows: x.rows.filter((_, j) => j !== i) }))} /> : null}
              </Animated.View>
            ))}
            <AddRow label={cfg.ingredients.add} onPress={() => setF((x) => ({ ...x, rows: [...x.rows, { name: '', amount: '' }] }))} />
          </Section>
        ) : null}

        <Section key={`m-${f.kind}`} title={cfg.method.label} icon={cfg.method.steps ? 'list.number' : 'doc.text.fill'}>
          {cfg.method.steps ? (
            <>
              {f.steps.map((st, i) => (
                <Animated.View key={i} layout={SMOOTH} entering={FadeIn.duration(200)} style={styles.row}>
                  <View style={[styles.rowNum, { backgroundColor: '#FCEBD2' }]}>
                    <T v="caption" color="#B26A12" style={{ fontWeight: '700' }}>{i + 1}</T>
                  </View>
                  <Field value={st} onChange={setStep(i)} placeholder={i === 0 ? cfg.method.ph : `ขั้นตอนที่ ${i + 1}`} multiline />
                  {f.steps.length > 1 ? <RemoveBtn label={`ลบขั้นตอนที่ ${i + 1}`} onPress={() => setF((x) => ({ ...x, steps: x.steps.filter((_, j) => j !== i) }))} /> : null}
                </Animated.View>
              ))}
              <AddRow label={cfg.method.add ?? 'เพิ่มขั้นตอน'} onPress={() => setF((x) => ({ ...x, steps: [...x.steps, ''] }))} />
            </>
          ) : (
            <Field value={f.steps.join('\n')} onChange={(v) => setF((x) => ({ ...x, steps: [v] }))} placeholder={cfg.method.ph} big />
          )}
          {cfg.extra ? <Field label={cfg.extra.label} value={f.extra} onChange={set('extra')} placeholder={cfg.extra.ph} /> : null}
        </Section>

        {!cfg.summary.big ? (
          <Section title={cfg.summary.label} icon="book.fill">
            <Field value={f.summary} onChange={set('summary')} placeholder={cfg.summary.ph} multiline />
          </Section>
        ) : null}

        <Section title="ข้อควรระวังและที่มา" icon="checkmark.shield.fill">
          <Field label={cfg.caution.label} value={f.caution} onChange={set('caution')} placeholder={cfg.caution.ph} multiline />
          <Field label={cfg.origin.label} value={f.origin} onChange={set('origin')} placeholder={cfg.origin.ph} />
        </Section>
      </ScrollView>

      <GlassDock>
        <Button label={editing ? 'บันทึกการแก้ไข' : 'บันทึกภูมิปัญญา'} disabled={!canSave} onPress={save} style={{ flex: 1, height: 52 }} />
      </GlassDock>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 130, gap: 14 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  label: { marginBottom: 6, marginLeft: 4, fontWeight: '600' },
  input: { height: 50, borderRadius: 25, paddingHorizontal: 18, backgroundColor: palette.mint, fontSize: 17, color: palette.ink, borderWidth: 1.5, borderColor: 'transparent' },
  inputMulti: { height: undefined, minHeight: 50, borderRadius: 20, paddingTop: 13, paddingBottom: 13, textAlignVertical: 'top' },
  inputFocus: { backgroundColor: palette.surface, borderColor: palette.primary },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kind: { flexBasis: '47%', flexGrow: 1, padding: 14, gap: 4, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.surface, borderWidth: 2, borderColor: 'transparent' },
  kindOn: { borderColor: palette.primary, backgroundColor: '#F2FAF5' },
  kindIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  kindCheck: { position: 'absolute', top: 12, right: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 11 },
  remove: { width: 30, height: 50, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: palette.primarySoft },
});

export default function NewWisdom() {
  return (
    <PractitionerGate>
      <NewWisdomInner />
    </PractitionerGate>
  );
}
