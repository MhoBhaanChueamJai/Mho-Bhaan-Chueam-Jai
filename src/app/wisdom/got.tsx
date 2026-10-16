/**
 * รับตำราจากรหัส/คิวอาร์ — Sheet ของ iOS (แบบหน้า "กิจกรรมใหม่" ในแอปปฏิทิน iOS 26)
 * แถบบน: ปุ่มกระจก ✕ (ปิด) · ชื่อหน้า · ✓ (เพิ่มลงคลัง)
 * เนื้อหาแบบ inset grouped บนพื้นเทา: ปก+ชื่อ · ข้อมูล (ประเภท ผู้เพิ่ม ใช้แก้ ตัวยา) · เนื้อหา 5 บรรทัด
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '../../components/BookCover';
import { KindIcon } from '../../components/KindIcon';
import { Sym, ios } from '../../components/ios';
import { GlassCircle, T, useHaptic } from '../../components/ui';
import type { Wisdom } from '../../data/mock';
import { KIND_FORM, plainText } from '../../lib/wisdomKinds';
import { cachedShare, cleanCode, fetchShare, type ReceivedShare } from '../../lib/wisdomShare';
import { useApp } from '../../store/app';
import { palette } from '../../theme';

const GROUPED_BG = '#F2F2F7';

function InfoRow({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowSep]}>
      <View style={styles.rowIcon}>{icon}</View>
      <T v="body">{label}</T>
      <T v="body" color={ios.secondary} numberOfLines={2} style={styles.rowValue}>{value}</T>
    </View>
  );
}

export default function GotWisdom() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = cleanCode(raw ?? '');
  const insets = useSafeAreaInsets();
  // ความสูงชัดเจน (ไม่พึ่ง flex:1) — Sheet ของ iOS บางครั้งวัดความสูงเนื้อหาเป็น 0 ทำให้หน้าว่าง
  const { height: SH } = useWindowDimensions();
  const sheetH = SH - insets.top - 10;
  const { addWisdom, wisdoms } = useApp();
  const h = useHaptic();
  const [got, setGot] = useState<ReceivedShare | null>(() => cachedShare(code));
  const [err, setErr] = useState('');

  useEffect(() => {
    if (got || !code) return;
    fetchShare(code)
      .then((r) => (r ? setGot(r) : setErr('ไม่พบตำราจากรหัสนี้ หรือรหัสหมดอายุแล้ว')))
      .catch(() => setErr('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'));
  }, [code, got]);

  /** ✓ = เพิ่มลงคลัง แล้วปิดแผ่น เปิดตำราเล่มนั้นให้ดู */
  const save = () => {
    if (!got) return;
    const t = new Date();
    const id = `w${Date.now()}`;
    addWisdom({
      ...got.wisdom,
      id,
      source: 'เพื่อนแชร์',
      sharedBy: got.fromName,
      shareCode: code,
      date: `${t.getDate()}/${t.getMonth() + 1}/${t.getFullYear() + 543}`,
      summary: got.wisdom.summary ?? '',
      verified: false,
    });
    h.success();
    router.dismissAll();
    setTimeout(() => router.push(`/wisdom/${id}`), 60);
  };

  const w = got?.wisdom;
  const kf = w ? (KIND_FORM[w.kind] ?? KIND_FORM['ตำรับยา']) : null;
  const preview = w ? ({ ...w, id: 'preview', source: 'เพื่อนแชร์', date: '', verified: true, summary: w.summary ?? '' } as Wisdom) : null;
  const dup = !!w && wisdoms.some((x) => x.title === w.title && x.sharedBy === got?.fromName);
  const body = w ? plainText(w.summary).replace(/\n*(ได้รับสืบทอดจาก|แหล่งที่มา):.*$/, '').trim() : '';
  const ingCount = (w?.ingredients ?? []).filter((x) => !/^\s*\(/.test(x)).length;

  return (
    <View style={[styles.page, { height: sheetH }]}>
      {/* แถบบน: ✕ · ชื่อ · ✓ (ปุ่มกระจกแบบ iOS 26) */}
      <View style={styles.bar}>
        <GlassCircle label="ปิด" onPress={() => router.back()} size={48}>
          <Sym name="xmark" size={18} color={palette.ink} weight="semibold" />
        </GlassCircle>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T v="title" numberOfLines={1}>รับตำรา</T>
          {code ? <T v="caption" color={ios.secondary}>{code.slice(0, 4)}-{code.slice(4)}</T> : null}
        </View>
        <GlassCircle label="เพิ่มลงคลัง" onPress={got ? save : undefined} size={48} tint={got ? palette.primary : undefined}>
          <Sym name="checkmark" size={19} color={got ? '#FFFFFF' : ios.tertiary} weight="bold" />
        </GlassCircle>
      </View>

      {err ? (
        <View style={styles.center}>
          <Sym name="exclamationmark.circle.fill" size={40} color={palette.coral} />
          <T v="title" center style={{ marginTop: 12 }}>{err}</T>
        </View>
      ) : !got || !w || !preview || !kf ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {/* ปก + ชื่อ */}
          <View style={[styles.group, styles.hero]}>
            <BookCover w={preview} width={112} />
            <T v="h2" center numberOfLines={3} style={{ marginTop: 16 }}>{w.title}</T>
            {dup ? (
              <View style={styles.dup}>
                <Sym name="checkmark.circle.fill" size={13} color={palette.primaryDeep} />
                <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '600' }}>มีในคลังแล้ว · กด ✓ เพื่อเพิ่มอีกครั้ง</T>
              </View>
            ) : null}
          </View>

          {/* ข้อมูล */}
          <T v="subhead" color={ios.secondary} style={styles.groupLabel}>ข้อมูล</T>
          <View style={styles.group}>
            <InfoRow icon={<KindIcon kind={w.kind} size={17} color={palette.primary} />} label="ประเภท" value={w.kind} />
            <InfoRow icon={<Sym name="person.crop.circle" size={18} color={palette.primary} />} label="เพิ่มโดย" value={got.fromName} last={!w.indication && !ingCount} />
            {w.indication ? <InfoRow icon={<Sym name="cross.case" size={17} color={palette.primary} />} label={kf.indication.label} value={w.indication} last={!ingCount} /> : null}
            {ingCount ? <InfoRow icon={<Sym name="leaf" size={17} color={palette.primary} />} label={kf.ingredients?.label ?? 'ตัวยา'} value={`${ingCount} รายการ`} last /> : null}
          </View>

          {/* เนื้อหา */}
          {body ? (
            <>
              <T v="subhead" color={ios.secondary} style={styles.groupLabel}>เนื้อหา</T>
              <View style={[styles.group, { padding: 16 }]}>
                <T v="body" color={palette.inkSoft} numberOfLines={5}>{body}</T>
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: GROUPED_BG },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  group: { backgroundColor: '#FFFFFF', borderRadius: 26, borderCurve: 'continuous', overflow: 'hidden' },
  hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  dup: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: palette.primarySoft },
  groupLabel: { marginTop: 24, marginBottom: 8, marginLeft: 20, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 16, paddingVertical: 12 },
  rowSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ios.separator },
  rowIcon: { width: 24, alignItems: 'center' },
  rowValue: { flex: 1, textAlign: 'right' },
});
