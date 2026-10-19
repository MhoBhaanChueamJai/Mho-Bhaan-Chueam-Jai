/**
 * ตั้งค่า — ออกแบบใหม่ตาม DESIGN_SYSTEM.md
 * โปรไฟล์ · ภาษาที่ใช้คุย (ภาษาถิ่น) · ความปลอดภัย · ข้อมูล · ออกจากระบบ
 * (ไม่มีการตั้งค่า AI — ครูปัญญาใช้ 2 โมเดลร่วมกันอัตโนมัติ และเสียงเดียวทั้งแอป)
 */
import { Stack, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';
import { Switch } from '../components/AppSwitch';
import { Alert } from '../lib/alert';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSpeaker } from '../components/audio';
import { CircleIcon, ListRow, ListSection, PAGE_PAD } from '../components/ListRow';
import { Sym, ios } from '../components/ios';
import { Avatar, HeaderBack, PressableScale, T, useHaptic } from '../components/ui';
import { doctor, doctorTypes, fullAddress } from '../data/mock';
import { TYPE_LABEL } from './verify';
import { DIALECTS } from '../lib/dialect';
import { AISphere } from '../components/AISphere';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/app';
import { useMyAvatar } from '../lib/myAvatar';
import { APP_VERSION } from './about';
import { authenticateBiometric, biometricInfo, clearPin } from '../store/security';
import { elevation, palette } from '../theme';
import { LargeTitle, useLargeTitleScroll } from '../components/nav/LargeTitle';
import { openManual } from '../lib/manual';

const enter = (i: number) => FadeInDown.delay(40 + i * 50).duration(420);

