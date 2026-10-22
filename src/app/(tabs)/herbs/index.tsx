/**
 * แท็บคลังสมุนไพร — โครงเดียวกับคลังภูมิ (DESIGN_SYSTEM.md)
 * การ์ดฟีเจอร์ใหม่ "สแกนหาสมุนไพร" (เปิดกล้อง) → แนะนำวันนี้ตามสภาพอากาศ (การ์ดซ้อน 3 ใบ) → กรองตามรสยา → การ์ดภาพเต็มใบ 2 คอลัมน์ (จอกว้างเพิ่มคอลัมน์)
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { Sym, ios } from '../../../components/ios';
import { HeaderButton, PressableScale, T } from '../../../components/ui';
import { herbs, tasteTone, tastes, type Herb } from '../../../data/herbs';
import { HerbStack } from '../../../components/HerbStack';
import { SKY_COLOR, WeatherIcon } from '../../../components/WeatherIcon';
import { WeatherError, getWeather, quickRecs, recommendForWeather, type Weather, type WeatherRecs } from '../../../lib/weatherHerbs';
import { elementColor, elevation, palette } from '../../../theme';
import { LargeTitle, useLargeTitleScroll } from '../../../components/nav/LargeTitle';
import { column, useGrid } from '../../../components/layout';

const TH_DAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** การ์ดสมุนไพรภาพเต็มใบ (แบบการ์ดของ Apple): ภาพเต็มการ์ด · ไล่เงาล่าง · ชื่อขาว · สรรพคุณ · แคปซูลกระจกรส/ธาตุ */
const HerbCard = React.memo(function HerbCard({ h, i, w }: { h: Herb; i: number; w: number }) {
  const el = elementColor[h.element] ?? elementColor['น้ำ'];
  return (
    <Animated.View entering={i < 6 ? FadeInDown.delay(40 + i * 40).duration(320) : undefined} style={{ width: w }}>
      <PressableScale scaleTo={0.97} haptic="select" onPress={() => router.push(`/herb/${h.id}`)} style={[styles.card, { height: w * 1.32 }, elevation.e2]} accessibilityLabel={`${h.name} รส${h.taste}`}>
        <View style={styles.cardClip}>
          <Image source={h.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.05)', 'rgba(4,18,10,0.86)']} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
          {h.nationalList ? (
            <View style={styles.sealWrap}>
              <Sym name="checkmark.seal.fill" size={15} color="#FFFFFF" />
            </View>
          ) : null}
          <View style={styles.cardText}>
            <T v="h3" color="#FFFFFF" numberOfLines={1}>{h.name}</T>
            <T v="caption" color="rgba(255,255,255,0.82)" numberOfLines={1} style={{ marginTop: 1 }}>{h.uses[0]}</T>
            <View style={styles.glassTags}>
              {[`รส${h.taste}`, el.label].map((t) => (
                <View key={t} style={styles.glassTag}>
                  <T v="micro" color="#FFFFFF" style={{ fontWeight: '700' }}>{t}</T>
                </View>
              ))}
            </View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

export default function Herbs() {
  const lt = useLargeTitleScroll();
  // มือถือ 2 คอลัมน์ · iPad mini 3 · จอกว้าง 4
  const { cols, cell } = useGrid({ min: 200, gap: 12, pad: 16, least: 2, most: 5 });
  const cardW = Math.floor(cell);
  // ── แนะนำสมุนไพรตามสภาพอากาศวันนี้ (ตำแหน่ง → อากาศ → ครูปัญญาเลือก 3 ตัว) ──
  const [wx, setWx] = useState<WeatherRecs | null>(null);
  const focused = useIsFocused();
  const [wxErr, setWxErr] = useState<'permission' | 'network' | 'location' | null>(null);
  const loadedDay = useRef('');
  const loadWx = useCallback(async (ask: boolean) => {
    loadedDay.current = new Date().toDateString();
    let w: Weather | null = null;
    try {
      w = await getWeather(ask);
      setWxErr(null);
    } catch (e) {
      setWxErr(e instanceof WeatherError ? e.reason : 'network');
    }
    // แสดงอากาศ + คำแนะนำเบื้องต้นทันที แล้วค่อยอัปเดตเป็นผลจากครูปัญญา
    setWx((cur) => (cur && cur.source === 'ai' && cur.weather?.sky === w?.sky ? cur : quickRecs(w)));
    setWx(await recommendForWeather(w));
  }, []);
  // โหลดเมื่อเปิดแท็บนี้ครั้งแรก (แท็บถูกสร้างตั้งแต่เปิดแอป — ไม่ขอตำแหน่งตอนผู้ใช้ยังไม่ได้เข้าหน้านี้)
  // และโหลดใหม่เมื่อข้ามวัน / กลับจากหน้าตั้งค่า
  useFocusEffect(
    useCallback(() => {
      if (loadedDay.current !== new Date().toDateString()) loadWx(true);
    }, [loadWx]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && (wxErr === 'permission' || loadedDay.current !== new Date().toDateString())) loadWx(false);
    });
    return () => sub.remove();
  }, [loadWx, wxErr]);
  const now = new Date();
  const dateLabel = `${TH_DAY[now.getDay()]} ${now.getDate()} ${TH_MON[now.getMonth()]}`;
  const w = wx?.weather;
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
      {/* รายการ 100 ชนิด: FlatList (โหลดเฉพาะที่เห็นบนจอ ไม่สร้างทั้งหมดพร้อมกัน) */}
      <Animated.FlatList
        {...lt}
        data={list}
        keyExtractor={(h) => h.id}
        key={cols}
        numColumns={cols}
        columnWrapperStyle={{ gap: 12 }}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: palette.bg }}
        contentContainerStyle={[styles.page, column.grid, { gap: 12 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        renderItem={({ item, index }) => <HerbCard h={item} i={index} w={cardW} />}
        ListHeaderComponent={
          <View>
            <LargeTitle title="คลังสมุนไพร" bleed={16} />
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

        {/* ── แนะนำวันนี้ตามสภาพอากาศ: การ์ดซ้อน 3 ใบ ── */}
        <View style={styles.secRow}>
          <T v="h3">แนะนำวันนี้</T>
          <T v="subhead" color={ios.secondary}>{dateLabel}</T>
        </View>
        {/* สภาพอากาศ */}
        {w ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.wxRow}>
            {/* แอนิเมชันไอคอนเล่นเฉพาะตอนแท็บนี้แสดงอยู่ (แท็บไม่ถูกปิด เดิมวาดทุกเฟรมตลอดการใช้แอป) */}
            {focused ? <WeatherIcon sky={w.sky} size={22} /> : <View style={{ width: 22, height: 22 }} />}
            <T v="subhead" color={SKY_COLOR[w.sky]} style={{ fontWeight: '700' }}>{w.temp}° {w.label}</T>
            <T v="subhead" color={ios.secondary} numberOfLines={1} style={{ flex: 1 }}>
              {w.place ? `· ${w.place}` : ''}{w.pm25 != null ? ` · PM2.5 ${w.pm25}` : ''}
            </T>
          </Animated.View>
        ) : wxErr === 'permission' ? (
          <PressableScale haptic="select" onPress={() => Linking.openSettings()} style={styles.wxRow} accessibilityLabel="เปิดตำแหน่งเพื่อดูอากาศ">
            <Sym name="location.slash" size={15} color={ios.secondary} />
            <T v="subhead" color={ios.secondary} style={{ flex: 1 }}>แนะนำตามฤดู · เปิดตำแหน่งเพื่อดูอากาศจริง</T>
            <Sym name="chevron.right" size={12} color={ios.tertiary} weight="semibold" />
          </PressableScale>
        ) : wxErr ? (
          // หาตำแหน่ง/ดึงอากาศไม่สำเร็จ → บอกให้รู้ และแตะลองใหม่ได้ (เดิมแถวนี้หายไปเฉยๆ)
          <PressableScale haptic="select" onPress={() => loadWx(false)} style={styles.wxRow} accessibilityLabel="โหลดสภาพอากาศใหม่">
            <Sym name={wxErr === 'location' ? 'location.slash' : 'wifi.exclamationmark'} size={15} color={ios.secondary} />
            <T v="subhead" color={ios.secondary} style={{ flex: 1 }}>{wxErr === 'location' ? 'หาตำแหน่งไม่ได้' : 'ดึงข้อมูลอากาศไม่ได้'} · แนะนำตามฤดู</T>
            <T v="subhead" color={palette.primary} style={{ fontWeight: '600' }}>ลองใหม่</T>
          </PressableScale>
        ) : null}
        {wx?.advice ? <T v="callout" color={palette.inkSoft} numberOfLines={1} style={{ paddingHorizontal: 4, marginBottom: 12 }}>{wx.advice}</T> : null}
        {wx && wx.recs.length ? (
          <HerbStack key={wx.recs.map((r) => r.herb.id).join()} recs={wx.recs} />
        ) : (
          // กำลังดูอากาศและให้ครูปัญญาเลือก
          <View style={[styles.wxSkel, elevation.e1]}>
            <View style={styles.wxSkelImg} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={[styles.skel, { width: '40%' }]} />
              <View style={[styles.skel, { width: '70%', height: 16 }]} />
              <View style={[styles.skel, { width: '90%' }]} />
              {/* บอกว่ากำลังทำอะไร (เดิมเป็นกล่องว่างเฉยๆ ดูเหมือนค้าง) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <ActivityIndicator size="small" color={palette.primary} />
                <T v="subhead" color={ios.secondary} style={{ flexShrink: 1 }}>กำลังดูอากาศวันนี้ เพื่อเลือกสมุนไพรให้…</T>
              </View>
            </View>
          </View>
        )}

        {/* ── กรองตามรสยา ── */}
        <View style={styles.secRow}>
          <T v="h3">สมุนไพรทั้งหมด</T>
          <T v="subhead" color={ios.secondary}>{list.length} ชนิด · บัญชียาหลัก {list.filter((h) => h.nationalList).length}</T>
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
          </View>
        }
        ListFooterComponent={
          <View>

        <View style={styles.foot}>
          <Sym name="checkmark.seal.fill" size={13} color={palette.primary} />
          <T v="caption" color={ios.secondary}>= อยู่ในบัญชียาหลักแห่งชาติ (ยาจากสมุนไพร)</T>
        </View>
          </View>
        }
      />
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
  wxRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginBottom: 8 },
  wxSkel: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 236, padding: 14, borderRadius: 26, borderCurve: 'continuous', backgroundColor: palette.surface },
  wxSkelImg: { width: 84, height: 84, borderRadius: 20, backgroundColor: 'rgba(20,144,92,0.08)' },
  skel: { height: 11, borderRadius: 6, backgroundColor: 'rgba(20,144,92,0.1)' },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  chip: { paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: ios.separator },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { borderRadius: 26, borderCurve: 'continuous', backgroundColor: palette.bgDeep },
  cardClip: { flex: 1, borderRadius: 26, borderCurve: 'continuous', overflow: 'hidden' },
  sealWrap: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,144,92,0.85)' },
  cardText: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  glassTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  glassTag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 18, marginLeft: 4 },
});
