import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { PractitionerGate } from '../../components/PractitionerGate';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleIcon, ListRow, ListSection, PAGE_PAD } from '../../components/ListRow';
import { Sym, ios } from '../../components/ios';
import { Avatar, Button, GlassDock, HeaderBack, PressableScale, T } from '../../components/ui';
import { avatarFor, fullAddress, type MB5Visit, type Patient } from '../../data/mock';
import { statusLabel, statusTone } from '../../data/tones';
import { useApp } from '../../store/app';
import { elementColor, elevation, palette } from '../../theme';

/** ข้อความสำหรับส่งออก (รูปแบบทะเบียนการรักษาของกรมการแพทย์แผนไทยฯ) */
function exportText(p: Patient) {
  const head = [
    'ทะเบียนการรักษา ประวัติการรักษา และผลการรักษาผู้ป่วย',
    '',
    `ชื่อ-สกุล ${p.name}  เพศ ${p.sex}  อายุ ${p.age} ปี`,
    `ที่อยู่ ${fullAddress(p.address)}`,
    `เบอร์โทรศัพท์ ${p.phone}`,
    `โรคประจำตัว ${p.chronic}  การแพ้ยา/อาหาร ${p.allergies}`,
    `น้ำหนัก ${p.weight} กิโลกรัม  ส่วนสูง ${p.height} เซนติเมตร`,
    '',
  ];
  const rows = [...p.visits]
    .reverse()
    .map(
      (v) =>
        `ครั้งที่ ${v.no} | ${v.date}\nอาการเจ็บป่วย: ${v.symptoms}\nตรวจร่างกาย: ${v.exam}\nวินิจฉัยโรค: ${v.diagnosis}\nการรักษา: ${v.treatment}\nผลการรักษา: ${v.result}\nการติดตามผล: ${v.followUp}${v.note ? `\nหมายเหตุ: ${v.note}` : ''}`,
    );
  return [...head, ...rows].join('\n');
}

const DETAIL: { k: keyof MB5Visit; l: string }[] = [
  { k: 'symptoms', l: 'อาการ' },
  { k: 'exam', l: 'ตรวจร่างกาย' },
  { k: 'treatment', l: 'การรักษา' },
  { k: 'followUp', l: 'การติดตามผล' },
  { k: 'note', l: 'หมายเหตุ' },
];

/** ปุ่มลัดวงกลม (แบบ Contacts): ไอคอนในวงกลม + ป้ายใต้ปุ่ม */
function QuickAction({ sym, label, onPress, primary }: { sym: any; label: string; onPress?: () => void; primary?: boolean }) {
  return (
    <PressableScale haptic="press" scaleTo={0.94} onPress={onPress} style={styles.qa} accessibilityLabel={label}>
      <View style={[styles.qaCircle, primary ? { backgroundColor: palette.primary } : { backgroundColor: palette.surface }, elevation.e1]}>
        <Sym name={sym} size={22} color={primary ? '#FFFFFF' : palette.primary} />
      </View>
      <T v="subhead" color={primary ? palette.primaryDeep : ios.label} style={{ fontWeight: '600' }}>{label}</T>
    </PressableScale>
  );
}

/** ช่องตัวเลขสรุป (อายุ / ธาตุ / BMI) */
function Stat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.stat}>
      <T v="caption" color={ios.secondary}>{label}</T>
      <T v="title" color={tint ?? ios.label} style={{ marginTop: 2 }}>{value}</T>
    </View>
  );
}

