import { Stack, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { MODELS, health, type ModelKey, type ServiceKey } from '../api/ai';
import { useSpeaker } from '../components/audio';
import { AppIcon, Sym, ios } from '../components/ios';
import { Avatar, HeaderBack, PressableScale, T, useHaptic } from '../components/ui';
import { avatars, doctor, doctorTypes, fullAddress } from '../data/mock';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/app';
import { authenticateBiometric, biometricInfo, clearPin } from '../store/security';
import { control, palette } from '../theme';

const SERVICES: { k: ServiceKey; label: string; sym: any; bg: string }[] = [
  { k: 'llm', label: 'สมองครูปัญญา (Gemma / Qwen)', sym: 'cpu', bg: palette.primary },
  { k: 'asr', label: 'ฟังเสียงภาษาไทย', sym: 'waveform', bg: '#2A8C7A' },
  { k: 'tts', label: 'พูดตอบด้วยเสียง', sym: 'speaker.wave.2.fill', bg: palette.orange },
  { k: 'ocr', label: 'อ่านตำราโบราณ (OCR)', sym: 'doc.text.viewfinder', bg: '#8A6A44' },
];
const VOICES = [
  { id: 'female', label: 'หญิง' },
  { id: 'male', label: 'ชาย' },
  { id: 'default', label: 'กลาง' },
];

/** แถวแบบหน้า Settings ของ iPhone */
function Row({
  icon,
  title,
  value,
  right,
  onPress,
  last,
  danger,
  chevron,
}: {
  icon?: React.ReactNode;
  title: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
  danger?: boolean;
  chevron?: boolean;
}) {
  const body = (
    <View style={styles.row}>
      {icon}
      <View style={[styles.rowMain, !last && styles.sep]}>
        <T v="body" color={danger ? palette.coral : ios.label} style={{ flex: 1 }} numberOfLines={1}>{title}</T>
        {value ? <T v="body" color={ios.secondary}>{value}</T> : null}
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

function Section({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 26 }}>
      {title ? <T v="caption" color={ios.secondary} style={styles.secTitle}>{title}</T> : null}
      <View style={styles.group}>{children}</View>
      {footer ? <T v="caption" color={ios.secondary} style={styles.secFooter}>{footer}</T> : null}
    </View>
  );
}

export default function Settings() {
  const { settings, update, patients, wisdoms, resetData, setUnlocked, sync, syncError, reloadCloud } = useApp();
  const [bio, setBio] = useState({ available: false, label: 'Face ID', icon: 'faceid' as 'faceid' | 'touchid' });
  useEffect(() => {
    biometricInfo().then(setBio);
  }, []);
  const tts = useSpeaker();
  const h = useHaptic();
  const [status, setStatus] = useState<Record<ServiceKey, boolean> | null>(null);
  const [checking, setChecking] = useState(false);
  const type = doctorTypes.find((d) => d.key === settings.doctorType) ?? doctorTypes[0];
  const voice = VOICES.find((v) => v.id === settings.voice) ?? VOICES[0];

  const check = async () => {
    setChecking(true);
    setStatus(null);
    setStatus(await health());
    setChecking(false);
  };
  useEffect(() => {
    check();
    return () => tts.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextVoice = () => {
    const i = VOICES.findIndex((v) => v.id === settings.voice);
    const v = VOICES[(i + 1) % VOICES.length];
    update({ voice: v.id });
    setTimeout(() => tts.speak('สวัสดีครับคุณหมอ ครูปัญญายินดีรับใช้ครับ'), 50);
  };

  const exportAll = () => {
    const text = patients
      .map((p) => `${p.name} (${p.sex} ${p.age} ปี) โทร ${p.phone}\nที่อยู่ ${fullAddress(p.address)}\nการรักษา ${p.visits.length} ครั้ง ล่าสุด: ${p.visits[0]?.diagnosis ?? '-'}`)
      .join('\n\n');
    Share.share({ title: 'ข้อมูลผู้ป่วย', message: `ข้อมูลผู้ป่วย ${patients.length} ราย\n\n${text}` });
  };

  const reset = () =>
    Alert.alert('รีเซ็ตเป็นข้อมูลตัวอย่าง?', 'ผู้ป่วยและภูมิปัญญาที่บันทึกในเครื่องจะถูกลบ และกลับเป็นข้อมูลตัวอย่าง', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'รีเซ็ต',
        style: 'destructive',
        onPress: () => {
          resetData();
          h.success();
        },
      },
    ]);

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
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: '#F2F2F7' }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* โปรไฟล์ */}
        <View style={[styles.group, { marginTop: 12 }]}>
          <View style={styles.profile}>
            <Avatar name={doctor.name} src={avatars.doctor} size={64} />
            <View style={{ flex: 1 }}>
              <T v="title" style={{ fontSize: 20, lineHeight: 26 }}>{doctor.name}</T>
              <T v="callout" color={ios.secondary}>{type.label} · ประสบการณ์ {doctor.years} ปี</T>
            </View>
          </View>
          <View style={[styles.sep, { marginLeft: 16 }]} />
          <View style={styles.license}>
            <Sym name="checkmark.seal.fill" size={20} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <T v="callout">หมอพื้นบ้านขึ้นทะเบียน</T>
              <T v="caption" color={ios.secondary}>{doctor.license.replace('หมอพื้นบ้านขึ้นทะเบียน ', '')}</T>
            </View>
          </View>
          <View style={[styles.sep, { marginLeft: 16 }]} />
          <View style={styles.license}>
            <Sym name="mappin.and.ellipse" size={20} color={palette.primary} />
            <T v="callout" style={{ flex: 1 }}>{doctor.village}</T>
          </View>
        </View>

        <Section title="ครูปัญญา AI">
          <Row
            icon={<AppIcon name="speaker.wave.2.fill" bg={palette.orange} />}
            title="อ่านคำตอบให้ฟังอัตโนมัติ"
            right={<Switch value={settings.autoSpeak} onValueChange={(v) => update({ autoSpeak: v })} trackColor={{ true: palette.primary }} />}
          />
          <Row icon={<AppIcon name="person.wave.2.fill" bg="#C2564B" />} title="เสียงของครูปัญญา" value={tts.speaking ? 'กำลังเล่น…' : voice.label} onPress={nextVoice} chevron />
          <Row
            icon={<AppIcon name="cpu" bg={palette.primary} />}
            title="โมเดล AI"
            last
            right={
              <View style={styles.seg}>
                {(Object.keys(MODELS) as ModelKey[]).map((k) => (
                  <PressableScale key={k} haptic="select" onPress={() => update({ model: k })} style={[styles.segItem, settings.model === k && styles.segOn]}>
                    <T v="caption" color={settings.model === k ? ios.label : ios.secondary} style={{ fontWeight: '600' }}>{MODELS[k].label}</T>
                  </PressableScale>
                ))}
              </View>
            }
          />
        </Section>

        <Section
          title="ความปลอดภัย"
          footer={
            settings.pinEnabled || settings.faceIdEnabled
              ? 'เปิดแอปครั้งถัดไป หรือกลับมาหลังออกจากแอปเกิน 1 นาที ต้องปลดล็อกก่อนใช้งาน ไม่ต้องกรอกรหัสผ่านใหม่'
              : 'ตั้งรหัส PIN หรือ Face ID เพื่อป้องกันข้อมูลผู้ป่วยเมื่อมีคนอื่นหยิบเครื่องไป'
          }
        >
          <Row
            icon={<AppIcon name="lock.shield.fill" bg={palette.primary} />}
            title="รหัส PIN"
            right={<Switch value={settings.pinEnabled} onValueChange={togglePin} trackColor={{ true: palette.primary }} />}
          />
          {settings.pinEnabled ? (
            <Row icon={<AppIcon name="key.fill" bg="#5E6B63" />} title="เปลี่ยนรหัส PIN" onPress={() => router.push({ pathname: '/pin-setup', params: { mode: 'change' } })} chevron />
          ) : null}
          <Row
            icon={<AppIcon name={bio.icon} bg="#2A8C7A" />}
            title={bio.label}
            value={bio.available ? undefined : 'ไม่พร้อมใช้งาน'}
            last
            right={bio.available ? <Switch value={settings.faceIdEnabled} onValueChange={toggleFace} trackColor={{ true: palette.primary }} /> : undefined}
          />
        </Section>

        <Section title="การใช้งาน" footer="ขนาดตัวอักษรในแอปปรับตาม การตั้งค่า › การแสดงผลและความสว่าง › ขนาดข้อความ ของ iPhone">
          <Row
            icon={<AppIcon name="iphone.radiowaves.left.and.right" bg="#2A8C7A" />}
            title="สั่นตอบสนองเมื่อแตะ"
            right={<Switch value={settings.haptics} onValueChange={(v) => update({ haptics: v })} trackColor={{ true: palette.primary }} />}
          />
          <Row icon={<AppIcon name="textformat.size" bg="#5E6B63" />} title="ขนาดตัวอักษร" value="ตาม iPhone" onPress={() => Linking.openSettings()} chevron last />
        </Section>

        <Section title="สถานะบริการ AI">
          {SERVICES.map((s) => {
            const ok = status?.[s.k];
            return (
              <Row
                key={s.k}
                icon={<AppIcon name={s.sym} bg={s.bg} />}
                title={s.label}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.dot, { backgroundColor: status == null ? ios.tertiary : ok ? palette.online : palette.coral }]} />
                    <T v="callout" color={ios.secondary}>{status == null ? 'กำลังตรวจ' : ok ? 'พร้อม' : 'ขัดข้อง'}</T>
                  </View>
                }
              />
            );
          })}
          <Row icon={<AppIcon name="arrow.clockwise" bg="#8E8E93" />} title={checking ? 'กำลังตรวจสอบ…' : 'ตรวจสอบอีกครั้ง'} onPress={check} last />
        </Section>

        <Section
          title="ฐานข้อมูล"
          footer={sync === 'error' ? `เชื่อมต่อไม่สำเร็จ: ${syncError.slice(0, 120)} — ใช้ข้อมูลในเครื่องไปก่อน` : 'ข้อมูลผู้ป่วยซิงก์กับ Supabase และเก็บสำเนาในเครื่องไว้ใช้ตอนไม่มีเน็ต'}
        >
          <Row
            icon={<AppIcon name="externaldrive.fill.badge.icloud" bg="#3B7DD8" />}
            title="Supabase"
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.dot, { backgroundColor: sync === 'cloud' ? palette.online : sync === 'syncing' ? ios.tertiary : palette.coral }]} />
                <T v="callout" color={ios.secondary}>{{ cloud: 'ซิงก์แล้ว', syncing: 'กำลังซิงก์', error: 'ขัดข้อง', local: 'ในเครื่อง' }[sync]}</T>
              </View>
            }
          />
          <Row icon={<AppIcon name="arrow.clockwise" bg="#8E8E93" />} title="ซิงก์ข้อมูลอีกครั้ง" onPress={() => reloadCloud()} last />
        </Section>

        <Section title="ข้อมูล" footer={`ผู้ป่วย ${patients.length} ราย · ภูมิปัญญา ${wisdoms.length} เรื่อง · เก็บในเครื่องนี้ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล`}>
          <Row icon={<AppIcon name="square.and.arrow.up" bg={palette.primary} />} title="ส่งออกข้อมูลผู้ป่วยทั้งหมด" onPress={exportAll} chevron />
          <Row icon={<AppIcon name="trash.fill" bg={palette.coral} />} title="รีเซ็ตเป็นข้อมูลตัวอย่าง" onPress={reset} danger last />
        </Section>

        <View style={[styles.group, { marginTop: 26 }]}>
          <PressableScale onPress={logout} scaleTo={0.99} haptic="press" style={styles.logout} accessibilityLabel="ออกจากระบบ">
            <T v="body" color={palette.coral} style={{ fontWeight: '600' }}>ออกจากระบบ</T>
          </PressableScale>
        </View>

        <T v="caption" color={ios.secondary} center style={{ marginTop: 20, paddingHorizontal: 24 }}>
          หมอบ้านเชื่อมใจ เวอร์ชัน 1.0{'\n'}คำแนะนำจาก AI เป็นข้อมูลเบื้องต้น ไม่ใช่การวินิจฉัยแทนแพทย์
        </T>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: palette.surface, borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden' },
  secTitle: { paddingHorizontal: 16, marginBottom: 6 },
  secFooter: { paddingHorizontal: 16, marginTop: 6 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  license: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, gap: 14 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: control.row, paddingRight: 16, paddingVertical: 8 },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ios.separator },
  dot: { width: 8, height: 8, borderRadius: 4 },
  logout: { minHeight: control.row, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  seg: { flexDirection: 'row', backgroundColor: '#EEEEF0', borderRadius: 9, padding: 2 },
  segItem: { paddingHorizontal: 12, height: 28, justifyContent: 'center', borderRadius: 7 },
  segOn: { backgroundColor: palette.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
});
