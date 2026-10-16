/**
 * อ่านแบบหนังสือ — เนื้อหายาวแบ่งเป็นหน้า ปัดซ้าย/ขวาเพื่อพลิกหน้า
 * หน้าแรก = ปกหนังสือ (แบบเดียวกับในคลังภูมิ) · หน้าปกใน (ชื่อเรื่อง ประเภท ที่มา) · เนื้อหา (ตัดหน้าให้พอดีจอ) · ท้ายเล่ม = ตัวยา/ขั้นตอน/ข้อห้าม
 * ตัวอักษรในเล่ม: Noto Serif Thai (แบบมีหัว ทางการ)
 * พลิกหน้าแบบหนังสือจริง: หน้ากระดาษหมุนรอบสันซ้าย (3D) ตามนิ้วลาก มีเงาบนหน้าที่พลิกและหน้าที่เผยด้านล่าง · แตะขวา/ซ้ายเพื่อพลิก
 */
import { NotoSerifThai_400Regular, NotoSerifThai_700Bold, useFonts } from '@expo-google-fonts/noto-serif-thai';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover, COVER_RATIO } from '../../components/BookCover';
import { KindIcon } from '../../components/KindIcon';
import { Sym } from '../../components/ios';
import { GlassCircle, T, useHaptic } from '../../components/ui';
import { KIND_FORM, bookPages, splitMethod } from '../../lib/wisdomKinds';
import { useApp } from '../../store/app';

const PAPER = '#F5ECD9';
const INK = '#3A2C1C';
const ORIGIN_RE = /\n*(ได้รับสืบทอดจาก|แหล่งที่มา):\s*(.+)$/;

type Page = { kind: 'cover' } | { kind: 'title' } | { kind: 'text'; heading?: string; text: string } | { kind: 'list'; heading: string; items: string[]; numbered?: boolean };

/** หน้าหนึ่งในเล่ม: pos = ตำแหน่งหน้าแบบทศนิยม (3.4 = กำลังพลิกจากหน้า 3 ไป 4 ได้ 40%) */
function FlipPage({ k, pos, spine, render }: { k: number; pos: SharedValue<number>; spine: number; render: (shade: React.ReactNode) => React.ReactNode }) {
  const turn = useAnimatedStyle(() => {
    const f = Math.min(1, Math.max(0, pos.value - k)); // 0 = วางราบ · 1 = พลิกไปแล้ว
    return {
      zIndex: 1000 - k,
      opacity: f >= 0.999 ? 0 : 1,
      transform: [{ perspective: 2200 }, { rotateY: `${-180 * f}deg` }],
    };
  });
  const shade = useAnimatedStyle(() => {
    const f = Math.min(1, Math.max(0, pos.value - k));
    const under = pos.value > k - 1 && pos.value < k ? k - pos.value : 0; // หน้าที่กำลังถูกเผยด้านล่าง
    return { opacity: f > 0 ? Math.min(0.5, f * 0.9) : under * 0.4 };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.flip, { transformOrigin: [spine, '50%', 0] }, turn]}>
      {render(<Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade, shade]} />)}
    </Animated.View>
  );
}

