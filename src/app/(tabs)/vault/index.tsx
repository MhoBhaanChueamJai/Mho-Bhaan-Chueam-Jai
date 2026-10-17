import { MenuView } from '@react-native-menu/menu';
/**
 * แท็บคลังภูมิปัญญา — สมุดข่อยดิจิทัลของคุณหมอ
 * Hero (การ์ด): พื้นหลังสันหนังสือ/ตำราเรียงบนหิ้ง (เบลอ) + ชื่อหน้า + KPI จำนวนตามประเภท · แถบเครื่องมือบนหัวจอ: สแกน QR รับตำรา · เพิ่ม
 * → เรื่องล่าสุด (การ์ดภาพใหญ่เลื่อนแนวนอน) → รายการทั้งหมด
 */
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BookCover } from '../../../components/BookCover';
import { KindIcon } from '../../../components/KindIcon';
import { syncShared } from '../../../lib/wisdomShare';
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
const SOURCE_ICON: Record<Wisdom['source'], string> = { เสียงเล่า: 'waveform', สแกนตำรา: 'doc.viewfinder', พิมพ์เอง: 'pencil', เพื่อนแชร์: 'person.2.fill', ตำราอ้างอิง: 'checkmark.seal.fill' };

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
      <T v="subhead" numberOfLines={1} style={{ marginTop: 10, fontWeight: '600' }}>{w.title}</T>
      <View style={styles.meta}>
        <Sym name={SOURCE_ICON[w.source] as any} size={10} color={ios.tertiary} />
        <T v="caption" color={ios.tertiary} numberOfLines={1} style={{ flexShrink: 1 }}>{w.sharedBy ? `จาก ${w.sharedBy}` : w.source}</T>
      </View>
    </Animated.View>
  );
}

export default function Vault() {
  const { wisdoms, updateWisdom } = useApp();
  // ตำราที่เพื่อนแชร์มา: เปิดคลังเมื่อไหร่ ดึงเนื้อหาล่าสุดจากต้นฉบับ (เพื่อนแก้แล้วอัปเดตตาม)
  useFocusEffect(
    useCallback(() => {
      syncShared(wisdoms, updateWisdom);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const { width: SW } = useWindowDimensions();
  // ชั้นหนังสือ 3 คอลัมน์: ขอบ 20 + ช่องไฟ 16
  const GRID_W = Math.floor((SW - 40 - 32) / 3) - 4;
  const list = wisdoms.filter((w) => !w.builtin);
  const library = wisdoms.filter((w) => w.builtin);
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
            {/* เพิ่มภูมิปัญญา: เล่า / เขียน / สแกน */}
            <MenuView
              shouldOpenOnLongPress={false}
              themeVariant="light"
              title="เพิ่มภูมิปัญญา"
              actions={[
                { id: 'tell', title: 'เล่าให้ครูปัญญาฟัง', subtitle: 'โหมดเล่า เก็บเสียงไว้ แล้วเรียบเรียงเป็นหนังสือ', image: 'waveform' },
                { id: 'write', title: 'เขียนเอง', image: 'square.and.pencil' },
                { id: 'scan', title: 'สแกนตำราโบราณ', image: 'doc.viewfinder' },
              ]}
              onPressAction={({ nativeEvent: e }) =>
                e.event === 'tell' ? router.push('/wisdom/tell') : e.event === 'scan' ? router.push({ pathname: '/scan', params: { fill: '1' } }) : router.push('/wisdom/new')
              }
            >
              <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="เพิ่มภูมิปัญญา">
                <Sym name="plus" size={20} color={palette.ink} weight="semibold" />
              </View>
            </MenuView>
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
                <KindIcon kind={k} size={15} color="#FFFFFF" />
              </View>
              <T v="h2" color="#FFFFFF" style={{ marginTop: 8 }}>{count(k)}</T>
              <T v="micro" color="rgba(255,255,255,0.82)" numberOfLines={1} style={{ fontWeight: '600' }}>{k}</T>
            </Animated.View>
          ))}
        </View>
      </View>
      </View>

      {/* ── โหมดเล่า: ทางลัดถ่ายทอดภูมิปัญญาด้วยเสียง ── */}
      <PressableScale haptic="press" scaleTo={0.98} onPress={() => router.push('/wisdom/tell')} style={[styles.tell, elevation.e1]} accessibilityLabel="โหมดเล่า เล่าให้ครูปัญญาฟัง">
        <View style={styles.tellIcon}>
          <Sym name="waveform" size={22} color="#7CF0A8" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="title" color="#FFFFFF">เล่าให้ครูปัญญาฟัง</T>
          <T v="caption" color="rgba(255,255,255,0.7)" numberOfLines={2}>เล่าต่อเนื่องเหมือนเล่าให้ลูกหลานฟัง ครูปัญญาเก็บเสียงไว้และเขียนเป็นหนังสือให้</T>
        </View>
        <Sym name="chevron.right" size={14} color="rgba(255,255,255,0.6)" weight="semibold" />
      </PressableScale>

      {/* ── ตำราของหมอ (ยังไม่มี = ไม่แสดงหัวข้อนี้) ── */}
      {list.length ? (
        <>
          <View style={styles.secHead}>
            <T v="h3">ทั้งหมด</T>
            <T v="subhead" color={ios.secondary}>{list.length} เรื่อง</T>
          </View>
          {/* ชั้นหนังสือ 3 คอลัมน์ */}
          <View style={styles.shelf}>
            {list.map((w, i) => (
              <Book key={w.id} w={w} width={GRID_W} i={i} />
            ))}
          </View>
        </>
      ) : null}

      {/* ── ตำราเริ่มต้นในระบบ (เนื้อหาจากแหล่งอ้างอิงทางการ) ── */}
      {library.length ? (
        <>
          <View style={[styles.secHead, list.length ? { marginTop: 30 } : null]}>
            <T v="h3">ตำราอ้างอิงในระบบ</T>
            <T v="subhead" color={ios.secondary}>{library.length} เล่ม</T>
          </View>
          <T v="caption" color={ios.secondary} style={{ paddingHorizontal: 20, marginTop: 4 }}>เนื้อหาจากบัญชียาหลักแห่งชาติ กรมการแพทย์แผนไทยฯ และแหล่งอ้างอิงทางการ</T>
          <View style={styles.shelf}>
            {library.map((w, i) => (
              <Book key={w.id} w={w} width={GRID_W} i={i} />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  tell: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 14, padding: 14, borderRadius: 22, borderCurve: 'continuous', backgroundColor: '#0E1A14' },
  tellIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,240,168,0.14)' },
  empty: { marginHorizontal: 16, marginTop: 10, alignItems: 'center', paddingVertical: 28, gap: 6, backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous' },
  bookShadow: {},
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
