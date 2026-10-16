import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { BookMarked, Camera, Check, FileText, Images, Languages, ScrollText, X } from '../components/icons';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SYSTEM_PROMPT, chatJSON, ocrImage } from '../api/ai';
import { Badge, Button, Card, GlassCircle, GlassDock, IconBubble, PressableScale, T, useHaptic } from '../components/ui';
import { manuscriptImage } from '../data/herbs';
import { useApp } from '../store/app';
import { setWisdomResult } from '../lib/wisdomTalk';
import { palette, radius, space } from '../theme';

type Stage = 'pick' | 'scanning' | 'result';
type Reading = { title: string; modern: string; ingredients: string[]; kind: string; note: string };

const FALLBACK: Reading = {
  title: 'ตำรายาแก้ไข้ป่า (ถอดความ)',
  modern:
    'ให้เอาบอระเพ็ด ฟ้าทะลายโจร รากย่านาง และจันทน์แดง อย่างละเท่ากัน ต้มกับน้ำ 3 ส่วน เคี่ยวให้เหลือ 1 ส่วน กินครั้งละครึ่งถ้วยชา เช้าและเย็น แก้ไข้จับสั่น ไข้ป่า',
  ingredients: ['บอระเพ็ด', 'ฟ้าทะลายโจร', 'รากย่านาง', 'จันทน์แดง'],
  kind: 'ตำรับยา',
  note: 'อักษรบางส่วนเลือนราง ควรให้ผู้รู้อักษรโบราณตรวจทานอีกครั้ง',
};

