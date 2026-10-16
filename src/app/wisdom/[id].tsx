/**
 * หน้าตำรา — Hero ปกหนังสือ (พื้นหลังเบลอจากปก) + ชื่อ/ที่มา + แผ่นเนื้อหาโค้งซ้อนขึ้นมา
 * สรุป · สรรพคุณ · ตัวยา (มีรูปถ้าตรงกับคลังสมุนไพร กดดูได้) · วิธีปรุงและวิธีใช้ · ข้อห้าม · ภาพต้นฉบับ (สแกน)
 * แถบล่าง: ฟังด้วยเสียง · หัวขวา: แชร์ QR ให้เพื่อน
 */
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSpeaker } from '../../components/audio';
import { BookCover, COVERS } from '../../components/BookCover';
import { KindIcon } from '../../components/KindIcon';
import { CircleIcon } from '../../components/ListRow';
import { Sym, ios } from '../../components/ios';
import { Button, GlassDock, HeaderBack, HeaderButton, PressableScale, T } from '../../components/ui';
import { herbs, manuscriptImage } from '../../data/herbs';
import { doctor } from '../../data/mock';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

const SOURCE_ICON: Record<string, string> = { เสียงเล่า: 'waveform', สแกนตำรา: 'doc.viewfinder', พิมพ์เอง: 'pencil', เพื่อนแชร์: 'person.2.fill' };

/** หัวข้อการ์ด: ไอคอนวงกลม + ชื่อ */
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

