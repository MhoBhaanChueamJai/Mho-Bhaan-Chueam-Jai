/**
 * เพิ่มภูมิปัญญา — หน้าเต็มแบบเดียวกับเพิ่มผู้ป่วย (DESIGN_SYSTEM.md)
 * เครื่องมือบนหัวจอ: เล่าให้ครูปัญญาฟัง (โหมดเสียง) · สแกนตำราโบราณ → เติมฟอร์มให้ แก้ไขได้ก่อนบันทึก
 */
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { PractitionerGate } from '../../components/PractitionerGate';
import { Sym, ios } from '../../components/ios';
import { Button, GlassDock, HeaderButton, PressableScale, T, useHaptic } from '../../components/ui';
import { KINDS, onWisdomResult, takeWisdomResult, type WisdomResult } from '../../lib/wisdomTalk';
import type { Wisdom } from '../../data/mock';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

const SMOOTH = LinearTransition.duration(280);

const KIND_ICON: Record<Wisdom['kind'], string> = {
  ตำรับยา: 'leaf.fill',
  วิธีรักษา: 'hand.raised.fill',
  'คาถา/พิธี': 'sparkles',
  ตำราโบราณ: 'scroll.fill',
};

type Form = { title: string; kind: Wisdom['kind']; ingredients: string; method: string; indication: string; caution: string; origin: string; summary: string };
const EMPTY: Form = { title: '', kind: 'ตำรับยา', ingredients: '', method: '', indication: '', caution: '', origin: '', summary: '' };

