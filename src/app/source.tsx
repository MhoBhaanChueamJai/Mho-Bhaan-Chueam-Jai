/**
 * อ่านหัวข้อในคลังความรู้อ้างอิง (เปิดจากป้ายอ้างอิงใต้คำแนะนำของครูปัญญา) · ดาวน์โหลดเป็นเอกสารได้
 * เปิดเป็นแผ่นเต็มจอแบบหน้าแก้ไขข้อมูลบัญชี → ไปหน้าอื่นจากแผ่นนี้ต้องปิดแผ่นก่อน
 * จัดหน้า: หัวเรื่อง (ไอคอนตำรา · ชื่อเล่ม · ป้ายหน้า · รูปสมุนไพร) → เนื้อหาแยกหัวข้อ/รายการ → ข้อมูลจาก (ต้นฉบับ) → ปุ่ม
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleIcon, PAGE_PAD } from '../components/ListRow';
import { NotFound } from '../components/NotFound';
import { SheetFrame } from '../components/nav/SheetFrame';
import { Sym, ios } from '../components/ios';
import { column } from '../components/layout';
import { Button, GlassCircle, PressableScale, T } from '../components/ui';
import { herbs } from '../data/herbs';
import { THP } from '../data/thp';
import { docPdf } from '../lib/knowledgePdf';
import { bookOf, docById } from '../lib/sources';
import { elevation, palette } from '../theme';

/** เนื้อหาในคลัง → หัวข้อ "ชื่อ: ค่า" (รวมรายการที่ขึ้นต้นด้วย • แต่มีชื่อหัวข้อ) · รายการ · ย่อหน้า */
type Block = { kind: 'kv'; k: string; v: string } | { kind: 'li'; items: string[] } | { kind: 'p'; text: string };
const KV = /^([^:：]{2,26})[:：]\s*(.+)$/;
function parse(text: string): Block[] {
  const lines = text.replace(/\n?\(ที่มา:[^)]*\)\s*$/, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const out: Block[] = [];
  for (const raw of lines) {
    const bullet = /^[•\-–·]\s*/.test(raw);
    const l = raw.replace(/^[•\-–·]\s*/, '');
    const m = l.match(KV);
    if (m) {
      out.push({ kind: 'kv', k: m[1].trim(), v: m[2].trim() });
      continue;
    }
    if (bullet) {
      const last = out[out.length - 1];
      if (last?.kind === 'li') last.items.push(l);
      else out.push({ kind: 'li', items: [l] });
      continue;
    }
    out.push({ kind: 'p', text: l });
  }
  return out;
}

/** หัวข้อที่รู้จัก → ไอคอน · แยกเป็นรายการ (ตัด ;) · กล่องเตือน */
const SECTION: { re: RegExp; icon: string; list?: boolean; warn?: boolean }[] = [
  { re: /สูตร|ส่วนประกอบ|ตัวยา/, icon: 'flask.fill', list: true },
  { re: /ข้อบ่งใช้|สรรพคุณ|ใช้แก้/, icon: 'cross.case.fill' },
  { re: /ขนาด|วิธีใช้|วิธีรับประทาน/, icon: 'clock.fill', list: true },
  { re: /ข้อควรระวัง|ข้อห้าม|คำเตือน|อาการไม่พึงประสงค์/, icon: 'exclamationmark.triangle.fill', list: true, warn: true },
  { re: /ส่วนที่ใช้|รูปแบบ|ประเภท/, icon: 'leaf.fill' },
  { re: /มอโนกราฟ|ผลิตภัณฑ์|ข้อความในตำรับ/, icon: 'checkmark.seal.fill', list: true },
];
const sectionOf = (k: string) => SECTION.find((x) => x.re.test(k));
const splitList = (v: string) => v.split(/\s*[;；]\s*|\s+·\s+/).map((x) => x.trim()).filter(Boolean);

