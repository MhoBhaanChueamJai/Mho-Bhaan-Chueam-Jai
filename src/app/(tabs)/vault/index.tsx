/**
 * แท็บคลังภูมิปัญญา — สมุดข่อยดิจิทัลของคุณหมอ
 * Hero (การ์ด): พื้นหลังสันหนังสือ/ตำราเรียงบนหิ้ง (เบลอ) + ชื่อหน้า + KPI จำนวนตามประเภท · ปุ่มไอคอน Liquid Glass (สแกน QR รับตำรา · เพิ่ม) มุมขวาบน
 * → เรื่องล่าสุด (การ์ดภาพใหญ่เลื่อนแนวนอน) → รายการทั้งหมด
 */
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleIcon } from '../../../components/ListRow';
import { Sym, ios } from '../../../components/ios';
import { GlassCircle, PressableScale, T } from '../../../components/ui';
import { herbs } from '../../../data/herbs';
import { legacy, type Wisdom } from '../../../data/mock';
import { useApp } from '../../../store/app';
import { elevation, palette } from '../../../theme';

const KIND: Record<Wisdom['kind'], { icon: string; color: string }> = {
  ตำรับยา: { icon: 'leaf.fill', color: palette.primary },
  วิธีรักษา: { icon: 'hand.raised.fill', color: '#3B7DD8' },
  'คาถา/พิธี': { icon: 'sparkles', color: '#8A5CD0' },
  ตำราโบราณ: { icon: 'scroll.fill', color: '#B07A2A' },
};
const KINDS = Object.keys(KIND) as Wisdom['kind'][];
const SOURCE_ICON: Record<Wisdom['source'], string> = { เสียงเล่า: 'waveform', สแกนตำรา: 'doc.viewfinder', พิมพ์เอง: 'pencil', เพื่อนแชร์: 'person.2.fill' };

const COVER = {
  shelf: require('../../../../assets/vault/shelf.jpg'),
  hands: require('../../../../assets/vault/hands.jpg'),
  herbs: require('../../../../assets/vault/herbs.jpg'),
  manuscript: require('../../../../assets/vault/manuscript.jpg'),
  healer: require('../../../../assets/vault/healer.jpg'),
};
/** ภาพปกตามเนื้อหา: สแกนตำรา/ตำราโบราณ = สมุดข่อย · ตำรับยา = สมุนไพรตัวแรกที่มีภาพ · วิธีรักษา = ลูกประคบ */
function coverOf(w: Wisdom): ImageSourcePropType {
  if (w.source === 'สแกนตำรา' || w.kind === 'ตำราโบราณ') return COVER.manuscript;
  if (w.kind === 'วิธีรักษา') return COVER.herbs;
  if (w.kind === 'คาถา/พิธี') return COVER.healer;
  const h = herbs.find((x) => w.ingredients?.some((i) => i.includes(x.name)));
  return h ? h.image : COVER.hands;
}

