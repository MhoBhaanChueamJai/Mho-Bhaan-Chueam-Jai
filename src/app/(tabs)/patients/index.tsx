import { Stack, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { PractitionerGate } from '../../../components/PractitionerGate';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedProps, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
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

const RING = 124;
const SW = 13;
const R = (RING - SW) / 2;
const CIRC = 2 * Math.PI * R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** หนึ่งส่วนของวงแหวน: วาดไล่ตามค่า p (0→1) ตอนเปิดหน้า */
function Arc({ start, len, c, dim, p }: { start: number; len: number; c: string; dim: boolean; p: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ strokeDasharray: [Math.max(0.001, len * p.value), CIRC] as any }));
  return (
    <AnimatedCircle
      cx={RING / 2}
      cy={RING / 2}
      r={R}
      stroke={c}
      strokeOpacity={dim ? 0.25 : 1}
      strokeWidth={SW}
      strokeLinecap="round"
      fill="none"
      rotation={-90 + (start / CIRC) * 360}
      origin={`${RING / 2}, ${RING / 2}`}
      animatedProps={props}
    />
  );
}

/** วงแหวนสถานะ: แต่ละสีตามสัดส่วนผู้ป่วยแต่ละสถานะ · ตัวเลขรวมกลางวง */
function StatusRing({ segs, total }: { segs: { n: number; c: string; dim: boolean }[]; total: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [p]);
  const live = segs.filter((x) => x.n > 0);
  const gap = live.length > 1 ? SW * 0.9 : 0; // ช่องว่างระหว่างสี (เผื่อหัวมน)
  let acc = 0;
  return (
    <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={SW} fill="none" />
        {total
          ? live.map((x, i) => {
              const len = Math.max(0.001, (x.n / total) * CIRC - gap);
              const el = <Arc key={i} start={acc + gap / 2} len={len} c={x.c} dim={x.dim} p={p} />;
              acc += (x.n / total) * CIRC;
              return el;
            })
          : null}
      </Svg>
      <T v="hero" color="#FFFFFF" style={{ fontVariant: ['tabular-nums'], lineHeight: 40 }}>{total}</T>
      <T v="caption" color="rgba(255,255,255,0.65)">ราย</T>
    </View>
  );
}

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
        {/* ── การ์ดสรุปสีเข้ม: วงแหวนสถานะ (แบบแอป Fitness) + รายการสถานะแตะกรองได้ ── */}
        <Animated.View entering={FadeInDown.duration(380)} style={[styles.hero, elevation.e2]}>
          <LinearGradient colors={['#0F2A1F', '#0A1913', '#050B08']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.glow} pointerEvents="none" />
          <T v="micro" color="rgba(124,240,168,0.85)" style={styles.kicker}>ผู้ป่วยของฉัน</T>
          <View style={styles.heroBody}>
            <PressableScale haptic="select" scaleTo={0.97} onPress={() => setFilter('all')} accessibilityLabel={`ผู้ป่วยทั้งหมด ${patients.length} ราย`}>
              <StatusRing segs={SEG.map((x) => ({ n: count(x.k), c: x.c, dim: filter !== 'all' && filter !== x.k }))} total={patients.length} />
            </PressableScale>
            <View style={{ flex: 1, gap: 4 }}>
              {SEG.map((x) => {
                const on = filter === x.k;
                return (
                  <PressableScale key={x.k} haptic="select" scaleTo={0.97} onPress={() => setFilter(on ? 'all' : x.k)} style={[styles.legRow, on && { backgroundColor: 'rgba(255,255,255,0.1)' }]} accessibilityLabel={`กรอง ${x.l} ${count(x.k)} ราย`} accessibilityState={{ selected: on }}>
                    <View style={[styles.legDot, { backgroundColor: x.c }]} />
                    <T v="subhead" color="rgba(255,255,255,0.85)" style={{ flex: 1, fontWeight: '600' }}>{x.l}</T>
                    <T v="bodyStrong" color="#FFFFFF" style={{ fontVariant: ['tabular-nums'] }}>{count(x.k)}</T>
                  </PressableScale>
                );
              })}
            </View>
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
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 12 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 30, paddingHorizontal: 10, borderRadius: 10 },
  legDot: { width: 10, height: 10, borderRadius: 5 },
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
