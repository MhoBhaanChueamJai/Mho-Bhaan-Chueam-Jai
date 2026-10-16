/**
 * เพิ่ม/แก้ไขภูมิปัญญา
 * 1) เลือกประเภท · ข้อมูลหลัก (ชื่อ + ใช้แก้/ว่าด้วยเรื่อง)
 * 2) เขียนตำรา: พื้นที่เดียวแบบหลายหน้า — เนื้อหา ตัวยา วิธีทำ วิธีใช้ ข้อห้าม ที่มา เขียนรวมกันได้เลย
 * 3) ให้ครูปัญญาจัดหน้า: AI แยกหัวข้อตามประเภท เรียบเรียงคำใหม่ และแบ่งหน้าอัตโนมัติ (lib/wisdomOrganize.ts)
 * 4) หน้าสรุป: ตรวจทานผลที่จัดแล้ว → บันทึก หรือกลับไปแก้ต้นฉบับ
 * เครื่องมือบนหัวจอ: เล่าให้ครูปัญญาฟัง (โหมดเสียง) · สแกนตำราโบราณ → ใส่ลงต้นฉบับให้
 */
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { AISphere } from '../../components/AISphere';
import { BookCover } from '../../components/BookCover';
import { PractitionerGate } from '../../components/PractitionerGate';
import { KindIcon } from '../../components/KindIcon';
import { Sym, ios } from '../../components/ios';
import { Button, GlassDock, HeaderButton, PressableScale, T, useHaptic } from '../../components/ui';
import { KINDS, onWisdomResult, takeWisdomResult, type WisdomResult } from '../../lib/wisdomTalk';
import { KIND_FORM, joinMethod } from '../../lib/wisdomKinds';
import { draftFromWisdom, organizeWisdom, organizedToWisdom, type Organized } from '../../lib/wisdomOrganize';
import type { Wisdom } from '../../data/mock';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

const SMOOTH = LinearTransition.duration(280);
const WRITE_HINT: Record<Wisdom['kind'], string> = {
  ตำรับยา: 'เขียนรวมกันได้ทุกอย่าง เช่น ที่มาของตำรับ ตัวยาและปริมาณ วิธีปรุง วิธีกิน ข้อห้าม — ครูปัญญาจะแยกหัวข้อและจัดหน้าให้',
  วิธีรักษา: 'เขียนรวมกันได้ทุกอย่าง เช่น อาการที่รักษา อุปกรณ์ ขั้นตอน ระยะเวลา ข้อห้าม — ครูปัญญาจะแยกหัวข้อและจัดหน้าให้',
  'คาถา/พิธี': 'เขียนบทคาถาตามที่ได้รับสืบทอด พร้อมเครื่องประกอบพิธี ขั้นตอน ข้อปฏิบัติ — บทคาถาจะคงถ้อยคำเดิม',
  ตำราโบราณ: 'คัดลอกข้อความต้นฉบับ พร้อมคำอธิบาย/ถอดความ ตัวยาที่พบ แหล่งที่มา — ข้อความต้นฉบับจะคงอักขระเดิม',
};

