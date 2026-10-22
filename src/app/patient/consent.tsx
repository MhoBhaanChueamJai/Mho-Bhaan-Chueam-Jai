/**
 * ใบยินยอมเก็บข้อมูล (PDPA) — อ่านข้อความให้ผู้ป่วยฟัง → ผู้ป่วย/ญาติเซ็นชื่อบนจอ → เก็บกับข้อมูลผู้ป่วย → ส่งออก PDF ได้
 * ลงชื่อแล้ว: ดูลายเซ็น ส่งออก PDF หรือบันทึกการถอนความยินยอม
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { TextInput } from '../../components/AppText';
import { NotFound } from '../../components/NotFound';
import { SIG_H, SIG_W, SignaturePad } from '../../components/SignaturePad';
import { Sym, ios } from '../../components/ios';
import { Button, GlassDock, PressableScale, T, useHaptic } from '../../components/ui';
import { useDoctor } from '../../components/useDoctor';
import { Alert } from '../../lib/alert';
import { consentHtml, consentPoints, outputPdf } from '../../lib/printDocs';
import { thDate } from '../../lib/referral';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';
import { column } from '../../components/layout';

const WHO = ['ผู้ป่วย', 'ญาติ/ผู้ดูแล'] as const;

export default function Consent() {
  const { pid } = useLocalSearchParams<{ pid: string }>();
  const { patients, updatePatient } = useApp();
  const dr = useDoctor();
  const h = useHaptic();
  const p = patients.find((x) => x.id === pid);
  const [who, setWho] = useState<(typeof WHO)[number]>('ผู้ป่วย');
  const [signer, setSigner] = useState('');
  const [relation, setRelation] = useState('');
  const [sig, setSig] = useState('');
  const [signing, setSigning] = useState(false);
  if (!p) return <NotFound />;
  const c = p.consent;
  const canSave = !!sig && (who === 'ผู้ป่วย' || (signer.trim() && relation.trim()));

  const save = () => {
    if (!canSave) return;
    updatePatient(p.id, { consent: { at: Date.now(), signer: who === 'ผู้ป่วย' ? p.name : signer.trim(), relation: who === 'ผู้ป่วย' ? 'ผู้ป่วย' : relation.trim(), sig } });
    h.success();
  };
  const pdf = () => outputPdf(consentHtml(p, dr), `ใบยินยอม ${p.name}`).catch(() => Alert.alert('สร้างเอกสารไม่สำเร็จ', 'ลองใหม่อีกครั้ง'));
  const withdraw = () =>
    Alert.alert('บันทึกการถอนความยินยอม?', 'ลายเซ็นจะถูกลบ ส่วนข้อมูลการรักษายังอยู่ ถ้าผู้ป่วยต้องการให้ลบข้อมูลทั้งหมด ให้ลบผู้ป่วยในหน้าผู้ป่วย', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ถอนความยินยอม', style: 'destructive', onPress: () => updatePatient(p.id, { consent: undefined }) },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: 'ใบยินยอมเก็บข้อมูล' }} />
      <ScrollView scrollEnabled={!signing} contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={[styles.page, column.read]} keyboardDismissMode="interactive">
        <T v="subhead" color={ios.secondary} style={{ marginHorizontal: 4 }}>
          อ่านให้{p.name}ฟัง แล้วให้ลงชื่อบนจอ ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)
        </T>
        <View style={[styles.card, elevation.e1, { gap: 10 }]}>
          {consentPoints(p, dr).map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <T v="body" color={palette.primary} style={{ fontWeight: '700', width: 18 }}>{i + 1}.</T>
              <T v="body" style={{ flex: 1 }}>{t}</T>
            </View>
          ))}
        </View>

        {c ? (
          <Animated.View entering={FadeIn} style={[styles.card, elevation.e1, { gap: 8 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Sym name="checkmark.seal.fill" size={20} color={palette.primary} />
              <T v="bodyStrong" style={{ flex: 1 }}>ลงชื่อยินยอมแล้ว {thDate(c.at)}</T>
            </View>
            <T v="subhead" color={ios.secondary}>ผู้ลงชื่อ: {c.signer}{c.relation !== 'ผู้ป่วย' ? ` (${c.relation})` : ''}</T>
            <View style={styles.sigView}>
              <Svg width="100%" height="100%" viewBox={`0 0 ${SIG_W} ${SIG_H}`} preserveAspectRatio="xMidYMid meet">
                <Path d={c.sig} stroke={palette.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </View>
            <PressableScale haptic="select" onPress={withdraw} style={{ alignSelf: 'flex-start', paddingVertical: 6 }} accessibilityLabel="บันทึกการถอนความยินยอม">
              <T v="subhead" color={palette.coral} style={{ fontWeight: '600' }}>บันทึกการถอนความยินยอม</T>
            </PressableScale>
          </Animated.View>
        ) : (
          <>
            <View style={[styles.card, elevation.e1, { gap: 12 }]}>
              <T v="subhead" color={ios.secondary} style={{ fontWeight: '600' }}>ผู้ลงชื่อ</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {WHO.map((x) => {
                  const on = who === x;
                  return (
                    <PressableScale key={x} haptic="select" scaleTo={0.95} onPress={() => setWho(x)} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: on }}>
                      <T v="subhead" color={on ? '#FFFFFF' : palette.ink} style={{ fontWeight: '600' }}>{x}</T>
                    </PressableScale>
                  );
                })}
              </View>
              {who !== 'ผู้ป่วย' ? (
                <Animated.View entering={FadeIn} style={{ gap: 10 }}>
                  <TextInput value={signer} onChangeText={setSigner} placeholder="ชื่อ-สกุลผู้ลงชื่อ" placeholderTextColor={ios.tertiary} style={styles.input} accessibilityLabel="ชื่อผู้ลงชื่อ" />
                  <TextInput value={relation} onChangeText={setRelation} placeholder="เกี่ยวข้องเป็น เช่น ลูก หลาน คู่สมรส" placeholderTextColor={ios.tertiary} style={styles.input} accessibilityLabel="ความเกี่ยวข้อง" />
                </Animated.View>
              ) : null}
            </View>
            <View style={[styles.card, elevation.e1, { gap: 10 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T v="subhead" color={ios.secondary} style={{ fontWeight: '600', flex: 1 }}>เซ็นชื่อในกรอบ</T>
                {sig ? (
                  <PressableScale haptic="select" onPress={() => setSig('')} hitSlop={8} accessibilityLabel="ล้างลายเซ็น">
                    <T v="subhead" color={palette.primary} style={{ fontWeight: '600' }}>ล้าง</T>
                  </PressableScale>
                ) : null}
              </View>
              <SignaturePad value={sig} onChange={setSig} onActive={setSigning} />
            </View>
          </>
        )}
      </ScrollView>
      <GlassDock>
        {c ? (
          <Button label="ส่งออก PDF" icon={<Sym name="square.and.arrow.up" size={17} color="#FFFFFF" />} onPress={pdf} style={{ flex: 1, height: 52 }} />
        ) : (
          <Button label="ลงชื่อยินยอม" icon={<Sym name="signature" size={17} color="#FFFFFF" />} disabled={!canSave} onPress={save} style={{ flex: 1, height: 52 }} />
        )}
      </GlassDock>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 140, gap: 14 },
  card: { padding: 16, borderRadius: 22, backgroundColor: palette.surface },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: palette.primary },
  input: { height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, fontSize: 17, color: palette.ink },
  sigView: { height: 120, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
});
