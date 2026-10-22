/**
 * การ์ด "แนวทางการรักษาจากครูปัญญา" (หน้าบันทึกการรักษา)
 * เลือกเส้นทาง แผนไทย / แผนปัจจุบัน (ยาสามัญประจำบ้าน + ส่งต่อ) · ทุกข้อมีป้ายบอกว่ามาจากตำราไหน แตะเปิดอ่านได้
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import type { Patient } from '../data/mock';
import { caseText, treatmentPlan, type PlanCase, type PlanItem, type TreatmentPlan } from '../lib/plan';
import { currentRole } from '../lib/roles';
import { Sym, ios } from './ios';
import { TextInput } from './AppText';
import { Button, PressableScale, Segmented, T, useHaptic } from './ui';
import { palette } from '../theme';
import { shortCite } from '../lib/sources';

/* โทนสี: สว่าง (หน้าบันทึกการรักษา) / มืด (ในแชทครูปัญญา) */
const LIGHT = { text: palette.ink, soft: palette.inkSoft, sub: ios.secondary, faint: ios.tertiary, accent: palette.primaryDeep, chip: palette.primarySoft, card: palette.mint, warnBg: '#FDF1DC', warnFg: '#7A4A00', nowBg: palette.coralSoft, soonBg: '#FDF1DC' };
const DARKC = { text: '#FFFFFF', soft: 'rgba(255,255,255,0.78)', sub: 'rgba(255,255,255,0.6)', faint: 'rgba(255,255,255,0.45)', accent: '#7CF0A8', chip: 'rgba(124,240,168,0.14)', card: 'rgba(255,255,255,0.07)', warnBg: 'rgba(217,146,26,0.22)', warnFg: '#FFD58A', nowBg: 'rgba(217,83,74,0.28)', soonBg: 'rgba(217,146,26,0.22)' };
export const PlanDark = React.createContext(false);
const useC = () => (React.useContext(PlanDark) ? DARKC : LIGHT);

type Track = 'thai' | 'modern';
const SMOOTH = LinearTransition.duration(220);
const REFER = {
  now: { bg: palette.coralSoft, fg: palette.coral, icon: 'exclamationmark.triangle.fill', title: 'ควรไปโรงพยาบาลทันที' },
  soon: { bg: '#FDF1DC', fg: '#B86E00', icon: 'stethoscope', title: 'ควรพบแพทย์ภายใน 1-3 วัน' },
} as const;

export function RefChips({ refs }: { refs: { id: string; label: string }[] }) {
  const C = useC();
  if (!refs.length) return null;
  // ป้ายชื่อเดียวกันแสดงครั้งเดียว · ชื่อเล่มย่อให้อ่านจบในป้าย
  const uniq = [...new Map(refs.map((r) => [shortCite(r.label), { ...r, label: shortCite(r.label) }])).values()];
  return (
    <View style={styles.refs}>
      {uniq.map((r) => (
        <PressableScale key={r.id} haptic="select" scaleTo={0.95} onPress={() => router.push({ pathname: '/source', params: { id: r.id } })} style={[styles.ref, { backgroundColor: C.chip }]} accessibilityLabel={`อ่านแหล่งอ้างอิง ${r.label}`}>
          <Sym name="book.closed.fill" size={10} color={C.accent} />
          <T v="micro" color={C.accent} numberOfLines={1} style={{ fontWeight: '600', maxWidth: 230 }}>{r.label}</T>
        </PressableScale>
      ))}
    </View>
  );
}

function Items({ list, empty }: { list: PlanItem[]; empty?: string }) {
  const C = useC();
  if (!list.length) return empty ? <T v="caption" color={C.sub}>{empty}</T> : null;
  return (
    <View style={{ gap: 10 }}>
      {list.map((x, i) => (
        <View key={i} style={{ gap: 4 }}>
          <T v="body" color={C.text}>• {x.text}</T>
          <RefChips refs={x.refs} />
        </View>
      ))}
    </View>
  );
}

