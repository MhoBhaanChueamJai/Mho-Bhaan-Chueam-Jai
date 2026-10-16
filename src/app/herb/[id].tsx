/**
 * หน้าสมุนไพร — แบบเดียวกับหน้าตำราในคลังภูมิ
 * Hero: พื้นหลังภาพสมุนไพรเบลอไล่จางลงพื้นหน้า + ภาพสมุนไพรมุมโค้งกลางจอ · รส · ชื่อ · ชื่อวิทยาศาสตร์
 * การ์ด: ข้อมูลสมุนไพร (ชื่อท้องถิ่น ส่วนที่ใช้ ธาตุ) · สรรพคุณ · วิธีใช้ · ข้อควรระวัง · ตำราในคลังที่ใช้สมุนไพรนี้
 * หัวขวา: อ่านออกเสียง · แถบลอยล่าง: ถามครูปัญญา
 */
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSpeaker } from '../../components/audio';
import { BookCover } from '../../components/BookCover';
import { CircleIcon } from '../../components/ListRow';
import { Sym, ios } from '../../components/ios';
import { Button, GlassDock, HeaderBack, HeaderButton, PressableScale, T } from '../../components/ui';
import { herbs, tasteTone } from '../../data/herbs';
import { useApp } from '../../store/app';
import { elementColor, elevation, palette } from '../../theme';

const FADE_EXTRA = 150;
const FADE = (() => {
  const stops: number[] = [], colors: string[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const a = t * t * (3 - 2 * t);
    stops.push(0.42 + t * 0.58);
    colors.push(`rgba(247,251,249,${a.toFixed(3)})`);
  }
  return { stops: stops as [number, number, ...number[]], colors: colors as [string, string, ...string[]] };
})();

function Section({ icon, color, title, children, i }: { icon: string; color: string; title: string; children: React.ReactNode; i: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(120 + i * 60).duration(380)} style={[styles.card, elevation.e1]}>
      <View style={styles.cardHead}>
        <CircleIcon name={icon} color={color} size={34} />
        <T v="title">{title}</T>
      </View>
      {children}
    </Animated.View>
  );
}

