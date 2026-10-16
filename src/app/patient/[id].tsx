import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { PractitionerGate } from '../../components/PractitionerGate';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleIcon, PAGE_PAD } from '../../components/ListRow';
import { Sym, ios } from '../../components/ios';
import { AISphere } from '../../components/AISphere';
import { PatientCard } from '../../components/PatientCard';
import { Button, GlassDock, HeaderBack, PressableScale, T } from '../../components/ui';
import { avatarFor, fullAddress, type MB5Visit, type Patient } from '../../data/mock';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

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

const DETAIL: { k: keyof MB5Visit; l: string; icon: string; color: string }[] = [
  { k: 'symptoms', l: 'อาการ', icon: 'waveform.path.ecg', color: '#C2564B' },
  { k: 'exam', l: 'ตรวจร่างกาย', icon: 'hand.raised.fill', color: '#3B7DD8' },
  { k: 'treatment', l: 'การรักษา', icon: 'leaf.fill', color: '#14905C' },
  { k: 'followUp', l: 'การติดตามผล', icon: 'calendar', color: '#D9921A' },
  { k: 'note', l: 'หมายเหตุ', icon: 'note.text', color: '#7A5CC8' },
];

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
/** "16/10/2569" → { d: '16', m: 'ต.ค.', y: '69' } */
const dateParts = (s: string) => {
  const [d, m, y] = s.split('/');
  return { d: String(Number(d) || d), m: TH_M[Number(m) - 1] ?? '', y: (y ?? '').slice(-2) };
};

/** ปุ่มลัดวงกลม (แบบ Contacts): ไอคอนในวงกลม + ป้ายใต้ปุ่ม */
function QuickAction({ sym, label, onPress, primary, ai }: { sym?: any; label: string; onPress?: () => void; primary?: boolean; ai?: boolean }) {
  return (
    <PressableScale haptic="press" scaleTo={0.94} onPress={onPress} style={styles.qa} accessibilityLabel={label}>
      {ai ? (
        // ไอคอน AI: ก้อนแสงครูปัญญาในวงกลมดำ
        <View style={[styles.qaCircle, { backgroundColor: '#05090A', overflow: 'hidden' }, elevation.e2]}>
          <AISphere size={60} active />
        </View>
      ) : (
        <View style={[styles.qaCircle, primary ? { backgroundColor: palette.primary } : { backgroundColor: palette.surface }, elevation.e1]}>
          <Sym name={sym} size={22} color={primary ? '#FFFFFF' : palette.primary} />
        </View>
      )}
      <T v="subhead" color={primary ? palette.primaryDeep : ios.label} style={{ fontWeight: '600' }}>{label}</T>
    </PressableScale>
  );
}

/** ช่องข้อมูลแบบตาราง 2 คอลัมน์ (ไอคอนวงกลมเล็ก · ป้าย · ค่า) */
function Tile({ icon, color, label, value, wide, onPress, alert }: { icon: string; color: string; label: string; value: string; wide?: boolean; onPress?: () => void; alert?: boolean }) {
  const body = (
    <View style={[styles.tile, elevation.e1, alert && styles.tileAlert]}>
      <View style={styles.tileHead}>
        <CircleIcon name={icon} color={color} size={32} />
        <T v="caption" color={alert ? palette.coral : ios.secondary} style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>{label}</T>
        {onPress ? <Sym name="chevron.right" size={11} color={ios.tertiary} weight="semibold" /> : null}
      </View>
      <T v="body" color={alert ? palette.coral : ios.label} style={{ fontWeight: '600', marginTop: 8 }} numberOfLines={wide ? 3 : 2}>{value}</T>
    </View>
  );
  return (
    <View style={wide ? { width: '100%' } : { width: '48.5%' }}>
      {onPress ? (
        <PressableScale onPress={onPress} scaleTo={0.98} haptic="select" accessibilityLabel={`${label} ${value}`}>
          {body}
        </PressableScale>
      ) : (
        body
      )}
    </View>
  );
}

