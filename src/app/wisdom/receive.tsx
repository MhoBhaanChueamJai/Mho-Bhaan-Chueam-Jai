/**
 * รับตำราจากเพื่อน — กรอกรหัสแชร์ (หรือเปิดจากลิงก์ ?code=) → ดูตัวอย่าง → เก็บเข้าคลังของตัวเอง
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { CircleIcon } from '../../components/ListRow';
import { Sym, ios } from '../../components/ios';
import { Button, GlassDock, PressableScale, T, useHaptic } from '../../components/ui';
import { cleanCode, fetchShare, prettyCode, type ReceivedShare } from '../../lib/wisdomShare';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

export default function ReceiveWisdom() {
  const { code: initial } = useLocalSearchParams<{ code?: string }>();
  const { addWisdom, wisdoms } = useApp();
  const h = useHaptic();
  const [code, setCode] = useState(initial ? cleanCode(initial) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [got, setGot] = useState<ReceivedShare | null>(null);
  const [saved, setSaved] = useState(false);

  const look = async (c = code) => {
    const k = cleanCode(c);
    if (k.length < 8 || busy) return;
    setBusy(true);
    setErr('');
    setGot(null);
    setSaved(false);
    try {
      const r = await fetchShare(k);
      if (!r) {
        setErr('ไม่พบตำราจากรหัสนี้ หรือรหัสหมดอายุแล้ว');
        h.warn();
      } else {
        setGot(r);
        h.success();
      }
    } catch {
      setErr('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง');
      h.warn();
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (initial) look(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // มีในคลังแล้ว (รหัสเดียวกัน หรือเรื่องเดียวกันจากคนเดียวกัน) → ห้ามเพิ่มซ้ำ
  const existing = got ? wisdoms.find((w) => w.shareCode === cleanCode(code) || (w.title === got.wisdom.title && w.sharedBy === got.fromName) || (w.builtin && w.title === got.wisdom.title)) : undefined;
  const dup = !!existing && !saved;
  const save = () => {
    if (!got || existing) return;
    const t = new Date();
    addWisdom({
      ...got.wisdom,
      id: `w${Date.now()}`,
      source: 'เพื่อนแชร์',
      sharedBy: got.fromName,
      shareCode: cleanCode(code),
      date: `${t.getDate()}/${t.getMonth() + 1}/${t.getFullYear() + 543}`,
      summary: got.wisdom.summary ?? '',
      verified: false,
    });
    h.success();
    setSaved(true);
  };

  const w = got?.wisdom;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* กรอกรหัส */}
        <Animated.View layout={LinearTransition.duration(280)} style={[styles.card, elevation.e1, { alignItems: 'center' }]}>
          <CircleIcon name="tray.and.arrow.down.fill" size={56} />
          <T v="title" center style={{ marginTop: 12 }}>กรอกรหัสที่เพื่อนส่งมา</T>
          <T v="subhead" color={ios.secondary} center style={{ marginTop: 2 }}>รหัส 8 ตัว เช่น ABCD-2345</T>
          <TextInput
            value={code.length > 4 ? prettyCode(code) : code}
            onChangeText={(t) => setCode(cleanCode(t).slice(0, 8))}
            placeholder="XXXX-XXXX"
            placeholderTextColor={ios.tertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => look()}
            style={styles.code}
            accessibilityLabel="รหัสแชร์"
          />
          <Button label={busy ? 'กำลังค้นหา…' : 'ดูตำรา'} disabled={code.length < 8 || busy} onPress={() => look()} style={{ alignSelf: 'stretch', height: 52, marginTop: 14 }} />
          {err ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.err}>
              <Sym name="exclamationmark.circle.fill" size={14} color={palette.coral} />
              <T v="subhead" color={palette.coral}>{err}</T>
            </Animated.View>
          ) : null}
        </Animated.View>

        {busy ? <ActivityIndicator color={palette.primary} style={{ marginTop: 24 }} /> : null}

        {/* ตัวอย่างตำรา */}
        {got && w ? (
          <Animated.View entering={FadeInDown.duration(380)} style={{ gap: 14 }}>
            <View style={styles.from}>
              <Sym name="person.crop.circle.fill" size={16} color={palette.primary} />
              <T v="subhead" color={palette.primaryDeep} style={{ fontWeight: '600' }}>{got.fromName} แชร์ให้คุณ</T>
            </View>
            <View style={[styles.card, elevation.e1, { gap: 10 }]}>
              <View style={styles.kind}>
                <T v="micro" color={palette.primaryDeep} style={{ fontWeight: '700' }}>{w.kind}</T>
              </View>
              <T v="h2">{w.title}</T>
              {w.summary ? <T v="body" color={palette.inkSoft}>{w.summary}</T> : null}
              {w.indication ? <Row icon="cross.case.fill" label="สรรพคุณ" text={w.indication} /> : null}
              {w.ingredients?.length ? (
                <View>
                  <T v="subhead" color={ios.secondary} style={styles.lbl}>ตัวยา</T>
                  <View style={styles.ings}>
                    {w.ingredients.map((x) => (
                      <View key={x} style={styles.ing}>
                        <Sym name="leaf.fill" size={12} color={palette.primary} />
                        <T v="callout" color={palette.primaryDeep}>{x}</T>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {w.method ? <Row icon="flame.fill" label="วิธีปรุงและวิธีใช้" text={w.method} /> : null}
              {w.caution ? <Row icon="exclamationmark.triangle.fill" label="ข้อห้าม" text={w.caution} warn /> : null}
            </View>
            <T v="caption" color={ios.secondary} style={{ paddingHorizontal: 6 }}>ตำราที่ได้รับจะอยู่ในสถานะ “รอตรวจทาน” ควรตรวจสอบก่อนนำไปใช้กับผู้ป่วย</T>
          </Animated.View>
        ) : null}
      </ScrollView>

      {got ? (
        <GlassDock>
          {saved ? (
            <Button kind="secondary" label="ดูในคลังภูมิ" icon={<Sym name="checkmark" size={17} color={palette.primary} />} onPress={() => (router.canDismiss() ? router.dismissTo('/vault') : router.navigate('/vault'))} style={{ flex: 1, height: 52 }} />
          ) : (
            <Button label={dup ? 'อยู่ในคลังแล้ว · เปิดดู' : 'เก็บเข้าคลังของฉัน'} icon={<Sym name={dup ? 'checkmark.circle.fill' : 'tray.and.arrow.down.fill'} size={17} color={palette.white} />} onPress={dup && existing ? () => router.replace(`/wisdom/${existing.id}`) : save} style={{ flex: 1, height: 52 }} />
          )}
        </GlassDock>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Row({ icon, label, text, warn }: { icon: string; label: string; text: string; warn?: boolean }) {
  return (
    <View style={[styles.row, warn && { backgroundColor: palette.coralSoft }]}>
      <Sym name={icon as any} size={15} color={warn ? palette.coral : palette.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="subhead" color={warn ? palette.coral : ios.secondary} style={{ fontWeight: '600' }}>{label}</T>
        <T v="body">{text}</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140, gap: 18 },
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 18 },
  code: { alignSelf: 'stretch', marginTop: 16, height: 60, borderRadius: 30, backgroundColor: palette.mint, textAlign: 'center', fontSize: 26, fontWeight: '700', letterSpacing: 4, color: palette.ink },
  err: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  from: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  kind: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: palette.primarySoft },
  lbl: { fontWeight: '600', marginBottom: 6 },
  ings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ing: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: palette.primarySoft },
  row: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: palette.mint },
});