export default function ReadBook() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wisdoms } = useApp();
  const w = wisdoms.find((x) => x.id === id) ?? wisdoms[0];
  const insets = useSafeAreaInsets();
  const { width: W, height: SH } = useWindowDimensions();
  const [fontsOk] = useFonts({ NotoSerifThai_400Regular, NotoSerifThai_700Bold });
  const F = fontsOk ? { r: { fontFamily: 'NotoSerifThai_400Regular' }, b: { fontFamily: 'NotoSerifThai_700Bold', fontWeight: 'normal' as const } } : { r: {}, b: {} };
  const [page, setPage] = useState(0);
  const kf = KIND_FORM[w.kind] ?? KIND_FORM['ตำรับยา'];
  const om = (w.summary ?? '').match(ORIGIN_RE);
  const body = (w.summary ?? '').replace(ORIGIN_RE, '').trim();

  // ทุกหน้า (รวมปก) ขนาดเท่ากัน = สัดส่วนปกหนังสือ จัดกลางพื้นที่ระหว่างแถบบนและตัวบอกหน้า
  const areaTop = insets.top + 60;
  const areaH = SH - areaTop - (insets.bottom + 50);
  const bookW = Math.min(W - 28, areaH / COVER_RATIO);
  const bookH = bookW * COVER_RATIO;
  const bx = (W - bookW) / 2;
  const frame = { position: 'absolute' as const, left: bx, top: areaTop + (areaH - bookH) / 2, width: bookW, height: bookH };
  // ตัวอักษรต่อหน้า ตามขนาดกระดาษจริงของเครื่อง (บรรทัด × ตัวอักษรต่อบรรทัด เผื่อหัวข้อ)
  const perPage = Math.round(Math.floor((bookH - 102) / 32) * ((bookW - 54) / 7.5) * 0.78);
  const pages = useMemo<Page[]>(() => {
    const out: Page[] = [{ kind: 'cover' }, { kind: 'title' }];
    const heading = kf.summary.big ? kf.summary.label : 'เนื้อหา';
    bookPages(body, perPage).forEach((t, i) => out.push({ kind: 'text', heading: i === 0 ? heading : undefined, text: t }));
    if (w.ingredients?.length) out.push({ kind: 'list', heading: kf.ingredients?.label ?? 'ตัวยา', items: w.ingredients });
    if (w.method) {
      const { steps, extra } = splitMethod(w.kind, w.method);
      if (kf.method.steps && steps.length > 1) out.push({ kind: 'list', heading: kf.method.label, items: steps, numbered: true });
      else bookPages(steps.join('\n'), perPage).forEach((t, i) => out.push({ kind: 'text', heading: i === 0 ? kf.method.label : undefined, text: t }));
      if (extra && kf.extra) out.push({ kind: 'text', heading: kf.extra.label, text: extra });
    }
    if (w.caution) out.push({ kind: 'text', heading: kf.caution.label, text: w.caution });
    return out;
  }, [w, body, kf, perPage]);

  // ── พลิกหน้า ──
  const h = useHaptic();
  const pos = useSharedValue(0);
  const start = useSharedValue(0);
  const n = pages.length;
  const landed = (t: number) => {
    setPage(t);
    h.select();
  };
  const settle = (t: number) => {
    'worklet';
    pos.value = withTiming(t, { duration: 560, easing: Easing.out(Easing.cubic) });
    runOnJS(landed)(t);
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart(() => {
      start.value = Math.round(pos.value);
    })
    .onUpdate((e) => {
      const lo = Math.max(0, start.value - 1);
      const hi = Math.min(n - 1, start.value + 1);
      pos.value = Math.min(hi, Math.max(lo, start.value - e.translationX / (W * 0.85)));
    })
    .onEnd((e) => {
      const d = pos.value - start.value;
      let t = start.value;
      if (d > 0.25 || (e.velocityX < -450 && d > 0)) t = Math.min(n - 1, start.value + 1);
      else if (d < -0.25 || (e.velocityX > 450 && d < 0)) t = Math.max(0, start.value - 1);
      settle(t);
    });
  const tap = Gesture.Tap().onEnd((e) => {
    const cur = Math.round(pos.value);
    const t = e.x > W * 0.4 ? Math.min(n - 1, cur + 1) : Math.max(0, cur - 1);
    if (t !== cur) settle(t);
  });
  const gesture = Gesture.Exclusive(pan, tap);

  const renderPage = (item: Page, index: number, shade: React.ReactNode) =>
    item.kind === 'cover' ? (
      <View style={frame}>
        <BookCover w={w} width={bookW} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: 5, overflow: 'hidden' }]} pointerEvents="none">{shade}</View>
      </View>
    ) : (
    <View style={frame}>
      <View style={styles.paper}>
        <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)', 'rgba(120,90,40,0.10)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* เงาสันกระดาษด้านซ้าย */}
        <LinearGradient colors={['rgba(90,60,20,0.18)', 'rgba(90,60,20,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gutter} />
        {item.kind === 'title' ? (
          <View style={styles.titlePage}>
            <Text style={[styles.orn, F.r]}>❦  ❦  ❦</Text>
            <View style={styles.titleKind}>
              <KindIcon kind={w.kind} size={15} color={INK} />
              <Text style={[styles.small, { color: INK }, F.r]}>{w.kind}</Text>
            </View>
            <Text style={[styles.bookTitle, F.b]}>{w.title}</Text>
            {w.indication ? <Text style={[styles.sub, F.r]}>{kf.indication.label} · {w.indication}</Text> : null}
            <View style={styles.rule} />
            <Text style={[styles.small, { textAlign: 'center' }, F.r]}>{om ? `${om[1]} ${om[2]}` : w.sharedBy ? `จาก ${w.sharedBy}` : w.source}</Text>
            <Text style={[styles.small, { textAlign: 'center', marginTop: 4, color: 'rgba(58,44,28,0.5)' }, F.r]}>{w.date}</Text>
          </View>
        ) : item.kind === 'text' ? (
          <View style={styles.textPage}>
            {item.heading ? <Text style={[styles.heading, F.b]}>{item.heading}</Text> : null}
            <Text style={[styles.body, F.r, w.kind === 'คาถา/พิธี' && item.heading === kf.summary.label && styles.chant]}>{item.text}</Text>
          </View>
        ) : (
          <View style={styles.textPage}>
            <Text style={[styles.heading, F.b]}>{item.heading}</Text>
            {item.items.map((x, i) => (
              <View key={i} style={styles.li}>
                <Text style={[styles.bullet, F.r]}>{item.numbered ? `${i + 1}.` : '•'}</Text>
                <Text style={[styles.body, { flex: 1 }, F.r]}>{x}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={[styles.folio, F.r]}>— {index} —</Text>
        {shade}
      </View>
    </View>
  );

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <LinearGradient colors={['#2B2117', '#1A140E']} style={StyleSheet.absoluteFill} />
      <GestureDetector gesture={gesture}>
        <View style={{ flex: 1 }}>
          {pages
            .map((item, k) => ({ item, k }))
            .filter(({ k }) => k >= page - 2 && k <= page + 2)
            .reverse()
            .map(({ item, k }) => (
              <FlipPage key={k} k={k} pos={pos} spine={bx} render={(shade) => renderPage(item, k, shade)} />
            ))}
        </View>
      </GestureDetector>
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <GlassCircle label="ปิด" onPress={() => router.back()} tint="rgba(255,255,255,0.12)">
          <Sym name="xmark" size={17} color="#FFFFFF" weight="semibold" />
        </GlassCircle>
        <T v="subhead" color="rgba(255,255,255,0.85)" numberOfLines={1} style={{ flex: 1, textAlign: 'center', marginHorizontal: 12 }}>{w.title}</T>
        <View style={{ width: 44 }} />
      </View>
      {/* ตัวบอกหน้า */}
      <View style={[styles.dots, { bottom: insets.bottom + 18 }]}>
        <T v="caption" color="rgba(255,255,255,0.7)">{page === 0 ? 'ปัดหรือแตะขวาเพื่อเปิดอ่าน  ›' : `หน้า ${page + 1} / ${pages.length}`}</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1A140E' },
  paper: { flex: 1, backgroundColor: PAPER, borderRadius: 6, borderTopRightRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden', boxShadow: '0px 18px 40px rgba(0,0,0,0.5)' },
  flip: { backfaceVisibility: 'hidden' },
  shade: { backgroundColor: '#000' },
  gutter: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 26 },
  titlePage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  titleKind: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(58,44,28,0.3)' },
  bookTitle: { marginTop: 20, fontSize: 28, lineHeight: 46, fontWeight: '700', color: INK, textAlign: 'center' },
  orn: { fontSize: 13, color: 'rgba(58,44,28,0.55)', letterSpacing: 3 },
  sub: { marginTop: 10, fontSize: 16, lineHeight: 28, color: 'rgba(58,44,28,0.75)', textAlign: 'center' },
  small: { fontSize: 14.5, lineHeight: 24, color: 'rgba(58,44,28,0.7)' },
  rule: { width: 60, height: 1, backgroundColor: 'rgba(58,44,28,0.35)', marginVertical: 22 },
  textPage: { flex: 1, paddingLeft: 30, paddingRight: 24, paddingTop: 28, paddingBottom: 44 },
  heading: { fontSize: 20, lineHeight: 34, fontWeight: '700', color: INK, marginBottom: 12 },
  body: { fontSize: 17, lineHeight: 32, color: INK },
  chant: { textAlign: 'center', fontSize: 19, lineHeight: 38 },
  li: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  bullet: { fontSize: 17, lineHeight: 32, color: 'rgba(58,44,28,0.7)', minWidth: 22 },
  folio: { position: 'absolute', left: 0, right: 0, bottom: 16, fontSize: 13, color: 'rgba(58,44,28,0.5)', textAlign: 'center' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center' },
  dots: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