export default function Settings() {
  const lt = useLargeTitleScroll();
  const { settings, update, patients, wisdoms, clearLocal, setUnlocked, profile, isPractitioner, sync, pendingCount, syncNow, demo } = useApp();
  const [syncing, setSyncing] = useState(false);
  const myAvatar = useMyAvatar();
  // สถานะซิงก์: ให้หมอรู้ว่าข้อมูลขึ้นคลาวด์ครบแล้วหรือยัง
  const syncAt = settings.lastSyncAt ? new Date(settings.lastSyncAt) : null;
  const syncAtLabel = syncAt ? `${syncAt.getDate()}/${syncAt.getMonth() + 1} ${String(syncAt.getHours()).padStart(2, '0')}:${String(syncAt.getMinutes()).padStart(2, '0')}` : '';
  const syncLabel = demo
    ? 'ข้อมูลเก็บในเครื่องนี้'
    : syncing || sync === 'syncing'
      ? 'กำลังซิงก์…'
      : pendingCount
        ? `รอส่งขึ้นคลาวด์ ${pendingCount} รายการ · แตะเพื่อส่งใหม่`
        : sync === 'error'
          ? 'ซิงก์ไม่สำเร็จ · แตะเพื่อลองใหม่'
          : sync === 'local'
            ? 'ยังไม่ได้เชื่อมต่อคลาวด์'
            : `ข้อมูลขึ้นคลาวด์ครบแล้ว${syncAtLabel ? ` · ล่าสุด ${syncAtLabel}` : ''}`;
  const doSync = async () => {
    if (syncing) return;
    setSyncing(true);
    await syncNow().catch(() => {});
    setSyncing(false);
  };
  const displayName = profile?.display_name || (profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ''}` : doctor.name);
  const [bio, setBio] = useState({ available: false, label: 'Face ID', icon: 'faceid' as 'faceid' | 'touchid' });
  useEffect(() => {
    biometricInfo().then(setBio);
  }, []);
  const tts = useSpeaker();
  const h = useHaptic();
  const dialect = settings.dialect ?? 'central';
  // ประเภทหมอพื้นบ้านจากทะเบียน (ยืนยันตัวตนแล้ว) หรือจากที่ตั้งไว้
  // หมอหนึ่งคนขึ้นทะเบียนได้หลายประเภท → แสดงเป็นป้ายแยกทีละประเภท
  const healers: string[] = isPractitioner
    ? profile?.healer_types?.length
      ? profile.healer_types.map((t) => TYPE_LABEL[t] ?? t)
      : [(doctorTypes.find((d) => d.key === settings.doctorType) ?? doctorTypes[0]).label]
    : [];

  const exportAll = () => {
    const text = patients
      .map((p) => `${p.name} (${p.sex} ${p.age} ปี) โทร ${p.phone}\nที่อยู่ ${fullAddress(p.address)}\nการรักษา ${p.visits.length} ครั้ง ล่าสุด: ${p.visits[0]?.diagnosis ?? '-'}`)
      .join('\n\n');
    Share.share({ title: 'ข้อมูลผู้ป่วย', message: `ข้อมูลผู้ป่วย ${patients.length} ราย\n\n${text}` });
  };

  /** เปิด: ไปหน้าตั้ง PIN, ปิด: ถามยืนยันแล้วลบ PIN */
  const togglePin = (on: boolean) => {
    if (on) return router.push({ pathname: '/pin-setup', params: { mode: 'change' } });
    Alert.alert('ปิดรหัส PIN?', settings.faceIdEnabled ? `ยังปลดล็อกด้วย ${bio.label} ได้ตามปกติ` : 'เปิดแอปครั้งถัดไปจะเข้าได้ทันทีโดยไม่ต้องปลดล็อก', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ปิด',
        style: 'destructive',
        onPress: async () => {
          await clearPin();
          update({ pinEnabled: false });
          h.success();
        },
      },
    ]);
  };

  /** เปิด: ยืนยันตัวตนด้วย Face ID ก่อน, ปิด: ปิดทันที */
  const toggleFace = async (on: boolean) => {
    if (!on) return update({ faceIdEnabled: false });
    if (!bio.available) return Alert.alert(`ยังใช้ ${bio.label} ไม่ได้`, `ตั้งค่า ${bio.label} ใน การตั้งค่า ของ iPhone ก่อน`);
    if (await authenticateBiometric(`เปิดใช้ ${bio.label} สำหรับหมอบ้านเชื่อมใจ`)) {
      update({ faceIdEnabled: true });
      h.success();
    }
  };

  const logout = () =>
    Alert.alert('ออกจากระบบ?', 'ข้อมูลทั้งหมดยังเก็บไว้บนระบบคลาวด์ เข้าสู่ระบบอีกครั้งเพื่อใช้งานต่อได้ทันที', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ',
        style: 'destructive',
        onPress: () => {
          tts.stop();
          // ล้างเฉพาะในเครื่อง — ห้ามลบข้อมูลบนคลาวด์ (เดิมเรียก resetData ซึ่งลบข้อมูลทั้งบัญชีบนคลาวด์)
          clearLocal();
          clearPin();
          supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          update({ loggedIn: false, phone: '', pinEnabled: false, faceIdEnabled: false });
          setUnlocked(false);
          h.success();
          router.dismissAll();
          router.replace('/login');
        },
      },
    ]);


  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <HeaderBack fallback="/home" color={palette.ink} /> }} />
      <Animated.ScrollView {...lt} contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 8, paddingBottom: 64 }} showsVerticalScrollIndicator={false}>
        <LargeTitle title="ตั้งค่า" bleed={16} />
        {/* ── โปรไฟล์: แถวบัญชีแบบ iPhone (รูปซ้าย · ชื่อ/อีเมล/สถานะ · ลูกศร) กดเพื่อดูข้อมูลส่วนตัว ── */}
        <Animated.View entering={enter(0)}>
          <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push('/profile')} style={[styles.card, styles.profile, elevation.e1]} accessibilityLabel="ดูข้อมูลส่วนตัว">
            <View style={styles.avatarRing}>
              <Avatar name={displayName} src={myAvatar} size={68} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <T v="title" numberOfLines={1} style={{ fontSize: 19, lineHeight: 26 }}>{displayName}</T>
              {profile?.email ? <T v="subhead" color={ios.secondary} numberOfLines={1}>{profile.email}</T> : null}
              <View style={styles.badges}>
                {/* แสดงประเภทแรก + จำนวนที่เหลือ (ดูทั้งหมดในหน้าข้อมูลส่วนตัว) */}
                <View style={[styles.badge, { backgroundColor: isPractitioner ? palette.primarySoft : '#FBEFD9' }]}>
                  <Sym name={isPractitioner ? 'checkmark.seal.fill' : 'person.fill'} size={11} color={isPractitioner ? palette.primary : palette.orange} />
                  <T v="caption" color={isPractitioner ? palette.primaryDeep : '#8A5A10'} style={{ fontWeight: '700' }}>{healers[0] ?? 'สมาชิกทั่วไป'}</T>
                </View>
                {healers.length > 1 ? (
                  <View style={[styles.badge, { backgroundColor: palette.primarySoft }]}>
                    <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '700' }}>+{healers.length - 1}</T>
                  </View>
                ) : null}
              </View>
            </View>
            <Sym name="chevron.right" size={14} color={ios.tertiary} weight="semibold" />
          </PressableScale>
        </Animated.View>

        {/* สมาชิกทั่วไป: ชวนยืนยันตัวตน */}
        {!isPractitioner ? (
          <ListSection i={1}>
            <ListRow icon={<CircleIcon name="person.badge.shield.checkmark.fill" color={palette.orange} />} title="ยืนยันตัวตนหมอพื้นบ้าน" subtitle="เพื่อใช้งานการรักษาและบันทึกข้อมูลผู้ป่วย" onPress={() => router.push('/verify')} chevron last />
          </ListSection>
        ) : null}

        {/* ── ครูปัญญา AI ── */}
        <ListSection i={1} title="ครูปัญญา AI">
          <ListRow
            icon={<View style={styles.aiIcon}><AISphere size={30} active={false} /></View>}
            title="ตั้งค่า AI"
            subtitle={`ภาษาพูด: ${DIALECTS.find((d) => d.id === dialect)?.label ?? 'ภาษากลาง'}`}
            onPress={() => router.push('/ai-settings')}
            chevron
            last
          />
        </ListSection>

        {/* ── ความปลอดภัย ── */}
        <ListSection i={2} title="ความปลอดภัย" footer={settings.pinEnabled || settings.faceIdEnabled ? 'กลับมาหลังออกจากแอปเกิน 1 นาที ต้องปลดล็อกก่อนใช้งาน' : 'ตั้งรหัส PIN หรือ Face ID เพื่อป้องกันข้อมูลผู้ป่วย'}>
          <ListRow icon={<CircleIcon name="lock.fill" color={palette.primary} />} title="รหัส PIN" subtitle={settings.pinEnabled ? 'เปิดอยู่' : 'ยังไม่ได้ตั้ง'} right={<Switch value={settings.pinEnabled} onValueChange={togglePin} trackColor={{ true: palette.primary }} />} />
          {settings.pinEnabled ? <ListRow icon={<CircleIcon name="key.fill" color="#5E6B63" />} title="เปลี่ยนรหัส PIN" onPress={() => router.push({ pathname: '/pin-setup', params: { mode: 'change' } })} chevron /> : null}
          <ListRow
            icon={<CircleIcon name={bio.icon} color="#2A8C7A" />}
            title={bio.label}
            subtitle={bio.available ? 'ปลดล็อกแอปด้วยใบหน้า' : 'ไม่พร้อมใช้งานบนเครื่องนี้'}
            last
            right={bio.available ? <Switch value={settings.faceIdEnabled} onValueChange={toggleFace} trackColor={{ true: palette.primary }} /> : undefined}
          />
        </ListSection>

        {/* ── ข้อมูล ── */}
        <ListSection i={3} title="ข้อมูล">
          <ListRow
            icon={<CircleIcon name={pendingCount || sync === 'error' ? 'exclamationmark.icloud.fill' : 'checkmark.icloud.fill'} color={pendingCount || sync === 'error' ? '#D9921A' : '#14905C'} />}
            title="ซิงก์ข้อมูล"
            subtitle={syncLabel}
            onPress={doSync}
            right={syncing ? <ActivityIndicator /> : <Sym name="arrow.triangle.2.circlepath" size={18} color={palette.primary} />}
          />
          <ListRow icon={<CircleIcon name="square.and.arrow.up" color="#3B7DD8" />} title="ส่งออกข้อมูลผู้ป่วย" subtitle={`ผู้ป่วย ${patients.length} ราย · ภูมิปัญญา ${wisdoms.length} เรื่อง`} onPress={exportAll} chevron />
          <ListRow icon={<CircleIcon name="hand.raised.fill" color="#7A5CC8" />} title="นโยบายความเป็นส่วนตัว" onPress={() => router.push('/privacy')} chevron last />
        </ListSection>

        {/* ── เกี่ยวกับ: ช่วยเหลือ · เวอร์ชัน ── */}
        <ListSection i={4} title="เกี่ยวกับ">
          <ListRow icon={<CircleIcon name="questionmark.circle.fill" color={palette.primary} />} title="ช่วยเหลือ · วิธีใช้งาน" onPress={openManual} chevron />
          <ListRow icon={<CircleIcon name="exclamationmark.bubble.fill" color="#E0861A" />} title="แจ้งปัญหา / เสนอแนะ" onPress={() => router.push('/feedback')} chevron />
          <ListRow icon={<CircleIcon name="info.circle.fill" color="#3B7DD8" />} title="เกี่ยวกับแอป" value={`เวอร์ชัน ${APP_VERSION}`} onPress={() => router.push('/about')} chevron last />
        </ListSection>

        {/* ── ออกจากระบบ ── */}
        <ListSection i={5}>
          <ListRow icon={<CircleIcon name="rectangle.portrait.and.arrow.right" color={palette.coral} />} title="ออกจากระบบ" danger onPress={logout} last />
        </ListSection>

        <T v="caption" color={ios.tertiary} center style={{ marginTop: 28, paddingHorizontal: 24, lineHeight: 20 }}>
          หมอบ้านเชื่อมใจ เวอร์ชัน {APP_VERSION}{'\n'}คำแนะนำจากครูปัญญาเป็นข้อมูลเบื้องต้น ไม่ใช่การวินิจฉัยแทนแพทย์
        </T>
      </Animated.ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 20, paddingHorizontal: 18 },
  avatarRing: { padding: 3, borderRadius: 999, backgroundColor: palette.primarySoft },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  aiIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#05090A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