/** คำถามซักประวัติเพิ่ม: แตะตอบได้ แล้วให้ครูปัญญาปรับแนวทางตามคำตอบ */
function AskMore({ ask, onRefine, busy }: { ask: string[]; onRefine?: (qa: { q: string; a: string }[]) => void; busy?: boolean }) {
  const C = useC();
  const [ans, setAns] = useState<Record<number, string>>({});
  const [open, setOpen] = useState<number | null>(null);
  const answered = ask.map((q, i) => ({ q, a: (ans[i] ?? '').trim() })).filter((x) => x.a);
  return (
    <View style={{ gap: 6 }}>
      <T v="micro" color={C.sub} style={styles.cap}>ซักประวัติเพิ่ม{onRefine ? ' · แตะเพื่อตอบ' : ''}</T>
      {ask.map((q, i) => (
        <View key={i} style={{ gap: 6 }}>
          <PressableScale haptic="select" scaleTo={0.99} disabled={!onRefine} onPress={() => setOpen(open === i ? null : i)} style={styles.askRow} accessibilityLabel={`ตอบคำถาม ${q}`}>
            <Sym name={ans[i]?.trim() ? 'checkmark.circle.fill' : 'questionmark.circle'} size={15} color={ans[i]?.trim() ? palette.primary : ios.secondary} />
            <View style={{ flex: 1 }}>
              <T v="caption" color={C.text}>{q}</T>
              {ans[i]?.trim() && open !== i ? <T v="caption" color={C.accent} style={{ fontWeight: '600' }}>{ans[i]}</T> : null}
            </View>
          </PressableScale>
          {open === i ? (
            <TextInput
              autoFocus
              value={ans[i] ?? ''}
              onChangeText={(t) => setAns((o) => ({ ...o, [i]: t }))}
              onSubmitEditing={() => setOpen(null)}
              returnKeyType="done"
              placeholder="พิมพ์คำตอบ"
              placeholderTextColor={ios.tertiary}
              style={styles.askInput}
              accessibilityLabel={`คำตอบ ${q}`}
            />
          ) : null}
        </View>
      ))}
      {onRefine && answered.length ? (
        <Button kind="secondary" label={busy ? 'ครูปัญญากำลังปรับแนวทาง…' : `ปรับแนวทางตามคำตอบ (${answered.length})`} icon={busy ? <ActivityIndicator color={palette.primary} /> : <Sym name="arrow.triangle.2.circlepath" size={15} color={palette.primary} weight="semibold" />} disabled={busy} onPress={() => onRefine(answered)} style={{ height: 44 }} />
      ) : null}
    </View>
  );
}

