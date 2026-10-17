/**
 * แท็บคลังสมุนไพร — โครงเดียวกับคลังภูมิ (DESIGN_SYSTEM.md)
 * การ์ดฟีเจอร์ใหม่ "สแกนหาสมุนไพร" (เปิดกล้อง) → สมุนไพรประจำวัน → กรองตามรสยา → รายการสมุนไพร (แถวรูปเล็ก คั่นเส้นบาง)
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Sym, ios } from '../../../components/ios';
import { HeaderButton, PressableScale, T } from '../../../components/ui';
import { herbs, tasteTone, tastes, type Herb } from '../../../data/herbs';
import { elementColor, elevation, palette } from '../../../theme';

/** สมุนไพรประจำวัน — เปลี่ยนทุกวัน */
const todayHerb = () => herbs[Math.floor(Date.now() / 86400000) % herbs.length];

function Pill({ text, fg, bg }: { text: string; fg: string; bg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <T v="micro" color={fg} style={{ fontWeight: '700' }}>{text}</T>
    </View>
  );
}

/** แถวสมุนไพร: รูปเล็กมุมโค้ง · ชื่อ (+ตราบัญชียาหลัก) · ชื่อวิทยาศาสตร์ · สรรพคุณ · ป้ายรส/ธาตุ · › */
function HerbRow({ h, i, last }: { h: Herb; i: number; last: boolean }) {
  const tone = tasteTone[h.taste];
  const el = elementColor[h.element];
  return (
    <Animated.View entering={FadeIn.delay(40 + (i % 10) * 30).duration(220)} layout={LinearTransition.duration(240)}>
      <PressableScale scaleTo={0.985} haptic="select" onPress={() => router.push(`/herb/${h.id}`)} style={styles.row} accessibilityLabel={`${h.name} รส${h.taste}`}>
        <Image source={h.image} style={styles.thumb} contentFit="cover" transition={200} />
        <View style={[styles.rowBody, !last && styles.rowSep]}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.nameRow}>
              <T v="title" numberOfLines={1} style={{ flexShrink: 1 }}>{h.name}</T>
              {h.nationalList ? <Sym name="checkmark.seal.fill" size={14} color={palette.primary} /> : null}
            </View>
            <T v="caption" color={ios.secondary} numberOfLines={1}>{h.uses.slice(0, 2).join(' · ')}</T>
            <View style={styles.tags}>
              <Pill text={`รส${h.taste}`} fg={tone.fg} bg={tone.bg} />
              <Pill text={el.label} fg={el.fg} bg={el.bg} />
            </View>
          </View>
          <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export default function Herbs() {
  const today = todayHerb();
  const national = herbs.filter((h) => h.nationalList).length;
  const [taste, setTaste] = useState<(typeof tastes)[number]>('ทั้งหมด');
  // แสดงเฉพาะรสที่มีสมุนไพรจริง
  const tasteOpts = tastes.filter((t) => t === 'ทั้งหมด' || herbs.some((h) => h.taste === t));
  const list = taste === 'ทั้งหมด' ? herbs : herbs.filter((h) => h.taste === taste);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderButton label="ค้นหาสมุนไพร" onPress={() => router.push('/herb/search')}>
              <Sym name="magnifyingglass" size={20} color={palette.ink} weight="semibold" />
            </HeaderButton>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        {/* ── ฟีเจอร์ใหม่: สแกนหาสมุนไพรด้วยกล้อง (การ์ดกะทัดรัด พื้นหลังภาพสมุนไพรบนพื้นเขียวเข้ม) ── */}
        <Animated.View entering={FadeInDown.duration(420)}>
          <PressableScale scaleTo={0.98} haptic="press" onPress={() => router.push('/herb/scan')} style={[styles.heroWrap, elevation.e2]} accessibilityLabel="สแกนหาสมุนไพรด้วยกล้อง">
            <View style={styles.hero}>
              <Image source={require('../../../../assets/herbs/scan-banner.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="right" />
              <LinearGradient colors={['rgba(8,26,16,0.92)', 'rgba(8,26,16,0.55)', 'rgba(8,26,16,0)']} locations={[0, 0.5, 0.85]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <View style={{ width: '64%' }}>
                <View style={styles.newBadge}>
                  <Sym name="sparkles" size={10} color="#04150E" />
                  <T v="micro" color="#04150E" style={{ fontWeight: '800' }}>ฟีเจอร์ใหม่</T>
                </View>
                <T v="h3" color="#FFFFFF" style={{ marginTop: 8 }}>สแกนหาสมุนไพร</T>
                <T v="caption" color="rgba(255,255,255,0.82)" numberOfLines={2} style={{ marginTop: 2 }}>ส่องกล้องที่ใบหรือเหง้า ครูปัญญาบอกชื่อและสรรพคุณให้</T>
                <View style={styles.scanBtn}>
                  <Sym name="camera.viewfinder" size={15} color="#04150E" weight="semibold" />
                  <T v="subhead" color="#04150E" style={{ fontWeight: '700' }}>เปิดกล้อง</T>
                </View>
              </View>
            </View>
          </PressableScale>
        </Animated.View>

        {/* ── สมุนไพรประจำวัน ── */}
        <T v="h3" style={styles.sec}>สมุนไพรประจำวัน</T>
        <Animated.View entering={FadeInDown.delay(80).duration(380)}>
          <PressableScale scaleTo={0.98} haptic="select" onPress={() => router.push(`/herb/${today.id}`)} style={[styles.today, elevation.e1]} accessibilityLabel={`สมุนไพรประจำวัน ${today.name}`}>
            <Image source={today.image} style={styles.todayImg} contentFit="cover" transition={250} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.todayBadge}>
                <Sym name="sun.max.fill" size={11} color={palette.primaryDeep} />
                <T v="micro" color={palette.primaryDeep} style={{ fontWeight: '700' }}>วันนี้</T>
              </View>
              <T v="h3" numberOfLines={1}>{today.name}</T>
              <T v="caption" color={ios.secondary} numberOfLines={1} style={{ fontStyle: 'italic' }}>{today.sci}</T>
              <T v="subhead" color={palette.inkSoft} numberOfLines={2}>{today.uses.slice(0, 2).join(' · ')}</T>
            </View>
            <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
          </PressableScale>
        </Animated.View>

        {/* ── กรองตามรสยา ── */}
        <View style={styles.secRow}>
          <T v="h3">สมุนไพรทั้งหมด</T>
          <T v="subhead" color={ios.secondary}>{list.length} ชนิด · บัญชียาหลัก {national}</T>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginHorizontal: -16 }}>
          {tasteOpts.map((t) => {
            const on = taste === t;
            const tone = t === 'ทั้งหมด' ? null : tasteTone[t];
            return (
              <PressableScale key={t} haptic="select" scaleTo={0.95} onPress={() => setTaste(t)} style={[styles.chip, on && { backgroundColor: tone?.fg ?? palette.primary, borderColor: 'transparent' }]} accessibilityState={{ selected: on }} accessibilityLabel={t === 'ทั้งหมด' ? 'ทั้งหมด' : `รส${t}`}>
                <T v="subhead" color={on ? '#FFFFFF' : palette.ink} style={{ fontWeight: '600' }}>{t === 'ทั้งหมด' ? 'ทั้งหมด' : `รส${t}`}</T>
              </PressableScale>
            );
          })}
        </ScrollView>
        <Animated.View layout={LinearTransition.duration(240)} style={[styles.list, elevation.e1]}>
          {list.map((h, i) => (
            <HerbRow key={h.id} h={h} i={i} last={i === list.length - 1} />
          ))}
        </Animated.View>

        <View style={styles.foot}>
          <Sym name="checkmark.seal.fill" size={13} color={palette.primary} />
          <T v="caption" color={ios.secondary}>= อยู่ในบัญชียาหลักแห่งชาติ (ยาจากสมุนไพร)</T>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 130 },
  heroWrap: { borderRadius: 24, borderCurve: 'continuous', backgroundColor: '#0d2015' },
  hero: { paddingHorizontal: 18, paddingVertical: 16, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden' },
  newBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#7CF0A8' },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 36, paddingHorizontal: 14, marginTop: 12, borderRadius: 18, backgroundColor: '#7CF0A8' },
  sec: { marginTop: 28, marginBottom: 12, marginLeft: 4 },
  secRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 10, paddingHorizontal: 4 },
  today: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 24, borderCurve: 'continuous', backgroundColor: palette.surface },
  todayImg: { width: 92, height: 92, borderRadius: 18, borderCurve: 'continuous', backgroundColor: palette.bgDeep },
  todayBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: palette.primarySoft },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  chip: { paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: ios.separator },
  list: { backgroundColor: palette.surface, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 14 },
  thumb: { width: 64, height: 64, borderRadius: 16, borderCurve: 'continuous', backgroundColor: palette.bgDeep },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingRight: 14 },
  rowSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ios.separator },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 18, marginLeft: 4 },
});
