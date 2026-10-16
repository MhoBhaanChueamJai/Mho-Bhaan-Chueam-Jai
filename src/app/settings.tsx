/**
 * ตั้งค่า — ออกแบบใหม่ตาม DESIGN_SYSTEM.md
 * โปรไฟล์ · ภาษาที่ใช้คุย (ภาษาถิ่น) · ความปลอดภัย · ข้อมูล · ออกจากระบบ
 * (ไม่มีการตั้งค่า AI — ครูปัญญาใช้ 2 โมเดลร่วมกันอัตโนมัติ และเสียงเดียวทั้งแอป)
 */
import { Stack, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSpeaker } from '../components/audio';
import { AppIcon, Sym, ios } from '../components/ios';
import { Avatar, HeaderBack, PressableScale, T, useHaptic } from '../components/ui';
import { avatars, doctor, doctorTypes, fullAddress } from '../data/mock';
import { TYPE_LABEL } from './verify';
import { DIALECTS } from '../lib/dialect';
import { AISphere } from '../components/AISphere';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/app';
import { authenticateBiometric, biometricInfo, clearPin } from '../store/security';
import { control, elevation, palette } from '../theme';

const enter = (i: number) => FadeInDown.delay(40 + i * 50).springify().damping(20);

/** แถวรายการในการ์ด (แบบหน้า Settings ของ iPhone) */
function Row({ icon, title, value, right, onPress, last, danger, chevron }: { icon?: React.ReactNode; title: string; value?: string; right?: React.ReactNode; onPress?: () => void; last?: boolean; danger?: boolean; chevron?: boolean }) {
  const body = (
    <View style={styles.row}>
      {icon}
      <View style={[styles.rowMain, !last && styles.sep]}>
        <T v="body" color={danger ? palette.coral : ios.label} style={{ flex: 1 }} numberOfLines={1}>{title}</T>
        {value ? <T v="subhead" color={ios.secondary}>{value}</T> : null}
        {right}
        {chevron ? <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" /> : null}
      </View>
    </View>
  );
  return onPress ? (
    <PressableScale onPress={onPress} scaleTo={0.99} haptic="select">
      {body}
    </PressableScale>
  ) : (
    body
  );
}

function Section({ title, footer, children, i }: { title: string; footer?: string; children: React.ReactNode; i: number }) {
  return (
    <Animated.View entering={enter(i)} layout={LinearTransition.springify().damping(20)} style={{ marginTop: 26 }}>
      <T v="h3" style={styles.secTitle}>{title}</T>
      {children}
      {footer ? <T v="caption" color={ios.secondary} style={styles.secFooter}>{footer}</T> : null}
    </Animated.View>
  );
}

export default function Settings() {
  const { settings, update, patients, wisdoms, resetData, setUnlocked, profile, isPractitioner } = useApp();
  const displayName = profile?.display_name || (profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ''}` : doctor.name);
  const [bio, setBio] = useState({ available: false, label: 'Face ID', icon: 'faceid' as 'faceid' | 'touchid' });
  useEffect(() => {
    biometricInfo().then(setBio);
  }, []);
  const tts = useSpeaker();
  const h = useHaptic();
  const type = doctorTypes.find((d) => d.key === settings.doctorType) ?? doctorTypes[0];
  const dialect = settings.dialect ?? 'central';
  const types = isPractitioner ? (profile?.healer_types?.length ? profile.healer_types.map((t) => TYPE_LABEL[t] ?? t).join(' · ') : type.label) : null;

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
    Alert.alert('ออกจากระบบ?', 'ข้อมูลที่บันทึกในเครื่องนี้จะถูกล้าง และต้องเข้าสู่ระบบใหม่ในครั้งถัดไป', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ',
        style: 'destructive',
        onPress: () => {
          tts.stop();
          resetData();
          clearPin();
          supabase.auth.signOut().catch(() => {});
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
      <Stack.Screen options={{ headerLeft: () => <HeaderBack fallback="/home" color={palette.primary} /> }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 56 }} showsVerticalScrollIndicator={false}>
        {/* ── โปรไฟล์ ── */}
        <Animated.View entering={enter(0)}>
        <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push('/profile')} style={[styles.card, styles.profile, elevation.e1]} accessibilityLabel="ดูข้อมูลส่วนตัว">
          <View style={styles.profileMore}>
            <T v="caption" color={palette.primary} style={{ fontWeight: '600' }}>ข้อมูลส่วนตัว</T>
            <Sym name="chevron.right" size={11} color={palette.primary} weight="semibold" />
          </View>
          <View style={styles.avatarRing}>
            <Avatar name={displayName} src={avatars.doctor} size={84} />
          </View>
          <T v="h2" center style={{ marginTop: 12 }}>{displayName}</T>
          {profile?.email ? <T v="subhead" color={ios.secondary} center>{profile.email}</T> : null}
          <View style={[styles.badge, { backgroundColor: isPractitioner ? palette.primarySoft : '#FBEFD9' }]}>
            <Sym name={isPractitioner ? 'checkmark.seal.fill' : 'person.fill'} size={14} color={isPractitioner ? palette.primary : palette.orange} />
            <T v="subhead" color={isPractitioner ? palette.primaryDeep : '#8A5A10'} style={{ fontWeight: '600' }}>
              {isPractitioner ? 'หมอพื้นบ้านที่ได้รับการรับรอง' : 'สมาชิกทั่วไป'}
            </T>
          </View>
          {isPractitioner ? (
            <View style={styles.certBox}>
              {types ? <T v="subhead" center>{types}</T> : null}
              <T v="caption" color={ios.secondary} center>
                {profile?.cert_number ? `เลขที่ ${profile.cert_number}${profile.cert_province ? ` · ${profile.cert_province}` : ''}${profile.cert_expiry ? ` · หมดอายุ ${profile.cert_expiry}` : ''}` : doctor.license}
              </T>
            </View>
          ) : (
            <PressableScale haptic="press" onPress={() => router.push('/verify')} style={styles.verifyBtn} accessibilityLabel="ยืนยันตัวตนหมอพื้นบ้าน">
              <Sym name="person.badge.shield.checkmark.fill" size={18} color="#FFFFFF" />
              <T v="bodyStrong" color="#FFFFFF">ยืนยันตัวตนหมอพื้นบ้าน</T>
            </PressableScale>
          )}
        </PressableScale>
        </Animated.View>

        {/* ── ตั้งค่า AI (หน้าของตัวเอง) ── */}
        <Section i={1} title="ครูปัญญา AI">
          <View style={[styles.card, elevation.e1]}>
            <Row
              icon={<View style={styles.aiIcon}><AISphere size={30} active={false} /></View>}
              title="ตั้งค่า AI"
              value={DIALECTS.find((d) => d.id === dialect)?.label}
              onPress={() => router.push('/ai-settings')}
              chevron
              last
            />
          </View>
        </Section>

        {/* ── ความปลอดภัย ── */}
        <Section
          i={2}
          title="ความปลอดภัย"
          footer={settings.pinEnabled || settings.faceIdEnabled ? 'กลับมาหลังออกจากแอปเกิน 1 นาที ต้องปลดล็อกก่อนใช้งาน' : 'ตั้งรหัส PIN หรือ Face ID เพื่อป้องกันข้อมูลผู้ป่วย'}
        >
          <View style={[styles.card, elevation.e1]}>
            <Row icon={<AppIcon name="lock.shield.fill" bg={palette.primary} />} title="รหัส PIN" right={<Switch value={settings.pinEnabled} onValueChange={togglePin} trackColor={{ true: palette.primary }} />} />
            {settings.pinEnabled ? <Row icon={<AppIcon name="key.fill" bg="#5E6B63" />} title="เปลี่ยนรหัส PIN" onPress={() => router.push({ pathname: '/pin-setup', params: { mode: 'change' } })} chevron /> : null}
            <Row
              icon={<AppIcon name={bio.icon} bg="#2A8C7A" />}
              title={bio.label}
              value={bio.available ? undefined : 'ไม่พร้อมใช้งาน'}
              last
              right={bio.available ? <Switch value={settings.faceIdEnabled} onValueChange={toggleFace} trackColor={{ true: palette.primary }} /> : undefined}
            />
          </View>
        </Section>

        {/* ── ข้อมูล ── */}
        <Section i={3} title="ข้อมูล" footer={`ผู้ป่วย ${patients.length} ราย · ภูมิปัญญา ${wisdoms.length} เรื่อง`}>
          <View style={[styles.card, elevation.e1]}>
            <Row icon={<AppIcon name="square.and.arrow.up" bg={palette.primary} />} title="ส่งออกข้อมูลผู้ป่วย" onPress={exportAll} chevron />
            <Row icon={<AppIcon name="hand.raised.fill" bg="#007AFF" />} title="นโยบายความเป็นส่วนตัว" onPress={() => router.push('/privacy')} chevron last />
          </View>
        </Section>

        {/* ── ออกจากระบบ ── */}
        <Animated.View entering={enter(4)}>
          <PressableScale onPress={logout} scaleTo={0.98} haptic="press" style={[styles.card, styles.logout, elevation.e1]} accessibilityLabel="ออกจากระบบ">
            <Sym name="rectangle.portrait.and.arrow.right" size={18} color={palette.coral} />
            <T v="bodyStrong" color={palette.coral}>ออกจากระบบ</T>
          </PressableScale>
        </Animated.View>

        <T v="caption" color={ios.tertiary} center style={{ marginTop: 20, paddingHorizontal: 24 }}>
          หมอบ้านเชื่อมใจ เวอร์ชัน 1.0{'\n'}คำแนะนำจากครูปัญญาเป็นข้อมูลเบื้องต้น ไม่ใช่การวินิจฉัยแทนแพทย์
        </T>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous' },
  profile: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 18, marginTop: 8 },
  profileMore: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 3 },
  avatarRing: { padding: 4, borderRadius: 999, backgroundColor: palette.primarySoft },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  certBox: { marginTop: 12, alignSelf: 'stretch', backgroundColor: palette.mint, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, height: 48, paddingHorizontal: 20, borderRadius: 24, backgroundColor: palette.primary },
  secTitle: { marginBottom: 10, marginLeft: 4 },
  secFooter: { paddingHorizontal: 6, marginTop: 8 },
  aiIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#05090A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, gap: 14 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: control.row, paddingRight: 16, paddingVertical: 8 },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ios.separator },
  logout: { marginTop: 26, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
