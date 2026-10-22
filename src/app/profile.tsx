/**
 * ข้อมูลส่วนตัว — เปิดจากการ์ดโปรไฟล์ในหน้าตั้งค่า
 * บัญชี · บทบาทผู้ใช้
 * จัดการบัญชี: เมนู ••• บนแถบเครื่องมือ (แก้ไขข้อมูลบัญชี · เปลี่ยนรหัสผ่าน · ลบบัญชี)
 */
import { MenuView } from '../components/Menu';
import { Stack, router } from 'expo-router';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CircleIcon, ListRow, ListSection, PAGE_PAD } from '../components/ListRow';
import { Sym } from '../components/ios';
import { Avatar, PressableScale, T } from '../components/ui';
import { doctor } from '../data/mock';
import { kindOf, ROLE_PICKER, ROLES, roleOf } from '../lib/roles';
import { useApp } from '../store/app';
import { AVATAR_PRESETS, changeAvatar, presetKeys, useMyAvatar } from '../lib/myAvatar';
import { bmiLabel, myAge, myBmi, myElement } from '../lib/me';
import { thaiBirth } from '../lib/birth';
import { useDeleteAccount } from '../components/useDeleteAccount';
import { elevation, palette } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { column } from '../components/layout';

function Info({ icon, bg, label, value, last }: { icon: string; bg: string; label: string; value: string; last?: boolean }) {
  return <ListRow icon={<CircleIcon name={icon} color={bg} />} overline={label} title={value || '-'} last={last} />;
}

export default function Profile() {
  const { profile, settings, update } = useApp();
  const role = ROLES.find((r) => r.k === roleOf(settings.userRole))!;
  const myAvatar = useMyAvatar();
  const [presetOpen, setPresetOpen] = useState(false);
  // คนทั่วไปที่ยังไม่มีชื่อ ไม่ใช้ชื่อพ่อหมอตัวอย่าง
  const name = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || (kindOf(settings.userKind) === 'public' ? settings.username || 'ผู้ใช้' : doctor.name);
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
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={[{ paddingHorizontal: PAGE_PAD, paddingTop: 8, paddingBottom: 56 }, column.read]}>
      <Animated.View entering={FadeInDown.duration(420)} style={{ alignItems: 'center', marginTop: 8 }}>
        {/* แตะภาพเพื่อเปลี่ยน: ถ่ายรูป / เลือกจากคลังภาพ / เลือกตัวการ์ตูน / ใช้ภาพเริ่มต้น */}
        <PressableScale
          haptic="select"
          scaleTo={0.96}
          onPress={() => changeAvatar(settings.avatarUri || settings.avatarPreset, (u) => update({ avatarUri: u, avatarPreset: undefined }), () => setPresetOpen(true))}
          accessibilityLabel="เปลี่ยนภาพโปรไฟล์"
        >
          <View style={styles.avatarRing}>
            <Avatar name={name} src={myAvatar} size={96} />
          </View>
          <View style={styles.camBadge}>
            <Sym name="camera.fill" size={13} color="#FFFFFF" />
          </View>
        </PressableScale>
        <T v="h2" center style={{ marginTop: 12 }}>{name}</T>
        {ROLE_PICKER ? <T v="subhead" color={role.color}>{settings.userRole ? role.label : 'ยังไม่ได้เลือกบทบาท'}</T> : null}
      </Animated.View>

      <ListSection i={1} title="บัญชี">
        <Info icon="person.fill" bg={palette.primary} label="ชื่อ" value={profile?.first_name ?? name.split(' ')[0]} />
        <Info icon="person.text.rectangle.fill" bg="#5E6B63" label="นามสกุล" value={profile?.last_name ?? name.split(' ').slice(1).join(' ')} />
        <Info icon="envelope.fill" bg="#3B7DD8" label="อีเมล" value={profile?.email ?? '-'} last />
      </ListSection>

      {/* ข้อมูลสุขภาพของฉัน (คนทั่วไป): ครูปัญญาใช้เวลาถามเรื่องตัวเอง */}
      {kindOf(settings.userKind) === 'public' ? (
        <ListSection i={2} title="ข้อมูลสุขภาพของฉัน" footer="ครูปัญญาใช้ข้อมูลนี้เวลาคุณถามเรื่องตัวเอง · เก็บไว้ในเครื่องนี้เท่านั้น">
          {settings.me && (settings.me.birth || settings.me.age || settings.me.sex || settings.me.weight || settings.me.element) ? (
            <>
              {/* แสดงเฉพาะช่องที่กรอกแล้ว */}
              {myAge(settings.me) ? <Info icon="calendar" bg="#E0782A" label={settings.me.birth ? 'วันเกิด · อายุ' : 'อายุ'} value={[settings.me.birth ? thaiBirth(settings.me.birth) : '', `${myAge(settings.me)} ปี`].filter(Boolean).join(' · ')} /> : null}
              {settings.me.sex ? <Info icon="person.fill" bg="#7A4FD0" label="เพศ" value={settings.me.sex} /> : null}
              {settings.me.weight || settings.me.height ? <Info icon="scalemass.fill" bg="#3B7DD8" label="น้ำหนัก · ส่วนสูง" value={[settings.me.weight ? `${settings.me.weight} กก.` : '', settings.me.height ? `${settings.me.height} ซม.` : ''].filter(Boolean).join(' · ')} /> : null}
              {myBmi(settings.me) ? <Info icon="figure.stand" bg="#2E9D8F" label="BMI" value={`${myBmi(settings.me)!.toFixed(1)} · ${bmiLabel(myBmi(settings.me)!)}`} /> : null}
              <Info icon="sparkles" bg={palette.primary} label="ธาตุเจ้าเรือน" value={myElement(settings.me) ? `ธาตุ${myElement(settings.me)}` : 'ยังไม่ได้เลือก · ใส่วันเกิดหรือเลือกเอง'} />
              <ListRow icon={<CircleIcon name="pencil" color={palette.primary} />} title="แก้ไขข้อมูลสุขภาพ" onPress={() => router.push('/account/health')} chevron last />
            </>
          ) : (
            <ListRow icon={<CircleIcon name="heart.fill" color="#D9534A" />} title="เพิ่มข้อมูลสุขภาพ" subtitle="วันเกิด อายุ เพศ น้ำหนัก ส่วนสูง → ธาตุเจ้าเรือนของคุณ" onPress={() => router.push('/account/health')} chevron last />
          )}
        </ListSection>
      ) : null}

      {ROLE_PICKER ? <ListSection i={3} title="บทบาท" footer="ครูปัญญาปรับคำแนะนำตามบทบาทนี้ · เปลี่ยนได้ทุกเมื่อ">
        <ListRow icon={<CircleIcon name={role.icon} color={role.color} />} overline="บทบาทของฉัน" title={settings.userRole ? role.label : 'ยังไม่ได้เลือก'} subtitle={role.desc} onPress={() => router.push('/role')} chevron last />
      </ListSection> : null}

    </ScrollView>
    <AvatarPicker
      visible={presetOpen}
      keys={presetKeys(settings.userKind)}
      current={settings.avatarUri ? undefined : settings.avatarPreset}
      onClose={() => setPresetOpen(false)}
      onPick={(k) => {
        update({ avatarPreset: k, avatarUri: undefined });
        setPresetOpen(false);
      }}
    />
    {del.deleting ? (
      <View style={styles.busy}>
        <ActivityIndicator color="#FFFFFF" />
        <T v="subhead" color="#FFFFFF">กำลังลบบัญชี…</T>
      </View>
    ) : null}
    </>
  );
}

