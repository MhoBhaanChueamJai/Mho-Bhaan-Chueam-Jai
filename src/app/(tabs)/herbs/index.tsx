/**
 * แท็บคลังสมุนไพร — โครงเดียวกับคลังภูมิ (DESIGN_SYSTEM.md)
 * Hero การ์ด (ภาพสมุนไพรประจำวันเบลอ) + จำนวน + KPI กระจกตามธาตุ → สมุนไพรประจำวัน → กรองตามรสยา → ตาราง 2 คอลัมน์
 */
import { BlurView } from 'expo-blur';
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
const ELEMENTS = ['ดิน', 'น้ำ', 'ลม', 'ไฟ'] as const;
const EL_ICON: Record<(typeof ELEMENTS)[number], string> = { ดิน: 'mountain.2.fill', น้ำ: 'drop.fill', ลม: 'wind', ไฟ: 'flame.fill' };

function Pill({ text, fg, bg }: { text: string; fg: string; bg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <T v="micro" color={fg} style={{ fontWeight: '700' }}>{text}</T>
    </View>
  );
}

function HerbCard({ h, i }: { h: Herb; i: number }) {
  const tone = tasteTone[h.taste];
  const el = elementColor[h.element];
  return (
    <Animated.View entering={FadeIn.delay(60 + (i % 8) * 40).duration(240)} layout={LinearTransition.duration(260)} style={styles.cell}>
      <PressableScale scaleTo={0.97} haptic="select" onPress={() => router.push(`/herb/${h.id}`)} style={[styles.card, elevation.e1]} accessibilityLabel={`${h.name} รส${h.taste}`}>
        <View style={styles.clip}>
          <View style={styles.imgWrap}>
            <Image source={h.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            {h.nationalList ? (
              <View style={styles.seal}>
                <Sym name="checkmark.seal.fill" size={13} color={palette.primary} />
              </View>
            ) : null}
          </View>
          <View style={styles.body}>
            <T v="title" numberOfLines={1}>{h.name}</T>
            <T v="caption" color={ios.secondary} numberOfLines={1}>{h.uses[0]}</T>
            <View style={styles.tags}>
              <Pill text={`รส${h.taste}`} fg={tone.fg} bg={tone.bg} />
              <Pill text={el.label} fg={el.fg} bg={el.bg} />
            </View>
          </View>
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
        {/* ── Hero: ภาพสมุนไพรประจำวัน (เบลอ) + จำนวน + KPI ตามธาตุ ── */}
        <View style={[styles.heroWrap, elevation.e3]}>
          <View style={styles.hero}>
            <Image source={today.image} style={StyleSheet.absoluteFill} contentFit="cover" />
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(6,20,13,0.5)', 'rgba(6,20,13,0.3)', 'rgba(6,20,13,0.85)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.eyebrow}>
              <Sym name="leaf.fill" size={13} color="#BFF0C9" />
              <T v="subhead" color="#BFF0C9" style={{ fontWeight: '600' }}>คลังสมุนไพรไทย</T>
            </View>
            <Animated.View entering={FadeInDown.duration(420)}>
              <T v="h1" color="#FFFFFF" style={{ marginTop: 10, marginBottom: 4 }}>สมุนไพร {herbs.length} ชนิด</T>
              <T v="callout" color="rgba(255,255,255,0.8)">ในบัญชียาหลักแห่งชาติ {national} ชนิด · รสยา ธาตุ สรรพคุณ วิธีใช้</T>
            </Animated.View>
            <View style={styles.kpis}>
              {ELEMENTS.map((e, i) => {
                const c = elementColor[e];
                return (
                  <Animated.View key={e} entering={FadeInDown.delay(120 + i * 60).duration(380)} style={styles.kpi}>
                    <BlurView intensity={26} tint="light" style={StyleSheet.absoluteFill} />
                    <View style={[styles.kpiIcon, { backgroundColor: c.fg }]}>
                      <Sym name={EL_ICON[e] as any} size={13} color="#FFFFFF" />
                    </View>
                    <T v="h2" color="#FFFFFF" style={{ marginTop: 8 }}>{herbs.filter((h) => h.element === e).length}</T>
                    <T v="micro" color="rgba(255,255,255,0.85)" style={{ fontWeight: '600' }}>{c.label}</T>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        </View>

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
          <T v="subhead" color={ios.secondary}>{list.length} ชนิด</T>
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
        <View style={styles.grid}>
          {list.map((h, i) => (
            <HerbCard key={h.id} h={h} i={i} />
          ))}
        </View>

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
  heroWrap: { borderRadius: 30, borderCurve: 'continuous', backgroundColor: '#14261c' },
  hero: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, borderRadius: 30, borderCurve: 'continuous', overflow: 'hidden' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kpis: { flexDirection: 'row', gap: 8, marginTop: 18 },
  kpi: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
  kpiIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sec: { marginTop: 28, marginBottom: 12, marginLeft: 4 },
  secRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 10, paddingHorizontal: 4 },
  today: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 24, borderCurve: 'continuous', backgroundColor: palette.surface },
  todayImg: { width: 92, height: 92, borderRadius: 18, borderCurve: 'continuous', backgroundColor: palette.bgDeep },
  todayBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: palette.primarySoft },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  chip: { paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: ios.separator },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '48.3%' },
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous' },
  clip: { borderRadius: 22, borderCurve: 'continuous', overflow: 'hidden' },
  imgWrap: { height: 132, backgroundColor: palette.bgDeep },
  seal: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 18, marginLeft: 4 },
});
