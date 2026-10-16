/**
 * รับตำราจากรหัส/คิวอาร์ — Sheet ของ iOS ที่หน้าตาเหมือนหน้ารายละเอียดในคลังภูมิ
 * (พื้นหลังปกเบลอ · ปกหนังสือ · ทุกหัวข้อ) + ปุ่มปิดบนซ้าย + แถบลอยด้านล่าง "เพิ่มลงคลัง"
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym } from '../../components/ios';
import { GlassCircle, T, useHaptic } from '../../components/ui';
import type { Wisdom } from '../../data/mock';
import { cachedShare, cleanCode, fetchShare, type ReceivedShare } from '../../lib/wisdomShare';
import { useApp } from '../../store/app';
import { palette } from '../../theme';
import { WisdomView } from './[id]';

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
  const [savedId, setSavedId] = useState('');

  useEffect(() => {
    if (got || !code) return;
    fetchShare(code)
      .then((r) => (r ? setGot(r) : setErr('ไม่พบตำราจากรหัสนี้ หรือรหัสหมดอายุแล้ว')))
      .catch(() => setErr('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'));
  }, [code, got]);

  const add = () => {
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
  const open = () => {
    router.dismissAll();
    setTimeout(() => router.push(`/wisdom/${savedId}`), 60);
  };

  if (!got) {
    return (
      <View style={[styles.wait, { height: sheetH }]}>
        <View style={styles.close}>
          <GlassCircle label="ปิด" onPress={() => router.back()} size={44}>
            <Sym name="xmark" size={17} color={palette.ink} weight="semibold" />
          </GlassCircle>
        </View>
        {err ? (
          <>
            <Sym name="exclamationmark.circle.fill" size={40} color={palette.coral} />
            <T v="title" center style={{ marginTop: 12 }}>{err}</T>
          </>
        ) : (
          <ActivityIndicator color={palette.primary} />
        )}
      </View>
    );
  }

  const w: Wisdom = { ...got.wisdom, id: `preview-${code}`, source: 'เพื่อนแชร์', sharedBy: got.fromName, date: '', verified: true, summary: got.wisdom.summary ?? '' };
  const dup = wisdoms.some((x) => x.title === w.title && x.sharedBy === got.fromName);
  return (
    <View style={{ height: sheetH, backgroundColor: palette.bg }}>
      <WisdomView w={w} preview={{ onClose: () => router.back(), onAdd: add, onOpen: open, added: !!savedId, dup }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wait: { backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  close: { position: 'absolute', top: 16, left: 16 },
});
