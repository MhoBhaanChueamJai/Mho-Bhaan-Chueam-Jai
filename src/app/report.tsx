/**
 * รายงาน (dashboard แบบแอป Health) — เดือน / 3 เดือน / ปี
 * ตัวเลขหลัก 4 ช่องพร้อมลูกศรเทียบช่วงก่อน · กราฟแท่งจำนวนครั้งที่รักษา · วงแหวนผลการรักษา · เพศ/อายุ · โรคและสมุนไพรที่พบบ่อย
 * ส่งออก PDF สำหรับรายงาน รพ.สต. / สสจ.
 */
import { Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Sym, ios } from '../components/ios';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import * as Print from 'expo-print';
import { MenuView } from '../components/Menu';
import { PressableScale, T } from '../components/ui';
import { NEEDS_FONT } from '../lib/font';
import { useDoctor } from '../components/useDoctor';
import { Alert } from '../lib/alert';
import { buildReport, reportHtml, type Span } from '../lib/monthReport';
import { outputPdf } from '../lib/printDocs';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';
import { column, useLayout } from '../components/layout';

const SPANS: { key: '1' | '3' | '12'; label: string }[] = [
  { key: '1', label: 'เดือน' },
  { key: '3', label: '3 เดือน' },
  { key: '12', label: 'ปี' },
];

/** ตัวเลขหลัก + ลูกศรเทียบช่วงก่อน */
function Kpi({ label, value, unit, delta, color, icon, pct }: { label: string; value: string; unit?: string; delta: number | null; color: string; icon: string; pct?: boolean }) {
  const up = (delta ?? 0) > 0;
  const tone = delta == null || delta === 0 ? ios.tertiary : up ? '#14905C' : '#D2453A';
  return (
    <View style={[styles.kpi, elevation.e1]}>
      <View style={styles.kpiHead}>
        <Sym name={icon as any} size={13} color={color} />
        <T v="caption" color={color} style={{ fontWeight: '700' }}>{label}</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <T v="h1" style={{ fontSize: 34, lineHeight: 40 }}>{value}</T>
        {unit ? <T v="subhead" color={ios.secondary}>{unit}</T> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        {delta ? <Sym name={up ? 'arrowtriangle.up.fill' : 'arrowtriangle.down.fill'} size={9} color={tone} /> : null}
        <T v="caption" color={tone}>{delta == null ? 'ยังเทียบไม่ได้' : delta === 0 ? 'เท่ากับช่วงก่อน' : `${up ? '+' : ''}${delta}${pct ? '%' : ''} จากช่วงก่อน`}</T>
      </View>
    </View>
  );
}

function Card({ title, icon, color = palette.primary, children, i, w }: { title: string; icon: string; color?: string; children: React.ReactNode; i: number; w?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(80 + i * 50).duration(360)} style={[styles.card, elevation.e1, w ? { width: w } : null]}>
      <View style={styles.head}>
        <Sym name={icon as any} size={15} color={color} />
        <T v="bodyStrong">{title}</T>
      </View>
      {children}
    </Animated.View>
  );
}

/** กราฟแท่งแนวตั้ง (แท่งล่าสุดสีเข้ม) */
function Bars({ bars }: { bars: { short: string; n: number }[] }) {
  const max = Math.max(1, ...bars.map((b) => b.n));
  return (
    <View style={styles.bars}>
      {bars.map((b, i) => (
        <View key={b.short + i} style={styles.barCol}>
          <T v="micro" color={ios.secondary} style={{ fontWeight: '700' }}>{b.n || ''}</T>
          <Animated.View entering={FadeIn.delay(i * 40)} style={[styles.bar, { height: Math.max(3, (b.n / max) * 120), backgroundColor: i === bars.length - 1 ? palette.primary : `${palette.primary}66` }]} />
          <T v="micro" color={ios.secondary}>{b.short}</T>
        </View>
      ))}
    </View>
  );
}

/** วงแหวนสัดส่วน */
function Donut({ parts, size = 120 }: { parts: { k: string; n: number; color: string }[]; size?: number }) {
  const total = parts.reduce((s, p) => s + p.n, 0) || 1;
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="#EEF2EF" strokeWidth={16} fill="none" />
      {parts.map((p) => {
        const len = (p.n / total) * c;
        const el = <Circle key={p.k} cx={size / 2} cy={size / 2} r={r} stroke={p.color} strokeWidth={16} fill="none" strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
        acc += len;
        return el;
      })}
    </Svg>
  );
}

