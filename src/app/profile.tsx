/**
 * ข้อมูลส่วนตัว — เปิดจากการ์ดโปรไฟล์ในหน้าตั้งค่า
 * บัญชี · การรับรองหมอพื้นบ้าน (ข้อมูลจากทะเบียนกรมการแพทย์แผนไทยฯ เมื่อยืนยันตัวตนแล้ว)
 */
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CircleIcon, ListRow, ListSection, PAGE_PAD } from '../components/ListRow';
import { Sym, ios } from '../components/ios';
import { Avatar, PressableScale, T } from '../components/ui';
import { avatars, doctor } from '../data/mock';
import { TYPE_LABEL } from './verify';
import { useApp } from '../store/app';
import { palette } from '../theme';

const thaiDate = (iso?: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear() + 543}`;
};

function Info({ icon, bg, label, value, last }: { icon: string; bg: string; label: string; value: string; last?: boolean }) {
  return <ListRow icon={<CircleIcon name={icon} color={bg} />} overline={label} title={value || '-'} last={last} />;
}

export default function Profile() {
  const { profile, isPractitioner } = useApp();
  const name = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || doctor.name;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 8, paddingBottom: 56 }}>
      <Animated.View entering={FadeInDown.springify().damping(20)} style={{ alignItems: 'center', marginTop: 8 }}>
        <View style={styles.avatarRing}>
          <Avatar name={name} src={avatars.doctor} size={96} />
        </View>
        <T v="h2" center style={{ marginTop: 12 }}>{name}</T>
        <T v="subhead" color={isPractitioner ? palette.primaryDeep : ios.secondary}>{isPractitioner ? 'หมอพื้นบ้านที่ได้รับการรับรอง' : 'สมาชิกทั่วไป'}</T>
      </Animated.View>

      <ListSection i={1} title="บัญชี">
        <Info icon="person.fill" bg={palette.primary} label="ชื่อ" value={profile?.first_name ?? name.split(' ')[0]} />
        <Info icon="person.text.rectangle.fill" bg="#5E6B63" label="นามสกุล" value={profile?.last_name ?? name.split(' ').slice(1).join(' ')} />
        <Info icon="envelope.fill" bg="#3B7DD8" label="อีเมล" value={profile?.email ?? '-'} last />
      </ListSection>

      {isPractitioner ? (
        <ListSection i={2} title="การรับรองหมอพื้นบ้าน" footer="ข้อมูลการรับรองมาจากทะเบียนหมอพื้นบ้าน กรมการแพทย์แผนไทยและการแพทย์ทางเลือก">
          {/* หลายประเภทได้ → ป้ายแยกทีละประเภท */}
          <View style={styles.typeRow}>
            <CircleIcon name="checkmark.seal.fill" color={palette.primary} />
            <View style={{ flex: 1, gap: 8 }}>
              <T v="subhead" color={ios.secondary}>ประเภทหมอพื้นบ้าน ({profile?.healer_types?.length ?? 0} ประเภท)</T>
              <View style={styles.typeChips}>
                {(profile?.healer_types ?? []).map((t) => (
                  <View key={t} style={styles.typeChip}>
                    <T v="subhead" color={palette.primaryDeep} style={{ fontWeight: '600' }}>{TYPE_LABEL[t] ?? t}</T>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.typeSep} />
          </View>
            ))}
          </View>
          <Info icon="doc.text.fill" bg="#8A6A44" label="เลขที่หนังสือรับรอง" value={profile?.cert_number ?? '-'} />
          <Info icon="mappin.and.ellipse" bg="#C2564B" label="จังหวัดที่ขึ้นทะเบียน" value={profile?.cert_province ?? '-'} />
          <Info icon="calendar" bg="#D9921A" label="หนังสือรับรองหมดอายุ" value={thaiDate(profile?.cert_expiry)} />
          <Info icon="checkmark.shield.fill" bg="#2A8C7A" label="ยืนยันตัวตนเมื่อ" value={thaiDate(profile?.verified_at)} last />
        </ListSection>
      ) : (
        <ListSection i={2} title="การรับรองหมอพื้นบ้าน">
          <View style={{ padding: 20, gap: 14 }}>
          <T v="subhead" color={ios.secondary}>ยังไม่ได้ยืนยันตัวตน ยืนยันด้วยเลขที่หนังสือรับรองหมอพื้นบ้าน เพื่อใช้งานการรักษาผู้ป่วย</T>
          <PressableScale haptic="press" onPress={() => router.push('/verify')} style={styles.verifyBtn}>
            <Sym name="person.badge.shield.checkmark.fill" size={18} color="#FFFFFF" />
            <T v="bodyStrong" color="#FFFFFF">ยืนยันตัวตนหมอพื้นบ้าน</T>
          </PressableScale>
          </View>
        </ListSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16, paddingHorizontal: 18 },
  typeSep: { position: 'absolute', left: 74, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(20,80,50,0.12)' },
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: palette.primarySoft },
  avatarRing: { padding: 4, borderRadius: 999, backgroundColor: palette.primarySoft },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, backgroundColor: palette.primary },
});
