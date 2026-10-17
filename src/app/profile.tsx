/**
 * ข้อมูลส่วนตัว — เปิดจากการ์ดโปรไฟล์ในหน้าตั้งค่า
 * บัญชี · การรับรองหมอพื้นบ้าน (ข้อมูลจากทะเบียนกรมการแพทย์แผนไทยฯ เมื่อยืนยันตัวตนแล้ว)
 * จัดการบัญชี: เมนู ••• บนแถบเครื่องมือ (แก้ไขข้อมูลบัญชี · เปลี่ยนรหัสผ่าน · ลบบัญชี)
 */
import { MenuView } from '@react-native-menu/menu';
import { Stack, router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CircleIcon, ListRow, ListSection, PAGE_PAD } from '../components/ListRow';
import { Sym, ios } from '../components/ios';
import { Avatar, PressableScale, T } from '../components/ui';
import { doctor } from '../data/mock';
import { TYPE_LABEL } from './verify';
import { useApp } from '../store/app';
import { changeAvatar, useMyAvatar } from '../lib/myAvatar';
import { useDeleteAccount } from '../components/useDeleteAccount';
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
  const { profile, isPractitioner, settings, update } = useApp();
  const myAvatar = useMyAvatar();
  const name = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || doctor.name;
  const del = useDeleteAccount();
  return (
    <>
    {/* แถบเครื่องมือ: เมนู ••• แก้ไขข้อมูลบัญชี · เปลี่ยนรหัสผ่าน (เปิดเป็นแผ่น) · ลบบัญชี */}
    <Stack.Screen
      options={{
        headerRight: () => (
          <MenuView
            shouldOpenOnLongPress={false}
            themeVariant="light"
            actions={[
              { id: 'edit', title: 'แก้ไขข้อมูลบัญชี', image: 'person.crop.circle', imageColor: palette.ink },
              { id: 'password', title: 'เปลี่ยนรหัสผ่าน', image: 'key', imageColor: palette.ink },
              { id: 'delete', title: 'ลบบัญชี', image: 'trash', imageColor: '#E5484D', attributes: { destructive: true } },
            ]}
            onPressAction={({ nativeEvent: e }) => (e.event === 'edit' ? router.push('/account/edit') : e.event === 'password' ? router.push('/account/password') : e.event === 'delete' ? del.ask() : undefined)}
          >
            <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="เพิ่มเติม">
              <Sym name="ellipsis" size={19} color={palette.ink} weight="semibold" />
            </View>
          </MenuView>
        ),
      }}
    />
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 8, paddingBottom: 56 }}>
      <Animated.View entering={FadeInDown.duration(420)} style={{ alignItems: 'center', marginTop: 8 }}>
        {/* แตะภาพเพื่อเปลี่ยน: ถ่ายรูป / เลือกจากคลังภาพ / ใช้ภาพเริ่มต้น */}
        <PressableScale haptic="select" scaleTo={0.96} onPress={() => changeAvatar(settings.avatarUri, (u) => update({ avatarUri: u }))} accessibilityLabel="เปลี่ยนภาพโปรไฟล์">
          <View style={styles.avatarRing}>
            <Avatar name={name} src={myAvatar} size={96} />
          </View>
          <View style={styles.camBadge}>
            <Sym name="camera.fill" size={13} color="#FFFFFF" />
          </View>
        </PressableScale>
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
          {/* หลายประเภทได้ → เขียนต่อกันคั่นด้วยจุลภาค */}
          <ListRow
            icon={<CircleIcon name="checkmark.seal.fill" color={palette.primary} />}
            overline="ประเภทหมอพื้นบ้าน"
            title={(profile?.healer_types ?? []).map((t) => TYPE_LABEL[t] ?? t).join(', ') || '-'}
            titleLines={3}
          />
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
    {del.deleting ? (
      <View style={styles.busy}>
        <ActivityIndicator color="#FFFFFF" />
        <T v="subhead" color="#FFFFFF">กำลังลบบัญชี…</T>
      </View>
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  busy: { ...StyleSheet.absoluteFillObject, zIndex: 50, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.45)' },
  camBadge: { position: 'absolute', right: 2, bottom: 2, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, borderWidth: 2.5, borderColor: palette.bg },
  avatarRing: { padding: 4, borderRadius: 999, backgroundColor: palette.primarySoft },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, backgroundColor: palette.primary },
});
