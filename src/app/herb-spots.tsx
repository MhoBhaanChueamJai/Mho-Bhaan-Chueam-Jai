/**
 * แหล่งสมุนไพรในชุมชน — ปักหมุดว่าต้นไหนขึ้นที่ไหน เก็บได้ช่วงไหน · นำทาง · แชร์รายการให้ลูกศิษย์
 * เก็บในเครื่อง + สำรองเป็นไฟล์ส่วนตัวบนคลาวด์ (ไม่ต้องใช้เซิร์ฟเวอร์ AI)
 */
import * as Location from 'expo-location';
import { Stack } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { TextInput } from '../components/AppText';
import { TileMap } from '../components/TileMap';
import { Sym, ios } from '../components/ios';
import { Button, HeaderButton, PressableScale, T, useHaptic } from '../components/ui';
import { herbs } from '../data/herbs';
import { Alert } from '../lib/alert';
import { useItems } from '../lib/userStore';
import { elevation, palette } from '../theme';

type Spot = { id: string; herb: string; lat: number; lon: number; note?: string; season: string; at: number };
const SEASONS = ['ตลอดปี', 'ฤดูร้อน', 'ฤดูฝน', 'ฤดูหนาว'];
const FALLBACK = { lat: 13.7563, lon: 100.5018 };
const mapsLink = (s: Spot) => `https://maps.google.com/?q=${s.lat.toFixed(6)},${s.lon.toFixed(6)}`;

