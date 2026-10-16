/**
 * ข้อมูลส่วนตัว — เปิดจากการ์ดโปรไฟล์ในหน้าตั้งค่า
 * บัญชี · การรับรองหมอพื้นบ้าน (ข้อมูลจากทะเบียนกรมการแพทย์แผนไทยฯ เมื่อยืนยันตัวตนแล้ว)
 */
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppIcon, Sym, ios } from '../components/ios';
import { Avatar, PressableScale, T } from '../components/ui';
import { avatars, doctor } from '../data/mock';
import { TYPE_LABEL } from './verify';
import { useApp } from '../store/app';
import { control, elevation, palette } from '../theme';

const thaiDate = (iso?: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear() + 543}`;
};

function Info({ icon, bg, label, value, last }: { icon: string; bg: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={styles.row}>
      <AppIcon name={icon as any} bg={bg} />
      <View style={[styles.rowMain, !last && styles.sep]}>
        <T v="subhead" color={ios.secondary}>{label}</T>
        <T v="body" style={{ marginTop: 1 }}>{value || '-'}</T>
      </View>
    </View>
  );
}

export default function Profile() {
  const { profile, isPractitioner } = useApp();
  const name = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || doctor.name;
  const types = profile?.healer_types?.length ? profile.healer_types.map((t) => TYPE_LABEL[t] ?? t).join(' · ') : '-';
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
      <Animated.View entering={FadeInDown.springify().damping(20)} style={{ alignItems: 'center', marginTop: 8 }}>
        <View style={styles.avatarRing}>
          <Avatar name={name} src={avatars.doctor} size={96} />
        </View>
        <T v="h2" center style={{ marginTop: 12 }}>{name}</T>
        <T v="subhead" color={isPractitioner ? palette.primaryDeep : ios.secondary}>{isPractitioner ? 'หมอพื้นบ้านที่ได้รับการรับรอง' : 'สมาชิกทั่วไป'}</T>
      </Animated.View>

      <T v="h3" style={styles.secTitle}>บัญชี</T>
      <Animated.View entering={FadeInDown.delay(60).springify().damping(20)} style={[styles.card, elevation.e1]}>
        <Info icon="person.fill" bg={palette.primary} label="ชื่อ" value={profile?.first_name ?? name.split(' ')[0]} />
        <Info icon="person.text.rectangle.fill" bg="#5E6B63" label="นามสกุล" value={profile?.last_name ?? name.split(' ').slice(1).join(' ')} />
        <Info icon="envelope.fill" bg="#3B7DD8" label="อีเมล" value={profile?.email ?? '-'} last />
      </Animated.View>

      <T v="h3" style={styles.secTitle}>การรับรองหมอพื้นบ้าน</T>
      {isPractitioner ? (
        <Animated.View entering={FadeInDown.delay(120).springify().damping(20)} style={[styles.card, elevation.e1]}>
          <Info icon="checkmark.seal.fill" bg={palette.primary} label="ประเภทหมอพื้นบ้าน" value={types} />
          <Info icon="doc.text.fill" bg="#8A6A44" label="เลขที่หนังสือรับรอง" value={profile?.cert_number ?? '-'} />
          <Info icon="mappin.and.ellipse" bg="#C2564B" label="จังหวัดที่ขึ้นทะเบียน" value={profile?.cert_province ?? '-'} />
          <Info icon="calendar" bg="#D9921A" label="หนังสือรับรองหมดอายุ" value={thaiDate(profile?.cert_expiry)} />
          <Info icon="checkmark.shield.fill" bg="#2A8C7A" label="ยืนยันตัวตนเมื่อ" value={thaiDate(profile?.verified_at)} last />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.delay(120).springify().damping(20)} style={[styles.card, elevation.e1, { padding: 16, gap: 12 }]}>
          <T v="subhead" color={ios.secondary}>ยังไม่ได้ยืนยันตัวตน ยืนยันด้วยเลขที่หนังสือรับรองหมอพื้นบ้าน เพื่อใช้งานการรักษาผู้ป่วย</T>
          <PressableScale haptic="press" onPress={() => router.push('/verify')} style={styles.verifyBtn}>
            <Sym name="person.badge.shield.checkmark.fill" size={18} color="#FFFFFF" />
            <T v="bodyStrong" color="#FFFFFF">ยืนยันตัวตนหมอพื้นบ้าน</T>
          </PressableScale>
        </Animated.View>
      )}
      <T v="caption" color={ios.secondary} style={{ marginTop: 8, paddingHorizontal: 6 }}>ข้อมูลการรับรองมาจากทะเบียนหมอพื้นบ้าน กรมการแพทย์แผนไทยและการแพทย์ทางเลือก</T>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatarRing: { padding: 4, borderRadius: 999, backgroundColor: palette.primarySoft },
  secTitle: { marginTop: 26, marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, gap: 14 },
  rowMain: { flex: 1, minHeight: control.row, paddingRight: 16, paddingVertical: 10, justifyContent: 'center' },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ios.separator },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, backgroundColor: palette.primary },
});
