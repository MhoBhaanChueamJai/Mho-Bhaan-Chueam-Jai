import { MenuView } from '@react-native-menu/menu';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { PractitionerGate } from '../../components/PractitionerGate';
import { Alert, Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import { NotFound } from '../../components/NotFound';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleIcon, ListRow, ListSection, PAGE_PAD } from '../../components/ListRow';
import { Sym, ios } from '../../components/ios';
import { PatientCard } from '../../components/PatientCard';
import { HeaderBack, PressableScale, T } from '../../components/ui';
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

/** เบอร์โทรแบบอ่านง่าย 081-000-0005 */
const fmtPhone = (t: string) => (t.length === 10 ? `${t.slice(0, 3)}-${t.slice(3, 6)}-${t.slice(6)}` : t);

/** ประวัติการรักษา: วันที่แบบปฏิทินด้านซ้าย การ์ดด้านขวา แตะเพื่อดูรายละเอียด */
/** สีป้ายผลการรักษา */
const RESULT_TONE: Record<string, { fg: string; bg: string }> = {
  หาย: { fg: '#1B7F4B', bg: '#DDF3E6' },
  ดีขึ้น: { fg: '#1B7F4B', bg: '#DDF3E6' },
  ทุเลา: { fg: '#1F7F9E', bg: '#DDF0F6' },
  ทรงตัว: { fg: '#5E6B63', bg: '#ECEFED' },
  แย่ลง: { fg: '#B0761E', bg: '#FBEEDB' },
  ส่งต่อ: { fg: '#C2453A', bg: '#FBE4E1' },
};
const resultTone = (r: string) => RESULT_TONE[r] ?? { fg: '#9A6A12', bg: '#FBF1DC' };
const filled = (x?: string) => !!x && x.trim() !== '-' && x.trim() !== '';

