import { Stack, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { PractitionerGate } from '../../../components/PractitionerGate';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { IOSCard, Sym, ios } from '../../../components/ios';
import { Avatar, HeaderButton, PressableScale, T } from '../../../components/ui';
import { avatarFor, lastVisit, type Patient } from '../../../data/mock';
import { statusLabel, statusTone, visitSortKey } from '../../../data/tones';
import { useApp } from '../../../store/app';
import { elevation, palette } from '../../../theme';

type Filter = 'all' | Patient['status'];
const FILTERS: { k: Filter; l: string }[] = [
  { k: 'all', l: 'ทั้งหมด' },
  { k: 'ติดตามอาการ', l: 'ติดตามอาการ' },
  { k: 'นัดวันนี้', l: statusLabel('นัดวันนี้') },
  { k: 'ส่งต่อ รพ.สต.', l: 'ส่งต่อ' },
  { k: 'หายดี', l: 'หายดี' },
];
const EL_TONE: Record<Patient['element'], { fg: string; bg: string }> = {
  ดิน: { fg: '#8A5E30', bg: '#F6EBDD' },
  น้ำ: { fg: '#1F64B0', bg: '#E2EEFA' },
  ลม: { fg: '#1E7F68', bg: '#DFF3EC' },
  ไฟ: { fg: '#C2453A', bg: '#FBE6E3' },
};
const filled = (x?: string) => !!x && x.trim() !== '' && x.trim() !== '-';

/** การ์ดสรุป: ไอคอนไล่สี · ตัวเลข · ป้าย — แตะเพื่อกรอง */
function Stat({ n, label, icon, colors, on, onPress }: { n: number; label: string; icon: string; colors: [string, string]; on: boolean; onPress: () => void }) {
  return (
    <PressableScale haptic="select" scaleTo={0.96} onPress={onPress} style={[styles.stat, elevation.e1, on && { borderColor: colors[1] }]} accessibilityLabel={`${label} ${n} ราย`} accessibilityState={{ selected: on }}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statIcon}>
        <Sym name={icon as any} size={15} color="#FFFFFF" />
      </LinearGradient>
      <T v="h2" style={{ marginTop: 8, fontVariant: ['tabular-nums'] }}>{n}</T>
      <T v="caption" color={ios.secondary} numberOfLines={1}>{label}</T>
    </PressableScale>
  );
}

/**
 * แท็บผู้ป่วย — สรุปจำนวน (แตะกรองได้) · ชิปกรองสถานะ · การ์ดผู้ป่วยทีละคน
 * เรียงตามที่มารักษาล่าสุด (หมอพื้นบ้านไม่ใช้ระบบนัดแบบคลินิก)
 */
