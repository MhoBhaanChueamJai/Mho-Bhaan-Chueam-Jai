/**
 * อ่านแบบหนังสือ — เนื้อหายาวแบ่งเป็นหน้า ปัดซ้าย/ขวาเพื่อพลิกหน้า
 * หน้าแรก = ปกหนังสือ (แบบเดียวกับในคลังภูมิ) · หน้าปกใน (ชื่อเรื่อง ประเภท ที่มา) · เนื้อหา (ตัดหน้าให้พอดีจอ) · ท้ายเล่ม = ตัวยา/ขั้นตอน/ข้อห้าม
 * ตัวอักษรในเล่ม: Noto Serif Thai (แบบมีหัว ทางการ)
 * พลิกหน้าแบบกระดาษจริง: แผ่นกระดาษม้วนโค้งตามนิ้วลาก เห็นหลังกระดาษ มีเงาทอดลงหน้าถัดไป · แตะขวา/ซ้ายเพื่อพลิก
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

/** ── พลิกหน้าแบบกระดาษโค้ง ──
 * หน้าที่กำลังพลิกถูกหั่นเป็นแถบแนวตั้ง แต่ละแถบวางตามกระดาษที่ม้วนรอบทรงกระบอก (รัศมี R) ตามเส้นพับ c
 * ส่วนที่ม้วนพ้นครึ่งวงจะกลับด้าน (เห็นหลังกระดาษจางๆ) และวางทับอยู่ด้านบน · คำนวณบน UI thread ทั้งหมด
 * pos = ตำแหน่งหน้าแบบทศนิยม (3.4 = กำลังพลิกจากหน้า 3 ไป 4 ได้ 40%)
 */
const STRIPS = 16;
const PERSP = 1600;
function curlAt(x: number, f: number, Wp: number) {
  'worklet';
  const R = Wp * 0.14;
  const c = Wp + 2 - f * (Wp + (Math.PI * R) / 2 + Wp * 0.08); // เส้นพับเลื่อนจากขอบขวาไปซ้าย
  const a = x - c;
  let X = x;
  let Z = 0;
  let phi = 0;
  if (a > 0 && a <= Math.PI * R) {
    phi = a / R;
    X = c + R * Math.sin(phi);
    Z = R * (1 - Math.cos(phi));
  } else if (a > Math.PI * R) {
    phi = Math.PI;
    X = c - (a - Math.PI * R);
    Z = 2 * R;
  }
  const k = PERSP / (PERSP - Z); // ใกล้ตา = ใหญ่ขึ้นเล็กน้อย
  return { X: Wp / 2 + (X - Wp / 2) * k, k, phi, c, R };
}

function Strip({ i, s, k, pos, Wp, H, content, paper }: { i: number; s: number; k: number; pos: SharedValue<number>; Wp: number; H: number; content: React.ReactNode; paper: string }) {
  const x0 = i * s;
  const st = useAnimatedStyle(() => {
    const f = Math.min(1, Math.max(0, pos.value - k));
    if (f <= 0) return { transform: [{ translateX: 0 }, { scaleX: 1 }, { scaleY: 1 }] };
    const p0 = curlAt(x0, f, Wp);
    const p1 = curlAt(x0 + s, f, Wp);
    let sx = (p1.X - p0.X) / s;
    if (Math.abs(sx) < 0.003) sx = sx < 0 ? -0.003 : 0.003;
    return { transform: [{ translateX: p0.X - x0 }, { scaleX: sx }, { scaleY: (p0.k + p1.k) / 2 }] };
  });
  // แสงเงาบนแผ่นที่โค้ง: ด้านหน้าหมองลงเมื่อเอียงหนีแสง · ด้านหลังเป็นสีกระดาษเห็นตัวอักษรทะลุจางๆ
  const dark = useAnimatedStyle(() => {
    const f = Math.min(1, Math.max(0, pos.value - k));
    if (f <= 0) return { opacity: 0 };
    const phi = (curlAt(x0, f, Wp).phi + curlAt(x0 + s, f, Wp).phi) / 2;
    return { opacity: phi < Math.PI / 2 ? 0.32 * Math.sin(phi) ** 1.5 : 0.1 + 0.22 * Math.sin(phi) };
  });
  const back = useAnimatedStyle(() => {
    const f = Math.min(1, Math.max(0, pos.value - k));
    if (f <= 0) return { opacity: 0 };
    const phi = (curlAt(x0, f, Wp).phi + curlAt(x0 + s, f, Wp).phi) / 2;
    return { opacity: phi > Math.PI / 2 ? 0.86 : 0 };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: x0, top: 0, width: s + 1, height: H, overflow: 'hidden', transformOrigin: 'left center' }, st]}>
      <View style={{ position: 'absolute', left: -x0, top: 0, width: Wp, height: H }}>{content}</View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: paper }, back]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade, dark]} />
    </Animated.View>
  );
}

