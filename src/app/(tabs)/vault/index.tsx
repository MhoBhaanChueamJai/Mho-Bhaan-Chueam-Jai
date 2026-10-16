/**
 * แท็บคลังภูมิปัญญา — สมุดข่อยดิจิทัลของคุณหมอ
 * บนสุด: การ์ดภาพใหญ่เลื่อนแนวนอน (เรื่องล่าสุด) → ปุ่มลัดวงกลม 3 ปุ่ม (เล่าด้วยเสียง · สแกนตำรา · รับจากเพื่อน)
 * → รายการทั้งหมด (ไอคอนวงกลมตามประเภท)
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { CircleIcon } from '../../../components/ListRow';
import { Sym, ios } from '../../../components/ios';
import { HeaderButton, PressableScale, T } from '../../../components/ui';
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
const SOURCE_ICON: Record<Wisdom['source'], string> = { เสียงเล่า: 'waveform', สแกนตำรา: 'doc.viewfinder', พิมพ์เอง: 'pencil', เพื่อนแชร์: 'person.2.fill' };

const COVER = {
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

const ACTIONS = [
  { label: 'เล่าด้วยเสียง', icon: 'mic.fill', color: palette.primary, go: '/wisdom/voice' },
  { label: 'สแกนตำรา', icon: 'doc.viewfinder', color: '#B07A2A', go: '/scan' },
  { label: 'รับจากเพื่อน', icon: 'tray.and.arrow.down.fill', color: '#3B7DD8', go: '/wisdom/receive' },
] as const;

function Feature({ w, i }: { w: Wisdom; i: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(60 + i * 60).duration(380)}>
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
  const recorded = legacy.recorded + Math.max(0, wisdoms.length - 3);
  const latest = wisdoms.slice(0, 6);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label="ค้นหาภูมิปัญญา" onPress={() => router.push('/wisdom/search')}>
                <Sym name="magnifyingglass" size={20} color={palette.primary} weight="semibold" />
              </HeaderButton>
              <HeaderButton label="เพิ่มภูมิปัญญา" onPress={() => router.push('/wisdom/new')}>
                <Sym name="plus" size={20} color={palette.primary} weight="semibold" />
              </HeaderButton>
            </View>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <T v="callout" color={ios.secondary} style={styles.sub}>สมุดข่อยดิจิทัล · บันทึกแล้ว {recorded} เรื่อง</T>

        {/* เรื่องล่าสุด: การ์ดภาพใหญ่เลื่อนแนวนอน (เงาไม่โดนตัด: เผื่อ padding ในแถบเลื่อน) */}
        {latest.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={CARD_W + 14} snapToAlignment="start" contentContainerStyle={styles.rail} style={styles.railBox}>
            {latest.map((w, i) => (
              <Feature key={w.id} w={w} i={i} />
            ))}
          </ScrollView>
        ) : null}

        {/* ปุ่มลัดวงกลม */}
        <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.actions}>
          {ACTIONS.map((a) => (
            <PressableScale key={a.label} scaleTo={0.94} haptic="select" onPress={() => router.push(a.go)} style={styles.action} accessibilityLabel={a.label}>
              <View style={[styles.actionCircle, elevation.e1]}>
                <CircleIcon name={a.icon} color={a.color} size={56} />
              </View>
              <T v="subhead" style={{ fontWeight: '600' }}>{a.label}</T>
            </PressableScale>
          ))}
        </Animated.View>

        <View style={styles.listHead}>
          <T v="h3">ภูมิปัญญาทั้งหมด</T>
          <T v="subhead" color={ios.secondary}>{wisdoms.length} เรื่อง</T>
        </View>
        {wisdoms.length ? (
          <View style={[styles.list, elevation.e1]}>
            {wisdoms.map((w, i) => (
              <Animated.View key={w.id} entering={FadeIn.delay(i * 40).duration(200)}>
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
          </View>
        ) : (
          <View style={[styles.list, elevation.e1, { alignItems: 'center', paddingVertical: 28, gap: 6 }]}>
            <Sym name="book.closed" size={28} color={ios.tertiary} />
            <T v="callout" color={ios.secondary}>ยังไม่มีภูมิปัญญา เริ่มจากเล่าให้ครูปัญญาฟังได้เลย</T>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const CARD_W = 272;
const styles = StyleSheet.create({
  page: { paddingTop: 4, paddingBottom: 130 },
  sub: { paddingHorizontal: 20, marginBottom: 6 },
  railBox: { marginHorizontal: 0 },
  rail: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 22, gap: 14 },
  feature: { width: CARD_W, height: 340, borderRadius: 26, borderCurve: 'continuous', backgroundColor: palette.surface },
  featureClip: { flex: 1, borderRadius: 26, borderCurve: 'continuous', overflow: 'hidden' },
  featureTop: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  kindPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  pendingPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(253,240,220,0.95)' },
  featureText: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  featureMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 16, marginTop: 2 },
  action: { alignItems: 'center', gap: 8, width: 100 },
  actionCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  listHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 28, marginBottom: 12 },
  list: { marginHorizontal: 16, backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 14, paddingRight: 16, minHeight: 76 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginLeft: 76 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  pending: { marginLeft: 4, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: '#FDF0DC' },
});
