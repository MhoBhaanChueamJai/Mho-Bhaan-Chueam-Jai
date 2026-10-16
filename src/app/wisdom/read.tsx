/**
 * อ่านแบบหนังสือ — เนื้อหายาวแบ่งเป็นหน้า ปัดซ้าย/ขวาเพื่อพลิกหน้า
 * หนังสือเต็มจอ · หน้าแรก = ปกหนังสือ (แบบเดียวกับในคลังภูมิ บนพื้นปกเบลอ) · หน้าปกใน (ชื่อเรื่อง ประเภท ที่มา) · เนื้อหา (ตัดหน้าให้พอดีจอ) · ท้ายเล่ม = ตัวยา/ขั้นตอน/ข้อห้าม
 * ตัวอักษรในเล่ม: Noto Serif Thai (แบบมีหัว ทางการ)
 * พลิกหน้าแบบกระดาษม้วนจริง (Skia page curl): ลากจากตรงไหนก็ได้ ลากเฉียง = พับเฉียง · แตะขวา/ซ้ายเพื่อพลิก
 */
import { NotoSerifThai_400Regular, NotoSerifThai_700Bold, useFonts } from '@expo-google-fonts/noto-serif-thai';
import { Canvas, Group, Image as SkImg, ImageShader, LinearGradient as SkLinear, Rect, Vertices, makeImageFromView, type SkImage } from '@shopify/react-native-skia';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { createRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover, COVERS, COVER_RATIO } from '../../components/BookCover';
import { KindIcon } from '../../components/KindIcon';
import { Sym } from '../../components/ios';
import { GlassCircle, T, useHaptic } from '../../components/ui';
import { KIND_FORM, bookPages, splitMethod } from '../../lib/wisdomKinds';
import { useApp } from '../../store/app';

const PAPER = '#F5ECD9';
const INK = '#3A2C1C';
const ORIGIN_RE = /\n*(ได้รับสืบทอดจาก|แหล่งที่มา):\s*(.+)$/;

type Page = { kind: 'cover' } | { kind: 'title' } | { kind: 'text'; heading?: string; text: string } | { kind: 'list'; heading: string; items: string[]; numbered?: boolean };

/** ── พลิกหน้าแบบกระดาษม้วน (page curl) ──
 * ดัดแปลงหลักการจาก react-native-pagecurl (MIT, github.com/Onedayago/react-native-pagecurl):
 * ถ่ายภาพหน้ากระดาษ (RN view → SkImage) แล้ววาดเป็นตาข่ายสามเหลี่ยมด้วย Skia Vertices
 * จุดบนแผ่นที่เลยเส้นพับถูกม้วนรอบทรงกระบอกรัศมี R เลยครึ่งวงจะพับกลับเป็นหลังกระดาษ
 * เส้นพับเอียงตามนิ้ว (ลากเฉียงได้) · แสงเงา/หลังกระดาษใช้ gradient ในพิกัดกระดาษ · เงาทอดลงหน้าถัดไป
 */
const COLS = 18;
const ROWS = 30;
type Geo = { valid: number; cx: number; cy: number; ux: number; uy: number; fx: number; fy: number };