function FlipPage({ k, pos, frame, curl, paper, render }: { k: number; pos: SharedValue<number>; frame: { left: number; top: number; width: number; height: number }; curl: boolean; paper: string; render: (shade: React.ReactNode) => React.ReactNode }) {
  const Wp = frame.width;
  const s = Wp / STRIPS;
  const box = useAnimatedStyle(() => {
    const f = Math.min(1, Math.max(0, pos.value - k));
    return { zIndex: 1000 - k, opacity: f >= 0.995 ? 0 : 1 };
  });
  // หน้าที่ถูกเผยด้านล่าง: มืดลงนิดๆ แล้วสว่างขึ้นเมื่อแผ่นบนพลิกพ้น
  const shade = useAnimatedStyle(() => {
    const under = pos.value > k - 1 && pos.value < k ? k - pos.value : 0;
    return { opacity: under * 0.28 };
  });
  // เงาที่แผ่นโค้งทอดลงบนหน้าถัดไป (ขวาของสันโค้ง)
  const cast = useAnimatedStyle(() => {
    const f = Math.min(1, Math.max(0, pos.value - k));
    if (f <= 0 || f >= 1) return { opacity: 0 };
    const p = curlAt(Wp, f, Wp);
    const edge = Math.max(p.X, Wp / 2 + (p.c + p.R - Wp / 2) * (PERSP / (PERSP - p.R)));
    return { opacity: Math.min(1, f * 10) * (1 - f) * 0.9, transform: [{ translateX: edge }] };
  });
  const shadeEl = <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade, shade]} />;
  const content = render(shadeEl);
  return (
    <Animated.View style={[{ position: 'absolute', ...frame }, box]}>
      {curl ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.cast, cast]}>
            <LinearGradient colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
          {Array.from({ length: STRIPS }, (_, i) => (
            <Strip key={i} i={i} s={s} k={k} pos={pos} Wp={Wp} H={frame.height} content={content} paper={paper} />
          ))}
        </>
      ) : (
        content
      )}
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
  const frame = { left: bx, top: areaTop + (areaH - bookH) / 2, width: bookW, height: bookH };
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
    pos.value = withTiming(t, { duration: 650, easing: Easing.out(Easing.quad) });
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
      <View style={{ flex: 1 }}>
        <BookCover w={w} width={bookW} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: 5, overflow: 'hidden' }]} pointerEvents="none">{shade}</View>
      </View>
    ) : (
    <View style={{ flex: 1 }}>
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
            {item.text.split(/\n{2,}/).map((para, j) => {
              const chant = w.kind === 'คาถา/พิธี' && (item.heading ?? kf.summary.label) === kf.summary.label;
              // ย่อหน้าแบบหนังสือ: เยื้องบรรทัดแรก (ยกเว้นรายการ/บทคาถา/หน้าที่ต่อจากหน้าก่อน)
              const indent = !chant && !/^\s*(?:[•\-*]|\d+[.)])/.test(para) && (j > 0 || !!item.heading);
              return (
                <Text key={j} style={[styles.body, F.r, chant && styles.chant, j > 0 && { marginTop: 10 }]}>
                  {indent ? '\u2003\u2003' : ''}
                  {para.trim()}
                </Text>
              );
            })}
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
              <FlipPage key={k} k={k} pos={pos} frame={frame} curl={k >= page - 1 && k <= page + 1} paper={item.kind === 'cover' ? '#E9DFC8' : PAPER} render={(shade) => renderPage(item, k, shade)} />
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
  cast: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 34 },
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
