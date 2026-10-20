/**
 * ตรวจยาตีกัน — เลือกสมุนไพร + ผู้ป่วย/ภาวะ/ยาที่กินอยู่ → บอกข้อห้ามและข้อควรระวังทันที
 * ใช้ข้อมูลในแอปล้วน (คลังสมุนไพร + ความรู้เภสัชกรรมไทย) ไม่ต้องใช้เซิร์ฟเวอร์ AI · ใช้ได้แม้ไม่มีเน็ต
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { TextInput } from '../components/AppText';
import { Dropdown } from '../components/FormPickers';
import { Sym, ios } from '../components/ios';
import { Button, PressableScale, T } from '../components/ui';
import { herbs, type Herb } from '../data/herbs';
import { herbsMentioned, pharmacyFor } from '../lib/brain';
import { allergyHits, herbConflicts, riskGroups } from '../lib/safety';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';

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

export default function Interactions() {
  const { pid, herb: herbParam } = useLocalSearchParams<{ pid?: string; herb?: string }>();
  const { patients } = useApp();
  const [who, setWho] = useState(patients.find((p) => p.id === pid)?.name ?? NONE);
  const p = patients.find((x) => x.name === who);
  const [picked, setPicked] = useState<Herb[]>(() => (herbParam ? herbs.filter((h) => h.id === herbParam || h.name === herbParam) : []));
  const [q, setQ] = useState('');
  const [conds, setConds] = useState<string[]>([]);
  const [meds, setMeds] = useState('');
  const [openDoc, setOpenDoc] = useState<string | null>(null);

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
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
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
                const bad = cs.length || allergic.includes(h);
                return (
                  <View key={h.id} style={[styles.result, elevation.e1, { backgroundColor: palette.surface }]}>
                    <Sym name={bad ? 'exclamationmark.triangle.fill' : 'checkmark.circle.fill'} size={20} color={bad ? '#D2453A' : '#14905C'} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <T v="bodyStrong">{h.name}</T>
                      {cs.length ? (
                        cs.map((c) => (
                          <T key={c.group} v="subhead" color="#D2453A">⚠ {c.group}: {c.caution}</T>
                        ))
                      ) : (
                        <T v="subhead" color="#14905C">{groups.length || p ? 'ไม่พบข้อห้ามที่ตรงกับผู้ป่วย' : 'ยังไม่ได้เลือกภาวะของผู้ป่วย'}</T>
                      )}
                      {!cs.length ? <T v="caption" color={ios.secondary}>ข้อควรระวังทั่วไป: {h.caution}</T> : null}
                    </View>
                  </View>
                );
              })}
              {picked.length >= 2 ? <T v="caption" color={ios.secondary} style={{ marginHorizontal: 4 }}>ใช้สมุนไพร {picked.length} ชนิดร่วมกัน: ตรวจข้อควรระวังของทุกตัวด้านบนรวมกัน และระวังรสยาที่ขัดกัน (เช่น ยารสร้อนในผู้ที่มีไข้)</T> : null}
              {docs.length ? (
                <View style={[styles.card, elevation.e1, { gap: 6 }]}>
                  <T v="subhead" color={ios.secondary} style={{ fontWeight: '700' }}>อ่านเพิ่มจากความรู้เภสัชกรรมไทย</T>
                  {docs.map((d) => (
                    <PressableScale key={d.id} haptic="select" onPress={() => setOpenDoc(openDoc === d.id ? null : d.id)} style={{ paddingVertical: 6 }} accessibilityLabel={d.title}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Sym name="book.closed.fill" size={14} color={palette.primary} />
                        <T v="subhead" style={{ flex: 1, fontWeight: '600' }}>{d.title}</T>
                        <Sym name={openDoc === d.id ? 'chevron.up' : 'chevron.down'} size={12} color={ios.tertiary} />
                      </View>
                      {openDoc === d.id ? <T v="caption" color={palette.inkSoft} style={{ marginTop: 6 }}>{d.text}</T> : null}
                    </PressableScale>
                  ))}
                </View>
              ) : null}
              <Button label="ถามครูปัญญาต่อ" icon={<Sym name="sparkles" size={16} color="#FFFFFF" />} kind="dark" onPress={ask} style={{ height: 50 }} />
              <T v="caption" color={ios.tertiary} style={{ marginHorizontal: 4 }}>ตรวจจากข้อควรระวังในคลังสมุนไพรของแอป ใช้ประกอบการตัดสินใจของหมอ ไม่ใช่คำวินิจฉัยของแพทย์</T>
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
  result: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 20 },
});
