/**
 * แจ้งปัญหา / เสนอแนะ — เขียนข้อความ แนบภาพหน้าจอ แล้วส่งเข้าอีเมลทีมงาน
 * iOS / Android: เปิดหน้าเขียนอีเมลของเครื่อง (ใส่ผู้รับ หัวเรื่อง ข้อความ ภาพ และข้อมูลเครื่องไว้ให้แล้ว)
 * เว็บ / เครื่องที่ไม่ได้ตั้งอีเมล: เปิดลิงก์ mailto (แนบภาพไม่ได้ → บอกให้แนบเองในแอปอีเมล)
 */
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import * as MailComposer from 'expo-mail-composer';
import { Stack, router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { TextInput } from '../components/AppText';
import { Sym, ios } from '../components/ios';
import { Button, GlassDock, PressableScale, T, useHaptic } from '../components/ui';
import { Alert } from '../lib/alert';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';
import { APP_BUILD, APP_VERSION } from './about';

export const FEEDBACK_EMAIL = 'mhobhaan@gmail.com';
const KINDS = [
  { k: 'bug', label: 'พบปัญหา', icon: 'exclamationmark.triangle.fill', color: '#D2453A' },
  { k: 'idea', label: 'เสนอแนะ', icon: 'lightbulb.fill', color: '#E0861A' },
  { k: 'other', label: 'อื่นๆ', icon: 'bubble.left.and.bubble.right.fill', color: '#2F7BE0' },
] as const;

export default function Feedback() {
  const { profile, settings } = useApp();
  const h = useHaptic();
  const [kind, setKind] = useState<(typeof KINDS)[number]['k']>('bug');
  const [text, setText] = useState('');
  const [shots, setShots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 3 - shots.length, quality: 0.8 });
    if (!r.canceled) setShots((s) => [...s, ...r.assets.map((a) => a.uri)].slice(0, 3));
  };

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const label = KINDS.find((x) => x.k === kind)!.label;
    const who = profile?.display_name || settings.username || '-';
    const body = [
      text.trim(),
      '',
      '— ข้อมูลสำหรับทีมพัฒนา —',
      `ประเภท: ${label}`,
      `ผู้แจ้ง: ${who}${profile?.email ? ` (${profile.email})` : ''}`,
      `แอป: หมอบ้านเชื่อมใจ ${APP_VERSION} (${APP_BUILD})`,
      `อุปกรณ์: ${Platform.OS === 'web' ? 'เว็บ' : `${Device.modelName ?? Device.deviceName ?? '-'} · ${Device.osName ?? Platform.OS} ${Device.osVersion ?? ''}`}`,
      `เวลา: ${new Date().toLocaleString('th-TH')}`,
    ].join('\n');
    const subject = `[หมอบ้านเชื่อมใจ] ${label}: ${text.trim().split('\n')[0].slice(0, 50)}`;
    try {
      if (Platform.OS !== 'web' && (await MailComposer.isAvailableAsync())) {
        const r = await MailComposer.composeAsync({ recipients: [FEEDBACK_EMAIL], subject, body, attachments: shots });
        if (r.status === MailComposer.MailComposerStatus.SENT) {
          h.success();
          Alert.alert('ส่งแล้ว ขอบคุณครับ', 'ทีมงานจะนำไปปรับปรุงแอปให้ดีขึ้น');
          router.back();
        }
      } else {
        await Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
        if (shots.length) Alert.alert('แนบภาพในแอปอีเมล', 'แอปอีเมลแนบภาพให้อัตโนมัติไม่ได้ กรุณาแนบภาพหน้าจอเองก่อนกดส่ง');
      }
    } catch {
      Alert.alert('เปิดแอปอีเมลไม่ได้', `ส่งอีเมลถึง ${FEEDBACK_EMAIL} ได้โดยตรง`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'แจ้งปัญหา / เสนอแนะ' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardDismissMode="interactive">
          <T v="subhead" color={ios.secondary} style={{ marginHorizontal: 4 }}>
            เล่าสิ่งที่เจอ หรือสิ่งที่อยากให้มีในแอป ข้อความจะส่งถึงทีมพัฒนาทางอีเมล
          </T>

          <View style={styles.kinds}>
            {KINDS.map((x) => {
              const on = kind === x.k;
              return (
                <PressableScale key={x.k} haptic="select" scaleTo={0.96} onPress={() => setKind(x.k)} style={[styles.kind, elevation.e1, on && { borderColor: x.color, backgroundColor: `${x.color}12` }]} accessibilityState={{ selected: on }} accessibilityLabel={x.label}>
                  <Sym name={x.icon as any} size={22} color={on ? x.color : ios.tertiary} />
                  <T v="subhead" color={on ? x.color : palette.ink} style={{ fontWeight: '600' }}>{x.label}</T>
                </PressableScale>
              );
            })}
          </View>

          <View style={[styles.card, elevation.e1]}>
            <T v="subhead" color={ios.secondary} style={styles.label}>{kind === 'bug' ? 'เกิดอะไรขึ้น ตอนทำอะไรอยู่' : kind === 'idea' ? 'อยากให้แอปมีหรือปรับอะไร' : 'ข้อความ'}</T>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder={kind === 'bug' ? 'เช่น กดบันทึกการรักษาแล้วแอปค้าง' : 'พิมพ์ได้เลย'}
              placeholderTextColor={ios.tertiary}
              style={styles.input}
              accessibilityLabel="ข้อความแจ้งปัญหา"
            />
          </View>

          <View style={[styles.card, elevation.e1]}>
            <T v="subhead" color={ios.secondary} style={styles.label}>ภาพหน้าจอ (ถ้ามี · สูงสุด 3 ภาพ)</T>
            <Animated.View layout={LinearTransition.duration(220)} style={styles.shots}>
              {shots.map((u) => (
                <Animated.View key={u} entering={FadeIn} style={styles.shot}>
                  <Image source={{ uri: u }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <PressableScale haptic="select" onPress={() => setShots((s) => s.filter((x) => x !== u))} style={styles.del} accessibilityLabel="ลบภาพ">
                    <Sym name="xmark" size={11} color="#FFFFFF" weight="bold" />
                  </PressableScale>
                </Animated.View>
              ))}
              {shots.length < 3 ? (
                <PressableScale haptic="select" scaleTo={0.95} onPress={pick} style={styles.add} accessibilityLabel="แนบภาพหน้าจอ">
                  <Sym name="photo.on.rectangle" size={24} color={palette.primary} />
                  <T v="caption" color={palette.primary} style={{ fontWeight: '600' }}>แนบภาพ</T>
                </PressableScale>
              ) : null}
            </Animated.View>
          </View>
          <T v="caption" color={ios.tertiary} style={{ marginHorizontal: 4 }}>
            แอปจะแนบรุ่นแอปและรุ่นเครื่องไปด้วย เพื่อให้ทีมพัฒนาหาสาเหตุได้เร็วขึ้น · ส่งถึง {FEEDBACK_EMAIL}
          </T>
        </ScrollView>
        <GlassDock>
          <Button label={busy ? 'กำลังเปิดอีเมล…' : 'ส่งถึงทีมพัฒนา'} disabled={!text.trim() || busy} onPress={send} style={{ flex: 1, height: 52 }} />
        </GlassDock>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 140, gap: 16 },
  kinds: { flexDirection: 'row', gap: 10 },
  kind: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 16, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1.5, borderColor: 'transparent' },
  card: { padding: 16, borderRadius: 22, backgroundColor: palette.surface },
  label: { fontWeight: '600', marginBottom: 8 },
  input: { minHeight: 140, fontSize: 17, lineHeight: 24, color: palette.ink, textAlignVertical: 'top', padding: 14, borderRadius: 16, backgroundColor: palette.mint },
  shots: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  shot: { width: 92, height: 160, borderRadius: 14, overflow: 'hidden', backgroundColor: palette.mint },
  del: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  add: { width: 92, height: 160, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: `${palette.primary}66`, alignItems: 'center', justifyContent: 'center', gap: 6 },
});