/** หนึ่งครั้งในไทม์ไลน์: จุดบนเส้นเวลา · การ์ดพับ = สรุป · แตะกางดูทุกช่อง ม.บ.5 */
function VisitItem({ v, open, onToggle, last, latest }: { v: MB5Visit; open: boolean; onToggle: () => void; last: boolean; latest: boolean }) {
  const dp = dateParts(v.date);
  const tone = resultTone(v.result);
  const title = filled(v.diagnosis) ? v.diagnosis : filled(v.symptoms) ? v.symptoms : 'ไม่ได้ระบุอาการ';
  const summary = filled(v.treatment) ? v.treatment : filled(v.symptoms) && title !== v.symptoms ? v.symptoms : '';
  return (
    <Animated.View layout={LinearTransition.duration(260)} style={styles.tlRow}>
      {/* เส้นเวลา: จุดทึบ = ล่าสุด · จุดกลวง = ครั้งก่อน */}
      <View style={styles.tlRail}>
        <View style={[styles.tlDot, latest ? styles.tlDotOn : null]} />
        {!last ? <View style={styles.tlLine} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
        <View style={styles.tlHead}>
          <T v="subhead" color={latest ? palette.primaryDeep : ios.secondary} style={{ fontWeight: '700' }}>
            {dp.d} {dp.m}{dp.y}
          </T>
          <T v="caption" color={ios.tertiary} style={{ flex: 1 }}> · ครั้งที่ {v.no}{latest ? ' · ล่าสุด' : ''}</T>
        </View>
        <PressableScale onPress={onToggle} scaleTo={0.99} haptic="select" style={[styles.tlCard, elevation.e1]} accessibilityLabel={`การรักษาครั้งที่ ${v.no} ${title}`}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <T v="title" numberOfLines={open ? undefined : 2} style={{ flex: 1 }}>{title}</T>
            <View style={[styles.result, { backgroundColor: tone.bg }]}>
              <T v="micro" color={tone.fg} style={{ fontWeight: '700' }}>{v.result}</T>
            </View>
          </View>
          {!open ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              {summary ? <Sym name="leaf.fill" size={11} color={palette.primary} /> : null}
              <T v="subhead" color={ios.secondary} numberOfLines={1} style={{ flex: 1 }}>{summary || 'แตะเพื่อดูรายละเอียด'}</T>
              <Sym name="chevron.down" size={12} color={ios.tertiary} weight="semibold" />
            </View>
          ) : (
            <Animated.View entering={FadeIn.duration(200)} style={styles.detail}>
              {DETAIL.filter((d) => filled(v[d.k] as string)).map((d, k, arr) => (
                <View key={d.k} style={[styles.detailRow, k < arr.length - 1 && styles.detailSep]}>
                  <CircleIcon name={d.icon} color={d.color} size={28} />
                  {/* หัวข้ออยู่เหนือเนื้อหา */}
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="caption" color={ios.secondary} style={{ fontWeight: '600' }}>{d.l}</T>
                    <T v="subhead">{String(v[d.k])}</T>
                  </View>
                </View>
              ))}
              <View style={{ alignItems: 'center', marginTop: 2 }}>
                <Sym name="chevron.up" size={12} color={ios.tertiary} weight="semibold" />
              </View>
            </Animated.View>
          )}
        </PressableScale>
      </View>
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
  const recordManual = () => router.push({ pathname: '/patient/record', params: { pid: p.id } });
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
          // แถบเครื่องมือ: เพิ่มบันทึกการรักษา (กรอกเอง / ครูปัญญา) · เพิ่มเติม (ส่งออก / ลบ)
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <MenuView
                shouldOpenOnLongPress={false}
                themeVariant="light"
                title={`บันทึกการรักษาครั้งที่ ${(p.visits[0]?.no ?? 0) + 1}`}
                actions={[
                  { id: 'ai', title: 'ให้ครูปัญญาบันทึก', image: 'sparkles', imageColor: palette.primary },
                  { id: 'manual', title: 'กรอกเอง', image: 'square.and.pencil', imageColor: palette.ink },
                ]}
                onPressAction={({ nativeEvent }) => (nativeEvent.event === 'ai' ? record() : nativeEvent.event === 'manual' ? recordManual() : undefined)}
              >
                <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="เพิ่มบันทึกการรักษา">
                  <Sym name="plus" size={20} color={palette.ink} weight="semibold" />
                </View>
              </MenuView>
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

        {/* ── ข้อมูลทั่วไป: รายการแบบ iOS แยก 2 หมวด (สุขภาพ · ติดต่อ) ── */}
        <ListSection i={1} title="สุขภาพ">
          <ListRow
            icon={<CircleIcon name="exclamationmark.triangle.fill" color={allergic ? palette.coral : '#8E8E93'} />}
            overline="แพ้ยา / อาหาร"
            title={allergic ? p.allergies : 'ไม่มี'}
            titleLines={2}
            danger={!!allergic}
          />
          <ListRow icon={<CircleIcon name="heart.fill" color="#C2564B" />} overline="โรคประจำตัว" title={p.chronic && p.chronic !== 'ไม่มี' ? p.chronic : 'ไม่มี'} titleLines={2} />
          {p.meds.length ? <ListRow icon={<CircleIcon name="pills.fill" color="#D9921A" />} overline="ยาที่ใช้อยู่" title={p.meds.join(', ')} titleLines={3} /> : null}
          <ListRow
            icon={<CircleIcon name="scalemass.fill" color="#7A5CC8" />}
            overline="น้ำหนัก · ส่วนสูง"
            title={p.weight && p.height ? `${p.weight} กก. · ${p.height} ซม.` : 'ยังไม่ระบุ'}
            last
          />
        </ListSection>

        {p.meds.length ? (
          <View style={[styles.aiNote, { marginTop: 12 }]}>
            <Sym name="sparkles" size={15} color={palette.primary} />
            <T v="subhead" color={palette.primaryDeep} style={{ flex: 1 }}>
              ครูปัญญา: {medsAdvice(p.meds)}
            </T>
          </View>
        ) : null}

        <ListSection i={2} title="ติดต่อ">
          <ListRow
            icon={<CircleIcon name="phone.fill" color={palette.primary} />}
            overline="เบอร์โทร"
            title={tel ? fmtPhone(tel) : 'ยังไม่ระบุ'}
            onPress={tel ? call : undefined}
            chevron={!!tel}
          />
          <ListRow icon={<CircleIcon name="house.fill" color="#3B7DD8" />} overline="ที่อยู่" title={fullAddress(p.address) || 'ยังไม่ระบุ'} titleLines={3} last />
        </ListSection>

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
            <T v="subhead" color={ios.secondary} center>ยังไม่มีประวัติการรักษา · กด + มุมขวาบนเพื่อบันทึก</T>
          </View>
        )}
      </ScrollView>

    </>
  );
}

const styles = StyleSheet.create({
  secTitle: { marginTop: 30, marginBottom: 12, marginLeft: 4 },
  countPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: palette.primarySoft },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aiNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: 14, borderRadius: 18, backgroundColor: palette.primarySoft },
  histHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30, marginBottom: 12, paddingHorizontal: 4 },
  tlRow: { flexDirection: 'row', gap: 12 },
  tlHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, marginLeft: 2 },
  tlDot: { width: 14, height: 14, borderRadius: 7, marginTop: 4, borderWidth: 2.5, borderColor: 'rgba(20,144,92,0.45)', backgroundColor: palette.bg },
  tlDotOn: { borderColor: palette.primary, backgroundColor: palette.primary, boxShadow: '0px 0px 0px 4px rgba(20,144,92,0.16)' },
  detailSep: { paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ios.separator },
  tlRail: { width: 18, alignItems: 'center' },
  tlLine: { flex: 1, width: 2, borderRadius: 1, backgroundColor: 'rgba(20,144,92,0.18)', marginTop: 4 },
  tlCard: { backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous', padding: 16 },
  result: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, marginTop: 2 },
  detail: { marginTop: 12, paddingTop: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, borderRadius: 20, backgroundColor: palette.surface },
});

export default function PatientDetail() {
  return (
    <PractitionerGate>
      <PatientDetailInner />
    </PractitionerGate>
  );
}
