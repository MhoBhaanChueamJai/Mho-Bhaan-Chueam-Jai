/** รายงานสรุปรายเดือน — เลื่อนดูทีละเดือน · ส่งออก PDF สำหรับรายงาน รพ.สต. / สสจ. หรือต่ออายุหนังสือรับรอง */
import { Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Sym, ios } from '../components/ios';
import { Button, GlassDock, PressableScale, T } from '../components/ui';
import { useDoctor } from '../components/useDoctor';
import { Alert } from '../lib/alert';
import { monthLabel, monthReport, monthReportHtml } from '../lib/monthReport';
import { outputPdf } from '../lib/printDocs';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';

export default function Report() {
  const { patients } = useApp();
  const dr = useDoctor();
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const r = useMemo(() => monthReport(patients, cur.y, cur.m), [patients, cur]);
  const shift = (d: number) => setCur((c) => { const x = new Date(c.y, c.m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });
  const isNow = cur.y === now.getFullYear() && cur.m === now.getMonth();
  const pdf = () => outputPdf(monthReportHtml(r, dr), `รายงาน ${monthLabel(cur.y, cur.m)}`).catch(() => Alert.alert('สร้างเอกสารไม่สำเร็จ', 'ลองใหม่อีกครั้ง'));

  const Stat = ({ n, label, color }: { n: number; label: string; color: string }) => (
    <View style={[styles.stat, elevation.e1]}>
      <T v="h1" color={color}>{n}</T>
      <T v="caption" color={ios.secondary} center>{label}</T>
    </View>
  );
  const List = ({ title, icon, items, unit }: { title: string; icon: string; items: { name: string; n: number }[]; unit: string }) => (
    <View style={[styles.card, elevation.e1]}>
      <View style={styles.head}>
        <Sym name={icon as any} size={16} color={palette.primary} />
        <T v="bodyStrong">{title}</T>
      </View>
      {items.length ? (
        items.map((x, i) => (
          <View key={x.name} style={[styles.row, i > 0 && styles.sep]}>
            <T v="body" style={{ flex: 1 }} numberOfLines={2}>{x.name}</T>
            <T v="subhead" color={ios.secondary}>{x.n} {unit}</T>
          </View>
        ))
      ) : (
        <T v="subhead" color={ios.tertiary}>ยังไม่มีข้อมูล</T>
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'รายงานรายเดือน' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={styles.page}>
        <View style={styles.month}>
          <PressableScale haptic="select" onPress={() => shift(-1)} style={styles.arrow} accessibilityLabel="เดือนก่อน">
            <Sym name="chevron.left" size={18} color={palette.ink} weight="semibold" />
          </PressableScale>
          <T v="h2" center style={{ flex: 1 }}>{monthLabel(cur.y, cur.m)}</T>
          <PressableScale haptic="select" onPress={() => !isNow && shift(1)} style={[styles.arrow, isNow && { opacity: 0.3 }]} accessibilityLabel="เดือนถัดไป">
            <Sym name="chevron.right" size={18} color={palette.ink} weight="semibold" />
          </PressableScale>
        </View>
        <Animated.View key={`${cur.y}-${cur.m}`} entering={FadeIn.duration(220)} style={{ gap: 14 }}>
          <View style={styles.stats}>
            <Stat n={r.visits} label="ครั้งที่รักษา" color={palette.primary} />
            <Stat n={r.patients} label="ผู้ป่วย" color="#2F7BE0" />
            <Stat n={r.newPatients} label="ผู้ป่วยใหม่" color="#7A4FD0" />
            <Stat n={r.referrals} label="ส่งต่อ" color={palette.coral} />
          </View>
          <View style={[styles.card, elevation.e1, { gap: 6 }]}>
            <T v="subhead" color={ios.secondary}>ชาย {r.male} ราย · หญิง {r.female} ราย</T>
            <T v="subhead" color={ios.secondary}>{r.ages.map((a) => `${a.label} ${a.n}`).join(' · ')}</T>
          </View>
          <List title="โรค/อาการที่พบบ่อย" icon="stethoscope" items={r.diagnoses} unit="ครั้ง" />
          <List title="สมุนไพรที่ใช้บ่อย" icon="leaf.fill" items={r.herbs} unit="ครั้ง" />
          <List title="ผลการรักษา" icon="checkmark.circle.fill" items={r.outcomes} unit="ครั้ง" />
          <T v="caption" color={ios.tertiary} style={{ marginHorizontal: 4 }}>นับจากบันทึกการรักษาตามแบบ ม.บ.5 ในเดือนนี้ · PDF มีรายการรักษาทุกครั้งและช่องลงชื่อ ใช้รายงาน รพ.สต. หรือประกอบการต่ออายุหนังสือรับรอง</T>
        </Animated.View>
      </ScrollView>
      <GlassDock>
        <Button label="ส่งออก PDF" icon={<Sym name="square.and.arrow.up" size={17} color="#FFFFFF" />} onPress={pdf} style={{ flex: 1, height: 52 }} />
      </GlassDock>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 140, gap: 14 },
  month: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 20, backgroundColor: palette.surface, gap: 2 },
  card: { padding: 16, borderRadius: 22, backgroundColor: palette.surface },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
});