const host = (u: string) => u.replace(/^https?:\/\//, '').split('/')[0];

export default function Source() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = id ? docById(id) : undefined;
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();
  if (!d) return <NotFound title="ไม่พบหัวข้อนี้" />;
  const b = bookOf(d.book);
  const herbId = d.id.startsWith('herb:') ? d.id.slice(5) : null;
  const herb = herbId ? herbs.find((h) => h.id === herbId) : undefined;
  const inThp = !!(herbId && THP[herbId]);
  const bookName = herbId && !inThp ? 'คลังสมุนไพรของแอป' : b.short;
  // ป้ายใต้ชื่อเรื่อง: ฉบับ/หน้าในเล่ม (ไม่ซ้ำกับชื่อเรื่อง)
  const page = d.book === 'thp' ? (inThp ? d.page ?? '' : '') : d.book === 'household' ? d.sub ?? '' : d.page ? (/หน้า/.test(d.page) ? d.page : `หน้า ${d.page}`) : '';
  const all = parse(d.text);
  const name = d.title.split(' (')[0].trim();
  // บรรทัดแรกที่ขึ้นต้นด้วยชื่อเรื่อง (เช่น "ยาประสะมะแว้ง (บัญชีรายการยาพื้นฐาน ยาเม็ด)") → ย้ายไปเป็นคำอธิบายใต้ชื่อ
  const subtitle = all[0]?.kind === 'p' && all[0].text.startsWith(name) ? all[0].text.slice(name.length).replace(/^[\s(]+|[)\s]+$/g, '') : '';
  const blocks = subtitle ? all.slice(1) : all;
  const refs = herbId && !inThp ? [] : b.refs.slice(0, 2);

  const download = async () => {
    setBusy(true);
    try {
      await docPdf(d);
    } finally {
      setBusy(false);
    }
  };
  // ปิดแผ่นก่อนแล้วค่อยไปหน้าถัดไป (ไม่ให้หน้าใหม่ไปซ้อนใต้แผ่น)
  const go = (to: Parameters<typeof router.push>[0]) => {
    router.back();
    setTimeout(() => router.push(to), 350);
  };

  return (
    <SheetFrame>
      {/* หัวแผ่นอยู่ใน ScrollView — ถ้าแยกไว้นอก ScrollView แผ่นของ iOS จะดันหัวพ้นจอ */}
      <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={styles.head}>
          <GlassCircle label="ปิด" onPress={() => router.back()}>
            <Sym name="xmark" size={17} color={palette.ink} weight="semibold" />
          </GlassCircle>
          <T v="bodyStrong" center numberOfLines={1} style={{ flex: 1 }}>แหล่งอ้างอิง</T>
          <GlassCircle label="ดาวน์โหลดเป็นเอกสาร" onPress={download}>
            {busy ? <ActivityIndicator color={palette.ink} /> : <Sym name="arrow.down.doc" size={17} color={palette.ink} weight="semibold" />}
          </GlassCircle>
        </View>

        <View style={[styles.body, column.read]}>
          {/* ── หัวเรื่อง ── */}
          <View style={[styles.hero, elevation.e1]}>
            {herb ? (
              <Image source={herb.image} style={styles.herbImg} contentFit="cover" transition={150} />
            ) : null}
            <View style={styles.heroInner}>
              <View style={styles.bookRow}>
                <CircleIcon name={herbId && !inThp ? 'leaf.fill' : b.icon} color={herbId && !inThp ? palette.primary : b.color} size={28} />
                <T v="caption" color={ios.secondary} numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>{bookName}</T>
                {inThp ? (
                  <View style={styles.badge}>
                    <Sym name="checkmark.seal.fill" size={11} color="#0E7C86" />
                    <T v="micro" color="#0E7C86" style={{ fontWeight: '700' }}>ตำรามาตรฐาน</T>
                  </View>
                ) : null}
              </View>
              <T v="h2" style={{ lineHeight: 34 }}>{d.title}</T>
              {subtitle ? (
                <View style={styles.tags}>
                  {subtitle.split(/\s+(?=ยา|ชนิด)|,\s*/).filter(Boolean).map((t) => (
                    <View key={t} style={styles.tag}>
                      <T v="caption" color={palette.inkSoft} style={{ fontWeight: '600' }}>{t}</T>
                    </View>
                  ))}
                </View>
              ) : null}
              {page ? (
                <View style={styles.pagePill}>
                  <Sym name="book.closed.fill" size={11} color={palette.primaryDeep} />
                  <T v="caption" color={palette.primaryDeep} numberOfLines={1} style={{ fontWeight: '700' }}>{page}</T>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── เนื้อหา: หัวข้อมีไอคอน · สูตร/ข้อควรระวังแยกเป็นรายการ · ข้อควรระวังเป็นกล่องสีส้ม ── */}
          {blocks.map((x, i) => {
            if (x.kind === 'kv') {
              const sec = sectionOf(x.k);
              const items = sec?.list ? splitList(x.v) : [x.v];
              return (
                <View key={i} style={[styles.sec, sec?.warn ? styles.warn : elevation.e1]}>
                  <View style={styles.secHead}>
                    <View style={[styles.secIcon, sec?.warn && { backgroundColor: '#FBE2B8' }]}>
                      <Sym name={(sec?.icon ?? 'text.alignleft') as any} size={14} color={sec?.warn ? '#B86E00' : palette.primary} />
                    </View>
                    <T v="subhead" color={sec?.warn ? '#7A4A00' : palette.primaryDeep} style={{ fontWeight: '800' }}>{x.k}</T>
                  </View>
                  {items.length > 1 ? (
                    <View style={{ gap: 8 }}>
                      {items.map((it, j) => (
                        <View key={j} style={styles.li}>
                          <View style={[styles.dot, sec?.warn && { backgroundColor: '#D9921A' }]} />
                          <T v="body" color={sec?.warn ? '#5C3D00' : palette.ink} style={[styles.text, { flex: 1 }]}>{it}</T>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <T v="body" color={sec?.warn ? '#5C3D00' : palette.ink} style={styles.text}>{items[0]}</T>
                  )}
                </View>
              );
            }
            if (x.kind === 'li')
              return (
                <View key={i} style={[styles.sec, elevation.e1, { gap: 8 }]}>
                  {x.items.map((it, j) => (
                    <View key={j} style={styles.li}>
                      <View style={styles.dot} />
                      <T v="body" style={[styles.text, { flex: 1 }]}>{it}</T>
                    </View>
                  ))}
                </View>
              );
            return (
              <View key={i} style={styles.note}>
                <Sym name="lightbulb.fill" size={14} color={palette.primary} />
                <T v="callout" color={palette.inkSoft} style={{ flex: 1, lineHeight: 24 }}>{x.text}</T>
              </View>
            );
          })}

          {/* ── ข้อมูลจาก ── */}
          {refs.length || d.url ? (
            <View style={styles.from}>
              <T v="micro" color={ios.secondary} style={styles.kvLabel}>ข้อมูลจาก</T>
              {refs.map((r, i) => (
                <T key={i} v="caption" color={palette.inkSoft} style={{ lineHeight: 19 }}>{r.title}</T>
              ))}
              {d.url ? (
                <PressableScale haptic="select" scaleTo={0.97} onPress={() => Linking.openURL(d.url!)} style={styles.linkBtn} accessibilityLabel="เปิดต้นฉบับ">
                  <Sym name="arrow.up.right.square" size={14} color={palette.primary} />
                  <T v="subhead" color={palette.primary} style={{ fontWeight: '700' }}>เปิดต้นฉบับ</T>
                  <T v="caption" color={ios.tertiary} numberOfLines={1} style={{ flexShrink: 1 }}>{host(d.url)}</T>
                </PressableScale>
              ) : null}
            </View>
          ) : null}

          {/* ── ปุ่ม ── */}
          <View style={{ gap: 10, marginTop: 4 }}>
            {herbId ? <Button kind="secondary" label="ดูหน้าสมุนไพร" icon={<Sym name="leaf.fill" size={15} color={palette.primary} />} onPress={() => go(`/herb/${herbId}`)} style={{ height: 50 }} /> : null}
            <PressableScale haptic="select" scaleTo={0.98} onPress={() => go({ pathname: '/knowledge', params: { book: d.book } })} style={styles.more} accessibilityLabel={`ดูหัวข้ออื่นใน ${b.short}`}>
              <T v="subhead" color={ios.secondary} style={{ fontWeight: '600' }}>ดูหัวข้ออื่นในเล่มนี้</T>
              <Sym name="chevron.right" size={12} color={ios.tertiary} weight="semibold" />
            </PressableScale>
            <Button label={busy ? 'กำลังสร้างเอกสาร…' : 'ดาวน์โหลดหัวข้อนี้'} icon={<Sym name="arrow.down.doc.fill" size={16} color="#FFFFFF" />} disabled={busy} onPress={download} style={{ height: 52 }} />
          </View>
        </View>
      </ScrollView>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: palette.bg },
  body: { paddingHorizontal: PAGE_PAD, paddingTop: 6, gap: 14 },
  hero: { borderRadius: 24, borderCurve: 'continuous', backgroundColor: palette.surface, overflow: 'hidden' },
  herbImg: { width: '100%', height: 170, backgroundColor: palette.bgDeep },
  heroInner: { padding: 16, gap: 10 },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: '#E0F2F3' },
  pagePill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', maxWidth: '100%', height: 28, paddingHorizontal: 11, borderRadius: 14, backgroundColor: palette.primarySoft },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center', backgroundColor: palette.bgDeep },
  sec: { gap: 10, padding: 16, borderRadius: 22, borderCurve: 'continuous', backgroundColor: palette.surface },
  warn: { backgroundColor: '#FDF1DC', borderWidth: 1, borderColor: '#F5D9A6' },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 6 },
  kvLabel: { fontWeight: '800', letterSpacing: 0.4 },
  text: { lineHeight: 26 },
  li: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 10, backgroundColor: palette.primary },
  from: { gap: 6, padding: 14, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.mint },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%', minHeight: 36, marginTop: 4, paddingHorizontal: 12, borderRadius: 18, backgroundColor: palette.surface },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 40 },
});