/** ช่องกรอก: ป้ายด้านบน + ช่องแคปซูลพื้นมิ้นต์ (โฟกัส = พื้นขาว ขอบเขียว) */
function Field({ label, value, onChange, placeholder, keyboard, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboard?: KeyboardTypeOptions; multiline?: boolean }) {
  const [focus, setFocus] = useState(false);
  return (
    <View>
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

function NewWisdomInner() {
  const { addWisdom } = useApp();
  const h = useHaptic();
  const [f, setF] = useState<Form>(EMPTY);
  const [source, setSource] = useState<Wisdom['source']>('พิมพ์เอง');
  const [aiNote, setAiNote] = useState('');
  const set = (k: keyof Form) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  /** ใส่ข้อมูลจากโหมดเสียง / สแกนตำรา ลงฟอร์ม (ช่องที่ได้มาแทนที่ ช่องอื่นคงเดิม) */
  const apply = (r: WisdomResult) => {
    setF((x) => ({
      ...x,
      title: r.title || x.title,
      kind: (KINDS.includes(r.kind as any) ? r.kind : x.kind) as Wisdom['kind'],
      ingredients: r.ingredients || x.ingredients,
      method: r.method || x.method,
      indication: r.indication || x.indication,
      caution: r.caution || x.caution,
      origin: r.origin || x.origin,
      summary: r.summary || x.summary,
    }));
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
    const lines = f.ingredients.split(/[,，\n]/).map((x) => x.trim()).filter(Boolean);
    addWisdom({
      id: `w${Date.now()}`,
      title: f.title.trim(),
      kind: f.kind,
      source,
      date: `${t.getDate()}/${t.getMonth() + 1}/${t.getFullYear() + 543}`,
      summary: [f.summary.trim() || (f.indication.trim() ? `ใช้แก้${f.indication.trim().replace(/^แก้/, '')}` : ''), f.origin.trim() ? `ได้รับสืบทอดจาก${f.origin.trim().replace(/^(สืบทอด|ได้รับ)?(มา)?จาก/, '')}` : '']
        .filter(Boolean)
        .join(' · ') || f.title.trim(),
      ingredients: lines.length ? lines : undefined,
      method: f.method.trim() || undefined,
      indication: f.indication.trim() || undefined,
      caution: f.caution.trim() || undefined,
      verified: false,
    });
    h.success();
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* เครื่องมือบนหัวจอ (แบบหน้าเพิ่มผู้ป่วย): เล่าด้วยเสียง · สแกนตำรา */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label="เล่าให้ครูปัญญาบันทึก" onPress={() => router.push('/wisdom/voice')}>
                <Sym name="mic.fill" size={20} color={palette.primary} weight="semibold" />
              </HeaderButton>
              <HeaderButton label="สแกนตำราโบราณ" onPress={() => router.push({ pathname: '/scan', params: { fill: '1' } })}>
                <Sym name="doc.viewfinder" size={20} color={palette.primary} weight="semibold" />
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

        <Section title="ภูมิปัญญา" icon="book.closed.fill">
          <Field label="ชื่อตำรับ / เรื่อง" value={f.title} onChange={set('title')} placeholder="เช่น ยาต้มแก้ลมจับโปง" />
          <View>
            <T v="subhead" color={ios.secondary} style={styles.label}>ประเภท</T>
            <View style={styles.kinds}>
              {KINDS.map((k) => {
                const on = f.kind === k;
                return (
                  <PressableScale key={k} haptic="select" scaleTo={0.96} onPress={() => setF((x) => ({ ...x, kind: k }))} style={[styles.kind, on && styles.kindOn]} accessibilityLabel={k} accessibilityState={{ selected: on }}>
                    <Sym name={KIND_ICON[k] as any} size={16} color={on ? palette.white : palette.primary} />
                    <T v="callout" color={on ? palette.white : palette.ink} style={{ fontWeight: '600' }}>{k}</T>
                  </PressableScale>
                );
              })}
            </View>
          </View>
          <Field label="สรรพคุณ / ใช้แก้" value={f.indication} onChange={set('indication')} placeholder="เช่น ปวดเข่า ปวดเมื่อย" />
        </Section>

        <Section title={f.kind === 'คาถา/พิธี' ? 'ขั้นตอน' : 'ตัวยาและวิธีทำ'} icon={f.kind === 'คาถา/พิธี' ? 'list.number' : 'leaf.fill'}>
          {f.kind !== 'คาถา/พิธี' ? <Field label="ตัวยา / สมุนไพร" value={f.ingredients} onChange={set('ingredients')} placeholder="คั่นด้วยจุลภาค เช่น เถาวัลย์เปรียง 1 กำมือ, ไพล 3 แง่ง" multiline /> : null}
          <Field label={f.kind === 'คาถา/พิธี' ? 'ขั้นตอน / บทคาถา' : 'วิธีปรุงและวิธีใช้'} value={f.method} onChange={set('method')} placeholder={f.kind === 'คาถา/พิธี' ? 'เล่าขั้นตอนตามลำดับ' : 'เช่น ต้มสามเอาหนึ่ง กินเช้าเย็นครั้งละครึ่งแก้ว'} multiline />
          {f.summary ? <Field label="ถอดความ" value={f.summary} onChange={set('summary')} multiline /> : null}
        </Section>

        <Section title="ความปลอดภัยและที่มา" icon="checkmark.shield.fill" footer="ภูมิปัญญาที่บันทึกจะรอตรวจทานก่อนส่งต่อให้ลูกศิษย์">
          <Field label="ข้อห้าม / ข้อควรระวัง" value={f.caution} onChange={set('caution')} placeholder="เช่น ห้ามใช้ในคนท้อง" multiline />
          <Field label="ได้รับสืบทอดจาก" value={f.origin} onChange={set('origin')} placeholder="เช่น พ่อ ครูบาอาจารย์ ตำราของวัด" />
        </Section>
      </ScrollView>

      <GlassDock>
        <Button label="บันทึกภูมิปัญญา" disabled={!canSave} onPress={save} style={{ flex: 1, height: 52 }} />
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
  input: { height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, fontSize: 17, color: palette.ink, borderWidth: 1.5, borderColor: 'transparent' },
  inputMulti: { height: undefined, minHeight: 76, borderRadius: 22, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' },
  inputFocus: { backgroundColor: palette.surface, borderColor: palette.primary },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: 24, backgroundColor: palette.mint },
  kindOn: { backgroundColor: palette.primary },
});

export default function NewWisdom() {
  return (
    <PractitionerGate>
      <NewWisdomInner />
    </PractitionerGate>
  );
}
