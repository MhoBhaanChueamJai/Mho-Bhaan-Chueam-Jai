import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { PractitionerGate } from '../../components/PractitionerGate';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Group, IOSCard, SectionTitle, Sym, ios } from '../../components/ios';
import { Avatar, Button, GlassDock, HeaderBack, HeaderButton, PressableScale, T } from '../../components/ui';
import { avatars, fullAddress, type MB5Visit, type Patient } from '../../data/mock';
import { statusTone } from '../../data/tones';
import { useApp } from '../../store/app';
import { elementColor, palette } from '../../theme';

/** ข้อความสำหรับส่งออก (รูปแบบทะเบียนการรักษาของกรมการแพทย์แผนไทยฯ) */
function exportText(p: Patient) {
  const head = [
    'ทะเบียนการรักษา ประวัติการรักษา และผลการรักษาผู้ป่วย (แบบ ม.บ.5)',
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
  { k: 'symptoms', l: 'อาการเจ็บป่วย' },
  { k: 'exam', l: 'ตรวจร่างกาย' },
  { k: 'treatment', l: 'การรักษา' },
  { k: 'followUp', l: 'การติดตามผล' },
  { k: 'note', l: 'หมายเหตุ' },
];

/** แถวข้อมูลแบบ Contacts: ป้ายเล็กด้านบน ค่าอยู่ด้านล่าง */
function InfoRow({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.info}>
      <T v="caption" color={ios.secondary}>{label}</T>
      <T v="body" color={tint ?? ios.label}>{value}</T>
    </View>
  );
}

function Action({ sym, label, onPress }: { sym: any; label: string; onPress?: () => void }) {
  return (
    <IOSCard onPress={onPress} containerStyle={{ flex: 1 }} style={styles.action}>
      <Sym name={sym} size={22} color={palette.primary} />
      <T v="caption" color={palette.primary} style={{ fontWeight: '600' }}>{label}</T>
    </IOSCard>
  );
}

function VisitRow({ v, open, onToggle }: { v: MB5Visit; open: boolean; onToggle: () => void }) {
  return (
    <Animated.View layout={LinearTransition.duration(220)}>
      <PressableScale onPress={onToggle} scaleTo={0.99} haptic="select" style={styles.visit}>
        <View style={styles.no}>
          <T v="callout" color={palette.primary} style={{ fontWeight: '700' }}>{v.no}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T v="body" numberOfLines={open ? undefined : 1} style={{ fontWeight: '600' }}>{v.diagnosis}</T>
          <T v="caption" color={ios.secondary}>{v.date} · {v.result}</T>
        </View>
        <Sym name={open ? 'chevron.up' : 'chevron.down'} size={13} color={ios.tertiary} weight="semibold" />
      </PressableScale>
      {open ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.detail}>
          {DETAIL.filter((d) => v[d.k]).map((d) => (
            <View key={d.k} style={{ gap: 1 }}>
              <T v="caption" color={ios.secondary}>{d.l}</T>
              <T v="callout">{String(v[d.k])}</T>
            </View>
          ))}
        </Animated.View>
      ) : null}
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
  const record = () => router.push({ pathname: '/capture', params: { mode: 'patient', pid: p.id } });

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
          headerRight: () => (
            <HeaderButton onPress={share} label="ส่งออก">
              <Sym name="square.and.arrow.up" size={20} color={palette.primary} weight="semibold" />
            </HeaderButton>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        {/* ส่วนบนแบบ Contacts */}
        <View style={styles.hero}>
          <Avatar name={p.name} src={avatars[p.id]} size={96} />
          <T v="h1" center style={{ marginTop: 10, fontWeight: '700' }}>{p.name}</T>
          <T v="callout" color={ios.secondary} center>
            {p.sex} · {p.age} ปี · {el.label}
          </T>
          <View style={[styles.status, { backgroundColor: st.bg }]}>
            <T v="caption" color={st.fg} style={{ fontWeight: '600' }}>{p.status}</T>
          </View>
        </View>

        <View style={styles.actions}>
          <Action sym="phone.fill" label="โทร" onPress={() => Linking.openURL(`tel:${p.phone.replace(/[^0-9]/g, '')}`)} />
          <Action sym="mic.fill" label="บันทึก" onPress={record} />
          <Action sym="square.and.arrow.up" label="ส่งออก" onPress={share} />
        </View>

        <SectionTitle title="ข้อมูลทั่วไป" />
        <Group inset={16}>
          <InfoRow label="ที่อยู่" value={fullAddress(p.address) || 'ยังไม่ระบุ'} />
          <InfoRow label="เบอร์โทรศัพท์" value={p.phone} tint={palette.primary} />
          <InfoRow label="โรคประจำตัว" value={p.chronic} />
          <InfoRow label="การแพ้ยา / อาหาร" value={p.allergies} tint={p.allergies !== 'ไม่มี' ? palette.coral : undefined} />
          <InfoRow label="น้ำหนัก / ส่วนสูง" value={bmi ? `${p.weight} กก. · ${p.height} ซม. · BMI ${bmi.toFixed(1)}` : 'ยังไม่ระบุ'} />
          {p.meds.length ? <InfoRow label="ยาที่ใช้อยู่" value={p.meds.join(', ')} /> : null}
        </Group>

        {p.meds.length ? (
          <View style={styles.note}>
            <Sym name="sparkles" size={16} color={ios.secondary} />
            <T v="caption" color={ios.secondary} style={{ flex: 1 }}>
              ครูปัญญา: ใช้ {p.meds[0]} อยู่ ควรเลี่ยงสมุนไพรรสร้อนจัด และวัดความดันทุกครั้ง
            </T>
          </View>
        ) : null}

        <SectionTitle title="ประวัติการรักษา" action={`${p.visits.length} ครั้ง`} />
        {p.visits.length ? (
          <Group>
            {p.visits.map((v) => (
              <VisitRow key={v.no} v={v} open={openNo === v.no} onToggle={() => setOpenNo(openNo === v.no ? null : v.no)} />
            ))}
          </Group>
        ) : (
          <IOSCard>
            <T v="callout" color={ios.secondary} center>ยังไม่มีประวัติการรักษา</T>
          </IOSCard>
        )}
      </ScrollView>

      <GlassDock>
        <Button style={{ flex: 1 }} label={`บันทึกการรักษาครั้งที่ ${(p.visits[0]?.no ?? 0) + 1}`} icon={<Sym name="mic.fill" size={18} color="#FFFFFF" />} onPress={record} />
      </GlassDock>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 8 },
  status: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  action: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  info: { paddingHorizontal: 16, paddingVertical: 11, gap: 2 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 10 },
  visit: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 60 },
  no: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  detail: { paddingLeft: 60, paddingRight: 16, paddingBottom: 14, gap: 10 },
});

export default function PatientDetail() {
  return (
    <PractitionerGate>
      <PatientDetailInner />
    </PractitionerGate>
  );
}