function PatientsInner() {
  const { patients } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const sorted = useMemo(() => [...patients].sort((a, b) => visitSortKey(lastVisit(b)?.date) - visitSortKey(lastVisit(a)?.date)), [patients]);
  const count = (k: Filter) => (k === 'all' ? patients.length : patients.filter((p) => p.status === k).length);
  const list = filter === 'all' ? sorted : sorted.filter((p) => p.status === filter);

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
        {/* ── สรุป 3 ช่อง (แตะเพื่อกรอง) ── */}
        <View style={styles.stats}>
          <Stat n={count('all')} label="ทั้งหมด" icon="person.2.fill" colors={['#3FD089', '#14905C']} on={filter === 'all'} onPress={() => setFilter('all')} />
          <Stat n={count('ติดตามอาการ')} label="ติดตามอาการ" icon="clock.fill" colors={['#FFC25A', '#E0861A']} on={filter === 'ติดตามอาการ'} onPress={() => setFilter(filter === 'ติดตามอาการ' ? 'all' : 'ติดตามอาการ')} />
          <Stat n={count('ส่งต่อ รพ.สต.')} label="ส่งต่อ รพ.สต." icon="arrow.up.right.circle.fill" colors={['#FF8A7A', '#D2453A']} on={filter === 'ส่งต่อ รพ.สต.'} onPress={() => setFilter(filter === 'ส่งต่อ รพ.สต.' ? 'all' : 'ส่งต่อ รพ.สต.')} />
        </View>

        {/* ── ชิปกรองสถานะ ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginTop: 14 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {FILTERS.map((f) => {
            const on = filter === f.k;
            return (
              <PressableScale key={f.k} haptic="select" scaleTo={0.95} onPress={() => setFilter(f.k)} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: on }} accessibilityLabel={`กรอง ${f.l}`}>
                <T v="subhead" color={on ? '#FFFFFF' : palette.ink} style={{ fontWeight: '600' }}>{f.l}</T>
                <T v="caption" color={on ? 'rgba(255,255,255,0.8)' : ios.secondary}>{count(f.k)}</T>
              </PressableScale>
            );
          })}
        </ScrollView>

        <T v="caption" color={ios.secondary} style={{ marginTop: 18, marginBottom: 8, marginLeft: 4 }}>เรียงตามที่มารักษาล่าสุด</T>

        {/* ── การ์ดผู้ป่วย ── */}
        {list.length ? (
          <View style={{ gap: 10 }}>
            {list.map((p, i) => {
              const st = statusTone[p.status];
              const v = lastVisit(p);
              const what = v ? [v.diagnosis, v.symptoms].find(filled) ?? 'ยังไม่ได้ระบุอาการ' : 'ยังไม่มีการรักษา';
              const el = EL_TONE[p.element];
              const allergic = p.allergies && p.allergies !== 'ไม่มี';
              return (
                <Animated.View key={p.id} entering={i < 10 ? FadeInDown.delay(i * 35).duration(240) : undefined}>
                  <PressableScale scaleTo={0.98} haptic="select" onPress={() => router.push(`/patient/${p.id}`)} style={[styles.card, elevation.e1]} accessibilityLabel={`${p.name} ${statusLabel(p.status)} ${what}`}>
                    <Avatar name={p.name} src={avatarFor(p)} size={52} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <T v="title" numberOfLines={1} style={{ flex: 1 }}>{p.name}</T>
                        <View style={[styles.status, { backgroundColor: st.bg }]}>
                          <View style={[styles.statusDot, { backgroundColor: st.fg }]} />
                          <T v="micro" color={st.fg} style={{ fontWeight: '700' }}>{statusLabel(p.status)}</T>
                        </View>
                      </View>
                      <T v="subhead" color={ios.secondary} numberOfLines={1}>{what}{v ? ` · ${v.date}` : ''}</T>
                      <View style={styles.tags}>
                        <View style={[styles.tag, { backgroundColor: el.bg }]}>
                          <T v="micro" color={el.fg} style={{ fontWeight: '700' }}>ธาตุ{p.element}</T>
                        </View>
                        <View style={[styles.tag, { backgroundColor: '#F0F2F1' }]}>
                          <T v="micro" color={ios.secondary} style={{ fontWeight: '600' }}>{p.sex} {p.age} ปี</T>
                        </View>
                        {allergic ? (
                          <View style={[styles.tag, { backgroundColor: '#FBE6E3' }]}>
                            <Sym name="exclamationmark.triangle.fill" size={9} color="#C2453A" />
                            <T v="micro" color="#C2453A" numberOfLines={1} style={{ fontWeight: '700', maxWidth: 120 }}>แพ้{p.allergies.replace(/^แพ้\s*/, '')}</T>
                          </View>
                        ) : null}
                        {p.meds.length ? (
                          <View style={[styles.tag, { backgroundColor: '#FBF1DC' }]}>
                            <Sym name="pills.fill" size={9} color="#8A5A12" />
                            <T v="micro" color="#8A5A12" style={{ fontWeight: '700' }}>ยา {p.meds.length}</T>
                          </View>
                        ) : null}
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
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 12, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.surface, borderWidth: 1.5, borderColor: 'transparent' },
  statIcon: { width: 30, height: 30, borderRadius: 9, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: palette.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(60,60,67,0.15)' },
  chipOn: { backgroundColor: palette.primary, borderColor: palette.primary },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.surface },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
});

export default function Patients() {
  return (
    <PractitionerGate>
      <PatientsInner />
    </PractitionerGate>
  );
}
