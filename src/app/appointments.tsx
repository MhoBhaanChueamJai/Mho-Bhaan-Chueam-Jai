/**
 * นัดหมาย — รวมนัดติดตามอาการของผู้ป่วยทุกคน: เลยนัด · วันนี้ · 7 วันข้างหน้า (แถบวัน) · หลังจากนั้น
 * แตะผู้ป่วยเพื่อเปิดหน้าผู้ป่วย · ปุ่มข้อความ = ส่งข้อความถามอาการ/เตือนนัด
 */
import { Stack, router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Avatar, PressableScale, T } from '../components/ui';
import { Sym, ios } from '../components/ios';
import { avatarFor, lastVisit, type Patient } from '../data/mock';
import { dayAt, isoIn, thShort, todayIso } from '../lib/reminders';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';
import { column } from '../components/layout';

const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export default function Appointments() {
  const { patients } = useApp();
  const today = todayIso();
  const week = Array.from({ length: 7 }, (_, i) => isoIn(i));
  const [day, setDay] = useState<string | null>(null);
  const appts = useMemo(
    () =>
      patients
        .filter((p) => p.followUpOn && p.status === 'ติดตามอาการ')
        .map((p) => ({ p, on: p.followUpOn! }))
        .sort((a, b) => a.on.localeCompare(b.on)),
    [patients],
  );
  const count = (d: string) => appts.filter((a) => a.on === d).length;
  const overdue = appts.filter((a) => a.on < today);
  const groups: { title: string; tone: string; list: { p: Patient; on: string }[] }[] = day
    ? [{ title: day === today ? 'วันนี้' : thShort(day), tone: palette.primary, list: appts.filter((a) => a.on === day) }]
    : [
        { title: `เลยนัด · ${overdue.length} ราย`, tone: '#D2453A', list: overdue },
        { title: 'วันนี้', tone: palette.primary, list: appts.filter((a) => a.on === today) },
        { title: '7 วันข้างหน้า', tone: '#2F7BE0', list: appts.filter((a) => a.on > today && a.on <= week[6]) },
        { title: 'หลังจากนั้น', tone: ios.secondary, list: appts.filter((a) => a.on > week[6]) },
      ].filter((g) => g.list.length);

  return (
    <>
      <Stack.Screen options={{ title: 'นัดหมาย' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={[styles.page, column.read]}>
        {/* แถบ 7 วัน: จุด = มีนัด · แตะเพื่อดูเฉพาะวันนั้น แตะซ้ำเพื่อดูทั้งหมด */}
        <View style={[styles.week, elevation.e1]}>
          {week.map((d) => {
            const on = day === d;
            const n = count(d);
            const dt = dayAt(d, 12);
            return (
              <PressableScale key={d} haptic="select" scaleTo={0.94} onPress={() => setDay(on ? null : d)} style={[styles.day, on && { backgroundColor: palette.primary }]} accessibilityLabel={`${thShort(d)} นัด ${n} ราย`} accessibilityState={{ selected: on }}>
                <T v="micro" color={on ? '#FFFFFF' : d === today ? palette.primary : ios.secondary} style={{ fontWeight: '700' }}>{d === today ? 'วันนี้' : DOW[dt.getDay()]}</T>
                <T v="h3" color={on ? '#FFFFFF' : palette.ink}>{dt.getDate()}</T>
                <View style={[styles.dot, { backgroundColor: n ? (on ? '#FFFFFF' : palette.primary) : 'transparent' }]} />
              </PressableScale>
            );
          })}
        </View>

        {groups.map((g) => (
          <Animated.View key={g.title} entering={FadeIn} layout={LinearTransition.duration(220)} style={{ gap: 8 }}>
            <T v="subhead" color={g.tone} style={{ fontWeight: '700', marginLeft: 4 }}>{g.title}</T>
            <View style={[styles.card, elevation.e1]}>
              {g.list.map(({ p, on }, i) => {
                const v = lastVisit(p);
                const late = on < today ? Math.round((Date.parse(today) - Date.parse(on)) / 86400000) : 0;
                return (
                  <PressableScale key={p.id} haptic="select" scaleTo={0.98} onPress={() => router.push(`/patient/${p.id}`)} style={[styles.row, i > 0 && styles.sep]} accessibilityLabel={`${p.name} นัด ${thShort(on)}`}>
                    <Avatar name={p.name} src={avatarFor(p)} size={42} />
                    <View style={{ flex: 1 }}>
                      <T v="body" style={{ fontWeight: '600' }} numberOfLines={1}>{p.name}</T>
                      <T v="caption" color={ios.secondary} numberOfLines={1}>{v?.diagnosis && v.diagnosis !== '-' ? v.diagnosis : v?.symptoms ?? ''}</T>
                      <T v="caption" color={late ? '#D2453A' : ios.tertiary}>{late ? `เลยนัด ${late} วัน (${thShort(on)})` : thShort(on)}</T>
                    </View>
                    <PressableScale haptic="select" hitSlop={8} onPress={() => router.push({ pathname: '/patient/[id]', params: { id: p.id, ask: '1' } })} style={styles.msg} accessibilityLabel={`ส่งข้อความถึง ${p.name}`}>
                      <Sym name="message.fill" size={16} color={palette.primary} />
                    </PressableScale>
                  </PressableScale>
                );
              })}
            </View>
          </Animated.View>
        ))}

        {!groups.length ? (
          <View style={[styles.empty, elevation.e1]}>
            <Sym name="calendar.badge.clock" size={32} color={palette.primary} />
            <T v="bodyStrong" center>{day ? 'ไม่มีนัดวันนี้' : 'ยังไม่มีนัดติดตามอาการ'}</T>
            <T v="subhead" color={ios.secondary} center>นัดได้ตอนบันทึกการรักษา เลือกสถานะ “ติดตามอาการ” แล้วเลือกวันนัด</T>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48, gap: 14 },
  week: { flexDirection: 'row', padding: 6, borderRadius: 22, backgroundColor: palette.surface, gap: 2 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 16, gap: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  card: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 22, backgroundColor: palette.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  msg: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  empty: { alignItems: 'center', gap: 8, padding: 28, borderRadius: 24, backgroundColor: palette.surface },
});