function CurlLayer({ base, turning, Wp, Hp, verts, tex, idx, g0, g1, s0, s1, baseDim, paper }: {
  base: SharedValue<SkImage | null>; turning: SharedValue<SkImage | null>; Wp: number; Hp: number;
  verts: SharedValue<{ x: number; y: number }[]>; tex: { x: number; y: number }[]; idx: SharedValue<number[]>;
  g0: SharedValue<{ x: number; y: number }>; g1: SharedValue<{ x: number; y: number }>; s0: SharedValue<{ x: number; y: number }>; s1: SharedValue<{ x: number; y: number }>;
  baseDim: SharedValue<number>; paper: string;
}) {
  const rect = { x: 0, y: 0, width: Wp, height: Hp };
  return (
    <Group>
      <SkImg image={base} x={0} y={0} width={Wp} height={Hp} fit="fill" />
      <Rect x={0} y={0} width={Wp} height={Hp} color="black" opacity={baseDim} />
      {/* เงาที่ส่วนม้วนทอดลงบนหน้าที่อยู่ด้านล่าง */}
      <Rect x={0} y={0} width={Wp} height={Hp}>
        <SkLinear start={s0} end={s1} colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.36)', 'rgba(0,0,0,0)']} positions={[0, 0.03, 1]} mode="clamp" />
      </Rect>
      <Vertices mode="triangles" vertices={verts} textures={tex} indices={idx}>
        <ImageShader image={turning} fit="fill" rect={rect} />
      </Vertices>
      {/* แสงเงาบนส่วนโค้ง + หลังกระดาษ (เห็นตัวอักษรทะลุจางๆ) */}
      <Vertices mode="triangles" vertices={verts} textures={tex} indices={idx}>
        <SkLinear start={g0} end={g1} colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.30)', 'rgba(120,100,70,0.55)', paper]} positions={[0, 0.2, 0.47, 0.53, 1]} mode="clamp" />
      </Vertices>
    </Group>
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

  // หนังสือเต็มจอ: ทุกหน้าขนาดเท่าจอ · ตัวหนังสืออยู่ในขอบปลอดภัย (ใต้แถบบน เหนือเลขหน้า)
  const frame = { left: 0, top: 0, width: W, height: SH };
  const padTop = insets.top + 62;
  const padBottom = insets.bottom + 46;
  const coverW = Math.min(W * 0.74, (SH - insets.top - insets.bottom - 220) / COVER_RATIO);
  // ตัวอักษรต่อหน้า ตามขนาดกระดาษจริงของเครื่อง (บรรทัด × ตัวอักษรต่อบรรทัด เผื่อหัวข้อ)
  const perPage = Math.round(Math.floor((SH - padTop - padBottom - 50) / 32) * ((W - 56) / 7.5) * 0.78);
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

  // ── พลิกหน้า (page curl) ──
  const h = useHaptic();
  const n = pages.length;
  const Wp = W;
  const Hp = SH;
  const R = Math.round(Wp * 0.13); // รัศมีม้วนกระดาษ
  const HC = Math.PI * R;
  const tt = useSharedValue(0); // 0 = แผ่นที่พลิกวางราบ · 1 = พลิกพ้นไปทางซ้ายแล้ว
  const tilt = useSharedValue(0); // เอียงเส้นพับตามนิ้วแนวตั้ง
  const sy = useSharedValue(Hp * 0.8); // ระดับที่จับขอบกระดาษ
  const dir = useSharedValue(1); // 1 = หน้าถัดไป · -1 = ย้อนกลับ
  const active = useSharedValue(0); // แสดงชั้น Skia (ระหว่างพลิก)
  const busy = useSharedValue(0);
  const dragging = useSharedValue(0); // pan นี้เป็นคนพลิกอยู่ (กันลากซ้อนระหว่างอนิเมชั่น)
  const readyF = useSharedValue(0);
  const readyB = useSharedValue(0);

  // ภาพหน้ากระดาษ (ถ่ายจาก RN view) เก็บแคชตามเลขหน้า — พลิกแต่ละครั้งถ่ายเพิ่มแค่หน้าที่ยังไม่มี
  const refs = useRef<Record<number, React.RefObject<View | null>>>({});
  const refOf = (k: number) => (refs.current[k] ??= createRef<View>());
  const cache = useRef(new Map<number, SkImage>());
  const cacheKey = `${w.id}:${W}x${SH}:${fontsOk ? 1 : 0}:${n}`;
  const keyRef = useRef(cacheKey);
  const [imgs, setImgs] = useState<{ prev: SkImage | null; cur: SkImage | null; next: SkImage | null }>({ prev: null, cur: null, next: null });
  useEffect(() => {
    if (keyRef.current !== cacheKey) {
      cache.current.clear();
      keyRef.current = cacheKey;
    }
    let alive = true;
    const snap = async (k: number) => {
      const r = refs.current[k];
      if (k < 0 || k >= n || !r?.current) return;
      const im = await makeImageFromView(r as React.RefObject<View>).catch(() => null);
      if (im && alive) cache.current.set(k, im);
    };
    const publish = () => {
      const c = cache.current;
      for (const k of [...c.keys()]) if (k < page - 2 || k > page + 2) c.delete(k);
      const cur = c.get(page) ?? null;
      const next = c.get(page + 1) ?? null;
      const prev = c.get(page - 1) ?? null;
      setImgs({ prev, cur, next });
      readyF.value = cur && next ? 1 : 0;
      readyB.value = prev && cur ? 1 : 0;
    };
    // ซ่อนชั้น Skia เมื่อ RN แสดงหน้าใหม่แล้ว
    const raf = requestAnimationFrame(() => {
      active.value = 0;
      busy.value = 0;
    });
    const t1 = setTimeout(async () => {
      for (const k of [page, page + 1, page - 1]) if (!cache.current.has(k)) await snap(k);
      if (alive) publish();
    }, 60);
    // รูปปกโหลดช้ากว่าตัวหนังสือ: ถ่ายปกซ้ำอีกรอบ
    const t2 = page <= 1 ? setTimeout(async () => {
      await snap(0);
      if (alive) publish();
    }, 900) : undefined;
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [page, n, cacheKey, active, busy, readyF, readyB]);

  const turned = useCallback(
    (d: number) => {
      setPage((p) => Math.max(0, Math.min(n - 1, p + d)));
      h.select();
    },
    [n, h],
  );

  // เรขาคณิต: S = จุดจับที่ขอบขวา (Wp, sy) · C = จุดบนเส้นพับ · u = ทิศม้วน · f = แนวเส้นพับ
  const geo = useDerivedValue<Geo>(() => {
    const cx = Wp - tt.value * (Wp + R + 8);
    const dxAbs = Wp - cx;
    const lim = dxAbs * 0.35;
    const cy = sy.value + Math.max(-lim, Math.min(lim, tilt.value));
    const dx = cx - Wp;
    const dy = cy - sy.value;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) return { valid: 0, cx: 0, cy: 0, ux: 0, uy: 0, fx: 0, fy: 0 };
    return { valid: 1, cx, cy, ux: -dx / d, uy: -dy / d, fx: dy / d, fy: -dx / d };
  });
  const tex = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) out.push({ x: (c / COLS) * Wp, y: (r / ROWS) * Hp });
    return out;
  }, [Wp, Hp]);
  const idxSet = useMemo(() => {
    const build = (rr: boolean, cr: boolean) => {
      const out: number[] = [];
      for (let ri = 0; ri < ROWS; ri++) {
        const r = rr ? ROWS - 1 - ri : ri;
        for (let ci = 0; ci < COLS; ci++) {
          const c = cr ? COLS - 1 - ci : ci;
          const tl = r * (COLS + 1) + c;
          const bl = tl + COLS + 1;
          out.push(tl, tl + 1, bl, tl + 1, bl + 1, bl);
        }
      }
      return out;
    };
    return { n: build(false, false), rr: build(true, false) };
  }, []);
  // ส่วนที่ม้วนต้องวาดทีหลัง (ทับด้านบน): เรียงสามเหลี่ยมตามทิศม้วน
  const idx = useDerivedValue(() => (geo.value.valid && geo.value.uy < 0 ? idxSet.rr : idxSet.n));
  const verts = useDerivedValue(() => {
    const g = geo.value;
    const out: { x: number; y: number }[] = [];
    for (let r = 0; r <= ROWS; r++) {
      for (let c = 0; c <= COLS; c++) {
        const ox = (c / COLS) * Wp;
        const oy = (r / ROWS) * Hp;
        if (!g.valid) {
          out.push({ x: ox, y: oy });
          continue;
        }
        const rx = ox - g.cx;
        const ry = oy - g.cy;
        const along = rx * g.ux + ry * g.uy;
        const perp = rx * g.fx + ry * g.fy;
        if (along > HC) {
          const ex = along - HC;
          out.push({ x: g.cx - g.ux * ex + g.fx * perp, y: g.cy - g.uy * ex + g.fy * perp });
        } else if (along > 0) {
          const sn = Math.sin(along / R);
          out.push({ x: g.cx + g.ux * R * sn + g.fx * perp, y: g.cy + g.uy * R * sn + g.fy * perp });
        } else out.push({ x: ox, y: oy });
      }
    }
    return out;
  });
  // gradient ในพิกัดกระดาษ: จากเส้นพับ → ครึ่งวงม้วน (แสงเงา + หลังกระดาษ)
  const g0 = useDerivedValue(() => ({ x: geo.value.cx, y: geo.value.cy }));
  const g1 = useDerivedValue(() => ({ x: geo.value.cx + geo.value.ux * HC, y: geo.value.cy + geo.value.uy * HC }));
  // เงาทอดบนหน้าล่าง เริ่มที่ขอบนอกของส่วนม้วน
  const s0 = useDerivedValue(() => ({ x: geo.value.cx + geo.value.ux * R * 0.9, y: geo.value.cy + geo.value.uy * R * 0.9 }));
  const s1 = useDerivedValue(() => ({ x: geo.value.cx + geo.value.ux * (R + 46), y: geo.value.cy + geo.value.uy * (R + 46) }));
  const baseDim = useDerivedValue(() => (geo.value.valid ? 0.22 * (1 - tt.value) : 0));
  // หน้าล่าง/แผ่นที่พลิก ตามทิศ (ไปหน้า: ล่าง=ถัดไป พลิก=ปัจจุบัน · ย้อน: ล่าง=ปัจจุบัน พลิก=ก่อนหน้า)
  const { prev: iPrev, cur: iCur, next: iNext } = imgs;
  const baseImg = useDerivedValue(() => (dir.value > 0 ? iNext : iCur) ?? iCur);
  const turnImg = useDerivedValue(() => (dir.value > 0 ? iCur : iPrev) ?? iCur);
  const layer = useAnimatedStyle(() => ({ opacity: active.value }));

  const DUR = 620;
  const ease = Easing.bezier(0.3, 0.1, 0.25, 1);
  const finish = (target: number, d: number, done: boolean) => {
    'worklet';
    tilt.value = withTiming(0, { duration: DUR, easing: ease });
    tt.value = withTiming(target, { duration: DUR, easing: ease }, (ok) => {
      if (!ok) return;
      if (done) runOnJS(turned)(d);
      else {
        active.value = 0;
        busy.value = 0;
      }
    });
  };
  const begin = (d: number, y: number) => {
    'worklet';
    dir.value = d;
    sy.value = Math.max(24, Math.min(Hp - 24, y));
    tt.value = d > 0 ? 0 : 1;
    tilt.value = 0;
    active.value = 1;
    busy.value = 1;
    readyF.value = 0;
    readyB.value = 0;
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onStart((e) => {
      dragging.value = 0;
      if (busy.value) return;
      const d = e.translationX < 0 ? 1 : -1;
      if (d > 0 ? !readyF.value : !readyB.value) return;
      begin(d, e.y);
      dragging.value = 1;
    })
    .onUpdate((e) => {
      if (!dragging.value) return;
      const p = Math.max(0, Math.min(1, Math.abs(e.translationX) / (Wp * 0.95)));
      tt.value = dir.value > 0 ? (e.translationX < 0 ? p : 0) : e.translationX > 0 ? 1 - p : 1;
      tilt.value = e.translationY * 0.6;
    })
    .onEnd((e) => {
      if (!dragging.value) return;
      dragging.value = 0;
      if (dir.value > 0) {
        const done = tt.value > 0.3 || e.velocityX < -400;
        finish(done ? 1 : 0, 1, done);
      } else {
        const done = tt.value < 0.7 || e.velocityX > 400;
        finish(done ? 0 : 1, -1, done);
      }
    });
  const tap = Gesture.Tap().onEnd((e) => {
    if (busy.value || dragging.value) return;
    const fwd = e.x > W * 0.4;
    if (fwd ? !readyF.value : !readyB.value) return;
    begin(fwd ? 1 : -1, Hp * 0.88);
    tilt.value = -Hp * 0.14; // เปิดจากมุมล่างขวาเฉียงขึ้น เหมือนหยิบมุมกระดาษ
    finish(fwd ? 1 : 0, fwd ? 1 : -1, true);
  });
  const gesture = Gesture.Exclusive(pan, tap);

  const renderPage = (item: Page, index: number) =>
    item.kind === 'cover' ? (
      <View style={styles.coverPage}>
        <ExpoImage source={COVERS[w.kind]?.src ?? COVERS['ตำรับยา'].src} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={36} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,5,0.42)' }]} />
        <BookCover w={w} width={coverW} />
        <T v="caption" color="rgba(255,255,255,0.7)" center style={{ marginTop: 30 }}>ปัดหรือแตะขวาเพื่อเปิดอ่าน  ›</T>
      </View>
    ) : (
    <View style={{ flex: 1 }}>
      <View style={styles.paper}>
        <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)', 'rgba(120,90,40,0.10)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* เงาสันกระดาษด้านซ้าย */}
        <LinearGradient colors={['rgba(90,60,20,0.18)', 'rgba(90,60,20,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gutter} />
        {item.kind === 'title' ? (
          <View style={[styles.titlePage, { paddingTop: padTop, paddingBottom: padBottom }]}>
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
          <View style={[styles.textPage, { paddingTop: padTop, paddingBottom: padBottom }]}>
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
          <View style={[styles.textPage, { paddingTop: padTop, paddingBottom: padBottom }]}>
            <Text style={[styles.heading, F.b]}>{item.heading}</Text>
            {item.items.map((x, i) => (
              <View key={i} style={styles.li}>
                <Text style={[styles.bullet, F.r]}>{item.numbered ? `${i + 1}.` : '•'}</Text>
                <Text style={[styles.body, { flex: 1 }, F.r]}>{x}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={[styles.folio, { bottom: insets.bottom + 14 }, F.r]}>— {index} —</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.page}>
      <StatusBar style={page === 0 ? 'light' : 'dark'} />
      <LinearGradient colors={['#2B2117', '#1A140E']} style={StyleSheet.absoluteFill} />
      <GestureDetector gesture={gesture}>
        <View style={{ flex: 1 }}>
          {/* หน้าจริง (RN): หน้าปัจจุบันอยู่บนสุด หน้าข้างเคียงซ้อนด้านหลังไว้ถ่ายภาพ */}
          {pages
            .map((item, k) => ({ item, k }))
            .filter(({ k }) => k >= page - 1 && k <= page + 1)
            .sort((a, b) => (a.k === page ? 1 : b.k === page ? -1 : 0))
            .map(({ item, k }) => (
              <View key={k} ref={refOf(k)} collapsable={false} style={[styles.sheet, frame]}>
                {renderPage(item, k)}
              </View>
            ))}
          {/* ชั้นพลิกหน้า (Skia) แสดงเฉพาะตอนพลิก */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, layer]}>
            {iCur ? (
              <Canvas style={StyleSheet.absoluteFill}>
                <CurlLayer base={baseImg} turning={turnImg} Wp={Wp} Hp={Hp} verts={verts} tex={tex} idx={idx} g0={g0} g1={g1} s0={s0} s1={s1} baseDim={baseDim} paper="rgba(240,231,211,0.93)" />
              </Canvas>
            ) : null}
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <GlassCircle label="ปิด" onPress={() => router.back()} tint={page === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(58,44,28,0.06)'}>
          <Sym name="xmark" size={17} color={page === 0 ? '#FFFFFF' : INK} weight="semibold" />
        </GlassCircle>
        <T v="subhead" color={page === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(58,44,28,0.6)'} numberOfLines={1} style={{ flex: 1, textAlign: 'center', marginHorizontal: 12 }}>{page === 0 ? '' : w.title}</T>
        <T v="caption" color={page === 0 ? 'rgba(255,255,255,0.75)' : 'rgba(58,44,28,0.55)'} style={{ minWidth: 44, textAlign: 'right' }}>{page + 1}/{pages.length}</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1A140E' },
  paper: { flex: 1, backgroundColor: PAPER, overflow: 'hidden' },
  coverPage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A140E', overflow: 'hidden' },
  sheet: { position: 'absolute' },
  gutter: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 26 },
  titlePage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  titleKind: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(58,44,28,0.3)' },
  bookTitle: { marginTop: 20, fontSize: 28, lineHeight: 46, fontWeight: '700', color: INK, textAlign: 'center' },
  orn: { fontSize: 13, color: 'rgba(58,44,28,0.55)', letterSpacing: 3 },
  sub: { marginTop: 10, fontSize: 16, lineHeight: 28, color: 'rgba(58,44,28,0.75)', textAlign: 'center' },
  small: { fontSize: 14.5, lineHeight: 24, color: 'rgba(58,44,28,0.7)' },
  rule: { width: 60, height: 1, backgroundColor: 'rgba(58,44,28,0.35)', marginVertical: 22 },
  textPage: { flex: 1, paddingLeft: 30, paddingRight: 26 },
  heading: { fontSize: 20, lineHeight: 34, fontWeight: '700', color: INK, marginBottom: 12 },
  body: { fontSize: 17, lineHeight: 32, color: INK },
  chant: { textAlign: 'center', fontSize: 19, lineHeight: 38 },
  li: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  bullet: { fontSize: 17, lineHeight: 32, color: 'rgba(58,44,28,0.7)', minWidth: 22 },
  folio: { position: 'absolute', left: 0, right: 0, fontSize: 13, color: 'rgba(58,44,28,0.5)', textAlign: 'center' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center' },
});