export default function HerbDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const herb = herbs.find((h) => h.id === id) ?? herbs[0];
  const { wisdoms } = useApp();
  const insets = useSafeAreaInsets();
  const tts = useSpeaker();
  const el = elementColor[herb.element];
  const tone = tasteTone[herb.taste];
  const read = `${herb.name} รส${herb.taste} สรรพคุณ ${herb.uses.join(' ')} วิธีใช้ ${herb.howto} ข้อควรระวัง ${herb.caution}`;
  useEffect(() => () => tts.stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ตำราในคลังภูมิที่มีสมุนไพรนี้เป็นตัวยา
  const inBooks = wisdoms.filter((w) => (w.ingredients ?? []).some((x) => x.includes(herb.name)));

  // ดึงลงเกินขอบบน: พื้นหลังตรึงขอบบนและขยาย (แบบหน้าตำรา)
  const y = useSharedValue(0);
  const heroH = useSharedValue(420);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const bgSt = useAnimatedStyle(() => {
    const pull = Math.max(0, -y.value);
    const s = 1 + pull / heroH.value;
    return { transform: [{ translateY: -pull / 2 }, { scale: s + Math.min(pull, 200) * 0.0004 }] };
  });

  const facts = [
    { k: 'ชื่อท้องถิ่น', v: herb.local, icon: 'map' },
    { k: 'ส่วนที่ใช้', v: herb.part, icon: 'leaf' },
    { k: 'ธาตุ', v: el.label, icon: 'circle.hexagongrid' },
    { k: 'รสยา', v: `รส${herb.taste}`, icon: 'drop' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTransparent: true,
          headerShadowVisible: false,
          scrollEdgeEffects: { top: 'hidden' },
          headerBackVisible: false,
          headerLeft: () => <HeaderBack fallback="/herbs" color={palette.ink} />,
          headerRight: () => (
            <HeaderButton label={tts.speaking ? 'หยุดอ่าน' : 'อ่านออกเสียงให้ฟัง'} onPress={() => (tts.speaking ? tts.stop() : tts.speak(read))}>
              <Sym name={tts.speaking ? 'stop.fill' : 'headphones'} size={19} color={tts.speaking ? palette.primary : palette.ink} weight="semibold" />
            </HeaderButton>
          ),
        }}
      />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingBottom: insets.bottom + 130 }} showsVerticalScrollIndicator={false}>
        {/* ── Hero: ภาพสมุนไพรบนพื้นเบลอจากภาพเดียวกัน ── */}
        <View onLayout={(e) => (heroH.value = e.nativeEvent.layout.height)} style={[styles.hero, { paddingTop: insets.top + 60 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { bottom: -FADE_EXTRA }, bgSt]}>
            <Image source={herb.image} style={StyleSheet.absoluteFill} contentFit="cover" />
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(0,0,0,0.14)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0)']} locations={[0, 0.45, 0.85]} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={FADE.colors} locations={FADE.stops} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View entering={FadeInUp.duration(500)} style={[styles.photo, elevation.e3]}>
            <Image source={herb.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          </Animated.View>
        </View>

        {/* ── ชื่อ ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(380)} style={styles.head}>
          <View style={styles.pills}>
            <View style={[styles.pill, { backgroundColor: tone.bg }]}>
              <T v="subhead" color={tone.fg} style={{ fontWeight: '700' }}>รส{herb.taste}</T>
            </View>
            <View style={[styles.pill, { backgroundColor: el.bg }]}>
              <T v="subhead" color={el.fg} style={{ fontWeight: '700' }}>{el.label}</T>
            </View>
          </View>
          <T v="h1" center style={{ marginTop: 10 }}>{herb.name}</T>
          <T v="callout" color={ios.secondary} center style={{ fontStyle: 'italic', marginTop: 2 }}>{herb.sci}</T>
          {herb.nationalList ? (
            <View style={styles.national}>
              <Sym name="checkmark.seal.fill" size={13} color={palette.primary} />
              <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '600' }}>อยู่ในบัญชียาหลักแห่งชาติ (ยาจากสมุนไพร)</T>
            </View>
          ) : null}
        </Animated.View>

        <View style={styles.body}>
          {/* ข้อมูลสมุนไพร: รายการคั่นเส้น */}
          <Section i={0} icon="info.circle.fill" color={palette.primary} title="ข้อมูลสมุนไพร">
            {facts.map((f, i) => (
              <View key={f.k} style={[styles.fact, i > 0 && styles.sepTop]}>
                <Sym name={f.icon as any} size={16} color={ios.secondary} />
                <T v="body" color={ios.secondary} style={{ width: 96 }}>{f.k}</T>
                <T v="body" style={{ flex: 1, fontWeight: '600' }}>{f.v}</T>
              </View>
            ))}
          </Section>

          <Section i={1} icon="cross.case.fill" color="#3B7DD8" title="สรรพคุณ">
            {herb.uses.map((u, i) => (
              <View key={u} style={[styles.use, i > 0 && styles.sepTop]}>
                <Sym name="checkmark.circle.fill" size={18} color={palette.primary} />
                <T v="body" style={{ flex: 1 }}>{u}</T>
              </View>
            ))}
          </Section>

          <Section i={2} icon="drop.fill" color="#B26A12" title="วิธีใช้">
            <T v="body" style={styles.para}>{herb.howto}</T>
          </Section>

          <Section i={3} icon="exclamationmark.triangle.fill" color={palette.coral} title="ข้อควรระวัง">
            <T v="body" style={styles.para}>{herb.caution}</T>
          </Section>

          {/* ตำราในคลังภูมิที่ใช้สมุนไพรนี้ */}
          {inBooks.length ? (
            <Section i={4} icon="books.vertical.fill" color={palette.primary} title={`ตำราที่ใช้${herb.name} · ${inBooks.length}`}>
              {inBooks.slice(0, 8).map((w, i) => (
                <PressableScale key={w.id} haptic="select" scaleTo={0.98} onPress={() => router.push(`/wisdom/${w.id}`)} style={[styles.book, i > 0 && styles.sepTop]} accessibilityLabel={`เปิดตำรา ${w.title}`}>
                  <BookCover w={{ ...w, verified: true }} width={34} />
                  <View style={{ flex: 1 }}>
                    <T v="body" numberOfLines={1} style={{ fontWeight: '600' }}>{w.title}</T>
                    <T v="caption" color={ios.secondary} numberOfLines={1}>{w.kind}{w.indication ? ` · ${w.indication}` : ''}</T>
                  </View>
                  <Sym name="chevron.right" size={12} color={ios.tertiary} weight="semibold" />
                </PressableScale>
              ))}
            </Section>
          ) : null}

          <T v="caption" color={ios.tertiary} center style={{ marginTop: 6 }}>ภาพ: {herb.credit}</T>
        </View>
      </Animated.ScrollView>

      <GlassDock>
        <Button
          style={{ flex: 1, height: 52 }}
          label="ถามครูปัญญาเรื่องนี้"
          icon={<Sym name="sparkles" size={18} color="#FFFFFF" />}
          onPress={() => router.push({ pathname: '/assistant', params: { q: `${herb.name} ใช้ร่วมกับยาแผนปัจจุบันได้ไหม` } })}
        />
      </GlassDock>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 26 },
  photo: { width: 190, height: 190, borderRadius: 40, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 4, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: palette.bgDeep },
  head: { alignItems: 'center', paddingHorizontal: 24 },
  pills: { flexDirection: 'row', gap: 6 },
  pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  national: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: palette.primarySoft },
  body: { paddingHorizontal: 16, marginTop: 22, gap: 14 },
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  para: { lineHeight: 26 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  use: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  book: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  sepTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
});
