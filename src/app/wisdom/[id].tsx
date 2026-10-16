/**
 * หน้าตำรา — Hero ปกหนังสือ (พื้นหลังเบลอจากปก) + ชื่อ/ที่มา + แผ่นเนื้อหาโค้งซ้อนขึ้นมา
 * เนื้อหา · สรรพคุณ · ตัวยา (มีรูปถ้าตรงกับคลังสมุนไพร กดดูได้) · วิธีปรุงและวิธีใช้ · ข้อห้าม
 * แถบล่าง: ฟังด้วยเสียง · หัวขวา: แชร์ QR ให้เพื่อน
 */
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { MenuView } from '@react-native-menu/menu';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSpeaker } from '../../components/audio';
import { BookCover, COVERS } from '../../components/BookCover';
import { KindIcon } from '../../components/KindIcon';
import { CircleIcon } from '../../components/ListRow';
import { Sym, ios } from '../../components/ios';
import { Glass, HeaderBack, HeaderButton, PressableScale, T, useHaptic } from '../../components/ui';
import { fetchLatestShared } from '../../lib/wisdomShare';
import { KIND_FORM, splitMethod } from '../../lib/wisdomKinds';
import { herbs } from '../../data/herbs';
import { doctor } from '../../data/mock';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

/** ไล่จางลงสีพื้นหน้าแบบโค้งนุ่ม (smoothstep หลายจุด → ไม่เห็นรอยต่อ) */
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

const SOURCE_ICON: Record<string, string> = { เสียงเล่า: 'waveform', สแกนตำรา: 'doc.viewfinder', พิมพ์เอง: 'pencil', เพื่อนแชร์: 'person.2.fill' };

