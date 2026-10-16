/**
 * แผ่นล่างแบบ iOS (formSheet) — ตัวอย่างตำราที่ได้จากรหัส/คิวอาร์ (เปิดจากหน้าสแกนรับตำรา)
 * ปกหนังสือ · ชื่อ · ผู้แชร์ · ประเภท · เนื้อหาไม่เกิน 5 บรรทัด · ปุ่มเพิ่มลงคลัง
 * ความสูงพอดีเนื้อหา (sheetAllowedDetents: fitToContents) ดึงลงเพื่อปิด
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '../../components/BookCover';
import { KindIcon } from '../../components/KindIcon';
import { Sym } from '../../components/ios';
import { Button, T, useHaptic } from '../../components/ui';
import type { Wisdom } from '../../data/mock';
import { plainText } from '../../lib/wisdomKinds';
import { cachedShare, cleanCode, fetchShare, type ReceivedShare } from '../../lib/wisdomShare';
import { useApp } from '../../store/app';
import { palette } from '../../theme';

export default function GotWisdom() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = cleanCode(raw ?? '');
  const insets = useSafeAreaInsets();
  const { addWisdom, wisdoms } = useApp();
  const h = useHaptic();
  const [got, setGot] = useState<ReceivedShare | null>(() => cachedShare(code));
  const [err, setErr] = useState('');
  const [savedId, setSavedId] = useState('');

  useEffect(() => {
    if (got || !code) return;
    fetchShare(code)
      .then((r) => (r ? setGot(r) : setErr('ไม่พบตำราจากรหัสนี้ หรือรหัสหมดอายุแล้ว')))
      .catch(() => setErr('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'));
  }, [code, got]);

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
    setSavedId(id);
  };
  const openSaved = () => {
    router.dismissAll();
    setTimeout(() => router.push(`/wisdom/${savedId}`), 50);
  };

  const pad = { paddingBottom: insets.bottom + 12 };
  if (err) {
    return (
      <View style={[styles.page, styles.center, pad]}>
        <Sym name="exclamationmark.circle.fill" size={30} color={palette.coral} />
        <T v="title" center style={{ marginTop: 10 }}>{err}</T>
        <Button kind="secondary" label="ลองรหัสอื่น" onPress={() => router.back()} style={{ alignSelf: 'stretch', height: 52, marginTop: 18 }} />
      </View>
    );
  }
  if (!got) {
    return (
      <View style={[styles.page, styles.center, pad]}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  const w = got.wisdom;
  const preview = { ...w, id: 'preview', source: 'เพื่อนแชร์', date: '', verified: true, summary: w.summary ?? '' } as Wisdom;
  const dup = wisdoms.some((x) => x.title === w.title && x.sharedBy === got.fromName);
  const body = plainText(w.summary).replace(/\n*(ได้รับสืบทอดจาก|แหล่งที่มา):.*$/, '').trim();
  return (
    <View style={[styles.page, pad]}>
      <View style={styles.head}>
        <BookCover w={preview} width={92} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={styles.kindPill}>
            <KindIcon kind={w.kind} size={12} color={palette.primaryDeep} />
            <T v="caption" color={palette.primaryDeep} style={{ fontWeight: '700' }}>{w.kind}</T>
          </View>
          <T v="h3" numberOfLines={3}>{w.title}</T>
          <View style={styles.byRow}>
            <Sym name="person.crop.circle.fill" size={14} color={palette.inkSoft} />
            <T v="subhead" color={palette.inkSoft} numberOfLines={1} style={{ flex: 1 }}>เพิ่มโดย {got.fromName}</T>
          </View>
        </View>
      </View>
      {body ? (
        <T v="body" color={palette.inkSoft} numberOfLines={5} style={{ marginTop: 16 }}>{body}</T>
      ) : null}
      {savedId ? (
        <Button label="เปิดดูในคลัง" icon={<Sym name="book.fill" size={17} color="#FFFFFF" />} onPress={openSaved} style={styles.btn} />
      ) : (
        <Button label={dup ? 'มีในคลังแล้ว · เพิ่มอีกครั้ง' : 'เพิ่มลงคลัง'} icon={<Sym name="plus" size={17} color="#FFFFFF" weight="semibold" />} onPress={save} style={styles.btn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: palette.surface, paddingHorizontal: 20, paddingTop: 28 },
  center: { alignItems: 'center', paddingVertical: 36 },
  head: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  kindPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: palette.primarySoft },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  btn: { height: 52, marginTop: 18 },
});
