/**
 * อ่านแบบหนังสือ — เนื้อหายาวแบ่งเป็นหน้า ปัดซ้าย/ขวาเพื่อพลิกหน้า
 * หน้าแรก = หน้าปกใน (ชื่อเรื่อง ประเภท ที่มา) · ถัดไป = เนื้อหา (ตัดหน้าให้พอดีจอ) · ท้ายเล่ม = ตัวยา/ขั้นตอน/ข้อห้าม
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KindIcon } from '../../components/KindIcon';
import { Sym } from '../../components/ios';
import { GlassCircle, T } from '../../components/ui';
import { KIND_FORM, bookPages, splitMethod } from '../../lib/wisdomKinds';
import { useApp } from '../../store/app';

const PAPER = '#F5ECD9';
const INK = '#3A2C1C';
const SERIF = Platform.select({ ios: 'Sukhumvit Set', default: undefined });
const ORIGIN_RE = /\n*(ได้รับสืบทอดจาก|แหล่งที่มา):\s*(.+)$/;

type Page = { kind: 'title' } | { kind: 'text'; heading?: string; text: string } | { kind: 'list'; heading: string; items: string[]; numbered?: boolean };

export default function ReadBook() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wisdoms } = useApp();
  const w = wisdoms.find((x) => x.id === id) ?? wisdoms[0];
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const kf = KIND_FORM[w.kind] ?? KIND_FORM['ตำรับยา'];
  const om = (w.summary ?? '').match(ORIGIN_RE);
  const body = (w.summary ?? '').replace(ORIGIN_RE, '').trim();

  const pages = useMemo<Page[]>(() => {
    const out: Page[] = [{ kind: 'title' }];
    const heading = kf.summary.big ? kf.summary.label : 'เนื้อหา';
    bookPages(body).forEach((t, i) => out.push({ kind: 'text', heading: i === 0 ? heading : undefined, text: t }));
    if (w.ingredients?.length) out.push({ kind: 'list', heading: kf.ingredients?.label ?? 'ตัวยา', items: w.ingredients });
    if (w.method) {
      const { steps, extra } = splitMethod(w.kind, w.method);
      if (kf.method.steps && steps.length > 1) out.push({ kind: 'list', heading: kf.method.label, items: steps, numbered: true });
      else bookPages(steps.join('\n')).forEach((t, i) => out.push({ kind: 'text', heading: i === 0 ? kf.method.label : undefined, text: t }));
      if (extra && kf.extra) out.push({ kind: 'text', heading: kf.extra.label, text: extra });
    }
    if (w.caution) out.push({ kind: 'text', heading: kf.caution.label, text: w.caution });
    return out;
  }, [w, body, kf]);

  const renderPage = ({ item, index }: { item: Page; index: number }) => (
    <View style={{ width: W, paddingHorizontal: 18 }}>
      <View style={[styles.paper, { marginTop: insets.top + 64, marginBottom: insets.bottom + 56 }]}>
        <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)', 'rgba(120,90,40,0.10)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* เงาสันกระดาษด้านซ้าย */}
        <LinearGradient colors={['rgba(90,60,20,0.18)', 'rgba(90,60,20,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gutter} />
        {item.kind === 'title' ? (
          <View style={styles.titlePage}>
            <T v="caption" color="rgba(58,44,28,0.55)" style={{ letterSpacing: 3 }}>❦  ❦  ❦</T>
            <View style={styles.titleKind}>
              <KindIcon kind={w.kind} size={16} color={INK} />
              <T v="subhead" color={INK} style={{ fontWeight: '600' }}>{w.kind}</T>
            </View>
            <Text style={[styles.bookTitle, { fontFamily: SERIF }]}>{w.title}</Text>
            {w.indication ? <T v="callout" color="rgba(58,44,28,0.75)" center style={{ marginTop: 10 }}>{kf.indication.label} · {w.indication}</T> : null}
            <View style={styles.rule} />
            <T v="subhead" color="rgba(58,44,28,0.7)" center>{om ? `${om[1]} ${om[2]}` : w.sharedBy ? `จาก ${w.sharedBy}` : w.source}</T>
            <T v="caption" color="rgba(58,44,28,0.5)" center style={{ marginTop: 4 }}>{w.date}</T>
            <T v="caption" color="rgba(58,44,28,0.5)" center style={{ marginTop: 28 }}>ปัดซ้ายเพื่ออ่าน  ›</T>
          </View>
        ) : item.kind === 'text' ? (
          <View style={styles.textPage}>
            {item.heading ? <Text style={[styles.heading, { fontFamily: SERIF }]}>{item.heading}</Text> : null}
            <Text style={[styles.body, { fontFamily: SERIF }, w.kind === 'คาถา/พิธี' && item.heading === kf.summary.label && styles.chant]}>{item.text}</Text>
          </View>
        ) : (
          <View style={styles.textPage}>
            <Text style={[styles.heading, { fontFamily: SERIF }]}>{item.heading}</Text>
            {item.items.map((x, i) => (
              <View key={i} style={styles.li}>
                <Text style={[styles.bullet, { fontFamily: SERIF }]}>{item.numbered ? `${i + 1}.` : '•'}</Text>
                <Text style={[styles.body, { flex: 1, fontFamily: SERIF }]}>{x}</Text>
              </View>
            ))}
          </View>
        )}
        <T v="caption" color="rgba(58,44,28,0.5)" center style={styles.folio}>— {index + 1} —</T>
      </View>
    </View>
  );

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <LinearGradient colors={['#2B2117', '#1A140E']} style={StyleSheet.absoluteFill} />
      <FlatList
        data={pages}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / W))}
      />
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <GlassCircle label="ปิด" onPress={() => router.back()} tint="rgba(255,255,255,0.12)">
          <Sym name="xmark" size={17} color="#FFFFFF" weight="semibold" />
        </GlassCircle>
        <T v="subhead" color="rgba(255,255,255,0.85)" numberOfLines={1} style={{ flex: 1, textAlign: 'center', marginHorizontal: 12 }}>{w.title}</T>
        <View style={{ width: 44 }} />
      </View>
      {/* ตัวบอกหน้า */}
      <View style={[styles.dots, { bottom: insets.bottom + 18 }]}>
        <T v="caption" color="rgba(255,255,255,0.7)">หน้า {page + 1} / {pages.length}</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1A140E' },
  paper: { flex: 1, backgroundColor: PAPER, borderRadius: 6, borderTopRightRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden', boxShadow: '0px 18px 40px rgba(0,0,0,0.5)' },
  gutter: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 26 },
  titlePage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  titleKind: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(58,44,28,0.3)' },
  bookTitle: { marginTop: 18, fontSize: 30, lineHeight: 42, fontWeight: '700', color: INK, textAlign: 'center' },
  rule: { width: 60, height: 1, backgroundColor: 'rgba(58,44,28,0.35)', marginVertical: 22 },
  textPage: { flex: 1, paddingHorizontal: 30, paddingTop: 34, paddingBottom: 50 },
  heading: { fontSize: 21, fontWeight: '700', color: INK, marginBottom: 14 },
  body: { fontSize: 18.5, lineHeight: 33, color: INK },
  chant: { textAlign: 'center', fontSize: 20, lineHeight: 36 },
  li: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  bullet: { fontSize: 18.5, lineHeight: 33, color: 'rgba(58,44,28,0.7)', minWidth: 22 },
  folio: { position: 'absolute', left: 0, right: 0, bottom: 16 },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center' },
  dots: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