export default function HerbSpots() {
  const [spots, setSpots] = useItems<Spot>('herbspots');
  const h = useHaptic();
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [pick, setPick] = useState<{ lat: number; lon: number } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [herb, setHerb] = useState('');
  const [note, setNote] = useState('');
  const [season, setSeason] = useState(SEASONS[0]);

  // เริ่มที่ตำแหน่งปัจจุบัน → หมุดล่าสุด → กรุงเทพฯ
  useEffect(() => {
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          const p = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
          if (p) return setCenter({ lat: p.coords.latitude, lon: p.coords.longitude });
        }
      } catch {}
      setCenter(spots[0] ? { lat: spots[0].lat, lon: spots[0].lon } : FALLBACK);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggest = useMemo(() => {
    const q = herb.trim();
    if (!q || herbs.some((x) => x.name === q)) return [];
    return herbs.filter((x) => x.name.includes(q) || x.local.includes(q)).slice(0, 6);
  }, [herb]);
  const cur = spots.find((s) => s.id === sel);

  const startAdd = (lat: number, lon: number) => {
    setSel(null);
    setPick({ lat, lon });
    h.tap();
  };
  const save = () => {
    if (!pick || !herb.trim()) return;
    setSpots([{ id: `h${Date.now()}`, herb: herb.trim(), lat: pick.lat, lon: pick.lon, note: note.trim() || undefined, season, at: Date.now() }, ...spots]);
    setPick(null);
    setHerb('');
    setNote('');
    setSeason(SEASONS[0]);
    h.success();
  };
  const remove = (s: Spot) =>
    Alert.alert(`ลบหมุด ${s.herb}?`, undefined, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: () => (setSpots(spots.filter((x) => x.id !== s.id)), setSel(null)) },
    ]);
  const navigate = (s: Spot) => Linking.openURL(Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${s.lat},${s.lon}` : mapsLink(s)).catch(() => {});
  const shareAll = () =>
    Share.share({ message: `แหล่งสมุนไพรในชุมชน (${spots.length} จุด)\n\n${spots.map((s) => `• ${s.herb} — ${s.season}${s.note ? ` · ${s.note}` : ''}\n  ${mapsLink(s)}`).join('\n')}` }).catch(() => {});
  const hereNow = async () => {
    try {
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      startAdd(p.coords.latitude, p.coords.longitude);
      setCenter({ lat: p.coords.latitude, lon: p.coords.longitude });
    } catch {
      Alert.alert('หาตำแหน่งไม่ได้', 'เปิดการเข้าถึงตำแหน่งในการตั้งค่าเครื่อง หรือแตะบนแผนที่ตรงจุดที่ต้นสมุนไพรอยู่แทน');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'แหล่งสมุนไพร', headerRight: spots.length ? () => (<HeaderButton onPress={shareAll} label="แชร์ให้ลูกศิษย์"><Sym name="square.and.arrow.up" size={19} color={palette.ink} /></HeaderButton>) : undefined }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          {center ? (
            <TileMap
              key={`${center.lat},${center.lon}`}
              center={center}
              pins={spots.map((s) => ({ id: s.id, lat: s.lat, lon: s.lon, selected: s.id === sel }))}
              marker={pick}
              onPress={startAdd}
              onPinPress={(id) => (setPick(null), setSel(id))}
            />
          ) : (
            <View style={[styles.mapWait, elevation.e1]}>
              <T v="subhead" color={ios.secondary}>กำลังหาตำแหน่ง…</T>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PressableScale haptic="select" onPress={hereNow} style={[styles.pillBtn, elevation.e1]} accessibilityLabel="ปักหมุดตรงที่ยืนอยู่">
              <Sym name="location.fill" size={15} color={palette.primary} />
              <T v="subhead" color={palette.primary} style={{ fontWeight: '700' }}>ปักหมุดตรงที่ยืนอยู่</T>
            </PressableScale>
          </View>
          <T v="caption" color={ios.tertiary} style={{ marginHorizontal: 4 }}>แตะบนแผนที่ตรงจุดที่ต้นสมุนไพรขึ้น เพื่อปักหมุด · ลากเพื่อเลื่อนแผนที่</T>

          {pick ? (
            <Animated.View entering={FadeInDown} style={[styles.card, elevation.e1]}>
              <T v="bodyStrong">ปักหมุดสมุนไพร</T>
              <TextInput value={herb} onChangeText={setHerb} placeholder="ชื่อสมุนไพร เช่น ฟ้าทะลายโจร" placeholderTextColor={ios.tertiary} style={styles.input} accessibilityLabel="ชื่อสมุนไพร" />
              {suggest.length ? (
                <View style={styles.chips}>
                  {suggest.map((x) => (
                    <PressableScale key={x.id} haptic="select" onPress={() => setHerb(x.name)} style={[styles.chip, { height: 34 }]}>
                      <T v="caption" style={{ fontWeight: '600' }}>{x.name}</T>
                    </PressableScale>
                  ))}
                </View>
              ) : null}
              <View style={styles.chips}>
                {SEASONS.map((x) => {
                  const on = season === x;
                  return (
                    <PressableScale key={x} haptic="select" onPress={() => setSeason(x)} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: on }}>
                      <T v="subhead" color={on ? '#FFFFFF' : palette.ink} style={{ fontWeight: '600' }}>{x}</T>
                    </PressableScale>
                  );
                })}
              </View>
              <TextInput value={note} onChangeText={setNote} placeholder="หมายเหตุ เช่น ข้างศาลาวัด ต้นใหญ่ ขออนุญาตเจ้าของก่อนเก็บ" placeholderTextColor={ios.tertiary} style={styles.input} accessibilityLabel="หมายเหตุ" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="ยกเลิก" kind="secondary" onPress={() => setPick(null)} style={{ flex: 1, height: 48 }} />
                <Button label="บันทึกหมุด" disabled={!herb.trim()} onPress={save} style={{ flex: 1, height: 48 }} />
              </View>
            </Animated.View>
          ) : null}

          {cur ? (
            <Animated.View entering={FadeIn} style={[styles.card, elevation.e1]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Sym name="leaf.fill" size={18} color={palette.primary} />
                <T v="h3" style={{ flex: 1 }}>{cur.herb}</T>
                <PressableScale haptic="select" onPress={() => setSel(null)} hitSlop={8} accessibilityLabel="ปิด">
                  <Sym name="xmark" size={16} color={ios.secondary} />
                </PressableScale>
              </View>
              <T v="subhead" color={ios.secondary}>เก็บได้: {cur.season}{cur.note ? ` · ${cur.note}` : ''}</T>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="นำทาง" icon={<Sym name="location.fill" size={15} color="#FFFFFF" />} onPress={() => navigate(cur)} style={{ flex: 1, height: 46 }} />
                <Button label="ลบหมุด" kind="secondary" onPress={() => remove(cur)} style={{ flex: 1, height: 46 }} />
              </View>
            </Animated.View>
          ) : null}

          {spots.length ? (
            <View style={[styles.card, elevation.e1, { gap: 0, paddingVertical: 6 }]}>
              {spots.map((s, i) => (
                <PressableScale key={s.id} haptic="select" onPress={() => (setPick(null), setSel(s.id), setCenter({ lat: s.lat, lon: s.lon }))} style={[styles.row, i > 0 && styles.sep]} accessibilityLabel={`${s.herb} ${s.season}`}>
                  <Sym name="mappin.circle.fill" size={24} color={palette.primary} />
                  <View style={{ flex: 1 }}>
                    <T v="body" style={{ fontWeight: '600' }}>{s.herb}</T>
                    <T v="caption" color={ios.secondary} numberOfLines={1}>{s.season}{s.note ? ` · ${s.note}` : ''}</T>
                  </View>
                  <Sym name="chevron.right" size={13} color={ios.tertiary} />
                </PressableScale>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 60, gap: 12 },
  mapWait: { height: 300, borderRadius: 22, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 16, borderRadius: 21, backgroundColor: palette.surface },
  card: { padding: 16, borderRadius: 22, backgroundColor: palette.surface, gap: 12 },
  input: { height: 50, borderRadius: 25, paddingHorizontal: 18, backgroundColor: palette.mint, fontSize: 17, color: palette.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: palette.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
});