/** แท่งแนวนอน (อันดับ) */
function HBars({ items, color }: { items: { name: string; n: number }[]; color: string }) {
  const max = Math.max(1, ...items.map((x) => x.n));
  if (!items.length) return <T v="subhead" color={ios.tertiary}>ยังไม่มีข้อมูลในช่วงนี้</T>;
  return (
    <View style={{ gap: 10 }}>
      {items.map((x) => (
        <View key={x.name} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row' }}>
            <T v="subhead" style={{ flex: 1 }} numberOfLines={1}>{x.name}</T>
            <T v="subhead" color={ios.secondary} style={{ fontWeight: '700' }}>{x.n}</T>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(x.n / max) * 100}%`, backgroundColor: color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function Report() {
  const { patients } = useApp();
  const { wide, gridW } = useLayout();
  // จอกว้าง: การ์ดกราฟกว้างครึ่งคอลัมน์ (ขอบ 16 · ช่องไฟ 12)
  const cardW = wide ? Math.floor((gridW - 32 - 12) / 2) : undefined;
  const dr = useDoctor();
  const now = new Date();
  const [span, setSpan] = useState<Span>(1);
  const [end, setEnd] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const r = useMemo(() => buildReport(patients, end.y, end.m, span), [patients, end, span]);
  const shift = (d: number) => setEnd((c) => { const x = new Date(c.y, c.m + d * span, 1); return { y: x.getFullYear(), m: x.getMonth() }; });
  const atNow = end.y === now.getFullYear() && end.m === now.getMonth();
  const pdf = () => outputPdf(reportHtml(r, dr), `รายงาน ${r.label}`).catch(() => Alert.alert('สร้างเอกสารไม่สำเร็จ', 'ลองใหม่อีกครั้ง'));
  const totalOut = r.outcomes.reduce((s, o) => s + o.n, 0);
  const people = r.male + r.female || 1;

  return (
    <>
      {/* ส่งออก/พิมพ์: เมนูบนแถบด้านบน */}
      <Stack.Screen
        options={{
          title: 'รายงาน',
          headerRight: () => (
            <MenuView
              shouldOpenOnLongPress={false}
              themeVariant="light"
              title={`รายงาน ${r.label}`}
              actions={[
                { id: 'pdf', title: 'ส่งออกเป็นเอกสาร', image: 'square.and.arrow.up', imageColor: palette.ink },
                { id: 'print', title: 'พิมพ์', image: 'printer.fill', imageColor: palette.ink },
              ]}
              onPressAction={({ nativeEvent }) => (nativeEvent.event === 'print' ? Print.printAsync({ html: reportHtml(r, dr) }).catch(() => {}) : pdf())}
            >
              <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="ส่งออกรายงาน">
                <Sym name="square.and.arrow.up" size={19} color={palette.ink} weight="semibold" />
              </View>
            </MenuView>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={[styles.page, column.grid]}>
        {/* แท็บแบบ iOS (UISegmentedControl · Android/เว็บวาดให้เหมือน) */}
        <SegmentedControl
          values={SPANS.map((x) => x.label)}
          selectedIndex={SPANS.findIndex((x) => Number(x.key) === span)}
          onChange={(e) => setSpan(Number(SPANS[e.nativeEvent.selectedSegmentIndex].key) as Span)}
          appearance="light"
          style={{ height: 34 }}
          fontStyle={NEEDS_FONT ? { fontFamily: 'NotoSansThaiLooped_500Medium', fontSize: 14 } : { fontSize: 14 }}
          activeFontStyle={NEEDS_FONT ? { fontFamily: 'NotoSansThaiLooped_600SemiBold', fontSize: 14 } : { fontSize: 14, fontWeight: '600' }}
        />
        <View style={styles.period}>
          <PressableScale haptic="select" onPress={() => shift(-1)} style={styles.arrow} accessibilityLabel="ช่วงก่อนหน้า">
            <Sym name="chevron.left" size={17} color={palette.ink} weight="semibold" />
          </PressableScale>
          <T v="h3" center style={{ flex: 1 }}>{r.label}</T>
          <PressableScale haptic="select" onPress={() => !atNow && shift(1)} style={[styles.arrow, atNow && { opacity: 0.3 }]} accessibilityLabel="ช่วงถัดไป">
            <Sym name="chevron.right" size={17} color={palette.ink} weight="semibold" />
          </PressableScale>
        </View>

        <Animated.View key={`${r.label}`} entering={FadeIn.duration(240)} style={{ gap: 12 }}>
          {/* KPI: มือถือ 2×2 · จอกว้างแถวเดียว 4 ช่อง */}
          <View style={wide ? styles.grid : { gap: 12 }}>
          <View style={[styles.grid, wide && { flex: 1 }]}>
            <Kpi label="ครั้งที่รักษา" icon="stethoscope" color={palette.primary} value={String(r.visits)} unit="ครั้ง" delta={r.delta.visits} />
            <Kpi label="ผู้ป่วย" icon="person.2.fill" color="#2F7BE0" value={String(r.patients)} unit="ราย" delta={r.delta.patients} />
          </View>
          <View style={[styles.grid, wide && { flex: 1 }]}>
            <Kpi label="ผู้ป่วยใหม่" icon="person.badge.plus" color="#7A4FD0" value={String(r.newPatients)} unit="ราย" delta={r.delta.newPatients} />
            <Kpi label="หาย/ดีขึ้น" icon="heart.fill" color="#E0861A" value={r.better != null ? String(r.better) : '–'} unit={r.better != null ? '%' : undefined} delta={r.delta.better} pct />
          </View>
          </View>

          {/* กราฟ: มือถือเรียงลงมา · จอกว้าง 2 คอลัมน์ */}
          <View style={wide ? styles.cards : { gap: 12 }}>

          <Card i={0} title={`จำนวนครั้งที่รักษา${span === 1 ? 'รายสัปดาห์' : 'รายเดือน'}`} icon="chart.bar.fill" w={cardW}>
            <Bars bars={r.bars} />
          </Card>

          <Card i={1} title="ผลการรักษา" icon="checkmark.circle.fill" w={cardW}>
            {totalOut ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View>
                  <Donut parts={r.outcomes} />
                  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                    <T v="h2">{totalOut}</T>
                    <T v="micro" color={ios.secondary}>ครั้ง</T>
                  </View>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  {r.outcomes.map((o) => (
                    <View key={o.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.dot, { backgroundColor: o.color }]} />
                      <T v="subhead" style={{ flex: 1 }}>{o.k}</T>
                      <T v="subhead" color={ios.secondary} style={{ fontWeight: '700' }}>{Math.round((o.n / totalOut) * 100)}%</T>
                    </View>
                  ))}
                  {r.referrals ? <T v="caption" color={ios.tertiary}>ส่งต่อสถานพยาบาล {r.referrals} ครั้ง</T> : null}
                </View>
              </View>
            ) : (
              <T v="subhead" color={ios.tertiary}>ยังไม่มีข้อมูลในช่วงนี้</T>
            )}
          </Card>

          <Card i={2} title="เพศและช่วงอายุ" icon="person.2.fill" color="#2F7BE0" w={cardW}>
            <View style={styles.split}>
              <View style={{ flex: r.male || 0.001, backgroundColor: '#2F7BE0' }} />
              <View style={{ flex: r.female || 0.001, backgroundColor: '#E46A9A' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <T v="caption" color="#2F7BE0" style={{ fontWeight: '700' }}>ชาย {r.male} ({Math.round((r.male / people) * 100)}%)</T>
              <T v="caption" color="#E46A9A" style={{ fontWeight: '700' }}>หญิง {r.female} ({Math.round((r.female / people) * 100)}%)</T>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {r.ages.map((a) => (
                <View key={a.label} style={styles.age}>
                  <T v="h3">{a.n}</T>
                  <T v="micro" color={ios.secondary} center>{a.label}</T>
                </View>
              ))}
            </View>
          </Card>

          <Card i={3} title="โรค/อาการที่พบบ่อย" icon="stethoscope" w={cardW}>
            <HBars items={r.diagnoses} color={palette.primary} />
          </Card>
          <Card i={4} title="สมุนไพรที่ใช้บ่อย" icon="leaf.fill" color="#3E8E2E" w={cardW}>
            <HBars items={r.herbs} color="#6FBF4A" />
          </Card>
          </View>
          <T v="caption" color={ios.tertiary} style={{ marginHorizontal: 4 }}>นับจากบันทึกการรักษาตามแบบ ม.บ.5 · ผลการรักษาจัดกลุ่มจากคำที่หมอพิมพ์ · ส่งออกเป็นเอกสารหรือพิมพ์ได้จากปุ่มมุมขวาบน (มีรายการรักษาทุกครั้งและช่องลงชื่อ)</T>
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48, gap: 12 },
  period: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface },
  grid: { flexDirection: 'row', gap: 12 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' },
  kpi: { flex: 1, padding: 14, borderRadius: 20, backgroundColor: palette.surface, gap: 2 },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  card: { padding: 16, borderRadius: 22, backgroundColor: palette.surface },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 160 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '70%', maxWidth: 34, borderRadius: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  split: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
  age: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: palette.mint },
  track: { height: 10, borderRadius: 5, backgroundColor: '#EEF2EF', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
});