/** ผลแนวทางการรักษา (ใช้ทั้งหน้าบันทึกการรักษาและหน้าปรึกษาอาการ) */
export function PlanResult({
  plan,
  busy,
  stale,
  onAgain,
  onRefine,
  onUse,
  useLabel = 'ใช้แนวทางนี้',
}: {
  plan: TreatmentPlan;
  busy?: boolean;
  stale?: boolean;
  onAgain?: () => void;
  onRefine?: (qa: { q: string; a: string }[]) => void;
  onUse?: (track: Track) => void;
  useLabel?: string;
}) {
  const C = useC();
  const [track, setTrack] = useState<Track>(currentRole() === 'modern_medicine' ? 'modern' : 'thai');
  const rf = plan.refer.level !== 'none' ? REFER[plan.refer.level] : null;
  const list = track === 'thai' ? plan.thai : plan.modern;
  return (
    <Animated.View entering={FadeIn.duration(220)} layout={SMOOTH} style={[styles.card, { backgroundColor: C.card }]}>
      <View style={styles.head}>
        <Sym name="sparkles" size={14} color={palette.primary} />
        <T v="subhead" color={C.accent} style={{ fontWeight: '700', flex: 1 }}>แนวทางจากครูปัญญา</T>
        {onAgain ? (
          <PressableScale haptic="select" onPress={onAgain} hitSlop={10} accessibilityLabel="ถามครูปัญญาใหม่" style={styles.again}>
            {busy ? <ActivityIndicator size="small" color={palette.primary} /> : <Sym name="arrow.clockwise" size={14} color={palette.primary} weight="semibold" />}
            <T v="caption" color={palette.primary} style={{ fontWeight: '600' }}>{stale ? 'อาการเปลี่ยน ถามใหม่' : 'ถามใหม่'}</T>
          </PressableScale>
        ) : null}
      </View>

      {rf ? (
        <View style={[styles.banner, { backgroundColor: plan.refer.level === 'now' ? C.nowBg : C.soonBg }]}>
          <Sym name={rf.icon} size={15} color={rf.fg} />
          <View style={{ flex: 1 }}>
            <T v="subhead" color={rf.fg} style={{ fontWeight: '700' }}>{rf.title}</T>
            {plan.refer.reason ? <T v="caption" color={C.soft}>{plan.refer.reason}</T> : null}
          </View>
        </View>
      ) : null}
      {plan.warnings.length ? (
        <View style={[styles.banner, { backgroundColor: C.warnBg }]}>
          <Sym name="exclamationmark.shield.fill" size={15} color="#B86E00" />
          <View style={{ flex: 1, gap: 2 }}>
            {plan.warnings.slice(0, 4).map((w, i) => (
              <T key={i} v="caption" color={C.warnFg}>• {w}</T>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 2 }}>
        <T v="micro" color={C.sub} style={styles.cap}>ภาวะที่น่าจะเป็น</T>
        {plan.thaiDx ? <T v="body" color={C.text}><T v="body" style={{ fontWeight: '700' }}>แผนไทย </T>{plan.thaiDx}</T> : null}
        {plan.modernDx ? <T v="body" color={C.text}><T v="body" style={{ fontWeight: '700' }}>แผนปัจจุบัน </T>{plan.modernDx}</T> : null}
        {plan.reason ? <T v="caption" color={C.soft}>{plan.reason}</T> : null}
      </View>

      {plan.ask.length ? <AskMore key={plan.ask.join('|')} ask={plan.ask} onRefine={onRefine} busy={busy} /> : null}

      <Segmented items={[{ key: 'thai', label: 'แผนไทย' }, { key: 'modern', label: 'แผนปัจจุบัน' }]} value={track} onChange={setTrack} />
      <Animated.View key={track} entering={FadeIn.duration(180)} style={{ gap: 8 }}>
        <Items list={list} empty={track === 'thai' ? 'ไม่พบแนวทางแผนไทยที่อ้างอิงคลังความรู้ได้สำหรับอาการนี้' : 'ไม่มียาสามัญประจำบ้านที่ตรงกับอาการนี้ ควรให้แพทย์ตรวจ'} />
        {track === 'modern' ? <T v="micro" color={C.faint}>เฉพาะยาสามัญประจำบ้านตามประกาศกระทรวงสาธารณสุข · ยาอื่นต้องให้แพทย์หรือเภสัชกรสั่ง</T> : null}
      </Animated.View>

      {plan.care.length ? (
        <View style={{ gap: 6 }}>
          <T v="micro" color={C.sub} style={styles.cap}>การปฏิบัติตัว</T>
          <Items list={plan.care} />
        </View>
      ) : null}
      {plan.followUp ? (
        <View style={{ gap: 2 }}>
          <T v="micro" color={C.sub} style={styles.cap}>ติดตามอาการ</T>
          <T v="caption" color={C.text}>{plan.followUp}</T>
        </View>
      ) : null}

      {onUse ? <Button label={useLabel} icon={<Sym name="checkmark" size={15} color="#FFFFFF" weight="bold" />} disabled={!list.length && track === 'thai'} onPress={() => onUse(track)} style={{ height: 46 }} /> : null}
      <T v="micro" color={C.faint} center>ข้อเสนอจาก AI ใช้ประกอบการตัดสินใจ ไม่แทนการตรวจวินิจฉัยของแพทย์</T>
    </Animated.View>
  );
}

export function PlanCard({ patient, input, onUse }: { patient: Patient; input: PlanCase; onUse: (p: TreatmentPlan, track: Track) => void }) {
  const C = useC();
  const h = useHaptic();
  const [plan, setPlan] = useState<TreatmentPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [asked, setAsked] = useState('');
  const [qa, setQa] = useState<{ q: string; a: string }[]>([]);
  const ready = !!input.symptoms.trim() || !!input.diagnosis?.trim();
  const stale = !!plan && asked !== caseText(input);

  const run = async (answers = qa) => {
    setBusy(true);
    setErr('');
    try {
      const p = await treatmentPlan(patient, { ...input, answers });
      setPlan(p);
      setAsked(caseText(input));
      h.success();
    } catch {
      setErr('ครูปัญญาตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  };
  // ตอบคำถามซักประวัติ → สะสมคำตอบแล้วถามใหม่
  const refine = (more: { q: string; a: string }[]) => {
    const all = [...qa.filter((x) => !more.some((m) => m.q === x.q)), ...more];
    setQa(all);
    run(all);
  };

  if (!plan)
    return (
      <View style={{ gap: 8 }}>
        <Button
          kind="secondary"
          label={busy ? 'ครูปัญญากำลังค้นคลังความรู้…' : 'ให้ครูปัญญาเสนอแนวทางรักษา'}
          icon={busy ? <ActivityIndicator color={palette.primary} /> : <Sym name="sparkles" size={16} color={palette.primary} weight="semibold" />}
          disabled={!ready || busy}
          onPress={() => run()}
          style={styles.ask}
        />
        <T v="caption" color={err ? palette.coral : ios.tertiary} style={{ marginLeft: 4 }}>
          {err || (ready ? 'แผนไทยหรือแผนปัจจุบัน (ยาสามัญประจำบ้าน) พร้อมบอกแหล่งอ้างอิงทุกข้อ' : 'กรอกอาการหรือการวินิจฉัยก่อน')}
        </T>
      </View>
    );

  return (
    <View style={{ gap: 6 }}>
      <PlanResult plan={plan} busy={busy} stale={stale} onAgain={() => run()} onRefine={refine} onUse={(track) => onUse(plan, track)} />
      {err ? <T v="caption" color={palette.coral} style={{ marginLeft: 4 }}>{err}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ask: { height: 48, borderWidth: 1.5, borderColor: palette.primarySoft },
  card: { gap: 14, padding: 14, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.mint },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  again: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 14 },
  cap: { fontWeight: '700', letterSpacing: 0.3 },
  askRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 4 },
  askInput: { height: 44, borderRadius: 22, paddingHorizontal: 16, backgroundColor: palette.surface, fontSize: 16, color: palette.ink, borderWidth: 1.5, borderColor: palette.primary, marginLeft: 21 },
  refs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 12 },
  ref: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: palette.primarySoft },
});
