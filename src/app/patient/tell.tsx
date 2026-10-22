/**
 * เล่าอาการ — เลือกผู้ป่วยก่อน แล้วครูปัญญาซักถามและบันทึกการรักษาด้วยเสียง
 * (ธีมมืดเดียวกับทุกหน้าของครูปัญญา) · ผู้ป่วยใหม่ → ครูปัญญาซักประวัติก่อน
 */
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { TextInput } from '../../components/AppText';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AISphere } from '../../components/AISphere';
import { Sym } from '../../components/ios';
import { Avatar, GlassCircle, PressableScale, T, useHaptic } from '../../components/ui';
import { avatarFor, lastVisit, type Patient } from '../../data/mock';
import { VisitSession } from './visit';
import { visitSortKey } from '../../data/tones';
import { useApp } from '../../store/app';
import { column } from '../../components/layout';
import { ageLabel } from '../../lib/birth';

const MINT = '#7CF0A8';

function TellInner() {
  const insets = useSafeAreaInsets();
  const h = useHaptic();
  const { patients } = useApp();
  const [q, setQ] = useState('');
  // เลือกผู้ป่วยแล้ว → เปลี่ยนเป็นการสนทนาในหน้าเดียวกัน (ลูกแก้วเลื่อนลงไปต่อ ไม่เปิดหน้าใหม่)
  const [picked, setPicked] = useState<Patient | null>(null);
  const orbRef = useRef<View>(null);
  const [from, setFrom] = useState<{ x: number; y: number; size: number } | undefined>();
  const pick = (p: Patient) => {
    h.press();
    Keyboard.dismiss();
    orbRef.current?.measureInWindow((x, y, w, hh) => {
      setFrom({ x: x + w / 2, y: y + hh / 2, size: w });
      setPicked(p);
    });
  };
  const list = useMemo(() => {
    const s = q.trim();
    const sorted = [...patients].sort((a, b) => visitSortKey(lastVisit(b)?.date) - visitSortKey(lastVisit(a)?.date));
    return s ? sorted.filter((p) => p.name.includes(s) || (p.phone ?? '').includes(s)) : sorted.slice(0, 30);
  }, [patients, q]);

  if (picked) return <VisitSession p={picked} morphFrom={from} />;

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <GlassCircle label="ปิด" onPress={() => router.back()} tint="rgba(255,255,255,0.12)">
          <Sym name="xmark" size={17} color="#FFFFFF" weight="semibold" />
        </GlassCircle>
        <T v="title" color="#FFFFFF">เล่าอาการ</T>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={[{ padding: 20, paddingBottom: insets.bottom + 40, gap: 12 }, column.read]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(450)} style={{ alignItems: 'center' }}>
          <View ref={orbRef} collapsable={false}>
            <AISphere size={130} active />
          </View>
          <T v="h2" color="#FFFFFF" center style={{ marginTop: 6 }}>วันนี้รักษาใครครับ</T>
          <T v="callout" color="rgba(255,255,255,0.6)" center style={{ marginTop: 4 }}>เลือกผู้ป่วย แล้วเล่าอาการให้ครูปัญญาฟัง ครูปัญญาจะถามเพิ่มและบันทึกการรักษาให้</T>
        </Animated.View>

        <PressableScale haptic="press" scaleTo={0.98} onPress={() => router.push('/patient/new')} style={styles.newRow} accessibilityLabel="ผู้ป่วยใหม่">
          <View style={[styles.icon, { backgroundColor: MINT }]}>
            <Sym name="person.badge.plus" size={18} color="#04150E" />
          </View>
          <View style={{ flex: 1 }}>
            <T v="bodyStrong" color="#FFFFFF">ผู้ป่วยใหม่</T>
            <T v="caption" color="rgba(255,255,255,0.6)">เพิ่มข้อมูล หรือให้ครูปัญญาซักประวัติด้วยเสียง</T>
          </View>
          <Sym name="chevron.right" size={13} color="rgba(255,255,255,0.45)" weight="semibold" />
        </PressableScale>

        {patients.length > 6 ? (
          <View style={styles.search}>
            <Sym name="magnifyingglass" size={15} color="rgba(255,255,255,0.5)" />
            <TextInput value={q} onChangeText={setQ} placeholder="ค้นชื่อหรือเบอร์โทร" placeholderTextColor="rgba(255,255,255,0.4)" style={styles.input} accessibilityLabel="ค้นหาผู้ป่วย" />
          </View>
        ) : null}

        {list.map((p, i) => {
          const v = lastVisit(p);
          return (
            <Animated.View key={p.id} entering={i < 10 ? FadeInDown.delay(i * 40).duration(260) : undefined}>
              <PressableScale haptic="select" scaleTo={0.98} onPress={() => pick(p)} style={styles.row} accessibilityLabel={`เล่าอาการ ${p.name}`}>
                <Avatar name={p.name} src={avatarFor(p)} size={42} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="bodyStrong" color="#FFFFFF" numberOfLines={1}>{p.name}</T>
                  <T v="caption" color="rgba(255,255,255,0.55)" numberOfLines={1}>{v ? `ครั้งล่าสุด ${v.date} · ${v.diagnosis}` : `${p.sex} ${ageLabel(p)} · ยังไม่มีการรักษา`}</T>
                </View>
                <Sym name="waveform" size={16} color={MINT} />
              </PressableScale>
            </Animated.View>
          );
        })}
        {!list.length && patients.length ? <T v="callout" color="rgba(255,255,255,0.5)" center>ไม่พบผู้ป่วยชื่อนี้</T> : null}
      </ScrollView>
    </View>
  );
}

export default function PatientTell() {
  return <TellInner />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 14, borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(124,240,168,0.12)', borderWidth: 1, borderColor: 'rgba(124,240,168,0.35)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)' },
  input: { flex: 1, fontSize: 17, color: '#FFFFFF' },
});
