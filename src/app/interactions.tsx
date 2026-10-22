/**
 * ตรวจยาตีกัน — เลือกสมุนไพร + ผู้ป่วย/ภาวะ/ยาที่กินอยู่ → บอกข้อห้ามและข้อควรระวังทันที
 * ใช้ข้อมูลในแอปล้วน (คลังสมุนไพร + ความรู้เภสัชกรรมไทย) ไม่ต้องใช้เซิร์ฟเวอร์ AI · ใช้ได้แม้ไม่มีเน็ต
 * ยาแผนปัจจุบันที่ตีกัน: จากหัวข้ออันตรกิริยาในบัญชียาหลักแห่งชาติด้านสมุนไพร 2566 · ทุกข้อแตะเปิดแหล่งอ้างอิงได้
 * ครูปัญญาวิเคราะห์: สรุปความเสี่ยงรวม คำแนะนำทีละสมุนไพร และทางเลือกที่ปลอดภัยกว่า (ใช้ผลตรวจในเครื่องเป็นข้อเท็จจริง)
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { TextInput } from '../components/AppText';
import { Dropdown } from '../components/FormPickers';
import { Sym, ios } from '../components/ios';
import { Button, PressableScale, T } from '../components/ui';
import { herbs, type Herb } from '../data/herbs';
import { herbsMentioned, pharmacyFor } from '../lib/brain';
import { allergyHits, drugInteractions, herbConflicts, riskGroups } from '../lib/safety';
import type { DrugClass } from '../data/interactions';
import { THP } from '../data/thp';
import { RefChips } from '../components/PlanCard';
import { citeLabel, docById, herbDocId, ixDocId } from '../lib/sources';
import { interactionAdvice, type InteractionAdvice, type RiskLevel } from '../lib/interactAI';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';
import { column } from '../components/layout';

const CONDS = [
  { label: 'ตั้งครรภ์/ให้นมบุตร', key: 'ตั้งครรภ์' },
  { label: 'เด็ก', key: 'เด็ก' },
  { label: 'โรคตับ', key: 'โรคตับ' },
  { label: 'โรคไต', key: 'โรคไต' },
  { label: 'โรคหัวใจ', key: 'โรคหัวใจ' },
  { label: 'เบาหวาน', key: 'เบาหวาน' },
  { label: 'ความดันสูง', key: 'ความดันสูง' },
  { label: 'ยาละลายลิ่มเลือด', key: 'วาร์ฟาริน' },
  { label: 'แผลในกระเพาะ', key: 'แผลในกระเพาะ' },
  { label: 'นิ่วในถุงน้ำดี', key: 'นิ่วในถุงน้ำดี' },
  { label: 'กำลังมีไข้', key: 'มีไข้' },
];
const NONE = 'ไม่เลือกผู้ป่วย';
const RISK: Record<RiskLevel, { label: string; color: string; bg: string; icon: any }> = {
  avoid: { label: 'ไม่ควรใช้', color: '#D2453A', bg: '#FCE8E6', icon: 'xmark.octagon.fill' },
  caution: { label: 'ใช้ได้แต่ต้องระวัง', color: '#B86E00', bg: '#FDF1DC', icon: 'exclamationmark.triangle.fill' },
  ok: { label: 'ไม่พบปัญหาจากข้อมูลในคลัง', color: '#14905C', bg: '#E3F2EA', icon: 'checkmark.circle.fill' },
};
/** ภาวะที่เลือก → กลุ่มยาที่ผู้ป่วยน่าจะใช้อยู่ (ใช้เน้นข้อยาตีกัน) */
const COND_DRUGS: Record<string, DrugClass[]> = { เบาหวาน: ['dm', 'dm_lipid'], ความดันสูง: ['bp'], วาร์ฟาริน: ['blood'] };
const ref = (id: string) => {
  const d = docById(id);
  return d ? [{ id: d.id, label: citeLabel(d) }] : [];
};

