/**
 * การ์ดลอยแบบตอนจับคู่อุปกรณ์ Apple (proximity card) — ตัวอย่างตำราที่ได้จากรหัส/คิวอาร์
 * การ์ดเว้นขอบจอ มุมโค้งตามมุมจอ เนื้อหาจัดกลาง: ปกหนังสือใหญ่ · ชื่อ · ผู้แชร์/ประเภท · เนื้อหา 5 บรรทัด · ปุ่มเพิ่มลงคลัง
 * แตะพื้นหลัง / ปุ่ม ✕ / ปัดลง เพื่อปิด
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '../../components/BookCover';
import { KindIcon } from '../../components/KindIcon';
import { Sym } from '../../components/ios';
import { Button, PressableScale, T, useHaptic } from '../../components/ui';
import type { Wisdom } from '../../data/mock';
import { plainText } from '../../lib/wisdomKinds';
import { cachedShare, cleanCode, fetchShare, type ReceivedShare } from '../../lib/wisdomShare';
import { useApp } from '../../store/app';
import { palette } from '../../theme';

const CARD_MARGIN = 8;
const CARD_RADIUS = 52; // ใกล้เคียงมุมจอ iPhone รุ่นใหม่

export default function GotWisdom() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = cleanCode(raw ?? '');
  const insets = useSafeAreaInsets();
  const { addWisdom, wisdoms } = useApp();
  const h = useHaptic();
  const [got, setGot] = useState<ReceivedShare | null>(() => cachedShare(code));
  const [err, setErr] = useState('');
  const [savedId, setSavedId] = useState('');

  useEffect(() => {
    if (got || !code) return;
    fetchShare(code)
      .then((r) => (r ? setGot(r) : setErr('ไม่พบตำราจากรหัสนี้ หรือรหัสหมดอายุแล้ว')))
      .catch(() => setErr('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'));
  }, [code, got]);

  const save = () => {
    if (!got) return;
    const t = new Date();
    const id = `w${Date.now()}`;
    addWisdom({
      ...got.wisdom,
      id,
      source: 'เพื่อนแชร์',
      sharedBy: got.fromName,
      shareCode: code,
      date: `${t.getDate()}/${t.getMonth() + 1}/${t.getFullYear() + 543}`,
      summary: got.wisdom.summary ?? '',
      verified: false,
    });
    h.success();
    setSavedId(id);
  };
  const openSaved = () => {
    router.dismissAll();
    setTimeout(() => router.push(`/wisdom/${savedId}`), 50);
  };

  // ── การ์ดเลื่อนขึ้นจากล่าง (สปริง) · ปัดลงเพื่อปิด ──
  const y = useSharedValue(600);
  useEffect(() => {
    y.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 });
  }, [y]);
  const close = () => {
    y.value = withTiming(700, { duration: 220 }, () => runOnJS(router.back)());
  };
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      y.value = Math.max(-20, e.translationY * (e.translationY < 0 ? 0.2 : 1));
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 800) {
        y.value = withTiming(700, { duration: 200 }, () => runOnJS(router.back)());
      } else y.value = withSpring(0, { damping: 22, stiffness: 220 });
    });
  const cardSt = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  const w = got?.wisdom;
  const preview = w ? ({ ...w, id: 'preview', source: 'เพื่อนแชร์', date: '', verified: true, summary: w.summary ?? '' } as Wisdom) : null;
  const dup = !!w && wisdoms.some((x) => x.title === w.title && x.sharedBy === got?.fromName);
  const body = w ? plainText(w.summary).replace(/\n*(ได้รับสืบทอดจาก|แหล่งที่มา):.*$/, '').trim() : '';

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, styles.backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="ปิด" />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, { bottom: Math.max(CARD_MARGIN, insets.bottom > 0 ? CARD_MARGIN : 16) }, cardSt]}>
          <PressableScale onPress={close} style={styles.x} accessibilityLabel="ปิด" hitSlop={8}>
            <Sym name="xmark" size={14} color={palette.inkSoft} weight="bold" />
          </PressableScale>
          {err ? (
            <View style={styles.center}>
              <Sym name="exclamationmark.circle.fill" size={44} color={palette.coral} />
              <T v="h3" center style={{ marginTop: 14 }}>{err}</T>
              <Button kind="secondary" label="ลองรหัสอื่น" onPress={close} style={styles.btn} />
            </View>
          ) : !got || !w || !preview ? (
            <View style={[styles.center, { paddingVertical: 60 }]}>
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : (
            <View style={styles.center}>
              <BookCover w={preview} width={124} />
              <T v="h2" center numberOfLines={2} style={{ marginTop: 22 }}>{w.title}</T>
              <View style={styles.meta}>
                <KindIcon kind={w.kind} size={12} color={palette.primaryDeep} />
                <T v="subhead" color={palette.primaryDeep} style={{ fontWeight: '600' }}>{w.kind}</T>
                <T v="subhead" color={palette.inkSoft}>·</T>
                <T v="subhead" color={palette.inkSoft} numberOfLines={1} style={{ flexShrink: 1 }}>เพิ่มโดย {got.fromName}</T>
              </View>
              {body ? (
                <T v="callout" color={palette.inkSoft} center numberOfLines={5} style={{ marginTop: 12 }}>{body}</T>
              ) : null}
              {savedId ? (
                <Button label="เปิดดูในคลัง" icon={<Sym name="book.fill" size={17} color="#FFFFFF" />} onPress={openSaved} style={styles.btn} />
              ) : (
                <Button label={dup ? 'มีในคลังแล้ว · เพิ่มอีกครั้ง' : 'เพิ่มลงคลัง'} onPress={save} style={styles.btn} />
              )}
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  card: { position: 'absolute', left: CARD_MARGIN, right: CARD_MARGIN, backgroundColor: palette.surface, borderRadius: CARD_RADIUS, borderCurve: 'continuous', paddingHorizontal: 26, paddingTop: 34, paddingBottom: 26, boxShadow: '0px 20px 50px rgba(0,0,0,0.35)' },
  x: { position: 'absolute', top: 18, right: 18, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(118,118,128,0.14)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  center: { alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, maxWidth: '100%' },
  btn: { alignSelf: 'stretch', height: 54, borderRadius: 27, marginTop: 24 },
});
