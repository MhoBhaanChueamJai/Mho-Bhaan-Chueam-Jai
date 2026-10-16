/**
 * แท็บคลังสมุนไพร (โครงเดียวกับแท็บผู้ป่วย/คลังภูมิ ตาม DESIGN_SYSTEM.md)
 * สมุนไพรประจำวัน (การ์ดภาพใหญ่) → ตารางสมุนไพร 2 คอลัมน์: ภาพเต็มขอบ · ชื่อ · ชื่อท้องถิ่น · รสยา + ธาตุ
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Sym, ios } from '../../../components/ios';
import { HeaderButton, PressableScale, T } from '../../../components/ui';
import { herbs, tasteTone, type Herb } from '../../../data/herbs';
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

function HerbCard({ h, i }: { h: Herb; i: number }) {
  const tone = tasteTone[h.taste];
  const el = elementColor[h.element];
  return (
    <Animated.View entering={FadeIn.delay(80 + (i % 8) * 40).duration(240)} style={styles.cell}>
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
        <T v="callout" color={ios.secondary} style={{ paddingHorizontal: 4, marginBottom: 14 }}>
          {herbs.length} ชนิด · ในบัญชียาหลักแห่งชาติ {national} ชนิด
        </T>

        {/* สมุนไพรประจำวัน */}
        <Animated.View entering={FadeInDown.duration(380)}>
          <PressableScale scaleTo={0.98} haptic="select" onPress={() => router.push(`/herb/${today.id}`)} style={[styles.hero, elevation.e2]} accessibilityLabel={`สมุนไพรประจำวัน ${today.name}`}>
            <View style={[StyleSheet.absoluteFill, styles.heroClip]}>
            <Image source={today.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(4,30,18,0.82)']} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
            </View>
            <View style={styles.heroBadge}>
              <Sym name="sun.max.fill" size={12} color={palette.primaryDeep} />
              <T v="micro" color={palette.primaryDeep} style={{ fontWeight: '700' }}>สมุนไพรประจำวัน</T>
            </View>
            <View style={styles.heroText}>
              <T v="h2" color="#FFFFFF">{today.name}</T>
              <T v="subhead" color="rgba(255,255,255,0.8)" style={{ fontStyle: 'italic' }} numberOfLines={1}>{today.sci}</T>
              <T v="callout" color="#FFFFFF" numberOfLines={2} style={{ marginTop: 6 }}>{today.uses.slice(0, 2).join(' · ')}</T>
            </View>
          </PressableScale>
        </Animated.View>

        <T v="h3" style={{ marginTop: 28, marginBottom: 12, marginLeft: 4 }}>สมุนไพรทั้งหมด</T>
        <View style={styles.grid}>
          {herbs.map((h, i) => (
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
  hero: { height: 220, borderRadius: 24, borderCurve: 'continuous', backgroundColor: palette.bgDeep, justifyContent: 'flex-end' },
  heroClip: { borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden' },
  heroBadge: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  heroText: { padding: 18 },
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