export default function WisdomDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wisdoms } = useApp();
  const w = wisdoms.find((x) => x.id === id) ?? wisdoms[0];
  const insets = useSafeAreaInsets();
  const tts = useSpeaker();
  const cover = COVERS[w.kind] ?? COVERS['ตำรับยา'];
  const share = () => router.push({ pathname: '/wisdom/share', params: { id: w.id } });
  const read = [w.title, w.summary, w.indication, w.ingredients?.join(' '), w.method, w.caution].filter(Boolean).join(' ');
  /** ตัวยา → สมุนไพรในคลัง (ถ้าชื่อตรง) */
  const herbOf = (name: string) => herbs.find((h) => name.includes(h.name));
  /** วิธีทำแยกเป็นขั้นตอน (ตัดตามช่องว่าง/ขึ้นบรรทัดใหม่ที่คั่นประโยค) */
  // ความสูง Hero + การหดปกเมื่อเลื่อน (เนื้อหาเลื่อนทับ Hero ที่อยู่กับที่)
  const heroH = insets.top + 56 + 150 * (700 / 480) + 40;
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const coverSt = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, heroH * 0.7], [1, 0.2], 'clamp'),
    transform: [{ scale: interpolate(y.value, [0, heroH * 0.7], [1, 0.9], 'clamp') }, { rotate: '-2deg' }],
  }));
  const steps = (w.method ?? '').split(/\n+|\s+(?=(?:แล้ว|จากนั้น|นำ|กิน|ใช้|ต้ม|บด|ห่อ|ประคบ))/).map((s) => s.trim()).filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTransparent: true,
          headerShadowVisible: false,
          // ไม่เบลอ/จางขอบบน ให้ Hero ชนขอบจอ
          scrollEdgeEffects: { top: 'hidden' },
          headerTintColor: '#FFFFFF',
          headerBackVisible: false,
          headerLeft: () => <HeaderBack fallback="/vault" color={palette.ink} />,
          headerRight: () => (
            <HeaderButton label="แชร์ตำราให้เพื่อน" onPress={share}>
              <Sym name="qrcode" size={19} color={palette.ink} weight="semibold" />
            </HeaderButton>
          ),
        }}
      />
      {/* ── Hero ตรึงอยู่กับที่: ปกหนังสือบนพื้นเบลอจากภาพปก (เนื้อหาเลื่อนขึ้นมาทับ) ── */}
      <View style={[styles.hero, { height: heroH, paddingTop: insets.top + 56 }]} pointerEvents="none">
        <Image source={cover.src} style={StyleSheet.absoluteFill} contentFit="cover" />
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.duration(500)} style={[styles.coverWrap, coverSt]}>
          <BookCover w={{ ...w, verified: true }} width={150} />
        </Animated.View>
      </View>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} bounces={false} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: heroH - 28, paddingBottom: 0 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 130 }]}>
          <View style={styles.grab} />
        {/* ── ชื่อ + ที่มา ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(380)} style={styles.head}>
          <View style={styles.kindPill}>
            <KindIcon kind={w.kind} size={14} color={palette.primaryDeep} />
            <T v="subhead" color={palette.primaryDeep} style={{ fontWeight: '700' }}>{w.kind}</T>
          </View>
          <T v="h1" center style={{ marginTop: 10 }}>{w.title}</T>
          <View style={styles.meta}>
            <Sym name={SOURCE_ICON[w.source] as any} size={13} color={ios.secondary} />
            <T v="subhead" color={ios.secondary}>
              {w.sharedBy ? `ได้รับจาก ${w.sharedBy}` : `${w.source} · บันทึกโดย ${doctor.short}`} · {w.date}
            </T>
          </View>
        </Animated.View>

        <View style={styles.body}>
          {w.summary ? (
            <Section i={0} icon="text.alignleft" color={palette.primary} title="สรุป">
              <T v="body" style={styles.para}>{w.summary}</T>
            </Section>
          ) : null}

          {w.indication ? (
            <Section i={1} icon="cross.case.fill" color="#3B7DD8" title="สรรพคุณ">
              <T v="body" style={styles.para}>{w.indication}</T>
            </Section>
          ) : null}

          {w.ingredients?.length ? (
            <Section i={2} icon="leaf.fill" color={palette.primary} title={`ตัวยา · ${w.ingredients.length} ชนิด`}>
              <View style={{ marginTop: 4 }}>
                {w.ingredients.map((x, i) => {
                  const h = herbOf(x);
                  const row = (
                    <View style={styles.ing}>
                      {h ? <Image source={h.image} style={styles.herbImg} contentFit="cover" /> : (
                        <View style={styles.num}>
                          <T v="subhead" color={palette.primaryDeep} style={{ fontWeight: '700' }}>{i + 1}</T>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <T v="body" style={{ fontWeight: '600' }}>{x}</T>
                        {h ? <T v="caption" color={ios.secondary} numberOfLines={1}>{h.uses.slice(0, 2).join(' · ')}</T> : null}
                      </View>
                      {h ? <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" /> : null}
                    </View>
                  );
                  return (
                    <View key={`${x}${i}`}>
                      {i ? <View style={styles.sep} /> : null}
                      {h ? (
                        <PressableScale scaleTo={0.98} haptic="select" onPress={() => router.push(`/herb/${h.id}`)} accessibilityLabel={`ดูสมุนไพร ${h.name}`}>
                          {row}
                        </PressableScale>
                      ) : row}
                    </View>
                  );
                })}
              </View>
            </Section>
          ) : null}

          {w.method ? (
            <Section i={3} icon="flame.fill" color="#D9921A" title={w.kind === 'คาถา/พิธี' ? 'ขั้นตอน' : 'วิธีปรุงและวิธีใช้'}>
              {steps.length > 1 ? (
                <View style={{ gap: 12, marginTop: 4 }}>
                  {steps.map((s, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={styles.stepNum}>
                        <T v="caption" color="#FFFFFF" style={{ fontWeight: '700' }}>{i + 1}</T>
                      </View>
                      <T v="body" style={{ flex: 1 }}>{s}</T>
                    </View>
                  ))}
                </View>
              ) : (
                <T v="body" style={styles.para}>{w.method}</T>
              )}
            </Section>
          ) : null}

          {w.caution ? (
            <Animated.View entering={FadeInDown.delay(360).duration(380)} style={styles.warn}>
              <Sym name="exclamationmark.triangle.fill" size={18} color={palette.coral} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="title" color={palette.coral}>ข้อห้าม / ข้อควรระวัง</T>
                <T v="body">{w.caution}</T>
              </View>
            </Animated.View>
          ) : null}

          {w.source === 'สแกนตำรา' ? (
            <Section i={5} icon="doc.viewfinder" color="#B07A2A" title="ภาพต้นฉบับ">
              <Image source={manuscriptImage} style={styles.scan} contentFit="cover" />
            </Section>
          ) : null}
        </View>
        </View>
      </Animated.ScrollView>

      <GlassDock>
        <Button
          style={{ flex: 1, height: 52 }}
          label={tts.speaking ? 'หยุดอ่าน' : 'ฟังด้วยเสียง'}
          icon={<Sym name={tts.speaking ? 'stop.fill' : 'speaker.wave.2.fill'} size={18} color="#FFFFFF" />}
          onPress={() => (tts.speaking ? tts.stop() : tts.speak(read))}
        />
      </GlassDock>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', overflow: 'hidden' },
  sheet: { backgroundColor: palette.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous', paddingTop: 10, minHeight: 600 },
  grab: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 14 },
  coverWrap: {},
  head: { alignItems: 'center', paddingHorizontal: 24 },
  kindPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: palette.primarySoft },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' },
  body: { paddingHorizontal: 16, marginTop: 22, gap: 14 },
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  para: { lineHeight: 26 },
  ing: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  herbImg: { width: 44, height: 44, borderRadius: 12 },
  num: { width: 44, height: 44, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginLeft: 56 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#D9921A', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  warn: { flexDirection: 'row', gap: 12, padding: 18, borderRadius: 22, borderCurve: 'continuous', backgroundColor: palette.coralSoft },
  scan: { height: 200, borderRadius: 16, marginTop: 4 },
});