/** ประวัติการรักษาแบบไทม์ไลน์: จุด+เส้นด้านซ้าย การ์ดด้านขวา แตะเพื่อดูรายละเอียด */
function VisitItem({ v, open, onToggle, last }: { v: MB5Visit; open: boolean; onToggle: () => void; last: boolean }) {
  return (
    <Animated.View layout={LinearTransition.duration(260)} style={styles.tlRow}>
      <View style={styles.tlRail}>
        <View style={[styles.tlDot, open && { backgroundColor: palette.primary }]}>
          <T v="caption" color={open ? '#FFFFFF' : palette.primaryDeep} style={{ fontWeight: '700' }}>{v.no}</T>
        </View>
        {!last ? <View style={styles.tlLine} /> : null}
      </View>
      <PressableScale onPress={onToggle} scaleTo={0.99} haptic="select" style={[styles.tlCard, elevation.e1]} accessibilityLabel={`การรักษาครั้งที่ ${v.no}`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T v="caption" color={ios.secondary} style={{ flex: 1 }}>{v.date}</T>
          <View style={styles.result}>
            <T v="micro" color={palette.primaryDeep}>{v.result}</T>
          </View>
          <Sym name={open ? 'chevron.up' : 'chevron.down'} size={12} color={ios.tertiary} weight="semibold" />
        </View>
        <T v="title" numberOfLines={open ? undefined : 1} style={{ marginTop: 4 }}>{v.diagnosis}</T>
        {!open ? <T v="subhead" color={ios.secondary} numberOfLines={1} style={{ marginTop: 2 }}>{v.symptoms}</T> : null}
        {open ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.detail}>
            {DETAIL.filter((d) => v[d.k]).map((d) => (
              <View key={d.k} style={{ gap: 2 }}>
                <T v="caption" color={ios.secondary} style={{ fontWeight: '600' }}>{d.l}</T>
                <T v="subhead">{String(v[d.k])}</T>
              </View>
            ))}
          </Animated.View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

function PatientDetailInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { patients, logOpen } = useApp();
  const p = patients.find((x) => x.id === id) ?? patients[0];
  // บันทึกว่าเปิดดูผู้ป่วยคนนี้ (ให้ครูปัญญาแนะนำคำค้นได้แม่นขึ้น)
  useEffect(() => {
    if (p?.id) logOpen(p.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);
  const insets = useSafeAreaInsets();
  const [openNo, setOpenNo] = useState<number | null>(p.visits[0]?.no ?? null);
  const el = elementColor[p.element];
  const st = statusTone[p.status];
  const bmi = p.weight && p.height ? p.weight / (p.height / 100) ** 2 : 0;
  const share = () => Share.share({ message: exportText(p), title: p.name });
  const call = () => Linking.openURL(`tel:${p.phone.replace(/[^0-9]/g, '')}`);
  // บันทึกการรักษาด้วยเสียง (ครูปัญญาถามทีละเรื่อง)
  const record = () => router.push({ pathname: '/patient/visit', params: { pid: p.id } });
  const allergic = p.allergies && p.allergies !== 'ไม่มี';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: palette.primary,
          headerBackButtonDisplayMode: 'minimal',
          headerBackVisible: false,
          headerLeft: () => <HeaderBack fallback="/patients" color={palette.primary} />,
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        {/* ── ส่วนหัว: รูป ชื่อ สถานะ + ตัวเลขสรุป ── */}
        <Animated.View entering={FadeIn.duration(350)} style={[styles.hero, elevation.e1]}>
          <View style={styles.avatarRing}>
            <Avatar name={p.name} src={avatarFor(p)} size={92} />
          </View>
          <T v="h2" center style={{ marginTop: 12 }}>{p.name}</T>
          <View style={[styles.status, { backgroundColor: st.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: st.fg }]} />
            <T v="caption" color={st.fg} style={{ fontWeight: '700' }}>{statusLabel(p.status)}</T>
          </View>
          <View style={styles.stats}>
            <Stat label="เพศ · อายุ" value={`${p.sex} ${p.age} ปี`} />
            <View style={styles.statSep} />
            <Stat label="ธาตุเจ้าเรือน" value={el.label} tint={el.fg} />
            <View style={styles.statSep} />
            <Stat label="BMI" value={bmi ? bmi.toFixed(1) : '-'} />
          </View>
        </Animated.View>

        {/* ── ปุ่มลัด ── */}
        <View style={styles.qaRow}>
          <QuickAction sym="phone.fill" label="โทร" onPress={call} />
          <QuickAction sym="mic.fill" label="บันทึกการรักษา" onPress={record} primary />
          <QuickAction sym="square.and.arrow.up" label="ส่งออก" onPress={share} />
        </View>

        {/* ── ข้อมูลทั่วไป ── */}
        <ListSection i={1} title="ข้อมูลทั่วไป">
          <ListRow icon={<CircleIcon name="house.fill" color="#3B7DD8" />} overline="ที่อยู่" title={fullAddress(p.address) || 'ยังไม่ระบุ'} titleLines={3} />
          <ListRow icon={<CircleIcon name="phone.fill" color={palette.primary} />} overline="เบอร์โทรศัพท์" title={p.phone} onPress={call} chevron />
          <ListRow icon={<CircleIcon name="heart.fill" color="#C2564B" />} overline="โรคประจำตัว" title={p.chronic} titleLines={2} />
          <ListRow icon={<CircleIcon name="exclamationmark.triangle.fill" color={allergic ? palette.coral : '#8E8E93'} />} overline="การแพ้ยา / อาหาร" title={p.allergies} titleLines={2} />
          <ListRow icon={<CircleIcon name="scalemass.fill" color="#7A5CC8" />} overline="น้ำหนัก / ส่วนสูง" title={p.weight && p.height ? `${p.weight} กก. · ${p.height} ซม.` : 'ยังไม่ระบุ'} last={!p.meds.length} />
          {p.meds.length ? <ListRow icon={<CircleIcon name="pills.fill" color="#D9921A" />} overline="ยาที่ใช้อยู่" title={p.meds.join(', ')} titleLines={2} last /> : null}
        </ListSection>

        {p.meds.length ? (
          <View style={styles.aiNote}>
            <Sym name="sparkles" size={15} color={palette.primary} />
            <T v="subhead" color={palette.primaryDeep} style={{ flex: 1 }}>
              ครูปัญญา: ใช้ {p.meds[0]} อยู่ ควรเลี่ยงสมุนไพรรสร้อนจัด และวัดความดันทุกครั้ง
            </T>
          </View>
        ) : null}

        {/* ── ประวัติการรักษา (ไทม์ไลน์) ── */}
        <View style={styles.histHead}>
          <T v="h3">ประวัติการรักษา</T>
          <T v="subhead" color={ios.secondary}>{p.visits.length} ครั้ง</T>
        </View>
        {p.visits.length ? (
          <View>
            {p.visits.map((v, i) => (
              <VisitItem key={v.no} v={v} last={i === p.visits.length - 1} open={openNo === v.no} onToggle={() => setOpenNo(openNo === v.no ? null : v.no)} />
            ))}
          </View>
        ) : (
          <View style={[styles.empty, elevation.e1]}>
            <Sym name="doc.text" size={26} color={ios.tertiary} />
            <T v="subhead" color={ios.secondary} center>ยังไม่มีประวัติการรักษา</T>
          </View>
        )}
      </ScrollView>

      <GlassDock>
        <Button style={{ flex: 1, height: 52 }} label={`บันทึกการรักษาครั้งที่ ${(p.visits[0]?.no ?? 0) + 1}`} icon={<Sym name="mic.fill" size={18} color="#FFFFFF" />} onPress={record} />
      </GlassDock>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 8, paddingTop: 24, paddingBottom: 18, paddingHorizontal: 16, borderRadius: 22, borderCurve: 'continuous', backgroundColor: palette.surface },
  avatarRing: { padding: 4, borderRadius: 999, backgroundColor: palette.primarySoft },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginTop: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  stats: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: 18, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  stat: { flex: 1, alignItems: 'center' },
  statSep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: ios.separator },
  qaRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 22 },
  qa: { alignItems: 'center', gap: 8, width: 110 },
  qaCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  aiNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: 14, borderRadius: 18, backgroundColor: palette.primarySoft },
  histHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 32, marginBottom: 12, paddingHorizontal: 4 },
  tlRow: { flexDirection: 'row', gap: 12 },
  tlRail: { width: 30, alignItems: 'center' },
  tlDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  tlLine: { flex: 1, width: 2, backgroundColor: palette.primarySoft, marginTop: 4 },
  tlCard: { flex: 1, backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous', padding: 16, marginBottom: 12 },
  result: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: palette.primarySoft },
  detail: { marginTop: 12, paddingTop: 12, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, borderRadius: 20, backgroundColor: palette.surface },
});

export default function PatientDetail() {
  return (
    <PractitionerGate>
      <PatientDetailInner />
    </PractitionerGate>
  );
}