/** แผ่นเลือกตัวการ์ตูนเป็นภาพโปรไฟล์ */
function AvatarPicker({ visible, keys, current, onClose, onPick }: { visible: boolean; keys: string[]; current?: string; onClose: () => void; onPick: (k: string) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="ปิด" />
      <View style={[styles.pickSheet, elevation.e3, { paddingBottom: insets.bottom + 20 }]}>
        <T v="h3" center>เลือกตัวการ์ตูน</T>
        <View style={styles.pickGrid}>
          {keys.map((k) => (
            <PressableScale key={k} haptic="select" scaleTo={0.92} onPress={() => onPick(k)} accessibilityLabel={`ตัวการ์ตูน ${k}`} accessibilityState={{ selected: current === k }} style={[styles.pickItem, current === k && styles.pickOn]}>
              <Image source={AVATAR_PRESETS[k]} style={styles.pickImg} contentFit="cover" />
            </PressableScale>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  pickSheet: { backgroundColor: palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous', paddingTop: 22, paddingHorizontal: 20, gap: 18 },
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  pickItem: { padding: 3, borderRadius: 999, borderWidth: 3, borderColor: 'transparent' },
  pickOn: { borderColor: palette.primary },
  pickImg: { width: 84, height: 84, borderRadius: 42 },
  busy: { ...StyleSheet.absoluteFillObject, zIndex: 50, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.45)' },
  camBadge: { position: 'absolute', right: 2, bottom: 2, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, borderWidth: 2.5, borderColor: palette.bg },
  avatarRing: { padding: 4, borderRadius: 999, backgroundColor: palette.primarySoft },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, backgroundColor: palette.primary },
});