export default function Interactions() {
  const { pid, herb: herbParam } = useLocalSearchParams<{ pid?: string; herb?: string }>();
  const { patients } = useApp();
  const [who, setWho] = useState(patients.find((p) => p.id === pid)?.name ?? NONE);
  const p = patients.find((x) => x.name === who);
  const [picked, setPicked] = useState<Herb[]>(() => (herbParam ? herbs.filter((h) => h.id === herbParam || h.name === herbParam) : []));
  const [q, setQ] = useState('');
  const [conds, setConds] = useState<string[]>([]);
  const [meds, setMeds] = useState('');

  const suggest = useMemo(() => {
    const s = q.trim();
    if (!s) return [];
    const byName = herbs.filter((h) => !picked.includes(h) && (h.name.includes(s) || h.local.includes(s)));
    return [...new Set([...byName, ...herbsMentioned(s).filter((h) => !picked.includes(h))])].slice(0, 8);
  }, [q, picked]);

  // ภาวะของผู้ป่วย = ที่เลือก + โรคประจำตัว/ยาที่ใช้ของผู้ป่วยที่เลือก + ยาที่พิมพ์
  const ctx = p ? { age: p.age, chronic: p.chronic, meds: p.meds, allergies: p.allergies } : null;
  const text = `${conds.join(' ')} ${meds}`;
  const groups = riskGroups(text, ctx);
  const conflicts = herbConflicts(picked, groups);
  const allergic = allergyHits(picked, p?.allergies);
  const docs = picked.length ? pharmacyFor(`${picked.map((h) => h.name).join(' ')} ${groups.map((g) => g.label).join(' ')} ยาตีกัน ข้อควรระวัง`, 3) : [];
  const drugText = `${meds} ${(p?.meds ?? []).join(' ')}`;
  const drugPicked = conds.flatMap((c) => COND_DRUGS[c] ?? []);
  const hitsMap = new Map(picked.map((h) => [h.id, drugInteractions(h, drugText, drugPicked, !!p?.meds?.length)]));
  // ครูปัญญาวิเคราะห์ (ผลเดิมจะบอกว่าข้อมูลเปลี่ยนแล้วเมื่อแก้สมุนไพร/ผู้ป่วย/ยา)
  const aiKey = JSON.stringify([picked.map((h) => h.id), who, conds, meds.trim()]);
  const [ai, setAi] = useState<{ key: string; r: InteractionAdvice } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const runAi = async () => {
    if (aiBusy || !picked.length) return;
    setAiBusy(true);
    setAiErr('');
    try {
      const r = await interactionAdvice({ herbs: picked, patient: p ? { name: p.name, age: p.age, sex: p.sex, chronic: p.chronic, allergies: p.allergies, meds: p.meds } : null, conditions: CONDS.filter((c) => conds.includes(c.key)).map((c) => c.label), medsText: meds, conflicts, allergic, drugHits: hitsMap });
      setAi({ key: aiKey, r });
    } catch {
      setAiErr('ครูปัญญาตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง');
    } finally {
      setAiBusy(false);
    }
  };
  const toggle = (k: string) => setConds((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  const ask = () =>
    router.push({
      pathname: '/assistant',
      params: { q: `${p ? `ผู้ป่วย ${p.name} ` : ''}${groups.length ? `(${groups.map((g) => g.label).join(', ')}) ` : ''}${meds.trim() ? `กินยา ${meds.trim()} ` : ''}ใช้ ${picked.map((h) => h.name).join(' ร่วมกับ ')} ได้ไหม ต้องระวังอะไรบ้าง` },
    });

  return (
    <>
      <Stack.Screen options={{ title: 'ตรวจยาตีกัน' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.page, column.read]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <View style={[styles.card, elevation.e1]}>
            <T v="bodyStrong">1. สมุนไพรที่จะใช้</T>
            <TextInput value={q} onChangeText={setQ} placeholder="พิมพ์ชื่อสมุนไพร เช่น ขมิ้นชัน" placeholderTextColor={ios.tertiary} style={styles.input} accessibilityLabel="ค้นหาสมุนไพร" />
            {suggest.length ? (
              <View style={styles.chips}>
                {suggest.map((h) => (
                  <PressableScale key={h.id} haptic="select" scaleTo={0.95} onPress={() => (setPicked((x) => [...x, h]), setQ(''))} style={[styles.chip, { height: 36 }]} accessibilityLabel={`เลือก ${h.name}`}>
                    <T v="subhead" style={{ fontWeight: '600' }}>+ {h.name}</T>
                  </PressableScale>
                ))}
              </View>
            ) : null}
            {picked.length ? (
              <View style={styles.chips}>
                {picked.map((h) => (
                  <PressableScale key={h.id} haptic="select" onPress={() => setPicked((x) => x.filter((y) => y !== h))} style={[styles.chip, styles.chipOn]} accessibilityLabel={`เอา ${h.name} ออก`}>
                    <T v="subhead" color="#FFFFFF" style={{ fontWeight: '600' }}>{h.name}</T>
                    <Sym name="xmark" size={11} color="#FFFFFF" weight="bold" />
                  </PressableScale>
                ))}
              </View>
            ) : null}
          </View>

          <View style={[styles.card, elevation.e1]}>
            <T v="bodyStrong">2. ผู้ป่วยและยาที่กินอยู่</T>
            <Dropdown label="ผู้ป่วย (ถ้ามี จะดึงโรคประจำตัว ยา และประวัติแพ้ยามาตรวจด้วย)" value={who} options={[NONE, ...patients.map((x) => x.name)]} onChange={setWho} />
            {p ? (
              <T v="caption" color={ios.secondary} style={{ marginLeft: 4 }}>
                {p.age} ปี · โรคประจำตัว: {p.chronic || '-'} · ยา: {p.meds.length ? p.meds.join(', ') : '-'} · แพ้: {p.allergies || '-'}
              </T>
            ) : null}
            <View style={styles.chips}>
              {CONDS.map((c) => {
                const on = conds.includes(c.key);
                return (
                  <PressableScale key={c.key} haptic="select" scaleTo={0.95} onPress={() => toggle(c.key)} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: on }}>
                    <T v="subhead" color={on ? '#FFFFFF' : palette.ink} style={{ fontWeight: '600' }}>{c.label}</T>
                  </PressableScale>
                );
              })}
            </View>
            <TextInput value={meds} onChangeText={setMeds} placeholder="ยาที่กินอยู่ เช่น แอสไพริน เมทฟอร์มิน" placeholderTextColor={ios.tertiary} style={styles.input} accessibilityLabel="ยาที่กินอยู่" />
          </View>

          {/* ── ผลตรวจ ── */}
          {picked.length ? (
            <Animated.View entering={FadeIn} layout={LinearTransition.duration(220)} style={{ gap: 10 }}>
              <T v="h3" style={{ marginLeft: 4 }}>ผลการตรวจ</T>
              {allergic.length ? (
                <View style={[styles.result, { backgroundColor: '#FCE8E6' }]}>
                  <Sym name="xmark.octagon.fill" size={20} color="#D2453A" />
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong" color="#D2453A">ห้ามใช้: ผู้ป่วยแพ้ {allergic.map((h) => h.name).join(', ')}</T>
                    <T v="caption" color={palette.inkSoft}>จากประวัติแพ้ยา/อาหารของผู้ป่วย</T>
                  </View>
                </View>
              ) : null}
              {picked.map((h) => {
                const cs = conflicts.filter((c) => c.herb.id === h.id);
                const ixs = hitsMap.get(h.id) ?? [];
                const bad = cs.length || allergic.includes(h) || ixs.some((x) => x.hit);
                return (
                  <View key={h.id} style={[styles.result, elevation.e1, { backgroundColor: palette.surface }]}>
                    <Sym name={bad ? 'exclamationmark.triangle.fill' : 'checkmark.circle.fill'} size={20} color={bad ? '#D2453A' : '#14905C'} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <T v="bodyStrong">{h.name}</T>
                        {THP[h.id] ? <View style={styles.thp}><Sym name="checkmark.seal.fill" size={11} color="#0E7C86" /><T v="micro" color="#0E7C86" style={{ fontWeight: '700' }}>มีในตำรามาตรฐานยาสมุนไพรไทย</T></View> : null}
                      </View>
                      {cs.length ? (
                        cs.map((c) => (
                          <T key={c.group} v="subhead" color="#D2453A">⚠ {c.group}: {c.caution}</T>
                        ))
                      ) : (
                        <T v="subhead" color="#14905C">{groups.length || p ? 'ไม่พบข้อห้ามที่ตรงกับผู้ป่วย' : 'ยังไม่ได้เลือกภาวะของผู้ป่วย'}</T>
                      )}
                      {!cs.length ? <T v="caption" color={ios.secondary}>ข้อควรระวังทั่วไป: {h.caution}</T> : null}
                      {ixs.length ? (
                        <View style={styles.ix}>
                          <T v="caption" color={ios.secondary} style={{ fontWeight: '700' }}>ยาแผนปัจจุบันที่ต้องระวังเมื่อใช้ร่วมกัน</T>
                          {ixs.map(({ it, hit }) => (
                            <View key={it.drug} style={{ gap: 3 }}>
                              <T v="subhead" color={hit ? '#D2453A' : palette.ink} style={{ fontWeight: hit ? '700' : '400' }}>
                                {hit ? '⚠ ' : '• '}{it.label}{hit ? ' (ตรงกับยาของผู้ป่วย)' : ''}
                              </T>
                              <T v="caption" color={palette.inkSoft}>{it.formula ? `ในตำรับ${it.products.join(', ')}: ` : ''}{it.statement}</T>
                              <RefChips refs={ref(ixDocId(it))} />
                            </View>
                          ))}
                        </View>
                      ) : (
                        <T v="caption" color={ios.tertiary}>ไม่พบข้อมูลยาตีกันในบัญชียาหลักแห่งชาติด้านสมุนไพร 2566</T>
                      )}
                      <RefChips refs={ref(herbDocId(h))} />
                    </View>
                  </View>
                );
              })}
              {picked.length >= 2 ? <T v="caption" color={ios.secondary} style={{ marginHorizontal: 4 }}>ใช้สมุนไพร {picked.length} ชนิดร่วมกัน: ตรวจข้อควรระวังของทุกตัวด้านบนรวมกัน และระวังรสยาที่ขัดกัน (เช่น ยารสร้อนในผู้ที่มีไข้)</T> : null}
              {docs.length ? (
                <View style={[styles.card, elevation.e1, { gap: 6 }]}>
                  <T v="subhead" color={ios.secondary} style={{ fontWeight: '700' }}>อ่านเพิ่มจากความรู้เภสัชกรรมไทย</T>
                  {docs.map((d) => (
                    <PressableScale key={d.id} haptic="select" onPress={() => router.push({ pathname: '/source', params: { id: d.id } })} style={{ paddingVertical: 6 }} accessibilityLabel={d.title}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Sym name="book.closed.fill" size={14} color={palette.primary} />
                        <T v="subhead" style={{ flex: 1, fontWeight: '600' }}>{d.title}</T>
                        <Sym name="chevron.right" size={12} color={ios.tertiary} />
                      </View>
                    </PressableScale>
                  ))}
                </View>
              ) : null}
              {/* ── ครูปัญญาวิเคราะห์และแนะนำ ── */}
              {ai ? (
                <Animated.View entering={FadeIn.duration(220)} style={[styles.card, elevation.e1, { gap: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Sym name="sparkles" size={14} color={palette.primary} />
                    <T v="subhead" color={palette.primaryDeep} style={{ fontWeight: '700', flex: 1 }}>ครูปัญญาวิเคราะห์</T>
                    <PressableScale haptic="select" onPress={runAi} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }} accessibilityLabel="ให้ครูปัญญาวิเคราะห์ใหม่">
                      {aiBusy ? <ActivityIndicator size="small" color={palette.primary} /> : <Sym name="arrow.clockwise" size={13} color={palette.primary} weight="semibold" />}
                      <T v="caption" color={palette.primary} style={{ fontWeight: '600' }}>{ai.key !== aiKey ? 'ข้อมูลเปลี่ยน วิเคราะห์ใหม่' : 'วิเคราะห์ใหม่'}</T>
                    </PressableScale>
                  </View>
                  <View style={[styles.result, { backgroundColor: RISK[ai.r.level].bg, padding: 12 }]}>
                    <Sym name={RISK[ai.r.level].icon} size={18} color={RISK[ai.r.level].color} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="bodyStrong" color={RISK[ai.r.level].color}>{RISK[ai.r.level].label}</T>
                      {ai.r.summary ? <T v="caption" color={palette.inkSoft}>{ai.r.summary}</T> : null}
                    </View>
                  </View>
                  {ai.r.herbs.map((x) => (
                    <View key={x.herb} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Sym name={RISK[x.level].icon} size={13} color={RISK[x.level].color} />
                        <T v="subhead" style={{ fontWeight: '700' }}>{x.herb}</T>
                        <T v="caption" color={RISK[x.level].color}>{RISK[x.level].label}</T>
                      </View>
                      {x.text ? <T v="subhead" color={palette.ink}>{x.text}</T> : null}
                      <RefChips refs={x.refs} />
                    </View>
                  ))}
                  {ai.r.alternatives.length ? (
                    <View style={{ gap: 6 }}>
                      <T v="micro" color={ios.secondary} style={{ fontWeight: '700' }}>ทางเลือกที่ปลอดภัยกว่า</T>
                      {ai.r.alternatives.map((x, i) => (
                        <View key={i} style={{ gap: 3 }}>
                          <T v="subhead">• {x.text}</T>
                          <RefChips refs={x.refs} />
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {ai.r.ask.length ? (
                    <View style={{ gap: 2 }}>
                      <T v="micro" color={ios.secondary} style={{ fontWeight: '700' }}>ควรถามผู้ป่วยเพิ่ม</T>
                      {ai.r.ask.map((q2, i) => (
                        <T key={i} v="caption" color={palette.ink}>• {q2}</T>
                      ))}
                    </View>
                  ) : null}
                  {ai.r.seeDoctor ? (
                    <View style={{ gap: 2 }}>
                      <T v="micro" color={ios.secondary} style={{ fontWeight: '700' }}>ปรึกษาแพทย์หรือเภสัชกรเมื่อ</T>
                      <T v="caption" color={palette.ink}>{ai.r.seeDoctor}</T>
                    </View>
                  ) : null}
                  <T v="micro" color={ios.tertiary}>ข้อเสนอจาก AI อ้างอิงคลังความรู้ในแอป ใช้ประกอบการตัดสินใจ ไม่แทนคำแนะนำของแพทย์หรือเภสัชกร</T>
                </Animated.View>
              ) : (
                <View style={{ gap: 6 }}>
                  <Button label={aiBusy ? 'ครูปัญญากำลังวิเคราะห์…' : 'ให้ครูปัญญาวิเคราะห์และแนะนำ'} icon={aiBusy ? <ActivityIndicator color="#FFFFFF" /> : <Sym name="sparkles" size={16} color="#FFFFFF" />} disabled={aiBusy} onPress={runAi} style={{ height: 50 }} />
                  {aiErr ? <T v="caption" color={palette.coral} style={{ marginLeft: 4 }}>{aiErr}</T> : <T v="caption" color={ios.tertiary} style={{ marginLeft: 4 }}>สรุปความเสี่ยง วิธีใช้ให้ปลอดภัย และสมุนไพรทางเลือก พร้อมแหล่งอ้างอิง</T>}
                </View>
              )}
              <Button label="ถามครูปัญญาต่อ" icon={<Sym name="bubble.left.and.text.bubble.right.fill" size={16} color={palette.primary} />} kind="secondary" onPress={ask} style={{ height: 50 }} />
              <T v="caption" color={ios.tertiary} style={{ marginHorizontal: 4 }}>ตรวจจากข้อควรระวังในคลังสมุนไพรของแอป และหัวข้ออันตรกิริยาในบัญชียาหลักแห่งชาติด้านสมุนไพร 2566 (ประกาศไม่ได้จัดระดับความรุนแรง) ใช้ประกอบการตัดสินใจ ไม่แทนคำแนะนำของแพทย์หรือเภสัชกร</T>
            </Animated.View>
          ) : (
            <T v="subhead" color={ios.tertiary} center style={{ marginTop: 8 }}>เลือกสมุนไพรอย่างน้อย 1 ชนิดเพื่อตรวจ</T>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 60, gap: 14 },
  card: { padding: 16, borderRadius: 22, backgroundColor: palette.surface, gap: 12 },
  input: { height: 50, borderRadius: 25, paddingHorizontal: 18, backgroundColor: palette.mint, fontSize: 17, color: palette.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: palette.mint },
  chipOn: { backgroundColor: palette.primary },
  ix: { gap: 8, marginTop: 4, padding: 10, borderRadius: 14, backgroundColor: palette.mint },
  thp: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, height: 20, borderRadius: 10, backgroundColor: '#E0F2F3' },
  result: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 20 },
});