/** ประวัติการรักษา: วันที่แบบปฏิทินด้านซ้าย การ์ดด้านขวา แตะเพื่อดูรายละเอียด */
function VisitItem({ v, open, onToggle, last, latest }: { v: MB5Visit; open: boolean; onToggle: () => void; last: boolean; latest: boolean }) {
  const dp = dateParts(v.date);
  return (
    <Animated.View layout={LinearTransition.duration(260)} style={styles.tlRow}>
      <View style={styles.tlRail}>
        <View style={[styles.cal, latest && styles.calOn]}>
          <T v="title" color={latest ? '#FFFFFF' : palette.ink} style={{ lineHeight: 22 }}>{dp.d}</T>
          <T v="micro" color={latest ? 'rgba(255,255,255,0.85)' : ios.secondary}>{dp.m}{dp.y}</T>
        </View>
        {!last ? <View style={styles.tlLine} /> : null}
      </View>
      <PressableScale onPress={onToggle} scaleTo={0.99} haptic="select" style={[styles.tlCard, elevation.e1]} accessibilityLabel={`การรักษาครั้งที่ ${v.no}`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T v="caption" color={ios.secondary} style={{ flex: 1, fontWeight: '600' }}>ครั้งที่ {v.no}{latest ? ' · ล่าสุด' : ''}</T>
          <View style={styles.result}>
            <T v="micro" color={palette.primaryDeep}>{v.result}</T>
          </View>
        </View>
        <T v="title" numberOfLines={open ? undefined : 1} style={{ marginTop: 6 }}>{v.diagnosis}</T>
        {!open ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <T v="subhead" color={ios.secondary} numberOfLines={1} style={{ flex: 1 }}>{v.symptoms}</T>
            <Sym name="chevron.down" size={12} color={ios.tertiary} weight="semibold" />
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(200)} style={styles.detail}>
            {DETAIL.filter((d) => v[d.k]).map((d) => (
              <View key={d.k} style={styles.detailRow}>
                <CircleIcon name={d.icon} color={d.color} size={28} />
                <View style={{ flex: 1, gap: 1 }}>
                  <T v="caption" color={ios.secondary} style={{ fontWeight: '600' }}>{d.l}</T>
                  <T v="subhead">{String(v[d.k])}</T>
                </View>
              </View>
            ))}
            <View style={{ alignItems: 'center' }}>
              <Sym name="chevron.up" size={12} color={ios.tertiary} weight="semibold" />
            </View>
          </Animated.View>
        )}
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
          headerTintColor: palette.ink,
          headerBackButtonDisplayMode: 'minimal',
          headerBackVisible: false,
          headerLeft: () => <HeaderBack fallback="/patients" color={palette.ink} />,
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        {/* ── บัตรผู้ป่วย 3 มิติ (แตะเพื่อพลิกดูธาตุ · เอียงมือถือแสงเปลี่ยน) ── */}
        <Animated.View entering={FadeIn.duration(350)} style={{ marginTop: 8 }}>
          <PatientCard p={p} avatar={avatarFor(p)} />
        </Animated.View>

        {/* ── ปุ่มลัด ── */}
        <View style={[styles.qaRow, { marginTop: 6 }]}>
          <QuickAction sym="phone.fill" label="โทร" onPress={call} />
          <QuickAction ai label="บันทึกการรักษา" onPress={record} primary />
          <QuickAction sym="square.and.arrow.up" label="ส่งออก" onPress={share} />
        </View>

        {/* ── ข้อมูลทั่วไป: ช่องตาราง 2 คอลัมน์ ── */}
        <T v="h3" style={styles.secTitle}>ข้อมูลทั่วไป</T>
        <View style={styles.grid}>
          <Tile icon="phone.fill" color={palette.primary} label="เบอร์โทร" value={p.phone} onPress={call} />
          <Tile icon="scalemass.fill" color="#7A5CC8" label="น้ำหนัก · ส่วนสูง" value={p.weight && p.height ? `${p.weight} กก. · ${p.height} ซม.` : 'ยังไม่ระบุ'} />
          <Tile icon="heart.fill" color="#C2564B" label="โรคประจำตัว" value={p.chronic} />
          <Tile icon="exclamationmark.triangle.fill" color={allergic ? palette.coral : '#8E8E93'} label="แพ้ยา / อาหาร" value={p.allergies} alert={!!allergic} />
          {p.meds.length ? <Tile wide icon="pills.fill" color="#D9921A" label="ยาที่ใช้อยู่" value={p.meds.join(', ')} /> : null}
          <Tile wide icon="house.fill" color="#3B7DD8" label="ที่อยู่" value={fullAddress(p.address) || 'ยังไม่ระบุ'} />
        </View>

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
          <View style={styles.countPill}>
            <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '700' }}>{p.visits.length} ครั้ง</T>
          </View>
        </View>
        {p.visits.length ? (
          <View>
            {p.visits.map((v, i) => (
              <VisitItem key={v.no} v={v} latest={i === 0} last={i === p.visits.length - 1} open={openNo === v.no} onToggle={() => setOpenNo(openNo === v.no ? null : v.no)} />
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
        <Button style={{ flex: 1, height: 52 }} label={`บันทึกการรักษาครั้งที่ ${(p.visits[0]?.no ?? 0) + 1}`} icon={<Sym name="sparkles" size={18} color="#FFFFFF" />} onPress={record} />
      </GlassDock>
    </>
  );
}

const styles = StyleSheet.create({
  secTitle: { marginTop: 30, marginBottom: 12, marginLeft: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: { backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous', padding: 14, minHeight: 96 },
  tileAlert: { backgroundColor: '#FFF4F2', borderWidth: 1, borderColor: 'rgba(217,83,74,0.25)' },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: palette.primarySoft },
  cal: { width: 46, paddingVertical: 6, borderRadius: 14, alignItems: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: 'rgba(20,80,50,0.12)' },
  calOn: { backgroundColor: palette.primary, borderColor: palette.primary },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  qaRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 22 },
  qa: { alignItems: 'center', gap: 8, width: 110 },
  qaCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  aiNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: 14, borderRadius: 18, backgroundColor: palette.primarySoft },
  histHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30, marginBottom: 12, paddingHorizontal: 4 },
  tlRow: { flexDirection: 'row', gap: 12 },
  tlRail: { width: 46, alignItems: 'center' },
  tlLine: { flex: 1, width: 2, borderRadius: 1, backgroundColor: 'rgba(20,144,92,0.15)', marginVertical: 4 },
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
