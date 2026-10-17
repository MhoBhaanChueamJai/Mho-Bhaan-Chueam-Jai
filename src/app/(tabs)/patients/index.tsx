import { Stack, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { PractitionerGate } from '../../../components/PractitionerGate';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { IOSCard, Sym, ios } from '../../../components/ios';
import { Avatar, HeaderButton, PressableScale, T } from '../../../components/ui';
import { avatarFor, lastVisit, type Patient } from '../../../data/mock';
import { statusLabel, statusTone, visitSortKey } from '../../../data/tones';
import { useApp } from '../../../store/app';
import { elevation, palette } from '../../../theme';

type Filter = 'all' | Patient['status'];
/** สถานะบนการ์ดเข้ม: สีสว่าง + ลำดับในแถบสัดส่วน */
const SEG: { k: Patient['status']; l: string; c: string }[] = [
  { k: 'ติดตามอาการ', l: 'ติดตาม', c: '#FFC25A' },
  { k: 'นัดวันนี้', l: statusLabel('นัดวันนี้'), c: '#7CF0A8' },
  { k: 'ส่งต่อ รพ.สต.', l: 'ส่งต่อ', c: '#FF8A7A' },
  { k: 'หายดี', l: 'หายดี', c: '#8FC8FF' },
];
const filled = (x?: string) => !!x && x.trim() !== '' && x.trim() !== '-';

/**
 * แท็บผู้ป่วย — การ์ดสรุปสีเข้ม (จำนวน · แถบสัดส่วนสถานะ · แตะสถานะเพื่อกรอง) + รายชื่อเรียงตามที่มารักษาล่าสุด
 * (หมอพื้นบ้านไม่ใช้ระบบนัดแบบคลินิก)
 */
function PatientsInner() {
  const { patients } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const sorted = useMemo(() => [...patients].sort((a, b) => visitSortKey(lastVisit(b)?.date) - visitSortKey(lastVisit(a)?.date)), [patients]);
  const count = (k: Patient['status']) => patients.filter((p) => p.status === k).length;
  const list = filter === 'all' ? sorted : sorted.filter((p) => p.status === filter);
  const total = Math.max(1, patients.length);
  const cur = SEG.find((x) => x.k === filter);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label="ค้นหาผู้ป่วย" onPress={() => router.push('/patient/search')}>
                <Sym name="magnifyingglass" size={20} color={palette.ink} weight="semibold" />
              </HeaderButton>
              <HeaderButton label="เพิ่มผู้ป่วยใหม่" onPress={() => router.push('/patient/new')}>
                <Sym name="plus" size={20} color={palette.ink} weight="semibold" />
              </HeaderButton>
            </View>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        {/* ── การ์ดสรุปสีเข้ม (แบบการ์ดครูปัญญา) ── */}
        <Animated.View entering={FadeInDown.duration(380)} style={[styles.hero, elevation.e2]}>
          <LinearGradient colors={['#0F2A1F', '#0A1913', '#050B08']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.glow} pointerEvents="none" />
          <PressableScale haptic="select" scaleTo={0.99} onPress={() => setFilter('all')} accessibilityLabel={`ผู้ป่วยทั้งหมด ${patients.length} ราย`}>
            <T v="micro" color="rgba(124,240,168,0.85)" style={styles.kicker}>ผู้ป่วยของฉัน</T>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <T v="hero" color="#FFFFFF" style={{ fontVariant: ['tabular-nums'] }}>{patients.length}</T>
              <T v="title" color="rgba(255,255,255,0.7)">ราย</T>
            </View>
          </PressableScale>
          {/* แถบสัดส่วนสถานะ */}
          <View style={styles.bar}>
            {SEG.map((x) => {
              const n = count(x.k);
              return n ? <View key={x.k} style={{ flex: n / total, backgroundColor: x.c, opacity: filter === 'all' || filter === x.k ? 1 : 0.3 }} /> : null;
            })}
          </View>
          {/* สถานะ: แตะเพื่อกรอง */}
          <View style={styles.legend}>
            {SEG.map((x) => {
              const on = filter === x.k;
              return (
                <PressableScale key={x.k} haptic="select" scaleTo={0.95} onPress={() => setFilter(on ? 'all' : x.k)} style={[styles.leg, on && { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: x.c }]} accessibilityLabel={`กรอง ${x.l} ${count(x.k)} ราย`} accessibilityState={{ selected: on }}>
                  <T v="h3" color="#FFFFFF" style={{ fontVariant: ['tabular-nums'] }}>{count(x.k)}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={[styles.legDot, { backgroundColor: x.c }]} />
                    <T v="micro" color="rgba(255,255,255,0.75)" numberOfLines={1} style={{ fontWeight: '600' }}>{x.l}</T>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>

        <View style={styles.listHead}>
          <T v="caption" color={ios.secondary} style={{ flex: 1 }}>{cur ? `${cur.l} · ${list.length} ราย` : 'เรียงตามที่มารักษาล่าสุด'}</T>
          {cur ? (
            <PressableScale haptic="select" onPress={() => setFilter('all')} hitSlop={8} accessibilityLabel="ดูทั้งหมด">
              <T v="caption" color={palette.primary} style={{ fontWeight: '700' }}>ดูทั้งหมด</T>
            </PressableScale>
          ) : null}
        </View>

        {/* ── รายชื่อ (แบบเดิม) ── */}
        {list.length ? (
          <View style={[styles.list, elevation.e1]}>
            {list.map((p, i) => {
              const st = statusTone[p.status];
              const v = lastVisit(p);
              const what = v ? [v.diagnosis, v.symptoms].find(filled) ?? 'ยังไม่ได้ระบุอาการ' : 'ยังไม่มีการรักษา';
              return (
                <Animated.View key={p.id} entering={i < 12 ? FadeIn.delay(i * 40).duration(200) : undefined}>
                  {i ? <View style={styles.sep} /> : null}
                  <PressableScale scaleTo={0.98} haptic="select" onPress={() => router.push(`/patient/${p.id}`)} style={styles.row} accessibilityLabel={`${p.name} ${statusLabel(p.status)}`}>
                    <View>
                      <Avatar name={p.name} src={avatarFor(p)} size={52} />
                      <View style={[styles.dot, { backgroundColor: st.fg }]} />
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <T v="title" numberOfLines={1}>{p.name}</T>
                      <T v="subhead" color={ios.secondary} numberOfLines={1}>{what}</T>
                      <View style={styles.meta}>
                        <T v="caption" color={st.fg} style={{ fontWeight: '600' }}>{statusLabel(p.status)}</T>
                        <T v="caption" color={ios.tertiary}>{v ? `· มาล่าสุด ${v.date}` : `· ${p.sex} ${p.age} ปี`}</T>
                      </View>
                    </View>
                    <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>
        ) : (
          <IOSCard style={{ alignItems: 'center', paddingVertical: 28, gap: 6 }}>
            <Sym name="person.2" size={28} color={ios.tertiary} />
            <T v="callout" color={ios.secondary}>{patients.length ? 'ไม่มีผู้ป่วยในสถานะนี้' : 'ยังไม่มีผู้ป่วย กด + เพื่อเพิ่ม'}</T>
          </IOSCard>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120 },
  hero: { borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', padding: 18, backgroundColor: '#0A1712' },
  glow: { position: 'absolute', right: -60, top: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,240,168,0.10)' },
  kicker: { fontWeight: '700', letterSpacing: 0.5 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 3, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  legend: { flexDirection: 'row', gap: 6, marginTop: 14 },
  leg: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  legDot: { width: 6, height: 6, borderRadius: 3 },
  listHead: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 8, marginHorizontal: 4 },
  list: { backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 14, paddingRight: 16, minHeight: 76 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginLeft: 80 },
  dot: { position: 'absolute', right: 0, bottom: 1, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: palette.surface },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
});

export default function Patients() {
  return (
    <PractitionerGate>
      <PatientsInner />
    </PractitionerGate>
  );
}
