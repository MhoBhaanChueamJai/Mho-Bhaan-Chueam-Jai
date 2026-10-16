import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { IOSCard, Sym, ios } from '../../../components/ios';
import { Avatar, Chip, Hatch, HeaderButton, PressableScale, T } from '../../../components/ui';
import { TODAY, avatars, lastVisit } from '../../../data/mock';
import type { Agenda } from '../../../lib/cloud';
import { statusTone } from '../../../data/tones';
import { useApp } from '../../../store/app';
import { control, elevation, palette } from '../../../theme';

const WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const same = (a: Date, b: Date) => key(a) === key(b);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(d, -d.getDay());

/** แถบวันที่แบบเดิม: แคปซูลใหญ่ วันที่เลือกเป็นสีเขียวมี glow */
const PAST_WEEKS = 8;
const FUTURE_WEEKS = 12;
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** แถบวันที่เลื่อนทีละสัปดาห์ (อาทิตย์–เสาร์ พอดีหนึ่งหน้าจอ) */
function WeekPager({ selected, onSelect, agenda }: { selected: Date; onSelect: (d: Date) => void; agenda: Agenda }) {
  const { width } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const base = addDays(startOfWeek(TODAY), -7 * PAST_WEEKS);
  const weeks = Array.from({ length: PAST_WEEKS + FUTURE_WEEKS + 1 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(base, w * 7 + i)));
  const [page, setPage] = useState(PAST_WEEKS);
  const gap = 10;
  const pill = (width - 32 - gap * 6) / 7;
  const wk = weeks[page];
  const a = wk[0];
  const z = wk[6];
  const range = a.getMonth() === z.getMonth() ? `${a.getDate()}–${z.getDate()} ${TH_M[z.getMonth()]} ${z.getFullYear() + 543}` : `${a.getDate()} ${TH_M[a.getMonth()]} – ${z.getDate()} ${TH_M[z.getMonth()]} ${z.getFullYear() + 543}`;
  const goToday = () => {
    ref.current?.scrollTo({ x: PAST_WEEKS * width, animated: true });
    setPage(PAST_WEEKS);
    onSelect(TODAY);
  };

  return (
    <View>
      <View style={styles.weekHead}>
        <T v="callout" style={{ fontWeight: '600' }}>{range}</T>
        {page !== PAST_WEEKS || !same(selected, TODAY) ? (
          <PressableScale haptic="select" hitSlop={control.hitSlop} onPress={goToday} style={styles.todayBtn}>
            <T v="caption" color={palette.primary} style={{ fontWeight: '600' }}>วันนี้</T>
          </PressableScale>
        ) : null}
      </View>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: PAST_WEEKS * width, y: 0 }}
        // เว็บไม่รองรับ contentOffset → เลื่อนไปสัปดาห์ปัจจุบันเมื่อวางเลย์เอาต์เสร็จ
        onLayout={() => ref.current?.scrollTo({ x: page * width, animated: false })}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ marginHorizontal: -16, marginVertical: -14 }}
      >
        {weeks.map((days, w) => (
          <View key={w} style={{ width, flexDirection: 'row', gap, paddingHorizontal: 16, paddingVertical: 22 }}>
            {days.map((d) => {
              const on = same(d, selected);
              const has = !!agenda[key(d)]?.length;
              return (
                <PressableScale key={key(d)} haptic="select" onPress={() => onSelect(d)} style={[styles.pill, { width: pill, borderRadius: pill / 2 }, on ? [styles.pillOn, elevation.glow] : elevation.e1]} accessibilityLabel={`${d.getDate()} ${MONTHS[d.getMonth()]}`}>
                  <T v="caption" color={on ? 'rgba(255,255,255,0.85)' : d.getDay() === 0 ? palette.coral : ios.secondary}>{WD[d.getDay()]}</T>
                  <T v="title" color={on ? palette.white : same(d, TODAY) ? palette.primary : palette.ink} style={{ fontWeight: '700' }}>{d.getDate()}</T>
                  <View style={[styles.dot, { backgroundColor: has ? (on ? palette.white : palette.primary) : 'transparent' }]} />
                </PressableScale>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const FILTERS = ['ทั้งหมด', 'นัดวันนี้', 'ติดตามอาการ', 'ส่งต่อ รพ.สต.', 'หายดี'] as const;
const TH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
/** นัดครั้งถัดไปของผู้ป่วย (ตั้งแต่วันนี้) */
function nextAppt(agenda: Agenda, pid: string) {
  const today = key(TODAY);
  const k = Object.keys(agenda)
    .filter((d) => d >= today && agenda[d].some((a) => a.pid === pid))
    .sort()[0];
  if (!k) return null;
  const a = agenda[k].find((x) => x.pid === pid)!;
  const [, m, d] = k.split('-').map(Number);
  return `${k === today ? 'วันนี้' : `${d} ${TH_SHORT[m - 1]}`} ${a.start} น.`;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export default function Patients() {
  const { patients, agenda } = useApp();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [mode, setMode] = useState(view === 'all' ? 1 : 0);
  useEffect(() => {
    if (view === 'all') setMode(1);
  }, [view]);
  const [day, setDay] = useState(TODAY);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ทั้งหมด');
  const appts = agenda[key(day)] ?? [];
  const shown = useMemo(
    () => patients.filter((p) => (filter === 'ทั้งหมด' || p.status === filter) && true),
    [patients, filter],
  );
  const dayLabel = `${same(day, TODAY) ? 'วันนี้ · ' : ''}วัน${['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][day.getDay()]}ที่ ${day.getDate()} ${MONTHS[day.getMonth()]}`;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label="ค้นหาผู้ป่วย" onPress={() => router.push('/patient/search')}>
                <Sym name="magnifyingglass" size={20} color={palette.primary} weight="semibold" />
              </HeaderButton>
              <HeaderButton label="เพิ่มผู้ป่วยใหม่" onPress={() => router.push('/patient/new')}>
                <Sym name="plus" size={20} color={palette.primary} weight="semibold" />
              </HeaderButton>
            </View>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
        <SegmentedControl
          values={['ตารางนัด', 'ผู้ป่วยทั้งหมด']}
          selectedIndex={mode}
          onChange={(e) => setMode(e.nativeEvent.selectedSegmentIndex)}
          style={{ height: 32 }}
        />

        {mode === 0 ? (
          <Animated.View key="cal" entering={FadeIn.duration(200)}>
            <View style={{ marginTop: 8 }}>
              <WeekPager selected={day} onSelect={setDay} agenda={agenda} />
            </View>

            <View style={styles.dayHead}>
              <T v="callout" style={{ fontWeight: '600' }}>{dayLabel}</T>
              <T v="caption" color={ios.secondary}>{appts.length ? `${appts.length} นัด` : 'ไม่มีนัด'}</T>
            </View>

            {appts.length ? (
              appts.map((a, i) => {
                const p = patients.find((x) => x.id === a.pid);
                if (!p) return null;
                const gap = i > 0 && toMin(a.start) - toMin(appts[i - 1].end) >= 90;
                return (
                  <View key={a.start}>
                    {gap ? (
                      <View style={styles.slot}>
                        <View style={styles.timeCol}>
                          <T v="callout" color={ios.secondary}>{appts[i - 1].end}</T>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.rule} />
                          <Hatch label="ว่าง · ไม่มีนัด" height={64} />
                        </View>
                      </View>
                    ) : null}
                    <View style={styles.slot}>
                      <View style={styles.timeCol}>
                        <T v="callout" numberOfLines={1} style={{ fontWeight: '600' }}>{a.start}</T>
                        <T v="micro" color={ios.secondary}>น.</T>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.rule} />
                        <PressableScale scaleTo={0.97} onPress={() => router.push(`/patient/${p.id}`)} style={[styles.card, elevation.e1]} accessibilityLabel={p.name}>
                          <Avatar name={p.name} src={avatars[p.id]} size={48} />
                          <View style={{ flex: 1 }}>
                            <T v="body" numberOfLines={1} style={{ fontWeight: '600' }}>{p.name}</T>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Sym name="clock" size={13} color={ios.secondary} />
                              <T v="caption" color={ios.secondary}>{a.start} – {a.end} น.</T>
                            </View>
                            <T v="caption" color={palette.primary} numberOfLines={1}>{a.what}</T>
                          </View>
                          <PressableScale haptic="select" onPress={() => Linking.openURL(`tel:${p.phone.replace(/[^0-9]/g, '')}`)} style={styles.phone} accessibilityLabel={`โทร ${p.name}`}>
                            <Sym name="phone.fill" size={17} color={palette.primary} />
                          </PressableScale>
                        </PressableScale>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <IOSCard style={{ alignItems: 'center', paddingVertical: 28, gap: 6 }}>
                <Sym name="calendar" size={28} color={ios.tertiary} />
                <T v="callout" color={ios.secondary}>ไม่มีนัดในวันนี้</T>
              </IOSCard>
            )}
          </Animated.View>
        ) : (
          <Animated.View key="all" entering={FadeIn.duration(200)}>

            {/* ตัวกรองสถานะ */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginTop: -4, marginBottom: -4 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 20 }}>
              {FILTERS.map((f) => {
                const n = f === 'ทั้งหมด' ? patients.length : patients.filter((p) => p.status === f).length;
                return <Chip key={f} label={`${f} ${n}`} active={filter === f} onPress={() => setFilter(f)} />;
              })}
            </ScrollView>

            <View style={{ gap: 12 }}>
              {shown.map((p, i) => {
                const st = statusTone[p.status];
                const v = lastVisit(p);
                const next = nextAppt(agenda, p.id);
                return (
                  <Animated.View key={p.id} entering={FadeIn.delay(i * 40).duration(200)}>
                    <PressableScale scaleTo={0.98} onPress={() => router.push(`/patient/${p.id}`)} style={[styles.pcard, elevation.e1]} accessibilityLabel={p.name}>
                      <View style={styles.pTop}>
                        <Avatar name={p.name} src={avatars[p.id]} size={52} online={p.status === 'นัดวันนี้'} />
                        <View style={{ flex: 1 }}>
                          <T v="body" style={{ fontWeight: '600' }}>{p.name}</T>
                          <T v="caption" color={ios.secondary}>{p.sex} · {p.age} ปี · ธาตุ{p.element}</T>
                        </View>
                        <View style={[styles.status, { backgroundColor: st.bg }]}>
                          <T v="micro" color={st.fg}>{p.status}</T>
                        </View>
                      </View>
                      <View style={styles.pDivider} />
                      <View style={{ gap: 6 }}>
                        <View style={styles.pLine}>
                          <Sym name="stethoscope" size={15} color={palette.primary} />
                          <T v="callout" style={{ flex: 1 }}>{v ? v.diagnosis : 'ยังไม่มีการรักษา'}</T>
                        </View>
                        <View style={styles.pMeta}>
                          {v ? (
                            <View style={styles.pLine}>
                              <Sym name="clock.arrow.circlepath" size={13} color={ios.secondary} />
                              <T v="caption" color={ios.secondary}>ล่าสุด {v.date} · ครั้งที่ {v.no}</T>
                            </View>
                          ) : null}
                          {next ? (
                            <View style={styles.pLine}>
                              <Sym name="calendar" size={13} color={palette.primary} />
                              <T v="caption" color={palette.primary} style={{ fontWeight: '600' }}>นัด {next}</T>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </PressableScale>
                  </Animated.View>
                );
              })}
              {!shown.length ? (
                <IOSCard style={{ alignItems: 'center', paddingVertical: 28, gap: 6 }}>
                  <Sym name="person.crop.circle.badge.questionmark" size={28} color={ios.tertiary} />
                  <T v="callout" color={ios.secondary}>ไม่พบผู้ป่วย</T>
                </IOSCard>
              ) : null}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingBottom: 120 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  pill: { height: 76, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', gap: 2 },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 20, minHeight: 28 },
  todayBtn: { paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: palette.primarySoft, justifyContent: 'center' },
  pillOn: { backgroundColor: palette.primary },
  slot: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  timeCol: { width: 54, paddingTop: 2 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginTop: 12, marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous', padding: 12 },
  phone: { width: control.icon, height: control.icon, borderRadius: control.icon / 2, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12, marginBottom: 8, paddingHorizontal: 4 },
  status: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  pcard: { backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous', padding: 14 },
  pTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pDivider: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginVertical: 12 },
  pLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pMeta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
});
