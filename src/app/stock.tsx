/** คลังยาของหมอ — ยาที่ปรุงไว้ เรียงตามวันหมดอายุ · ปรับจำนวนได้ทันที · แตะเพื่อแก้ไข */
import { Stack, router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Sym, ios } from '../components/ios';
import { HeaderButton, PressableScale, T, useHaptic } from '../components/ui';
import { thShort } from '../lib/reminders';
import { stockState, useStock, type StockItem } from '../lib/stock';
import { elevation, palette } from '../theme';

const TONE = { expired: '#D2453A', out: '#D2453A', expiring: '#C27A12', low: '#C27A12', ok: '#14905C' } as const;

export default function Stock() {
  const [items, setItems] = useStock();
  const h = useHaptic();
  const sorted = [...items].sort((a, b) => {
    const order = { expired: 0, out: 1, expiring: 2, low: 3, ok: 4 };
    const d = order[stockState(a).k] - order[stockState(b).k];
    return d || (a.expiresOn ?? '9').localeCompare(b.expiresOn ?? '9');
  });
  const adjust = (s: StockItem, d: number) => {
    h.tap();
    setItems(items.map((x) => (x.id === s.id ? { ...x, qty: Math.max(0, x.qty + d) } : x)));
  };
  const warn = items.filter((s) => stockState(s).k !== 'ok').length;

  return (
    <>
      <Stack.Screen options={{ title: 'คลังยาของหมอ', headerRight: () => (<HeaderButton onPress={() => router.push('/stock-item')} label="เพิ่มยา"><Sym name="plus" size={20} color={palette.ink} weight="semibold" /></HeaderButton>) }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={styles.page}>
        {items.length ? (
          <T v="subhead" color={ios.secondary} style={{ marginHorizontal: 4 }}>
            ยา {items.length} รายการ{warn ? ` · ต้องดูแล ${warn} รายการ` : ' · พร้อมใช้ทั้งหมด'} · แอปเตือนก่อนหมดอายุ 7 วัน
          </T>
        ) : null}
        {sorted.map((s) => {
          const st = stockState(s);
          return (
            <Animated.View key={s.id} layout={LinearTransition.duration(220)} entering={FadeIn}>
              <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push({ pathname: '/stock-item', params: { id: s.id } })} style={[styles.card, elevation.e1]} accessibilityLabel={`${s.name} เหลือ ${s.qty} ${s.unit} ${st.label}`}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="bodyStrong" numberOfLines={1}>{s.name}</T>
                  <T v="caption" color={ios.secondary}>{s.form}{s.expiresOn ? ` · หมดอายุ ${thShort(s.expiresOn)}` : ''}</T>
                  <View style={[styles.badge, { backgroundColor: `${TONE[st.k]}18` }]}>
                    <View style={[styles.dot, { backgroundColor: TONE[st.k] }]} />
                    <T v="micro" color={TONE[st.k]} style={{ fontWeight: '700' }}>{st.label}</T>
                  </View>
                </View>
                <View style={styles.qty}>
                  <PressableScale haptic="select" onPress={() => adjust(s, -1)} hitSlop={6} accessibilityLabel={`ลด ${s.name}`}>
                    <Sym name="minus.circle.fill" size={30} color={s.qty ? palette.primary : ios.tertiary} />
                  </PressableScale>
                  <View style={{ minWidth: 48, alignItems: 'center' }}>
                    <T v="h3">{s.qty}</T>
                    <T v="micro" color={ios.secondary}>{s.unit}</T>
                  </View>
                  <PressableScale haptic="select" onPress={() => adjust(s, 1)} hitSlop={6} accessibilityLabel={`เพิ่ม ${s.name}`}>
                    <Sym name="plus.circle.fill" size={30} color={palette.primary} />
                  </PressableScale>
                </View>
              </PressableScale>
            </Animated.View>
          );
        })}
        {!items.length ? (
          <PressableScale haptic="press" onPress={() => router.push('/stock-item')} style={[styles.empty, elevation.e1]} accessibilityLabel="เพิ่มยาตัวแรก">
            <Sym name="cross.vial.fill" size={34} color={palette.primary} />
            <T v="bodyStrong" center>ยังไม่มียาในคลัง</T>
            <T v="subhead" color={ios.secondary} center>บันทึกยาที่ปรุงไว้ วันที่ปรุง และวันหมดอายุ{'\n'}แอปจะเตือนก่อนยาหมดอายุ และบอกเมื่อยาใกล้หมด</T>
            <View style={styles.addBtn}>
              <Sym name="plus" size={16} color="#FFFFFF" weight="bold" />
              <T v="subhead" color="#FFFFFF" style={{ fontWeight: '700' }}>เพิ่มยา</T>
            </View>
          </PressableScale>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 60, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22, backgroundColor: palette.surface },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, height: 22, borderRadius: 11, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { alignItems: 'center', gap: 10, padding: 28, borderRadius: 24, backgroundColor: palette.surface, marginTop: 20 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: palette.primary, marginTop: 6 },
});
