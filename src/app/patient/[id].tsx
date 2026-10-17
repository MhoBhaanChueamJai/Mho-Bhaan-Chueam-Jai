import { MenuView } from '@react-native-menu/menu';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { PractitionerGate } from '../../components/PractitionerGate';
import { Alert, Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import { NotFound } from '../../components/NotFound';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleIcon, PAGE_PAD } from '../../components/ListRow';
import { Sym, ios } from '../../components/ios';
import { PatientCard } from '../../components/PatientCard';
import { Button, GlassDock, HeaderBack, HeaderButton, PressableScale, T } from '../../components/ui';
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

/**
 * คำเตือนตามยาที่ผู้ป่วยใช้อยู่ (เดิมเป็นข้อความเดียวกันทุกคน "เลี่ยงรสร้อนจัด วัดความดัน" ซึ่งไม่ตรงกับยาจริง)
 * อ้างอิงอันตรกิริยาสมุนไพร-ยาที่พบบ่อย (ศูนย์ข้อมูลสมุนไพร ม.มหิดล / บัญชียาหลักแห่งชาติด้านสมุนไพร)
 */
function medsAdvice(meds: string[]) {
  const m = meds.join(' ').toLowerCase();
  const tips: string[] = [];
  if (/วาร์ฟาริน|warfarin|ละลายลิ่มเลือด|แอสไพริน|aspirin|clopidogrel|ต้านเกล็ดเลือด/.test(m)) tips.push('กินยาต้านการแข็งตัวของเลือด เลี่ยงขมิ้นชัน ขิง กระเทียม แปะก๊วย ปริมาณมาก (เลือดออกง่าย)');
  if (/ความดัน|amlodipine|แอมโลดิปีน|enalapril|losartan|ขับปัสสาวะ/.test(m)) tips.push('กินยาลดความดัน เลี่ยงชะเอมเทศ ระวังฟ้าทะลายโจรร่วมกับยาลดความดัน วัดความดันทุกครั้ง');
  if (/เบาหวาน|metformin|เมทฟอร์มิน|insulin|อินซูลิน|glipizide/.test(m)) tips.push('กินยาเบาหวาน ระวังสมุนไพรที่ลดน้ำตาลซ้ำกับยา เช่น มะระขี้นก อบเชย ตรวจน้ำตาลสม่ำเสมอ');
  if (/digoxin|ดิจอกซิน|หัวใจ/.test(m)) tips.push('กินยาโรคหัวใจ เลี่ยงชะเอมเทศ และยาระบาย (มะขามแขก ชุมเห็ดเทศ) ต่อเนื่อง');
  return tips.length ? tips.join(' · ') : `ใช้ ${meds[0]} อยู่ ถามครูปัญญาก่อนจ่ายสมุนไพรที่อาจตีกับยานี้`;
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
  const { patients } = useApp();
  const p = patients.find((x) => x.id === id);
  // ไม่พบผู้ป่วย → แจ้ง ไม่แสดงคนอื่นแทน (เดิมใช้ patients[0] ทำให้บันทึกการรักษาผิดคนได้)
  if (!p) return <NotFound title="ไม่พบผู้ป่วย" />;
  return <PatientBody p={p} />;
}

function PatientBody({ p }: { p: Patient }) {
  const { logOpen, removePatient } = useApp();
  // บันทึกว่าเปิดดูผู้ป่วยคนนี้ (ให้ครูปัญญาแนะนำคำค้นได้แม่นขึ้น)
  useEffect(() => {
    if (p?.id) logOpen(p.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);
  const insets = useSafeAreaInsets();
  const [openNo, setOpenNo] = useState<number | null>(p.visits[0]?.no ?? null);
  const share = () => Share.share({ message: exportText(p), title: p.name });
  const tel = (p.phone ?? '').replace(/[^0-9]/g, '');
  const call = () => {
    if (!tel) return Alert.alert('ไม่มีเบอร์โทร', 'ยังไม่ได้บันทึกเบอร์โทรของผู้ป่วยรายนี้');
    Linking.openURL(`tel:${tel}`).catch(() => {});
  };
  // บันทึกการรักษาด้วยเสียง (ครูปัญญาถามทีละเรื่อง)
  const record = () => router.push({ pathname: '/patient/visit', params: { pid: p.id } });
  const allergic = p.allergies && p.allergies !== 'ไม่มี';
  // ลบผู้ป่วย (เพิ่มผิด/ซ้ำ) — ยืนยันก่อน เพราะลบประวัติการรักษาทั้งหมดด้วย
  const remove = () =>
    Alert.alert(`ลบ ${p.name}?`, p.visits.length ? `ประวัติการรักษา ${p.visits.length} ครั้งจะถูกลบด้วย และกู้คืนไม่ได้` : 'ข้อมูลผู้ป่วยรายนี้จะถูกลบ และกู้คืนไม่ได้', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบผู้ป่วย',
        style: 'destructive',
        onPress: () => {
          removePatient(p.id);
          if (router.canGoBack()) router.back();
          else router.replace('/patients');
        },
      },
    ]);

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
          // แถบเครื่องมือ: บันทึกการรักษา (ครูปัญญา) · เพิ่มเติม (ส่งออก / ลบ)
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label="บันทึกการรักษาด้วยเสียง" onPress={record}>
                <Sym name="waveform" size={19} color={palette.primary} weight="semibold" />
              </HeaderButton>
              <MenuView
                shouldOpenOnLongPress={false}
                themeVariant="light"
                actions={[
                  { id: 'share', title: 'ส่งออก', image: 'square.and.arrow.up', imageColor: palette.ink },
                  { id: 'delete', title: 'ลบผู้ป่วย', image: 'trash', imageColor: '#E5484D', attributes: { destructive: true } },
                ]}
                onPressAction={({ nativeEvent }) => (nativeEvent.event === 'share' ? share() : nativeEvent.event === 'delete' ? remove() : undefined)}
              >
                <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="เพิ่มเติม">
                  <Sym name="ellipsis" size={19} color={palette.ink} weight="semibold" />
                </View>
              </MenuView>
            </View>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        {/* ── บัตรผู้ป่วย 3 มิติ (แตะเพื่อพลิกดูธาตุ · เอียงมือถือแสงเปลี่ยน) ── */}
        <Animated.View entering={FadeIn.duration(350)} style={{ marginTop: 8 }}>
          <PatientCard p={p} avatar={avatarFor(p)} onCall={call} />
        </Animated.View>

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
              ครูปัญญา: {medsAdvice(p.meds)}
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
        {/* บันทึกการรักษา: กรอกเอง หรือให้ครูปัญญาถามด้วยเสียง (ปุ่มกว้างเท่ากัน) */}
        <Button kind="secondary" style={{ flex: 1, height: 52 }} label="กรอกเอง" icon={<Sym name="square.and.pencil" size={17} color={palette.primary} />} onPress={() => router.push({ pathname: '/patient/record', params: { pid: p.id } })} />
        <Button style={{ flex: 1, height: 52 }} label="พูดบันทึก" icon={<Sym name="waveform" size={17} color="#FFFFFF" />} onPress={record} />
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