/** หัวข้อการ์ด: ไอคอนวงกลม + ชื่อ */
function Section({ icon, color, title, children, i, reading, onY }: { icon: string; color: string; title: string; children: React.ReactNode; i: number; reading?: boolean; onY?: (y: number) => void }) {
  return (
    <Animated.View onLayout={(e) => onY?.(e.nativeEvent.layout.y)} entering={FadeInDown.delay(120 + i * 60).duration(380)} style={[styles.card, elevation.e1, reading && styles.reading]}>
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
  const { wisdoms, updateWisdom, removeWisdom } = useApp();
  const h = useHaptic();
  const w = wisdoms.find((x) => x.id === id) ?? wisdoms[0];
  const insets = useSafeAreaInsets();
  const tts = useSpeaker();
  const cover = COVERS[w.kind] ?? COVERS['ตำรับยา'];
  const share = () => router.push({ pathname: '/wisdom/share', params: { id: w.id } });
  /** ตัวยา → สมุนไพรในคลัง (ถ้าชื่อตรง) */
  const herbOf = (name: string) => herbs.find((h) => name.includes(h.name));
  /** วิธีทำแยกเป็นขั้นตอน (ตัดตามช่องว่าง/ขึ้นบรรทัดใหม่ที่คั่นประโยค) */
  // ดึงลงเกินขอบบน: พื้นหลังตรึงขอบบน + ขยาย (transform บน UI thread — ไม่มีช่องขาวหลุด) · ปกเลื่อนตามเนื้อหาปกติ
  const y = useSharedValue(0);
  const heroH = useSharedValue(420);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const bgSt = useAnimatedStyle(() => {
    const pull = Math.max(0, -y.value);
    const s = 1 + pull / heroH.value;
    // ขยายจากกลาง (ขอบบนขยับขึ้น pull/2·…) แล้วเลื่อนขึ้นอีก pull/2 → ขอบบนอยู่ที่ขอบจอพอดี ขอบล่างอยู่กับที่ · บวกขยายเพิ่มเล็กน้อย
    return { transform: [{ translateY: -pull / 2 }, { scale: s + Math.min(pull, 200) * 0.0004 }] };
  });

  // ── สำเนาที่ได้รับจากเพื่อน: ขอเนื้อหาล่าสุดเมื่อเปิด (เพื่อนแก้ต้นฉบับ → อัปเดตตาม) ──
  const isShared = w.source === 'เพื่อนแชร์' || !!w.shareCode;
  useEffect(() => {
    if (!w.shareCode) return;
    fetchLatestShared(w.shareCode).then((r) => {
      if (!r) return;
      const patch: Record<string, unknown> = {};
      (Object.keys(r) as (keyof typeof r)[]).forEach((k) => {
        if (JSON.stringify(r[k] ?? null) !== JSON.stringify((w as any)[k] ?? null)) patch[k] = r[k];
      });
      if (Object.keys(patch).length) updateWisdom(w.id, patch);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.id]);

  // ── โหมดอ่านออกเสียง: อ่านทีละหัวข้อ ไฮไลต์การ์ดที่กำลังอ่าน และเลื่อนตามให้ ──
  const kf = KIND_FORM[w.kind] ?? KIND_FORM['ตำรับยา'];
  const { steps, extra } = splitMethod(w.kind, w.method);
  const ORIGIN_RE = /\n*(ได้รับสืบทอดจาก|แหล่งที่มา):\s*(.+)$/;
  const om = (w.summary ?? '').match(ORIGIN_RE);
  const body = (w.summary ?? '').replace(ORIGIN_RE, '').trim();
  const L = {
    summary: kf.summary.big ? kf.summary.label : 'เนื้อหา',
    indication: kf.indication.label,
    ingredients: kf.ingredients?.label ?? 'ตัวยา',
    method: kf.method.label,
    caution: kf.caution.label,
  };
  const sections = [
    { key: 'summary', label: L.summary, text: [w.title, body].filter(Boolean).join(' ') },
    { key: 'indication', label: L.indication, text: w.indication ? `${L.indication} ${w.indication}` : '' },
    { key: 'ingredients', label: L.ingredients, text: w.ingredients?.length ? `${L.ingredients} ${w.ingredients.join(' ')}` : '' },
    { key: 'method', label: L.method, text: w.method ? `${L.method} ${w.method.replace(/\n/g, ' ')}` : '' },
    { key: 'caution', label: L.caution, text: w.caution ? `${L.caution} ${w.caution}` : '' },
  ].filter((x) => x.text);
  const [readIdx, setReadIdx] = useState<number | null>(null);
  const reading = readIdx !== null ? sections[readIdx]?.key : null;
  const posY = useRef<Record<string, number>>({});
  const bodyY = useRef(0);
  const wasSpeaking = useRef(false);
  useEffect(() => {
    if (readIdx === null) return;
    wasSpeaking.current = false;
    tts.speak(sections[readIdx].text);
    const yy = posY.current[sections[readIdx].key];
    if (yy !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, bodyY.current + yy - 120), animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readIdx]);
  useEffect(() => {
    if (readIdx === null) return;
    if (tts.speaking) wasSpeaking.current = true;
    else if (wasSpeaking.current) {
      wasSpeaking.current = false;
      setReadIdx((i) => (i !== null && i + 1 < sections.length ? i + 1 : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tts.speaking]);
  useEffect(() => () => tts.stop(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleRead = () => {
    h.select();
    if (readIdx !== null) {
      setReadIdx(null);
      tts.stop();
    } else setReadIdx(0);
  };

  // ── เมนูเพิ่มเติม: แชร์ · แก้ไข (เฉพาะที่เราเพิ่มเอง) · ลบ ──
  const confirmDelete = () =>
    Alert.alert(
      isShared ? 'ลบออกจากคลังของฉัน?' : 'ลบตำรานี้?',
      isShared ? `ลบเฉพาะในคลังของคุณ ต้นฉบับของ ${w.sharedBy ?? 'เพื่อน'} ยังอยู่ตามเดิม` : 'ตำรานี้จะถูกลบออกจากคลังของคุณ และเพื่อนที่เคยรับไปจะไม่ได้รับการอัปเดตอีก',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: () => {
            tts.stop();
            removeWisdom(w.id);
            h.success();
            router.back();
          },
        },
      ],
    );
  // เมนู native ของ iOS (compact) — ต้องใส่ imageColor เอง ไม่งั้นไลบรารีส่งสีโปร่งใส ทำให้ไอคอนหาย
  const menu = [
    { id: 'share', title: 'แชร์ให้เพื่อน', image: 'qrcode', imageColor: palette.ink },
    ...(isShared ? [] : [{ id: 'edit', title: 'แก้ไข', image: 'pencil', imageColor: palette.ink }]),
    { id: 'delete', title: isShared ? 'ลบออกจากคลังของฉัน' : 'ลบ', image: 'trash', imageColor: '#E5484D', attributes: { destructive: true } },
  ];
  const onMenu = (id: string) => {
    if (id === 'share') share();
    else if (id === 'edit') router.push({ pathname: '/wisdom/new', params: { id: w.id } });
    else if (id === 'delete') confirmDelete();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTransparent: true,
          headerShadowVisible: false,
          // ไม่เบลอ/จางขอบบน ให้พื้นหลัง Hero ชนขอบจอ
          scrollEdgeEffects: { top: 'hidden' },
          headerTintColor: '#FFFFFF',
          headerBackVisible: false,
          headerLeft: () => <HeaderBack fallback="/vault" color={palette.ink} />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label={readIdx !== null ? 'หยุดอ่านออกเสียง' : 'อ่านออกเสียงให้ฟัง'} onPress={toggleRead}>
                <Sym name={readIdx !== null ? 'stop.fill' : 'headphones'} size={19} color={readIdx !== null ? palette.primary : palette.ink} weight="semibold" />
              </HeaderButton>
              <MenuView shouldOpenOnLongPress={false} themeVariant="light" actions={menu} onPressAction={({ nativeEvent }) => onMenu(nativeEvent.event)}>
                <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="เพิ่มเติม">
                  <Sym name="ellipsis" size={19} color={palette.ink} weight="semibold" />
                </View>
              </MenuView>
            </View>
          ),
        }}
      />
      <Animated.ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingBottom: insets.bottom + 130 }} showsVerticalScrollIndicator={false}>
        {/* ── Hero: ปกหนังสือบนพื้นเบลอจากภาพปก ── */}
        <View onLayout={(e) => (heroH.value = e.nativeEvent.layout.height)} style={[styles.hero, { paddingTop: insets.top + 60 }]}>
          {/* พื้นหลังยาวลงไปใต้ชื่อเรื่อง แล้วค่อยๆ จางกลืนกับสีพื้นหน้า */}
          <Animated.View style={[StyleSheet.absoluteFill, { bottom: -FADE_EXTRA }, bgSt]}>
            <Image source={cover.src} style={StyleSheet.absoluteFill} contentFit="cover" />
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(0,0,0,0.14)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0)']} locations={[0, 0.45, 0.85]} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={FADE.colors} locations={FADE.stops} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View entering={FadeInUp.duration(500)} style={styles.coverWrap}>
            <BookCover w={{ ...w, verified: true }} width={150} />
          </Animated.View>
        </View>

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

        <View style={styles.body} onLayout={(e) => (bodyY.current = e.nativeEvent.layout.y)}>
          {body || om ? (
            <Section reading={reading === 'summary'} onY={(v) => (posY.current['summary'] = v)} i={0} icon={kf.summary.big ? (w.kind === 'คาถา/พิธี' ? 'sparkles' : 'text.book.closed.fill') : 'book.fill'} color={palette.primary} title={L.summary}>
              <T v="body" style={[styles.para, w.kind === 'คาถา/พิธี' && styles.chant]}>{body}</T>
              {om ? (
                <View style={styles.originRow}>
                  <Sym name="person.crop.circle" size={14} color={ios.secondary} />
                  <T v="subhead" color={ios.secondary} style={{ flex: 1 }}>{om[1]} {om[2]}</T>
                </View>
              ) : null}
            </Section>
          ) : null}

          {w.indication ? (
            <Section reading={reading === 'indication'} onY={(v) => (posY.current['indication'] = v)} i={1} icon="cross.case.fill" color="#3B7DD8" title={L.indication}>
              <T v="body" style={styles.para}>{w.indication}</T>
            </Section>
          ) : null}

          {w.ingredients?.length ? (
            <Section reading={reading === 'ingredients'} onY={(v) => (posY.current['ingredients'] = v)} i={2} icon="leaf.fill" color={palette.primary} title={`${L.ingredients} · ${w.ingredients.length} รายการ`}>
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
            <Section reading={reading === 'method'} onY={(v) => (posY.current['method'] = v)} i={3} icon="flame.fill" color="#D9921A" title={L.method}>
              {kf.method.steps && steps.length > 1 ? (
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
                <T v="body" style={[styles.para, w.kind === 'ตำราโบราณ' && styles.original]}>{steps.join('\n')}</T>
              )}
              {/* บรรทัดเสริม: วิธีใช้ / ระยะเวลา */}
              {extra && kf.extra ? (
                <View style={styles.extra}>
                  <Sym name={w.kind === 'วิธีรักษา' ? 'clock.fill' : 'drop.fill'} size={15} color="#B26A12" />
                  <View style={{ flex: 1 }}>
                    <T v="caption" color="#B26A12" style={{ fontWeight: '700' }}>{kf.extra.label}</T>
                    <T v="body">{extra}</T>
                  </View>
                </View>
              ) : null}
            </Section>
          ) : null}

          {w.caution ? (
            <Animated.View onLayout={(e) => (posY.current.caution = e.nativeEvent.layout.y)} entering={FadeInDown.delay(360).duration(380)} style={[styles.warn, reading === 'caution' && styles.reading]}>
              <Sym name="exclamationmark.triangle.fill" size={18} color={palette.coral} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="title" color={palette.coral}>{L.caution}</T>
                <T v="body">{w.caution}</T>
              </View>
            </Animated.View>
          ) : null}

        </View>
      </Animated.ScrollView>

      {/* แถบกำลังอ่านออกเสียง (เปิดจากปุ่มหูฟังบนแถบเครื่องมือ) — กระจกฝ้าลอยเหนือเนื้อหา */}
      {readIdx !== null ? (
        <View pointerEvents="box-none" style={[styles.readWrap, { bottom: insets.bottom ? 24 : 16 }]}>
          <Glass interactive tint="rgba(255,255,255,0.5)" style={[styles.readBar, elevation.e3]}>
            <View style={styles.readIcon}>
              <Sym name="speaker.wave.2.fill" size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <T v="caption" color={ios.secondary} numberOfLines={1}>กำลังอ่านให้ฟัง · {readIdx + 1}/{sections.length}</T>
              <T v="title" numberOfLines={1}>{sections[readIdx]?.label}</T>
            </View>
            <PressableScale haptic="select" onPress={() => setReadIdx((i) => (i !== null && i + 1 < sections.length ? i + 1 : i))} style={styles.readBtn} accessibilityLabel="หัวข้อถัดไป">
              <Sym name="forward.fill" size={16} color={palette.ink} />
            </PressableScale>
            <PressableScale haptic="press" onPress={toggleRead} style={[styles.readBtn, { backgroundColor: palette.primary }]} accessibilityLabel="หยุดอ่าน">
              <Sym name="stop.fill" size={15} color="#FFFFFF" />
            </PressableScale>
          </Glass>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 26 },
  reading: { borderWidth: 2, borderColor: palette.primary, boxShadow: '0px 0px 0px 4px rgba(20,144,92,0.15), 0px 8px 20px rgba(20,60,40,0.12)' },
  readWrap: { position: 'absolute', left: 24, right: 24, borderRadius: 32 },
  readBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 10, paddingRight: 10, height: 64, borderRadius: 32 },
  readIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  readBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
  coverWrap: { transform: [{ rotate: '-2deg' }] },
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
  chant: { fontSize: 19, lineHeight: 32, textAlign: 'center', fontWeight: '500' },
  original: { fontStyle: 'italic', color: '#5B4A2A' },
  originRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  extra: { flexDirection: 'row', gap: 10, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#FDF3E3' },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#D9921A', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  warn: { flexDirection: 'row', gap: 12, padding: 18, borderRadius: 22, borderCurve: 'continuous', backgroundColor: palette.coralSoft },
});
