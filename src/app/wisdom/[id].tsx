/**
 * หน้าตำรา — Hero ปกหนังสือ (พื้นหลังเบลอจากปก) + ชื่อ/ที่มา + แผ่นเนื้อหาโค้งซ้อนขึ้นมา
 * เนื้อหา · สรรพคุณ · ตัวยา (มีรูปถ้าตรงกับคลังสมุนไพร กดดูได้) · วิธีปรุงและวิธีใช้ · ข้อห้าม
 * แถบล่าง: ฟังด้วยเสียง · หัวขวา: แชร์ QR ให้เพื่อน
 */
import { BlurView } from '../../components/Blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { MenuView } from '../../components/Menu';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Alert } from '../../lib/alert';
import Animated, { FadeInDown, FadeInUp, FadeOut, runOnJS, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioClips } from '../../components/AudioClips';
import { NotFound } from '../../components/NotFound';
import { useSpeaker } from '../../components/audio';
import { BookCover, COVERS } from '../../components/BookCover';
import { KindIcon } from '../../components/KindIcon';
import { CircleIcon } from '../../components/ListRow';
import { Sym, ios } from '../../components/ios';
import { Button, Glass, GlassCircle, GlassDock, HeaderBack, HeaderButton, PressableScale, T, useHaptic } from '../../components/ui';
import { fetchLatestShared } from '../../lib/wisdomShare';
import { KIND_FORM, bookPages, plainText, splitMethod } from '../../lib/wisdomKinds';
import { herbs } from '../../data/herbs';
import { doctor, type Wisdom } from '../../data/mock';
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

/** แยก "ชื่อตัวยา ปริมาณ" → ชื่อ / ปริมาณ (ปริมาณ = ตั้งแต่ตัวเลขแรกจนจบ ถ้าไม่ยาวเกิน) */
function splitAmount(x: string): { name: string; amount: string } {
  const m = x.match(/^(.+?)\s+([\d๐-๙][\d๐-๙.,/x×–\-\s]*\S*(?:\s+\S+)?)$/);
  if (m && m[2].length <= 18) return { name: m[1].trim(), amount: m[2].trim() };
  return { name: x, amount: '' };
}

/** แยกข้อความวิธีใช้เป็นแถวตามรูปแบบยา ("ชนิดชง …" / "ชนิดผง ชนิดแคปซูล … ") + ข้อความเตือน ("ไม่ควร…/ห้าม…") */
function usageRows(text: string): { rows: { label: string; body: string }[]; warns: string[] } {
  const rows: { label: string[]; body: string[] }[] = [];
  const warns: string[] = [];
  let mode: 'body' | 'warn' = 'body';
  for (const tok of text.split(/\s+/).filter(Boolean)) {
    const kind = tok.match(/^(?:และ)?ชนิด(.+)$/);
    if (kind) {
      const names = kind[1].split(/และ(?:ชนิด)?/).filter(Boolean);
      const cur = rows[rows.length - 1];
      if (!cur || cur.body.length || mode === 'warn') rows.push({ label: names, body: [] });
      else cur.label.push(...names);
      mode = 'body';
    } else if (/^กรณี/.test(tok) && rows.length && rows[rows.length - 1].body.length) {
      rows.push({ label: [], body: [tok] }); // แต่ละกรณีขึ้นแถวใหม่
      mode = 'body';
    } else if (/^(ไม่ควร|ห้าม)/.test(tok)) {
      warns.push(tok);
      mode = 'warn';
    } else if (tok === 'และ' && rows.length && !rows[rows.length - 1].body.length) {
      continue;
    } else if (mode === 'warn') {
      warns[warns.length - 1] += ` ${tok}`;
    } else {
      if (!rows.length) rows.push({ label: [], body: [] });
      rows[rows.length - 1].body.push(tok);
    }
  }
  return { rows: rows.filter((r) => r.body.length).map((r) => ({ label: r.label.length ? `ชนิด${r.label.join(' · ')}` : '', body: r.body.join(' ') })), warns };
}

export default function WisdomDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wisdoms } = useApp();
  const w = wisdoms.find((x) => x.id === id);
  // ไม่พบ → แจ้ง ไม่แสดงเล่มอื่นแทน
  if (!w) return <NotFound title="ไม่พบตำรานี้" />;
  return <WisdomView w={w} />;
}

