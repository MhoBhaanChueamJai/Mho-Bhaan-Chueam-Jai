/**
 * แท็บคลังภูมิปัญญา — สมุดข่อยดิจิทัลของคุณหมอ
 * Hero (การ์ด): พื้นหลังสันหนังสือ/ตำราเรียงบนหิ้ง (เบลอ) + ชื่อหน้า + KPI จำนวนตามประเภท · แถบเครื่องมือบนหัวจอ: สแกน QR รับตำรา · เพิ่ม
 * → เรื่องล่าสุด (การ์ดภาพใหญ่เลื่อนแนวนอน) → รายการทั้งหมด
 */
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BookCover } from '../../../components/BookCover';
import { Sym, ios } from '../../../components/ios';
import { HeaderButton, PressableScale, T } from '../../../components/ui';
import { type Wisdom } from '../../../data/mock';
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
};

/** ปกตำรา + ชื่อเรื่องและที่มาใต้ปก (แบบชั้นหนังสือ) */
function Book({ w, width, i }: { w: Wisdom; width: number; i: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(40 + (i % 9) * 45).duration(340)} style={{ width: width + 4 }}>
      <PressableScale scaleTo={0.96} haptic="select" onPress={() => router.push(`/wisdom/${w.id}`)} style={styles.bookShadow} accessibilityLabel={`${w.title} ${w.kind}${w.verified ? '' : ' รอตรวจทาน'}`}>
        <BookCover w={w} width={width} />
      </PressableScale>
      <T v="subhead" numberOfLines={2} style={{ marginTop: 10, fontWeight: '600' }}>{w.title}</T>
      <View style={styles.meta}>
        <Sym name={SOURCE_ICON[w.source] as any} size={10} color={ios.tertiary} />
        <T v="caption" color={ios.tertiary} numberOfLines={1} style={{ flexShrink: 1 }}>{w.sharedBy ? `จาก ${w.sharedBy}` : w.source}</T>
      </View>
    </Animated.View>
  );
}

export default function Vault() {
  const { wisdoms } = useApp();
  const { width: SW } = useWindowDimensions();
  // ชั้นหนังสือ 3 คอลัมน์: ขอบ 20 + ช่องไฟ 16
  const GRID_W = Math.floor((SW - 40 - 32) / 3) - 4;
  const list = wisdoms;
  const count = (k: Wisdom['kind']) => wisdoms.filter((w) => w.kind === k).length;

  return (
    <>
    {/* ปุ่มบนหัวจอแบบเดียวกับแท็บอื่น: ค้นหา · สแกน QR รับตำรา · เพิ่ม */}
    <Stack.Screen
      options={{
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <HeaderButton label="ค้นหาภูมิปัญญา" onPress={() => router.push('/wisdom/search')}>
              <Sym name="magnifyingglass" size={20} color={palette.ink} weight="semibold" />
            </HeaderButton>
            <HeaderButton label="สแกนคิวอาร์โค้ดรับตำรา" onPress={() => router.push('/wisdom/scan-qr')}>
              <Sym name="qrcode.viewfinder" size={20} color={palette.ink} weight="semibold" />
            </HeaderButton>
            <HeaderButton label="เพิ่มภูมิปัญญา" onPress={() => router.push('/wisdom/new')}>
              <Sym name="plus" size={20} color={palette.ink} weight="semibold" />
            </HeaderButton>
          </View>
        ),
      }}
    />
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingTop: 4, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
      {/* ── Hero: สันหนังสือบนหิ้ง (เบลอ) ── */}
      <View style={[styles.heroWrap, elevation.e3]}>
      <View style={styles.hero}>
        <Image source={COVER.shelf} style={StyleSheet.absoluteFill} contentFit="cover" />
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(6,20,13,0.55)', 'rgba(6,20,13,0.35)', 'rgba(6,20,13,0.88)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />

        <View style={styles.heroTop}>
          <View style={styles.eyebrow}>
            <Sym name="books.vertical.fill" size={13} color="#F3D9A4" />
            <T v="subhead" color="#F3D9A4" style={{ fontWeight: '600' }}>สมุดข่อยดิจิทัล</T>
          </View>
        </View>

        <Animated.View entering={FadeInDown.duration(420)}>
          <T v="h1" color="#FFFFFF" style={styles.title}>บันทึกแล้ว {wisdoms.length} เรื่อง</T>
          <T v="callout" color="rgba(255,255,255,0.78)">ตำรับยา วิธีรักษา คาถา และตำราโบราณของคุณหมอ</T>
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

      {/* ── รายการทั้งหมด ── */}
      <View style={styles.secHead}>
        <T v="h3">ทั้งหมด</T>
        <T v="subhead" color={ios.secondary}>{list.length} เรื่อง</T>
      </View>
      {list.length ? (
        // ชั้นหนังสือ 3 คอลัมน์
        <View style={styles.shelf}>
          {list.map((w, i) => (
            <Book key={w.id} w={w} width={GRID_W} i={i} />
          ))}
        </View>
      ) : (
        <View style={[styles.empty, elevation.e1]}>
          <Sym name="book.closed" size={28} color={ios.tertiary} />
          <T v="callout" color={ios.secondary}>ยังไม่มีภูมิปัญญา กด “เพิ่มภูมิปัญญา” ได้เลย</T>
        </View>
      )}
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  empty: { marginHorizontal: 16, marginTop: 10, alignItems: 'center', paddingVertical: 28, gap: 6, backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous' },
  bookShadow: { borderRadius: 8, boxShadow: '0px 10px 18px rgba(20,40,30,0.22), 0px 2px 4px rgba(20,40,30,0.18)' },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 22, paddingHorizontal: 20, marginTop: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 20, paddingRight: 16, marginBottom: 14 },
  heroWrap: { marginHorizontal: 16, borderRadius: 30, borderCurve: 'continuous', backgroundColor: '#14261c' },
  hero: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, borderRadius: 30, borderCurve: 'continuous', overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { marginBottom: 4 },
  kpis: { flexDirection: 'row', gap: 8, marginTop: 18 },
  kpi: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
  kpiIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  secHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 24, marginBottom: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
});
