/**
 * นัดหมาย — การ์ดวันปัดได้ (แบบ Apple Wallet): วันที่ตัวใหญ่ · รูปผู้ป่วยซ้อนกัน · การ์ดแดง = เลยนัด · การ์ดที่เลือกเป็นสีเขียว
 * ใต้การ์ด = รายชื่อนัดของวันนั้น · แตะผู้ป่วยเพื่อเปิด · ปุ่มข้อความ = ส่งข้อความถามอาการ/เตือนนัด
 */
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Avatar, PressableScale, T, useHaptic } from '../components/ui';
import { Sym, ios } from '../components/ios';
import { avatarFor, lastVisit, type Patient } from '../data/mock';
import { dayAt, isoIn, thShort, todayIso } from '../lib/reminders';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';

const DAYS = 14;
const TH_DAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const GREEN = ['#3FD089', '#14905C'] as const;
const RED = ['#FF8A7A', '#D2453A'] as const;

type Appt = { p: Patient; on: string };
type Card = { key: string; iso?: string; overdue?: boolean; list: Appt[] };

/** รูปผู้ป่วยซ้อนกัน (สูงสุด 3 + จำนวนที่เหลือ) */
function Faces({ list, light }: { list: Appt[]; light: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {list.slice(0, 3).map(({ p }, i) => (
        <View key={p.id} style={[styles.face, { marginLeft: i ? -12 : 0, borderColor: light ? 'rgba(255,255,255,0.9)' : palette.surface }]}>
          <Avatar name={p.name} src={avatarFor(p)} size={34} />
        </View>
      ))}
      {list.length > 3 ? (
        <View style={[styles.face, styles.more, { marginLeft: -12, borderColor: light ? 'rgba(255,255,255,0.9)' : palette.surface }]}>
          <T v="micro" color={palette.ink} style={{ fontWeight: '700' }}>+{list.length - 3}</T>
        </View>
      ) : null}
    </View>
  );
}