/** โหมดตัวอย่าง (แผ่นรับตำราจากรหัส): ไม่มีเมนู/แถบหัว · มีปุ่มปิดบนซ้าย + แถบลอยปุ่มเพิ่มลงคลัง */
export type WisdomPreview = { onClose: () => void; onAdd: () => void; onOpen: () => void; added: boolean; dup: boolean };

/** หน้าตำรา (ใช้ทั้งหน้ารายละเอียดในคลัง และแผ่นตัวอย่างตำราที่เพื่อนแชร์) */
export function WisdomView({ w, preview }: { w: Wisdom; preview?: WisdomPreview }) {
  const { updateWisdom, removeWisdom, profile } = useApp();
  const myName = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || doctor.short;
  const h = useHaptic();
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
  // ปุ่มบนหัว/แถบสถานะ: ขาวเมื่ออยู่บนพื้นปกเบลอสีเข้ม · เข้มเมื่อเลื่อนพ้นปกแล้ว (เดิมเป็นสีเข้มบนพื้นเข้ม มองไม่เห็น)
  const [onHero, setOnHero] = useState(true);
  useAnimatedReaction(
    () => y.value < heroH.value - 140,
    (v, prev) => {
      if (v !== prev) runOnJS(setOnHero)(v);
    },
  );
  const ic = onHero ? '#FFFFFF' : palette.ink;
  const bgSt = useAnimatedStyle(() => {
    const pull = Math.max(0, -y.value);
    const s = 1 + pull / heroH.value;
    // ขยายจากกลาง (ขอบบนขยับขึ้น pull/2·…) แล้วเลื่อนขึ้นอีก pull/2 → ขอบบนอยู่ที่ขอบจอพอดี ขอบล่างอยู่กับที่ · บวกขยายเพิ่มเล็กน้อย
    return { transform: [{ translateY: -pull / 2 }, { scale: s + Math.min(pull, 200) * 0.0004 }] };
  });

  // ── สำเนาที่ได้รับจากเพื่อน: ขอเนื้อหาล่าสุดเมื่อเปิด (เพื่อนแก้ต้นฉบับ → อัปเดตตาม) ──
  const isShared = w.source === 'เพื่อนแชร์' || !!w.shareCode;
  useEffect(() => {
    if (!w.shareCode || preview) return;
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
  const ingRows = (w.ingredients ?? []).filter((x) => !/^\s*\(/.test(x));
  const usage = usageRows(extra);
  const ingNotes = (w.ingredients ?? []).filter((x) => /^\s*\(/.test(x)).map((x) => x.trim().replace(/^\(|\)$/g, ''));
  const ORIGIN_RE = /\n*(ได้รับสืบทอดจาก|แหล่งที่มา):\s*(.+)$/;
  const om = (w.summary ?? '').match(ORIGIN_RE);
  const body = plainText((w.summary ?? '').replace(ORIGIN_RE, '').trim());
  const openBook = () => router.push({ pathname: '/wisdom/read', params: { id: w.id } });
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
    { key: 'method', label: L.method, text: w.method && !kf.method.hidden ? `${L.method} ${w.method.replace(/\n/g, ' ')}` : '' },
    { key: 'caution', label: L.caution, text: w.caution ? `${L.caution} ${w.caution}` : '' },
  ]
    .filter((x) => x.text)
    .flatMap((x) => bookPages(x.text, 480).map((t) => ({ ...x, text: t })));
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
    // ตำราเริ่มต้นในระบบ: อ่าน/แชร์ได้อย่างเดียว
    ...(isShared || w.builtin ? [] : [{ id: 'edit', title: 'แก้ไข', image: 'pencil', imageColor: palette.ink }]),
    ...(w.builtin ? [] : [{ id: 'delete', title: isShared ? 'ลบออกจากคลังของฉัน' : 'ลบ', image: 'trash', imageColor: '#E5484D', attributes: { destructive: true } }]),
  ];
  const onMenu = (id: string) => {
    if (id === 'share') share();
    else if (id === 'edit') router.push({ pathname: '/wisdom/new', params: { id: w.id } });
    else if (id === 'delete') confirmDelete();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {preview ? null : <StatusBar style={onHero ? 'light' : 'dark'} />}
      {preview ? null : (
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
          headerLeft: () => <HeaderBack fallback="/vault" color={ic} />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label="อ่านแบบหนังสือ" onPress={openBook}>
                <Sym name="book.pages" size={19} color={ic} weight="semibold" />
              </HeaderButton>
              <HeaderButton label={readIdx !== null ? 'หยุดอ่านออกเสียง' : 'อ่านออกเสียงให้ฟัง'} onPress={toggleRead}>
                <Sym name={readIdx !== null ? 'stop.fill' : 'headphones'} size={19} color={readIdx !== null ? palette.primary : ic} weight="semibold" />
              </HeaderButton>
              <MenuView shouldOpenOnLongPress={false} themeVariant="light" actions={menu} onPressAction={({ nativeEvent }) => onMenu(nativeEvent.event)}>
                <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="เพิ่มเติม">
                  <Sym name="ellipsis" size={19} color={ic} weight="semibold" />
                </View>
              </MenuView>
            </View>
          ),
        }}
      />
      )}
      <Animated.ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingBottom: insets.bottom + 130 }} showsVerticalScrollIndicator={false}>
        {/* ── Hero: ปกหนังสือบนพื้นเบลอจากภาพปก ── */}
        <View onLayout={(e) => (heroH.value = e.nativeEvent.layout.height)} style={[styles.hero, { paddingTop: preview ? 76 : insets.top + 60 }]}>
          {/* พื้นหลังยาวลงไปใต้ชื่อเรื่อง แล้วค่อยๆ จางกลืนกับสีพื้นหน้า */}
          <Animated.View style={[StyleSheet.absoluteFill, { bottom: -FADE_EXTRA }, bgSt]}>
            <Image source={cover.src} style={StyleSheet.absoluteFill} contentFit="cover" />
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(0,0,0,0.14)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0)']} locations={[0, 0.45, 0.85]} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={FADE.colors} locations={FADE.stops} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View entering={FadeInUp.duration(500)} style={styles.coverWrap}>
            <PressableScale haptic="select" scaleTo={0.97} onPress={preview ? undefined : openBook} accessibilityLabel="เปิดอ่านแบบหนังสือ">
              <BookCover w={{ ...w, verified: true }} width={150} />
            </PressableScale>
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
              {w.builtin ? 'ตำราอ้างอิงในระบบ · มีแหล่งอ้างอิง' : w.sharedBy ? `ได้รับจาก ${w.sharedBy}` : `${w.source} · บันทึกโดย ${myName}`}{w.date ? ` · ${w.date}` : ''}
            </T>
          </View>
        </Animated.View>

        <View style={styles.body} onLayout={(e) => (bodyY.current = e.nativeEvent.layout.y)}>
          {/* รอคุณหมอตรวจทาน: เนื้อหาที่ครูปัญญาถอด/จัดหน้าให้ หรือได้รับจากเพื่อน — อ่านทวนแล้วกดยืนยัน */}
          {!preview && !w.builtin && !w.verified ? (
            <Animated.View exiting={FadeOut.duration(220)} style={[styles.review, elevation.e1]}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <CircleIcon name="checkmark.seal.fill" color="#E0861A" size={36} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="bodyStrong">รอคุณหมอตรวจทาน</T>
                  <T v="subhead" color={ios.secondary}>{REVIEW_NOTE[w.source] ?? REVIEW_NOTE.default}</T>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {isShared ? null : (
                  <PressableScale haptic="select" scaleTo={0.96} onPress={() => router.push({ pathname: '/wisdom/new', params: { id: w.id } })} style={[styles.reviewBtn, styles.reviewEdit]} accessibilityLabel="แก้ไขให้ถูกต้อง">
                    <Sym name="pencil" size={15} color={palette.ink} weight="semibold" />
                    <T v="subhead" style={{ fontWeight: '600' }}>แก้ไข</T>
                  </PressableScale>
                )}
                <PressableScale haptic="none" scaleTo={0.96} onPress={() => { h.success(); updateWisdom(w.id, { verified: true }); }} style={[styles.reviewBtn, { backgroundColor: palette.primary }]} accessibilityLabel="ตรวจทานแล้ว ถูกต้อง">
                  <Sym name="checkmark" size={15} color="#FFFFFF" weight="bold" />
                  <T v="subhead" color="#FFFFFF" style={{ fontWeight: '600' }}>ตรวจทานแล้ว ถูกต้อง</T>
                </PressableScale>
              </View>
            </Animated.View>
          ) : null}
          {/* เสียงเล่าต้นฉบับ (โหมดเล่า) */}
          {!preview && w.audio?.length ? <AudioClips clips={w.audio} by={w.sharedBy ?? myName} /> : null}
          {body || om ? (
            <Section reading={reading === 'summary'} onY={(v) => (posY.current['summary'] = v)} i={0} icon={kf.summary.big ? (w.kind === 'คาถา/พิธี' ? 'sparkles' : 'text.book.closed.fill') : 'book.fill'} color={palette.primary} title={L.summary}>
              <T v="body" numberOfLines={preview ? 10 : undefined} style={[styles.para, w.kind === 'คาถา/พิธี' && styles.chant]}>{body}</T>
              {om ? (
                <View style={styles.originRow}>
                  <Sym name="person.crop.circle" size={14} color={ios.secondary} />
                  <T v="subhead" color={ios.secondary} numberOfLines={1} style={{ flex: 1 }}>{om[1]} {om[2]}</T>
                </View>
              ) : null}
            </Section>
          ) : null}

          {!preview && w.indication ? (
            <Section reading={reading === 'indication'} onY={(v) => (posY.current['indication'] = v)} i={1} icon="cross.case.fill" color="#3B7DD8" title={L.indication}>
              <T v="body" style={styles.para}>{w.indication}</T>
            </Section>
          ) : null}

          {!preview && w.ingredients?.length ? (
            <Section reading={reading === 'ingredients'} onY={(v) => (posY.current['ingredients'] = v)} i={2} icon="leaf.fill" color={palette.primary} title={`${L.ingredients} · ${ingRows.length} รายการ`}>
              {/* สรุปสูตร (บรรทัดในวงเล็บของตำรับ) */}
              {ingNotes.length ? (
                <View style={styles.ingSummary}>
                  <Sym name="scalemass.fill" size={12} color={palette.primaryDeep} />
                  <T v="caption" color={palette.primaryDeep} style={{ flex: 1, fontWeight: '600' }}>{ingNotes.join(' · ')}</T>
                </View>
              ) : null}
              {/* รายการตัวยา: รูป/ไอคอน · ชื่อ · ปริมาณ คั่นด้วยเส้นบาง */}
              <View style={styles.ingGrid}>
                {ingRows.map((x, i) => {
                  const h = herbOf(x);
                  const { name, amount } = splitAmount(x);
                  const tile = (
                    <View style={[styles.tile, i > 0 && styles.tileSep]}>
                      {h ? (
                        <Image source={h.image} style={styles.tileImg} contentFit="cover" />
                      ) : (
                        <View style={styles.tileIcon}>
                          <KindIcon kind={w.kind} size={14} color={palette.primary} />
                        </View>
                      )}
                      <View style={{ flex: 1, gap: 1 }}>
                        <T v="body" style={{ fontWeight: '600' }}>{name}</T>
                        {amount ? <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '700' }}>{amount}</T> : null}
                      </View>
                      {h ? <Sym name="chevron.right" size={12} color={ios.tertiary} weight="semibold" /> : null}
                    </View>
                  );
                  return h ? (
                    <PressableScale key={`${x}${i}`} scaleTo={0.97} haptic="select" onPress={() => router.push(`/herb/${h.id}`)} style={styles.tileWrap} accessibilityLabel={`ดูสมุนไพร ${h.name}`}>
                      {tile}
                    </PressableScale>
                  ) : (
                    <View key={`${x}${i}`} style={styles.tileWrap}>{tile}</View>
                  );
                })}
              </View>
            </Section>
          ) : null}

          {!preview && w.method && !kf.method.hidden ? (
            <Section reading={reading === 'method'} onY={(v) => (posY.current['method'] = v)} i={3} icon="flame.fill" color="#D9921A" title={L.method}>
              {kf.method.steps && steps.length > 1 ? (
                // ไทม์ไลน์: เลขในวงกลมเชื่อมด้วยเส้นแนวตั้ง
                <View style={{ marginTop: 4 }}>
                  {steps.map((st, i) => (
                    <View key={i} style={styles.stepRow}>
                      <View style={styles.stepRail}>
                        {/* เส้นต่อเนื่องผ่านทุกขั้น (วงกลมทับด้านบน) */}
                        {steps.length > 1 ? <View style={[styles.stepLine, i === 0 && { top: 13 }, i === steps.length - 1 && { bottom: undefined, height: 13 }]} /> : null}
                        <View style={styles.stepNum}>
                          <T v="caption" color="#FFFFFF" style={{ fontWeight: '700' }}>{i + 1}</T>
                        </View>
                      </View>
                      <T v="body" style={[styles.stepText, i === steps.length - 1 && { paddingBottom: 0 }]}>{st}</T>
                    </View>
                  ))}
                </View>
              ) : (
                <T v="body" style={[styles.para, w.kind === 'ตำราโบราณ' && styles.original]}>{steps.join('\n')}</T>
              )}
            </Section>
          ) : null}

          {/* วิธีใช้ / ระยะเวลา: แยกแถวตามรูปแบบยา + ข้อความเตือนแยกแถว */}
          {!preview && extra && kf.extra ? (
            <Section reading={false} onY={() => {}} i={3} icon={w.kind === 'วิธีรักษา' ? 'clock.fill' : 'drop.fill'} color="#B26A12" title={kf.extra.label}>
              <View style={{ gap: 10 }}>
                {usage.rows.map((r, i) => (
                  <View key={i} style={styles.useRow}>
                    {r.label ? (
                      <View style={styles.usePill}>
                        <T v="caption" color="#9A5A0C" style={{ fontWeight: '700' }}>{r.label}</T>
                      </View>
                    ) : null}
                    <T v="body" style={styles.para}>{r.body}</T>
                  </View>
                ))}
                {usage.warns.map((x, i) => (
                  <View key={`w${i}`} style={styles.useWarn}>
                    <Sym name="exclamationmark.circle.fill" size={14} color={palette.coral} />
                    <T v="subhead" color={palette.coral} style={{ flex: 1, fontWeight: '600' }}>{x}</T>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {!preview && w.caution ? (
            <Section reading={reading === 'caution'} onY={(v) => (posY.current['caution'] = v)} i={4} icon="exclamationmark.triangle.fill" color={palette.coral} title={L.caution}>
              <T v="body" style={styles.para}>{w.caution}</T>
            </Section>
          ) : null}

          {/* แหล่งอ้างอิง */}
          {!preview && w.refs?.length ? (
            <Animated.View entering={FadeInDown.delay(400).duration(380)} style={[styles.refs, elevation.e1]}>
              <View style={styles.refsHead}>
                <Sym name="checkmark.seal.fill" size={16} color={palette.primary} />
                <T v="title">แหล่งอ้างอิง</T>
              </View>
              {w.refs.map((r, i) => (
                <PressableScale key={i} haptic="select" disabled={!r.url} onPress={() => r.url && Linking.openURL(r.url)} style={styles.refRow} accessibilityLabel={`อ้างอิง ${r.title}`}>
                  <T v="caption" color={ios.secondary} style={{ width: 18, fontWeight: '700' }}>{i + 1}.</T>
                  <View style={{ flex: 1, gap: 1 }}>
                    <T v="subhead" style={{ fontWeight: '600' }}>{r.title}</T>
                    {r.org || r.year ? <T v="caption" color={ios.secondary}>{[r.org, r.year].filter(Boolean).join(' · ')}</T> : null}
                    {r.url ? <T v="caption" color={palette.primary} numberOfLines={1}>{r.url.replace(/^https?:\/\//, '')}</T> : null}
                  </View>
                  {r.url ? <Sym name="arrow.up.right.square" size={15} color={ios.tertiary} /> : null}
                </PressableScale>
              ))}
            </Animated.View>
          ) : null}

        </View>
      </Animated.ScrollView>

      {/* โหมดตัวอย่าง: ปุ่มปิด (กระจก) บนซ้าย + แถบลอยด้านล่าง ปุ่มเพิ่มลงคลัง */}
      {preview ? (
        <>
          <View style={styles.previewClose}>
            <GlassCircle label="ปิด" onPress={preview.onClose} size={44}>
              <Sym name="xmark" size={17} color={palette.ink} weight="semibold" />
            </GlassCircle>
          </View>
          <GlassDock>
            {preview.added || preview.dup ? (
              // มีในคลังแล้ว (เพิ่งเพิ่ม หรือเคยรับไว้) → เปิดดูเล่มที่มีอยู่ ไม่ให้เพิ่มซ้ำ
              <Button label={preview.added ? 'เปิดดูในคลัง' : 'อยู่ในคลังแล้ว · เปิดดู'} icon={<Sym name="checkmark.circle.fill" size={17} color="#FFFFFF" />} onPress={preview.onOpen} style={{ flex: 1, height: 52 }} />
            ) : (
              <Button label="เพิ่มลงคลัง" icon={<Sym name="plus" size={17} color="#FFFFFF" weight="semibold" />} onPress={preview.onAdd} style={{ flex: 1, height: 52 }} />
            )}
          </GlassDock>
        </>
      ) : null}

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

/** เหตุที่ต้องตรวจทาน ตามที่มาของตำรา */
const REVIEW_NOTE: Record<string, string> = {
  สแกนตำรา: 'ครูปัญญาถอดความจากภาพตำรา อ่านทวนว่าตรงกับต้นฉบับ ชื่อยาและปริมาณถูกต้อง',
  เสียงเล่า: 'ครูปัญญาถอดจากเสียงเล่าแล้วจัดหน้าให้ อ่านทวนว่าตรงกับที่คุณหมอเล่า',
  เพื่อนแชร์: 'ตำรานี้ได้รับจากเพื่อน อ่านทวนก่อนนำไปใช้กับผู้ป่วย',
  default: 'ครูปัญญาจัดหน้าให้ อ่านทวนว่าเนื้อหาถูกต้องก่อนนำไปใช้',
};

const styles = StyleSheet.create({
  review: { gap: 14, padding: 16, borderRadius: 22, borderCurve: 'continuous', backgroundColor: palette.surface },
  reviewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 22 },
  reviewEdit: { flex: 0, paddingHorizontal: 18, backgroundColor: 'rgba(120,120,128,0.12)' },
  previewClose: { position: 'absolute', top: 16, left: 16 },
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
  ing: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingVertical: 8 },
  ingSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  herbImg: { width: 24, height: 24, borderRadius: 12 },
  ingIdx: { width: 24, textAlign: 'center', fontWeight: '600' },
  ingName: { flexShrink: 1 },
  leader: { flex: 1, minWidth: 12, height: 1, marginTop: 8, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: 'rgba(60,60,67,0.22)' },
  ingAmt: { fontWeight: '600', color: palette.ink },
  ingSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  ingGrid: {},
  tileWrap: {},
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  tileSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  tileImg: { width: 32, height: 32, borderRadius: 16 },
  tileIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  useRow: { gap: 6 },
  usePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FCEBD2' },
  useWarn: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  ingNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: palette.primarySoft },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepRail: { width: 26, alignItems: 'center' },
  stepLine: { position: 'absolute', top: 0, bottom: 0, width: 2, borderRadius: 1, backgroundColor: '#F2DDBB' },
  stepText: { flex: 1, paddingTop: 2, paddingBottom: 16 },
  extraIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FCEBD2', alignItems: 'center', justifyContent: 'center' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginLeft: 56 },
  chant: { fontSize: 19, lineHeight: 32, textAlign: 'center', fontWeight: '500' },
  original: { fontStyle: 'italic', color: '#5B4A2A' },
  originRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  extra: { flexDirection: 'row', gap: 12, marginTop: 4, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#D9921A', alignItems: 'center', justifyContent: 'center' },
  refs: { padding: 16, borderRadius: 22, borderCurve: 'continuous', backgroundColor: palette.surface, gap: 12 },
  refsHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  warn: { flexDirection: 'row', gap: 12, padding: 18, borderRadius: 22, borderCurve: 'continuous', backgroundColor: palette.coralSoft },
});
