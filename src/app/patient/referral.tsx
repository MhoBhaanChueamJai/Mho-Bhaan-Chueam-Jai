/**
 * ส่งต่อผู้ป่วย — กรอกสถานพยาบาลปลายทางและเหตุผล → ส่งข้อมูลให้ปลายทาง → พิมพ์หนังสือส่งต่อ (PDF)
 * การส่งข้อมูลตอนนี้เป็นการจำลอง (ยังไม่เชื่อมระบบสถานพยาบาลจริง) ให้เห็นขั้นตอนการทำงาน
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { TextInput } from '../../components/AppText';
import { Switch } from '../../components/AppSwitch';
import { NotFound } from '../../components/NotFound';
import { Sym, ios } from '../../components/ios';
import { Dropdown } from '../../components/FormPickers';
import { Button, GlassDock, T, useHaptic } from '../../components/ui';
import { useDoctor } from '../../components/useDoctor';
import { FACILITIES } from '../../data/facilities';
import { lastVisit } from '../../data/mock';
import { Alert } from '../../lib/alert';
import { outputPdf, referralHtml } from '../../lib/printDocs';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

const SEND_STEPS = ['เตรียมข้อมูลผู้ป่วยและการรักษา', 'ส่งข้อมูลไปยังสถานพยาบาลปลายทาง', 'ปลายทางได้รับข้อมูลแล้ว'];

export default function Referral() {
  const { pid } = useLocalSearchParams<{ pid: string }>();
  const { patients, updatePatient } = useApp();
  const dr = useDoctor();
  const h = useHaptic();
  const p = patients.find((x) => x.id === pid);
  const v = p ? lastVisit(p) : undefined;
  const [fid, setFid] = useState(FACILITIES[0].id);
  const fac = FACILITIES.find((f) => f.id === fid)!;
  const to = fac.name;
  const [reason, setReason] = useState(v?.diagnosis ? `อาการ${v.diagnosis}ไม่ดีขึ้นหลังการรักษาแบบแผนไทย ควรได้รับการตรวจวินิจฉัยเพิ่มเติม` : '');
  const [extra, setExtra] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [mark, setMark] = useState(p?.status !== 'ส่งต่อ รพ.สต.');
  const [phase, setPhase] = useState<'form' | 'sending' | 'sent'>('form');
  const [step, setStep] = useState(0);
  const [refNo, setRefNo] = useState('');
  const [sentAt, setSentAt] = useState('');
  const [busy, setBusy] = useState(false);
  if (!p) return <NotFound />;

  // ส่งข้อมูลให้สถานพยาบาลปลายทาง (จำลอง: เตรียมข้อมูล → ส่ง → ปลายทางได้รับ)
  const send = async () => {
    if (phase !== 'form' || !to) return;
    setPhase('sending');
    for (let i = 0; i < SEND_STEPS.length; i++) {
      setStep(i);
      await new Promise((r) => setTimeout(r, 700));
    }
    const d = new Date();
    setRefNo(`RF${String(d.getFullYear() + 543).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`);
    setSentAt(d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
    if (mark) updatePatient(p.id, { status: 'ส่งต่อ รพ.สต.' });
    h.success();
    setPhase('sent');
  };

  const print = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await outputPdf(referralHtml(p, v, { to: to, reason: reason.trim(), urgent, extra: extra.trim(), no: refNo }, dr), `ใบส่งต่อ ${p.name}`);
    } catch {
      Alert.alert('สร้างเอกสารไม่สำเร็จ', 'ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  };

  const Field = ({ label, value, onChange, multiline, placeholder }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string }) => (
    <View style={{ gap: 6 }}>
      <T v="subhead" color={ios.secondary} style={{ fontWeight: '600', marginLeft: 4 }}>{label}</T>
      <TextInput value={value} onChangeText={onChange} multiline={multiline} placeholder={placeholder} placeholderTextColor={ios.tertiary} style={[styles.input, multiline && { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' }]} accessibilityLabel={label} />
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'ใบส่งต่อผู้ป่วย' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
        {phase === 'sent' ? (
          <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page}>
            <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.done}>
              <Sym name="checkmark.circle.fill" size={44} color="#FFFFFF" />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(120)} style={{ gap: 4 }}>
              <T v="h2" center>ส่งข้อมูลแล้ว</T>
              <T v="callout" color={ios.secondary} center>{to} ได้รับข้อมูลผู้ป่วยแล้ว</T>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(200)} style={[styles.card, elevation.e1, { gap: 0, paddingVertical: 4 }]}>
              {[
                ['เลขที่ส่งต่อ', refNo],
                ['ผู้ป่วย', p.name],
                ['ส่งถึง', to],
                ['เวลาที่ส่ง', `${sentAt} น.`],
                ['ความเร่งด่วน', urgent ? 'ด่วน' : 'ปกติ'],
              ].map(([k, val], i) => (
                <View key={k} style={[styles.sw, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator }]}>
                  <T v="body" color={ios.secondary} style={{ width: 110 }}>{k}</T>
                  <T v="body" style={{ flex: 1, textAlign: 'right', fontWeight: '600' }} color={k === 'ความเร่งด่วน' && urgent ? palette.coral : palette.ink}>{val}</T>
                </View>
              ))}
            </Animated.View>
            <T v="caption" color={ios.tertiary} style={{ marginHorizontal: 4 }}>ปลายทางจะตอบกลับผลการรักษาเข้ามาในแอป · พิมพ์หนังสือส่งต่อให้ผู้ป่วยถือไปด้วยได้</T>
          </ScrollView>
        ) : (
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardDismissMode="interactive">
          <View style={[styles.card, elevation.e1, styles.who]}>
            <Sym name="person.crop.circle.fill" size={34} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <T v="bodyStrong">{p.name}</T>
              <T v="caption" color={ios.secondary}>{v ? `การรักษาครั้งที่ ${v.no} · ${v.date} · ${v.diagnosis || 'ไม่ระบุการวินิจฉัย'}` : 'ยังไม่มีบันทึกการรักษา'}</T>
            </View>
          </View>
          <View style={[styles.card, elevation.e1, { gap: 14 }]}>
            <View style={{ gap: 6 }}>
              <Dropdown label="ส่งถึง" value={to} options={FACILITIES.map((f) => f.name)} onChange={(n) => setFid(FACILITIES.find((f) => f.name === n)?.id ?? fid)} />
              <View style={styles.facNote}>
                <Sym name="link" size={12} color={palette.primary} />
                <T v="caption" color={ios.secondary}>{fac.area} · {fac.km} กม. · เชื่อมกับระบบแล้ว</T>
              </View>
            </View>
            {Field({ label: 'เหตุผลที่ส่งต่อ', value: reason, onChange: setReason, multiline: true })}
            {Field({ label: 'หมายเหตุเพิ่มเติม (ถ้ามี)', value: extra, onChange: setExtra, multiline: true, placeholder: 'เช่น ผู้ป่วยแพ้ยาแก้ปวด' })}
          </View>
          <View style={[styles.card, elevation.e1, { gap: 0, paddingVertical: 6 }]}>
            <View style={styles.sw}>
              <T v="body" style={{ flex: 1 }}>ส่งต่อด่วน</T>
              <Switch value={urgent} onValueChange={setUrgent} trackColor={{ true: palette.coral }} />
            </View>
            <View style={[styles.sw, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator }]}>
              <T v="body" style={{ flex: 1 }}>เปลี่ยนสถานะเป็น “ส่งต่อ รพ.สต.”</T>
              <Switch value={mark} onValueChange={setMark} trackColor={{ true: palette.primary }} />
            </View>
          </View>
          <T v="caption" color={ios.tertiary} style={{ marginHorizontal: 4 }}>ส่งข้อมูลผู้ป่วยและการรักษาครั้งล่าสุดให้สถานพยาบาลปลายทาง แล้วพิมพ์หนังสือส่งต่อได้หลังส่ง</T>
          {phase === 'sending' ? (
            <Animated.View entering={FadeIn} style={[styles.card, elevation.e1, { gap: 10 }]}>
              {SEND_STEPS.map((t, i) => (
                <View key={t} style={styles.step}>
                  <Sym name={i < step ? 'checkmark.circle.fill' : i === step ? 'paperplane.fill' : 'circle'} size={18} color={i <= step ? palette.primary : ios.tertiary} />
                  <T v="body" color={i <= step ? palette.ink : ios.tertiary}>{t}</T>
                </View>
              ))}
            </Animated.View>
          ) : null}
        </ScrollView>
        )}
        <GlassDock>
          {phase === 'sent' ? (
            <View style={{ flex: 1, gap: 10 }}>
              <Button label={busy ? 'กำลังสร้างเอกสาร…' : 'พิมพ์หนังสือส่งต่อ (PDF)'} icon={<Sym name="printer.fill" size={17} color="#FFFFFF" />} disabled={busy} onPress={print} style={{ height: 52 }} />
              <Button label="เสร็จ" kind="secondary" onPress={() => router.back()} style={{ height: 52 }} />
            </View>
          ) : (
            <Button label={phase === 'sending' ? 'กำลังส่งข้อมูล…' : 'ส่งข้อมูลให้สถานพยาบาล'} icon={phase === 'form' ? <Sym name="paperplane.fill" size={17} color="#FFFFFF" /> : undefined} disabled={phase !== 'form' || !to} onPress={send} style={{ flex: 1, height: 52 }} />
          )}
        </GlassDock>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 140, gap: 14 },
  card: { padding: 16, borderRadius: 22, backgroundColor: palette.surface },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { minHeight: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, fontSize: 17, color: palette.ink },
  sw: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 10 },
  facNote: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  done: { alignSelf: 'center', width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, marginTop: 12 },
});
