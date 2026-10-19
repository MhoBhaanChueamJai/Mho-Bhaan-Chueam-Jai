/**
 * หนังสือส่งต่อผู้ป่วย — กรอกหน่วยบริการที่ส่งไปและเหตุผล แล้วสร้าง PDF (ใช้ข้อมูลการรักษาครั้งล่าสุด)
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { TextInput } from '../../components/AppText';
import { Switch } from '../../components/AppSwitch';
import { NotFound } from '../../components/NotFound';
import { Sym, ios } from '../../components/ios';
import { Button, GlassDock, T, useHaptic } from '../../components/ui';
import { useDoctor } from '../../components/useDoctor';
import { lastVisit } from '../../data/mock';
import { Alert } from '../../lib/alert';
import { outputPdf, referralHtml } from '../../lib/printDocs';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

export default function Referral() {
  const { pid } = useLocalSearchParams<{ pid: string }>();
  const { patients, updatePatient } = useApp();
  const dr = useDoctor();
  const h = useHaptic();
  const p = patients.find((x) => x.id === pid);
  const v = p ? lastVisit(p) : undefined;
  const [to, setTo] = useState('รพ.สต. ');
  const [reason, setReason] = useState(v?.diagnosis ? `อาการ${v.diagnosis}ไม่ดีขึ้นหลังการรักษาแบบแผนไทย ควรได้รับการตรวจวินิจฉัยเพิ่มเติม` : '');
  const [extra, setExtra] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [mark, setMark] = useState(p?.status !== 'ส่งต่อ รพ.สต.');
  const [busy, setBusy] = useState(false);
  if (!p) return <NotFound />;

  const make = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await outputPdf(referralHtml(p, v, { to: to.trim(), reason: reason.trim(), urgent, extra: extra.trim() }, dr), `ใบส่งต่อ ${p.name}`);
      if (mark) updatePatient(p.id, { status: 'ส่งต่อ รพ.สต.' });
      h.success();
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
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardDismissMode="interactive">
          <View style={[styles.card, elevation.e1, styles.who]}>
            <Sym name="person.crop.circle.fill" size={34} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <T v="bodyStrong">{p.name}</T>
              <T v="caption" color={ios.secondary}>{v ? `การรักษาครั้งที่ ${v.no} · ${v.date} · ${v.diagnosis || 'ไม่ระบุการวินิจฉัย'}` : 'ยังไม่มีบันทึกการรักษา'}</T>
            </View>
          </View>
          <View style={[styles.card, elevation.e1, { gap: 14 }]}>
            {Field({ label: 'ส่งถึง', value: to, onChange: setTo, placeholder: 'เช่น รพ.สต.บ้านดอนแก้ว' })}
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
          <T v="caption" color={ios.tertiary} style={{ marginHorizontal: 4 }}>เอกสารใช้ข้อมูลผู้ป่วยและการรักษาครั้งล่าสุด มีส่วนให้หน่วยบริการตอบกลับผลการรักษา</T>
        </ScrollView>
        <GlassDock>
          <Button label={busy ? 'กำลังสร้างเอกสาร…' : 'สร้างหนังสือส่งต่อ (PDF)'} disabled={busy || !to.trim()} onPress={make} style={{ flex: 1, height: 52 }} />
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
});
