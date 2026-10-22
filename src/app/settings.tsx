/**
 * ตั้งค่า — ออกแบบใหม่ตาม DESIGN_SYSTEM.md
 * โปรไฟล์ · ภาษาที่ใช้คุย (ภาษาถิ่น) · ความปลอดภัย · ข้อมูล · ออกจากระบบ
 * (ไม่มีการตั้งค่า AI — ครูปัญญาใช้โมเดล Gemma 4 ของ BMS และเสียงเดียวทั้งแอป)
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
import { doctor, fullAddress } from '../data/mock';
import { KINDS, ROLE_PICKER, ROLES, roleOf, showPatients } from '../lib/roles';
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
import { column } from '../components/layout';
import { clearChats } from '../lib/chatStore';

const enter = (i: number) => FadeInDown.delay(40 + i * 50).duration(420);

export default function Settings() {
  const lt = useLargeTitleScroll();
  const { settings, update, patients, wisdoms, clearLocal, setUnlocked, profile, sync, pendingCount, syncNow } = useApp();
  const [syncing, setSyncing] = useState(false);
  const myAvatar = useMyAvatar();
  // สถานะซิงก์: ให้หมอรู้ว่าข้อมูลขึ้นคลาวด์ครบแล้วหรือยัง
  const syncAt = settings.lastSyncAt ? new Date(settings.lastSyncAt) : null;
  const syncAtLabel = syncAt ? `${syncAt.getDate()}/${syncAt.getMonth() + 1} ${String(syncAt.getHours()).padStart(2, '0')}:${String(syncAt.getMinutes()).padStart(2, '0')}` : '';
  const syncLabel = syncing || sync === 'syncing'
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
  // บทบาทที่ผู้ใช้เลือกเอง (ไม่มีการยืนยันตัวตนแล้ว)
  const role = ROLES.find((r) => r.k === roleOf(settings.userRole))!;
  const doc = showPatients(settings.userKind);
  const clearChatHistory = () =>
    Alert.alert('ลบประวัติแชททั้งหมด?', 'ทุกแชทที่เก็บไว้ในเครื่องนี้จะถูกลบ และกู้คืนไม่ได้', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบทั้งหมด', style: 'destructive', onPress: () => clearChats().then(() => Alert.alert('ลบประวัติแชทแล้ว')) },
    ]);
  const kind = KINDS.find((k) => k.k === settings.userKind) ?? KINDS[1];

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
    Alert.alert(
      'ออกจากระบบ?',
      'ข้อมูลทั้งหมดยังเก็บไว้บนระบบคลาวด์ เข้าสู่ระบบอีกครั้งเพื่อใช้งานต่อได้ทันที',
      [
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
      <Animated.ScrollView {...lt} contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={[{ paddingHorizontal: PAGE_PAD, paddingTop: 8, paddingBottom: 64 }, column.read]} showsVerticalScrollIndicator={false}>
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
              {ROLE_PICKER ? <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: `${role.color}1F` }]}>
                  <Sym name={role.icon as any} size={11} color={role.color} />
                  <T v="caption" color={role.color} style={{ fontWeight: '700' }}>{settings.userRole ? role.label : 'ยังไม่ได้เลือกบทบาท'}</T>
                </View>
              </View> : null}
            </View>
            <Sym name="chevron.right" size={14} color={ios.tertiary} weight="semibold" />
          </PressableScale>
        </Animated.View>

        {/* บทบาทผู้ใช้: ปรับคำแนะนำของครูปัญญา (ปิดอยู่ — ใช้แบบรวม) */}
        {ROLE_PICKER ? (
          <ListSection i={1}>
            <ListRow icon={<CircleIcon name={role.icon} color={role.color} />} title="บทบาทของฉัน" subtitle={settings.userRole ? role.label : 'เลือกเพื่อให้ครูปัญญาแนะนำได้เหมาะกับคุณ'} onPress={() => router.push('/role')} chevron last />
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

        {/* ── การใช้งาน: ประชาชนทั่วไป / หมอ-บุคลากรสุขภาพ ── */}
        {!ROLE_PICKER ? (
          <ListSection i={3} title="การใช้งาน" footer={doc ? 'มีเมนูผู้ป่วย บันทึกการรักษา และเครื่องมือของหมอ' : 'เปลี่ยนเป็นหมอ/บุคลากรสุขภาพ เพื่อใช้เมนูผู้ป่วยและบันทึกการรักษา'}>
            <ListRow icon={<CircleIcon name={kind.icon} color={kind.color} />} title={kind.label} subtitle={settings.userKind ? 'แตะเพื่อเปลี่ยน' : 'ยังไม่ได้เลือก · แตะเพื่อเลือก'} onPress={() => router.push('/role')} chevron last />
          </ListSection>
        ) : null}

        {/* ── เครื่องมือของหมอ: รายงาน · คลังยา · นัดหมาย (หมอ/บุคลากรเท่านั้น) ── */}
        {doc ? <ListSection i={3} title="เครื่องมือของหมอ">
          <ListRow icon={<CircleIcon name="chart.bar.doc.horizontal.fill" color="#14905C" />} title="รายงาน" subtitle="dashboard การรักษา · รายเดือน/ปี · ส่งออก PDF" onPress={() => router.push('/report')} chevron />
          <ListRow icon={<CircleIcon name="cross.vial.fill" color="#C27A12" />} title="คลังยาของหมอ" subtitle="ยาที่ปรุงไว้ · วันหมดอายุ · เหลือเท่าไร" onPress={() => router.push('/stock')} chevron />
          <ListRow icon={<CircleIcon name="calendar" color="#2F7BE0" />} title="นัดหมาย" subtitle="นัดติดตามอาการวันนี้และสัปดาห์นี้" onPress={() => router.push('/appointments')} chevron last />
        </ListSection> : null}

        {/* ── ข้อมูล ── */}
        <ListSection i={3} title="ข้อมูล">
          <ListRow
            icon={<CircleIcon name={pendingCount || sync === 'error' ? 'exclamationmark.icloud.fill' : 'checkmark.icloud.fill'} color={pendingCount || sync === 'error' ? '#D9921A' : '#14905C'} />}
            title="ซิงก์ข้อมูล"
            subtitle={syncLabel}
            onPress={doSync}
            right={syncing ? <ActivityIndicator /> : <Sym name="arrow.triangle.2.circlepath" size={18} color={palette.primary} />}
          />
          <ListRow icon={<CircleIcon name="square.and.arrow.up" color="#3B7DD8" />} title={doc ? 'ส่งออกข้อมูลผู้ป่วย' : 'ส่งออกข้อมูล'} subtitle={doc ? `ผู้ป่วย ${patients.length} ราย · ภูมิปัญญา ${wisdoms.length} เรื่อง` : `ภูมิปัญญา ${wisdoms.length} เรื่อง`} onPress={exportAll} chevron />
          <ListRow icon={<CircleIcon name="trash.fill" color="#D9534A" />} title="ลบประวัติแชททั้งหมด" subtitle="แชทกับครูปัญญาที่เก็บไว้ในเครื่องนี้" onPress={clearChatHistory} />
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