export default function Scan() {
  const insets = useSafeAreaInsets();
  const { settings, addWisdom } = useApp();
  // เปิดจากหน้าเพิ่มภูมิปัญญา → ส่งผลกลับไปเติมฟอร์มแทนการบันทึกทันที
  const { fill } = useLocalSearchParams<{ fill?: string }>();
  const h = useHaptic();
  const [stage, setStage] = useState<Stage>('pick');
  const [uri, setUri] = useState<string | null>(null);
  const [raw, setRaw] = useState('');
  const [reading, setReading] = useState<Reading | null>(null);
  const [tab, setTab] = useState<'modern' | 'raw'>('modern');
  const [phase, setPhase] = useState('');
  const [demo, setDemo] = useState(false);
  const [saved, setSaved] = useState(false);

  const laser = useSharedValue(0);
  useEffect(() => {
    if (stage === 'scanning') laser.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [stage]);
  const laserStyle = useAnimatedStyle(() => ({ top: `${laser.value * 92}%` as any }));

  const run = async (imgUri: string, mime = 'image/jpeg') => {
    setUri(imgUri);
    setStage('scanning');
    setPhase('Typhoon OCR กำลังอ่านตัวอักษร…');
    let text = '';
    try {
      text = await ocrImage(imgUri, mime);
    } catch {}
    setRaw(text);
    setPhase('ครูปัญญากำลังถอดความเป็นภาษาปัจจุบัน…');
    try {
      if (!text) throw new Error('empty');
      const r = await chatJSON<Reading>(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `ข้อความนี้ได้จากการ OCR ตำรา/สมุดข่อย/ใบลานโบราณ อาจมีคำผิด:\n"""${text.slice(0, 3000)}"""\n\nถอดความเป็นภาษาไทยปัจจุบันที่อ่านง่าย ตอบเป็น JSON เท่านั้น:
{"title":"ชื่อเรื่อง/ตำรับ","modern":"ถอดความภาษาปัจจุบัน ไม่เกิน 6 ประโยค","ingredients":["สมุนไพร/ตัวยาที่พบ (ถ้ามี)"],"kind":"ตำรับยา|วิธีรักษา|คาถา/พิธี|ตำราโบราณ","note":"หมายเหตุสำหรับผู้ตรวจทาน"}`,
          },
        ],
        settings.model,
      );
      setReading(r);
      setDemo(false);
    } catch {
      setReading(FALLBACK);
      if (!text) setRaw('๏ ยาแก้ไข้ป่า ท่านให้เอา บรเพช ฟ้าทลายโจร รากย่านาง จันแดง สิ่งละส่วน ต้มสามเอาหนึ่ง กินแก้ไข้จับสั่น หายแล ฯ');
      setDemo(true);
    }
    h.success();
    setStage('result');
  };

  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8, mediaTypes: ['images'] });
    if (!r.canceled) run(r.assets[0].uri, r.assets[0].mimeType ?? 'image/jpeg');
  };
  const fromLibrary = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ['images'] });
    if (!r.canceled) run(r.assets[0].uri, r.assets[0].mimeType ?? 'image/jpeg');
  };
  const fromSample = async () => {
    const a = Asset.fromModule(manuscriptImage);
    await a.downloadAsync();
    run(a.localUri ?? a.uri);
  };

  const save = () => {
    if (!reading) return;
    if (fill) {
      setWisdomResult({ title: reading.title, kind: reading.kind, summary: reading.modern, ingredients: reading.ingredients?.join(', '), source: 'สแกนตำรา' });
      h.success();
      router.back();
      return;
    }
    addWisdom({
      id: `w${Date.now()}`,
      title: reading.title,
      kind: (['ตำรับยา', 'วิธีรักษา', 'คาถา/พิธี', 'ตำราโบราณ'].includes(reading.kind) ? reading.kind : 'ตำราโบราณ') as any,
      source: 'สแกนตำรา',
      date: 'วันนี้',
      summary: reading.modern,
      ingredients: reading.ingredients,
      verified: false,
    });
    h.success();
    setSaved(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.ink }}>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <GlassCircle label="ปิด" onPress={() => router.back()}>
          <X size={20} color={palette.white} strokeWidth={2.4} />
        </GlassCircle>
        <T v="title" color={palette.white}>สแกนตำราโบราณ</T>
        <View style={{ width: 52 }} />
      </View>

      {stage === 'pick' && (
        <Animated.View entering={FadeIn} style={{ flex: 1, padding: space.lg, justifyContent: 'flex-end', paddingBottom: insets.bottom + space.lg }}>
          <View style={styles.frame}>
            <Image source={manuscriptImage} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={['rgba(16,41,31,0.2)', 'rgba(16,41,31,0.85)']} style={StyleSheet.absoluteFill} />
            {['tl', 'tr', 'bl', 'br'].map((c) => (
              <View key={c} style={[styles.corner, styles[c as 'tl']]} />
            ))}
            <View style={{ position: 'absolute', bottom: space.lg, left: space.lg, right: space.lg }}>
              <T v="h2" color={palette.white}>แปลงสมุดข่อย ใบลาน{'\n'}เป็นความรู้ดิจิทัล</T>
              <T v="callout" color="rgba(255,255,255,0.8)">วางตำราบนพื้นเรียบ แสงสว่างพอ ถ่ายให้ตรงหน้า</T>
            </View>
          </View>
          <View style={{ gap: space.sm, marginTop: space.lg }}>
            <Button kind="primary" label="ถ่ายภาพตำรา" icon={<Camera size={24} color={palette.ink} />} onPress={fromCamera} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button style={{ flex: 1 }} kind="secondary" label="เลือกจากอัลบั้ม" icon={<Images size={22} color={palette.primary} />} onPress={fromLibrary} />
              <Button style={{ flex: 1 }} kind="secondary" label="ลองตัวอย่าง" icon={<ScrollText size={22} color={palette.primary} />} onPress={fromSample} />
            </View>
          </View>
        </Animated.View>
      )}

      {stage === 'scanning' && uri && (
        <Animated.View entering={FadeIn} style={{ flex: 1, padding: space.lg, alignItems: 'center', justifyContent: 'center' }}>
          <View style={[styles.frame, { height: 440 }]}>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(16,41,31,0.25)' }]} />
            <Animated.View style={[styles.laser, laserStyle]}>
              <LinearGradient colors={['rgba(233,211,160,0)', 'rgba(233,211,160,0.55)', palette.orange]} style={{ flex: 1 }} />
            </Animated.View>
          </View>
          <T v="title" color={palette.white} style={{ marginTop: space.xl }}>{phase}</T>
          <T v="callout" color="rgba(255,255,255,0.7)">ใช้เวลาประมาณ 10–30 วินาที</T>
        </Animated.View>
      )}

      {stage === 'result' && reading && (
        <View style={{ flex: 1, backgroundColor: palette.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(420)} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              {uri ? <Image source={{ uri }} style={styles.thumb} contentFit="cover" /> : null}
              <View style={{ flex: 1 }}>
                {demo ? <Badge label="โหมดสาธิต" fg={palette.coral} bg={palette.coralSoft} /> : <Badge label="✓ อ่านด้วย Typhoon OCR" />}
                <T v="h2" color={palette.ink} style={{ marginTop: 4 }}>{reading.title}</T>
                <T v="caption" color={palette.inkMute}>{reading.kind}</T>
              </View>
            </Animated.View>

            <View style={styles.seg}>
              {[
                { k: 'modern' as const, l: 'ถอดความปัจจุบัน', I: Languages },
                { k: 'raw' as const, l: 'ข้อความต้นฉบับ', I: FileText },
              ].map(({ k, l, I }) => (
                <PressableScale key={k} haptic="select" onPress={() => setTab(k)} style={[styles.segItem, tab === k && styles.segOn]}>
                  <I size={18} color={tab === k ? palette.white : palette.inkSoft} />
                  <T v="callout" color={tab === k ? palette.white : palette.inkSoft}>{l}</T>
                </PressableScale>
              ))}
            </View>

            <Animated.View key={tab} entering={FadeIn.duration(250)}>
              <Card style={{ backgroundColor: tab === 'raw' ? '#2A2A24' : palette.surface }}>
                <T v="body" color={tab === 'raw' ? '#F0E6CC' : palette.ink} >
                  {tab === 'modern' ? reading.modern : raw}
                </T>
              </Card>
            </Animated.View>

            {reading.ingredients.length ? (
              <Animated.View entering={FadeInDown.delay(120).duration(420)}>
                <T v="bodyStrong" color={palette.ink} style={{ marginTop: space.lg, marginBottom: space.sm }}>สมุนไพรที่พบในตำรา</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {reading.ingredients.map((x) => (
                    <View key={x} style={styles.ing}>
                      <T v="callout" color={palette.ink}>🌿 {x}</T>
                    </View>
                  ))}
                </View>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(180).duration(420)} style={styles.note}>
              <IconBubble bg="rgba(197,154,61,0.2)" size={44}>
                <ScrollText size={22} color="#8A6A1E" />
              </IconBubble>
              <T v="callout" style={{ flex: 1 }}>{reading.note}</T>
            </Animated.View>
          </ScrollView>
          <GlassDock>
            <Button style={{ flex: 1 }} kind="secondary" label="สแกนหน้าต่อไป" icon={<Camera size={20} color={palette.primary} />} onPress={() => { setSaved(false); setStage('pick'); }} />
            <Button
              style={{ flex: 1.2 }}
              kind={saved ? 'secondary' : 'primary'}
              label={saved ? 'ดูในคลัง' : fill ? 'ใช้ข้อมูลนี้' : 'เก็บเข้าคลัง'}
              icon={saved ? <Check size={20} color={palette.primary} /> : <BookMarked size={20} color={palette.white} />}
              onPress={saved ? () => router.replace('/vault') : save}
            />
          </GlassDock>
        </View>
      )}
    </View>
  );
}

const C = 34;
const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: 8 },
  frame: { width: '100%', flex: 1, maxHeight: 460, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: palette.ink },
  corner: { position: 'absolute', width: C, height: C, borderColor: palette.orange },
  tl: { top: 16, left: 16, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  tr: { top: 16, right: 16, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bl: { bottom: 16, left: 16, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  br: { bottom: 16, right: 16, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  laser: { position: 'absolute', left: 0, right: 0, height: 40 },
  thumb: { width: 76, height: 96, borderRadius: radius.sm },
  seg: { flexDirection: 'row', backgroundColor: palette.bgDeep, borderRadius: radius.pill, padding: 4, marginVertical: space.lg },
  segItem: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  segOn: { backgroundColor: palette.primary },
  ing: { backgroundColor: palette.primarySoft, paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill },
  note: { flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: palette.peach, padding: space.md, borderRadius: radius.lg, marginTop: space.lg },
});