/** ช่องกรอก: ป้ายด้านบน + ช่องแคปซูลพื้นมิ้นต์ (โฟกัส = พื้นขาว ขอบเขียว) */
function Field({ label, value, onChange, placeholder, big }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; big?: boolean }) {
  const [focus, setFocus] = useState(false);
  return (
    <View>
      {label ? <T v="subhead" color={ios.secondary} style={styles.label}>{label}</T> : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={ios.tertiary}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        multiline={big}
        scrollEnabled={false}
        style={[styles.input, big && styles.inputBig, focus && styles.inputFocus]}
        accessibilityLabel={label ?? placeholder}
      />
    </View>
  );
}

function Section({ title, icon, footer, children, right }: { title: string; icon: string; footer?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Animated.View layout={SMOOTH} entering={FadeIn.duration(250)} style={[styles.card, elevation.e1]}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Sym name={icon as any} size={15} color={palette.primary} />
        </View>
        <T v="title" style={{ flex: 1 }}>{title}</T>
        {right}
      </View>
      <Animated.View layout={SMOOTH} style={{ gap: 14 }}>{children}</Animated.View>
      {footer ? <T v="caption" color={ios.secondary} style={{ marginTop: 12 }}>{footer}</T> : null}
    </Animated.View>
  );
}

function NewWisdomInner() {
  const { addWisdom, updateWisdom, wisdoms } = useApp();
  const h = useHaptic();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const editing = editId ? wisdoms.find((x) => x.id === editId) : undefined;

  const [kind, setKind] = useState<Wisdom['kind']>(editing?.kind ?? 'ตำรับยา');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [indication, setIndication] = useState(editing?.indication ?? '');
  const [draft, setDraft] = useState<string[]>(() => (editing ? draftFromWisdom(editing.kind, editing) : ['']));
  const [source, setSource] = useState<Wisdom['source']>(editing?.source ?? 'พิมพ์เอง');
  const [mode, setMode] = useState<'write' | 'organizing' | 'review'>('write');
  const [org, setOrg] = useState<Organized | null>(null);
  const [aiNote, setAiNote] = useState('');
  const cfg = KIND_FORM[kind];
  const setPage = (i: number) => (v: string) => setDraft((d) => d.map((p, j) => (j === i ? v : p)));

  /** ผลจากโหมดเสียง / สแกนตำรา → ใส่ลงต้นฉบับ (หมอแก้ต่อได้ แล้วค่อยให้ครูปัญญาจัดหน้า) */
  const apply = (r: WisdomResult) => {
    const k = (KINDS.includes(r.kind as any) ? r.kind : kind) as Wisdom['kind'];
    setKind(k);
    if (r.title) setTitle(r.title);
    if (r.indication) setIndication(r.indication);
    const originLabel = k === 'ตำราโบราณ' ? 'แหล่งที่มา' : 'ได้รับสืบทอดจาก';
    setDraft(
      draftFromWisdom(k, {
        summary: [r.summary, r.origin ? `${originLabel}: ${r.origin}` : ''].filter(Boolean).join('\n\n'),
        ingredients: (r.ingredients ?? '').split(/[,，\n]/).map((s) => s.trim()).filter(Boolean),
        method: joinMethod(k, (r.method ?? '').split(/\n+/), r.extra ?? ''),
        caution: r.caution,
      }),
    );
    if (r.source) setSource(r.source);
    setMode('write');
    setAiNote(r.source === 'สแกนตำรา' ? 'ใส่ข้อความที่ถอดจากตำราลงต้นฉบับแล้ว แก้ได้ แล้วกดให้ครูปัญญาจัดหน้า' : 'ใส่สิ่งที่คุณหมอเล่าลงต้นฉบับแล้ว แก้ได้ แล้วกดให้ครูปัญญาจัดหน้า');
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

  const canOrganize = draft.some((p) => p.trim().length > 10);

  const saveData = (o: Organized) => {
    const data = organizedToWisdom(kind, { ...o, title: o.title || title.trim() || 'ภูมิปัญญาไม่มีชื่อ' });
    const t = new Date();
    if (editing) updateWisdom(editing.id, data);
    else addWisdom({ ...data, id: `w${Date.now()}`, source, date: `${t.getDate()}/${t.getMonth() + 1}/${t.getFullYear() + 543}`, verified: false });
    h.success();
    router.back();
  };

  /** ให้ครูปัญญาจัดหน้าและเรียบเรียง */
  const organize = async () => {
    if (!canOrganize) return;
    h.press();
    setMode('organizing');
    try {
      const o = await organizeWisdom(kind, title, indication, draft);
      setOrg(o);
      setMode('review');
      h.success();
    } catch {
      setMode('write');
      h.warn();
      Alert.alert('จัดหน้าไม่สำเร็จ', 'เชื่อมต่อครูปัญญาไม่ได้ ลองใหม่อีกครั้ง หรือบันทึกตามต้นฉบับไปก่อนได้', [
        { text: 'ลองใหม่', onPress: organize },
        { text: 'บันทึกตามต้นฉบับ', onPress: () => saveData({ title: title.trim(), indication, pages: draft, ingredients: [], steps: [], extra: '', caution: '', origin: '' }) },
        { text: 'ยกเลิก', style: 'cancel' },
      ]);
    }
  };

  const header = (
    <Stack.Screen
      options={{
        title: mode === 'review' ? 'สรุปก่อนบันทึก' : editing ? 'แก้ไขภูมิปัญญา' : 'เพิ่มภูมิปัญญา',
        headerRight: () =>
          mode === 'review' ? null : (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label="เล่าให้ครูปัญญาบันทึก" onPress={() => router.push({ pathname: '/wisdom/voice', params: { kind } })}>
                <Sym name="mic.fill" size={20} color={palette.ink} weight="semibold" />
              </HeaderButton>
              <HeaderButton label="สแกนตำราโบราณ" onPress={() => router.push({ pathname: '/scan', params: { fill: '1' } })}>
                <Sym name="doc.viewfinder" size={20} color={palette.ink} weight="semibold" />
              </HeaderButton>
            </View>
          ),
      }}
    />
  );

  // ── หน้าสรุป: ผลที่ครูปัญญาจัดหน้าแล้ว ──
  if (mode === 'review' && org) {
    const preview = organizedToWisdom(kind, org);
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        {header}
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(250)} style={styles.note}>
            <Sym name="sparkles" size={14} color={palette.primary} />
            <T v="caption" color={palette.primary} style={{ flex: 1 }}>ครูปัญญาจัดหน้าและเรียบเรียงให้แล้ว ตรวจทานก่อนบันทึกนะครับ</T>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(380)} style={styles.reviewHead}>
            <BookCover w={{ ...preview, id: 'preview', source, date: '', verified: true } as Wisdom} width={104} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.kindPill}>
                <KindIcon kind={kind} size={13} color={palette.primaryDeep} />
                <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '700' }}>{kind}</T>
              </View>
              <T v="h2">{org.title}</T>
              {org.indication ? <T v="subhead" color={ios.secondary}>{cfg.indication.label} · {org.indication}</T> : null}
            </View>
          </Animated.View>

          <Section title={`${cfg.summary.big ? cfg.summary.label : 'เนื้อหา'} · ${org.pages.length} หน้า`} icon="book.pages.fill">
            {org.pages.map((p, i) => (
              <View key={i} style={styles.paper}>
                <T v="caption" color="rgba(58,44,28,0.55)" style={{ fontWeight: '700', marginBottom: 6 }}>หน้า {i + 1}</T>
                <T v="body" color="#3A2C1C" style={{ lineHeight: 27 }}>{p}</T>
              </View>
            ))}
          </Section>
          {org.ingredients.length && cfg.ingredients ? (
            <Section title={`${cfg.ingredients.label} · ${org.ingredients.length}`} icon="leaf.fill">
              {org.ingredients.map((x, i) => (
                <View key={i} style={styles.li}>
                  <View style={styles.liNum}>
                    <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '700' }}>{i + 1}</T>
                  </View>
                  <T v="body" style={{ flex: 1 }}>{x}</T>
                </View>
              ))}
            </Section>
          ) : null}
          {org.steps.length || org.extra ? (
            <Section title={cfg.method.label} icon="list.number">
              {org.steps.map((x, i) =>
                cfg.method.steps ? (
                  <View key={i} style={styles.li}>
                    <View style={[styles.liNum, styles.stepNum]}>
                      <T v="caption" color="#B26A12" style={{ fontWeight: '700' }}>{i + 1}</T>
                    </View>
                    <T v="body" style={{ flex: 1 }}>{x}</T>
                  </View>
                ) : (
                  <T key={i} v="body">{x}</T>
                ),
              )}
              {org.extra && cfg.extra ? (
                <View style={styles.extra}>
                  <T v="caption" color="#B26A12" style={{ fontWeight: '700' }}>{cfg.extra.label}</T>
                  <T v="body">{org.extra}</T>
                </View>
              ) : null}
            </Section>
          ) : null}
          {org.caution ? (
            <View style={styles.warn}>
              <Sym name="exclamationmark.triangle.fill" size={17} color={palette.coral} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="title" color={palette.coral}>{cfg.caution.label}</T>
                <T v="body">{org.caution}</T>
              </View>
            </View>
          ) : null}
          {org.origin ? (
            <View style={styles.originRow}>
              <Sym name="person.crop.circle" size={15} color={ios.secondary} />
              <T v="subhead" color={ios.secondary} style={{ flex: 1 }}>{cfg.origin.label}: {org.origin}</T>
            </View>
          ) : null}
        </ScrollView>
        <GlassDock>
          <Button kind="secondary" label="แก้ต้นฉบับ" icon={<Sym name="pencil" size={16} color={palette.primary} />} onPress={() => setMode('write')} style={{ flex: 1, height: 52 }} />
          <Button label={editing ? 'บันทึกการแก้ไข' : 'บันทึก'} icon={<Sym name="checkmark" size={17} color={palette.white} />} onPress={() => saveData(org)} style={{ flex: 1.3, height: 52 }} />
        </GlassDock>
      </View>
    );
  }

  // ── เขียนต้นฉบับ ──
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
      {header}
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {aiNote ? (
          <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} layout={SMOOTH} style={styles.note}>
            <Sym name="sparkles" size={14} color={palette.primary} />
            <T v="caption" color={palette.primary} style={{ flex: 1 }}>{aiNote}</T>
          </Animated.View>
        ) : null}

        <T v="subhead" color={ios.secondary} style={[styles.label, { marginBottom: -4 }]}>ประเภทภูมิปัญญา</T>
        <View style={styles.kinds}>
          {KINDS.map((k) => {
            const on = kind === k;
            return (
              <PressableScale key={k} haptic="select" scaleTo={0.97} onPress={() => setKind(k)} style={[styles.kind, elevation.e1, on && styles.kindOn]} accessibilityLabel={`${k} ${KIND_FORM[k].desc}`} accessibilityState={{ selected: on }}>
                <View style={[styles.kindIcon, on && { backgroundColor: palette.primary }]}>
                  <KindIcon kind={k} size={20} color={on ? palette.white : palette.primary} />
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
          <Field label={cfg.title.label} value={title} onChange={setTitle} placeholder={cfg.title.ph} />
          <Field label={cfg.indication.label} value={indication} onChange={setIndication} placeholder={cfg.indication.ph} />
        </Section>

        {/* เขียนตำรา: พื้นที่เดียว หลายหน้า */}
        <Section title="เขียนตำรา" icon="pencil.and.scribble" footer={WRITE_HINT[kind]} right={<T v="caption" color={ios.secondary}>{draft.length} หน้า</T>}>
          {draft.map((pg, i) => (
            <Animated.View key={i} layout={SMOOTH} entering={FadeIn.duration(200)} style={{ gap: 6 }}>
              <View style={styles.pageHead}>
                <View style={styles.pageTag}>
                  <Sym name="doc.plaintext" size={12} color={palette.primaryDeep} />
                  <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '700' }}>หน้า {i + 1}</T>
                </View>
                {draft.length > 1 ? (
                  <PressableScale haptic="select" onPress={() => setDraft((d) => d.filter((_, j) => j !== i))} hitSlop={6} accessibilityLabel={`ลบหน้า ${i + 1}`}>
                    <Sym name="minus.circle.fill" size={20} color={ios.tertiary} />
                  </PressableScale>
                ) : null}
              </View>
              <Field value={pg} onChange={setPage(i)} placeholder={i === 0 ? 'เริ่มเขียนได้เลย…' : `หน้า ${i + 1}`} big />
            </Animated.View>
          ))}
          <PressableScale haptic="select" scaleTo={0.97} onPress={() => setDraft((d) => [...d, ''])} style={styles.addRow} accessibilityLabel="เพิ่มหน้า">
            <Sym name="plus.circle.fill" size={18} color={palette.primary} />
            <T v="callout" color={palette.primary} style={{ fontWeight: '600' }}>เพิ่มหน้า</T>
          </PressableScale>
        </Section>
      </ScrollView>

      <GlassDock>
        <Button label="ให้ครูปัญญาจัดหน้า" icon={<Sym name="sparkles" size={18} color={palette.white} />} disabled={!canOrganize || mode === 'organizing'} onPress={organize} style={{ flex: 1, height: 52 }} />
      </GlassDock>

      {mode === 'organizing' ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.busy}>
          <View style={styles.busyCard}>
            <AISphere size={110} active />
            <T v="title" color={palette.white} center style={{ marginTop: 12 }}>ครูปัญญากำลังจัดหน้า</T>
            <T v="subhead" color="rgba(255,255,255,0.7)" center style={{ marginTop: 4 }}>แยกหัวข้อ เรียบเรียงคำ และแบ่งหน้าให้อ่านง่าย</T>
          </View>
        </Animated.View>
      ) : null}
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
  inputBig: { height: undefined, minHeight: 240, borderRadius: 18, paddingTop: 14, paddingBottom: 14, lineHeight: 26, textAlignVertical: 'top' },
  inputFocus: { backgroundColor: palette.surface, borderColor: palette.primary },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kind: { flexBasis: '47%', flexGrow: 1, padding: 14, gap: 4, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.surface, borderWidth: 2, borderColor: 'transparent' },
  kindOn: { borderColor: palette.primary, backgroundColor: palette.mint },
  kindIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  kindCheck: { position: 'absolute', top: 12, right: 12 },
  pageHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: palette.primarySoft },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: palette.primarySoft },
  busy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  busyCard: { alignItems: 'center', padding: 28, borderRadius: 28, borderCurve: 'continuous', backgroundColor: 'rgba(8,16,12,0.94)', marginHorizontal: 40 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4 },
  kindPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: palette.primarySoft },
  paper: { padding: 16, borderRadius: 12, backgroundColor: '#F7F0E0', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(120,90,40,0.25)' },
  li: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  liNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNum: { backgroundColor: '#FCEBD2' },
  extra: { padding: 12, borderRadius: 14, backgroundColor: '#FDF3E3', gap: 2 },
  warn: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.coralSoft },
  originRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 },
});

export default function NewWisdom() {
  return (
    <PractitionerGate>
      <NewWisdomInner />
    </PractitionerGate>
  );
}