export default function Appointments() {
  const { patients } = useApp();
  const h = useHaptic();
  const { width } = useWindowDimensions();
  const cardW = Math.min(300, width * 0.68);
  const gap = 12;
  const side = (width - cardW) / 2;
  const today = todayIso();
  const scroller = useRef<ScrollView>(null);

  const appts = useMemo<Appt[]>(
    () =>
      patients
        .filter((p) => p.followUpOn && (p.status === 'ติดตามอาการ' || p.status === 'นัดวันนี้'))
        .map((p) => ({ p, on: p.followUpOn! }))
        .sort((a, b) => a.on.localeCompare(b.on)),
    [patients],
  );
  const overdue = appts.filter((a) => a.on < today);
  const cards: Card[] = [
    ...(overdue.length ? [{ key: 'overdue', overdue: true, list: overdue }] : []),
    ...Array.from({ length: DAYS }, (_, i) => {
      const iso = isoIn(i);
      return { key: iso, iso, list: appts.filter((a) => a.on === iso) };
    }),
  ];
  // เริ่มที่การ์ดวันนี้ (ถัดจากการ์ดเลยนัดถ้ามี)
  const startIdx = overdue.length ? 1 : 0;
  const [idx, setIdx] = useState(startIdx);
  const cur = cards[Math.min(idx, cards.length - 1)];
  const later = appts.filter((a) => a.on > isoIn(DAYS - 1));
  const next = appts.find((a) => a.on > (cur.iso ?? today));

  // เปิดหน้า → เลื่อนไปการ์ดวันนี้ (เว็บไม่รองรับ contentOffset ตั้งต้น)
  useEffect(() => {
    const t = setTimeout(() => scroller.current?.scrollTo({ x: startIdx * (cardW + gap), animated: false }), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIdx, cardW]);
  const go = (i: number, animated = true) => {
    scroller.current?.scrollTo({ x: i * (cardW + gap), animated });
    setIdx(i);
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (cardW + gap));
    if (i !== idx) h.tap();
    setIdx(Math.max(0, Math.min(cards.length - 1, i)));
  };

  return (
    <>
      <Stack.Screen options={{ title: 'นัดหมาย' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={styles.page}>
        <ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardW + gap}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: side, gap, paddingVertical: 16 }}
          style={{ marginHorizontal: -16, marginTop: -8 }}
          contentOffset={{ x: startIdx * (cardW + gap), y: 0 }}
          onMomentumScrollEnd={onEnd}
          onScrollEndDrag={(e) => e.nativeEvent.velocity?.x === 0 && onEnd(e)}
        >
          {cards.map((c, i) => {
            const on = i === idx;
            const d = c.iso ? dayAt(c.iso, 12) : null;
            const tint = c.overdue ? RED : on ? GREEN : null;
            const light = !!tint;
            const fg = light ? '#FFFFFF' : palette.ink;
            const sub = light ? 'rgba(255,255,255,0.85)' : ios.secondary;
            return (
              <PressableScale key={c.key} haptic="select" scaleTo={0.97} onPress={() => go(i)} style={[{ width: cardW }, on ? styles.cardShadow : elevation.e1, { borderRadius: 30 }]} accessibilityLabel={c.overdue ? `เลยนัด ${c.list.length} ราย` : `${thShort(c.iso!)} นัด ${c.list.length} ราย`}>
                {tint ? <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} /> : null}
                <View style={[styles.card, !tint && { backgroundColor: palette.surface }, !tint && !c.list.length && { opacity: 0.7 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <T v="subhead" color={sub} style={{ flex: 1, fontWeight: '700' }}>{c.overdue ? 'เลยวันนัด' : c.iso === today ? `วันนี้ · ${TH_DAY[d!.getDay()]}` : TH_DAY[d!.getDay()]}</T>
                    {c.list.length ? (
                      <View style={[styles.badge, { backgroundColor: light ? 'rgba(255,255,255,0.25)' : palette.primarySoft }]}>
                        <T v="caption" color={light ? '#FFFFFF' : palette.primaryDeep} style={{ fontWeight: '700' }}>{c.list.length} ราย</T>
                      </View>
                    ) : null}
                  </View>
                  {c.overdue ? (
                    <View>
                      <Sym name="exclamationmark.triangle.fill" size={44} color="#FFFFFF" />
                      <T v="callout" color="#FFFFFF" style={{ fontWeight: '700', marginTop: 6 }}>ยังไม่ได้ติดตาม</T>
                    </View>
                  ) : (
                    <View>
                      <T v="hero" color={fg} style={styles.bigDate}>{d!.getDate()}</T>
                      <T v="callout" color={sub} style={{ fontWeight: '600' }}>{TH_MONTH[d!.getMonth()]}</T>
                    </View>
                  )}
                  {c.list.length ? <Faces list={c.list} light={light} /> : <T v="subhead" color={sub}>ไม่มีนัด</T>}
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>

        {/* จุดบอกตำแหน่งการ์ด */}
        <View style={styles.dots}>
          {cards.map((c, i) => (
            <View key={c.key} style={[styles.dot, i === idx && styles.dotOn, c.overdue && { backgroundColor: i === idx ? '#D2453A' : '#F0A49A' }]} />
          ))}
        </View>

        <Animated.View key={cur.key} entering={FadeInDown.duration(260)} style={{ gap: 8 }}>
          <T v="h3" style={{ marginLeft: 4 }}>{cur.overdue ? `เลยนัด · ${cur.list.length} ราย` : cur.iso === today ? 'นัดวันนี้' : `นัด${thShort(cur.iso!)}`}</T>
          {cur.list.length ? (
            <View style={[styles.list, elevation.e1]}>
              {cur.list.map(({ p, on }, i) => {
                const v = lastVisit(p);
                const late = on < today ? Math.round((Date.parse(today) - Date.parse(on)) / 86400000) : 0;
                return (
                  <PressableScale key={p.id} haptic="select" scaleTo={0.98} onPress={() => router.push(`/patient/${p.id}`)} style={[styles.row, i > 0 && styles.sep]} accessibilityLabel={`${p.name} นัด ${thShort(on)}`}>
                    <Avatar name={p.name} src={avatarFor(p)} size={44} />
                    <View style={{ flex: 1 }}>
                      <T v="body" style={{ fontWeight: '600' }} numberOfLines={1}>{p.name}</T>
                      <T v="caption" color={ios.secondary} numberOfLines={1}>{v?.diagnosis && v.diagnosis !== '-' ? v.diagnosis : v?.symptoms ?? ''}</T>
                      {late ? <T v="caption" color="#D2453A" style={{ fontWeight: '600' }}>เลยนัด {late} วัน ({thShort(on)})</T> : null}
                    </View>
                    <PressableScale haptic="select" hitSlop={8} onPress={() => router.push({ pathname: '/patient/[id]', params: { id: p.id, ask: '1' } })} style={styles.msg} accessibilityLabel={`ส่งข้อความถึง ${p.name}`}>
                      <Sym name="message.fill" size={16} color={palette.primary} />
                    </PressableScale>
                  </PressableScale>
                );
              })}
            </View>
          ) : (
            <View style={[styles.empty, elevation.e1]}>
              <Sym name="calendar.badge.clock" size={28} color={ios.tertiary} />
              <T v="subhead" color={ios.secondary} center>ไม่มีนัดวันนี้</T>
              {next ? (
                <PressableScale haptic="select" onPress={() => { const j = cards.findIndex((c) => c.iso === next.on); if (j >= 0) go(j); }} hitSlop={6}>
                  <T v="subhead" color={palette.primary} style={{ fontWeight: '700' }} center>นัดถัดไป {thShort(next.on)} · {next.p.name.replace(/^(นาย|นางสาว|นาง|เด็กชาย|เด็กหญิง)/, '')}</T>
                </PressableScale>
              ) : null}
            </View>
          )}
          {later.length ? (
            <Animated.View entering={FadeIn} layout={LinearTransition} style={{ marginTop: 6 }}>
              <T v="caption" color={ios.tertiary} style={{ marginLeft: 4 }}>หลังจาก 2 สัปดาห์: {later.map((a) => `${a.p.name.replace(/^(นาย|นางสาว|นาง|เด็กชาย|เด็กหญิง)/, '')} (${thShort(a.on)})`).join(' · ')}</T>
            </Animated.View>
          ) : null}
          {!appts.length ? <T v="caption" color={ios.tertiary} center style={{ marginTop: 6 }}>นัดได้ตอนบันทึกการรักษา เลือกสถานะ “ติดตามอาการ” แล้วเลือกวันนัด</T> : null}
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48, gap: 10 },
  card: { height: 210, padding: 20, borderRadius: 30, justifyContent: 'space-between' },
  cardShadow: { boxShadow: '0px 14px 30px rgba(20,144,92,0.35)' },
  bigDate: { fontSize: 68, lineHeight: 74, fontWeight: '800', letterSpacing: -2 },
  badge: { paddingHorizontal: 10, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  face: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  more: { backgroundColor: '#FFFFFF' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: -4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(60,67,62,0.18)' },
  dotOn: { width: 18, backgroundColor: palette.primary },
  list: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 22, backgroundColor: palette.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  msg: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  empty: { alignItems: 'center', gap: 8, padding: 24, borderRadius: 22, backgroundColor: palette.surface },
});