function Feature({ w, i }: { w: Wisdom; i: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(40 + i * 50).duration(340)}>
      <PressableScale scaleTo={0.97} haptic="select" onPress={() => router.push(`/wisdom/${w.id}`)} style={[styles.feature, elevation.e2]} accessibilityLabel={w.title}>
        <View style={styles.featureClip}>
          <Image source={coverOf(w)} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(4,22,14,0.35)', 'rgba(4,22,14,0.9)']} locations={[0.25, 0.55, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.featureTop}>
            <View style={styles.kindPill}>
              <Sym name={KIND[w.kind]?.icon as any} size={12} color={KIND[w.kind]?.color} />
              <T v="micro" color={palette.ink} style={{ fontWeight: '700' }}>{w.kind}</T>
            </View>
            {w.verified ? null : (
              <View style={styles.pendingPill}>
                <T v="micro" color="#8A5A10" style={{ fontWeight: '700' }}>รอตรวจทาน</T>
              </View>
            )}
          </View>
          <View style={styles.featureText}>
            <T v="h3" color="#FFFFFF" numberOfLines={2}>{w.title}</T>
            <T v="subhead" color="rgba(255,255,255,0.8)" numberOfLines={2} style={{ marginTop: 4 }}>{w.summary}</T>
            <View style={styles.featureMeta}>
              <Sym name={SOURCE_ICON[w.source] as any} size={12} color="rgba(255,255,255,0.75)" />
              <T v="caption" color="rgba(255,255,255,0.75)" numberOfLines={1}>{w.sharedBy ? `จาก ${w.sharedBy}` : w.source} · {w.date}</T>
            </View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export default function Vault() {
  const { wisdoms } = useApp();
  const insets = useSafeAreaInsets();
  const recorded = legacy.recorded + Math.max(0, wisdoms.length - 3);
  const list = wisdoms;
  const count = (k: Wisdom['kind']) => wisdoms.filter((w) => w.kind === k).length;

  return (
    <ScrollView contentInsetAdjustmentBehavior="never" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
      {/* ── Hero: สันหนังสือบนหิ้ง (เบลอ) ── */}
      <View style={[styles.heroWrap, { marginTop: insets.top + 8 }, elevation.e3]}>
      <View style={styles.hero}>
        <Image source={COVER.shelf} style={StyleSheet.absoluteFill} contentFit="cover" />
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(6,20,13,0.55)', 'rgba(6,20,13,0.35)', 'rgba(6,20,13,0.88)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />

        <View style={styles.heroTop}>
          <View style={styles.eyebrow}>
            <Sym name="books.vertical.fill" size={13} color="#F3D9A4" />
            <T v="subhead" color="#F3D9A4" style={{ fontWeight: '600' }}>สมุดข่อยดิจิทัล</T>
          </View>
          {/* ปุ่มไอคอน Liquid Glass: สแกน QR รับตำรา · เพิ่มภูมิปัญญา */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <GlassCircle label="สแกนคิวอาร์โค้ดรับตำรา" onPress={() => router.push('/wisdom/scan-qr')} tint="rgba(255,255,255,0.14)">
              <Sym name="qrcode.viewfinder" size={19} color="#FFFFFF" />
            </GlassCircle>
            <GlassCircle label="เพิ่มภูมิปัญญา" onPress={() => router.push('/wisdom/new')} tint="rgba(255,255,255,0.14)">
              <Sym name="plus" size={20} color="#FFFFFF" weight="semibold" />
            </GlassCircle>
          </View>
        </View>

        <Animated.View entering={FadeInDown.duration(420)}>
          <T v="hero" color="#FFFFFF" style={styles.title}>คลังภูมิปัญญา</T>
          <T v="callout" color="rgba(255,255,255,0.78)">ตำรับยา วิธีรักษา และตำราโบราณ · บันทึกแล้ว {recorded} เรื่อง</T>
        </Animated.View>

        {/* KPI: จำนวนตามประเภทตำรา (แสดงผลอย่างเดียว) */}
        <View style={styles.kpis}>
          {KINDS.map((k, i) => (
            <Animated.View key={k} entering={FadeInDown.delay(120 + i * 60).duration(380)} style={styles.kpi}>
              <BlurView intensity={26} tint="light" style={StyleSheet.absoluteFill} />
              <View style={[styles.kpiIcon, { backgroundColor: `${KIND[k].color}` }]}>
                <Sym name={KIND[k].icon as any} size={13} color="#FFFFFF" />
              </View>
              <T v="h2" color="#FFFFFF" style={{ marginTop: 8 }}>{count(k)}</T>
              <T v="micro" color="rgba(255,255,255,0.82)" numberOfLines={1} style={{ fontWeight: '600' }}>{k}</T>
            </Animated.View>
          ))}
        </View>
      </View>
      </View>

      {/* ── เรื่องล่าสุด ── */}
      {list.length ? (
        <>
          <View style={styles.secHead}>
            <T v="h3">ล่าสุด</T>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={CARD_W + 14} snapToAlignment="start" contentContainerStyle={styles.rail}>
            {list.slice(0, 6).map((w, i) => (
              <Feature key={w.id} w={w} i={i} />
            ))}
          </ScrollView>
        </>
      ) : null}

      {/* ── รายการทั้งหมด ── */}
      <View style={[styles.secHead, { marginTop: 14 }]}>
        <T v="h3">ทั้งหมด</T>
        <T v="subhead" color={ios.secondary}>{list.length} เรื่อง</T>
      </View>
      {list.length ? (
        <Animated.View layout={LinearTransition.duration(260)} style={[styles.list, elevation.e1]}>
          {list.map((w, i) => (
            <Animated.View key={w.id} entering={FadeIn.delay(i * 35).duration(200)}>
              {i ? <View style={styles.sep} /> : null}
              <PressableScale scaleTo={0.98} haptic="select" onPress={() => router.push(`/wisdom/${w.id}`)} style={styles.row} accessibilityLabel={`${w.title} ${w.kind}`}>
                <CircleIcon name={KIND[w.kind]?.icon ?? 'book.closed.fill'} color={KIND[w.kind]?.color ?? palette.primary} size={48} />
                <View style={{ flex: 1, gap: 1 }}>
                  <T v="title" numberOfLines={2}>{w.title}</T>
                  <View style={styles.meta}>
                    <Sym name={SOURCE_ICON[w.source] as any} size={11} color={ios.tertiary} />
                    <T v="caption" color={ios.tertiary} numberOfLines={1} style={{ flexShrink: 1 }}>{w.sharedBy ? `จาก ${w.sharedBy}` : w.source} · {w.date}</T>
                    {w.verified ? null : (
                      <View style={styles.pending}>
                        <T v="micro" color="#C27A12" style={{ fontWeight: '700' }}>รอตรวจทาน</T>
                      </View>
                    )}
                  </View>
                </View>
                <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
              </PressableScale>
            </Animated.View>
          ))}
        </Animated.View>
      ) : (
        <View style={[styles.list, elevation.e1, { alignItems: 'center', paddingVertical: 28, gap: 6 }]}>
          <Sym name="book.closed" size={28} color={ios.tertiary} />
          <T v="callout" color={ios.secondary}>ยังไม่มีภูมิปัญญา กด “เพิ่มภูมิปัญญา” ได้เลย</T>
        </View>
      )}
    </ScrollView>
  );
}

const CARD_W = 272;
const styles = StyleSheet.create({
  heroWrap: { marginHorizontal: 16, borderRadius: 30, borderCurve: 'continuous', backgroundColor: '#14261c' },
  hero: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, borderRadius: 30, borderCurve: 'continuous', overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { marginBottom: 4 },
  kpis: { flexDirection: 'row', gap: 8, marginTop: 18 },
  kpi: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
  kpiIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  secHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 24, marginBottom: 2 },
  rail: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 22, gap: 14 },
  feature: { width: CARD_W, height: 320, borderRadius: 26, borderCurve: 'continuous', backgroundColor: palette.surface },
  featureClip: { flex: 1, borderRadius: 26, borderCurve: 'continuous', overflow: 'hidden' },
  featureTop: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  kindPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  pendingPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(253,240,220,0.95)' },
  featureText: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  featureMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  list: { marginHorizontal: 16, marginTop: 10, backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 14, paddingRight: 16, minHeight: 76 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginLeft: 76 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  pending: { marginLeft: 4, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: '#FDF0DC' },
});
