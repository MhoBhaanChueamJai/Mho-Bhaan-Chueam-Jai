/**
 * ปฏิทินป๊อปโอเวอร์แบบ UIDatePicker (compact → inline) ของ iOS 26 สำหรับ Android / เว็บ
 * - แผ่นกระจก 318×330 เปิดใต้ช่องวันที่ (ล้นจอ → เปิดด้านบน) ขยายออกจากช่องแบบสปริง · แตะนอกแผ่นเพื่อปิด
 * - หัว: "เดือน ปี(พ.ศ.) ›" (แตะ = สลับเป็นวงล้อเลือกเดือน/ปี) · ปุ่ม ‹ › เปลี่ยนเดือน
 * - วันที่เลือก = วงกลมเขียวอ่อน ตัวเขียวหนา · วันนี้ = ตัวเขียว · เกินวันสูงสุด = จาง กดไม่ได้
 */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Sym } from './ios';
import { Glass, PressableScale, T, useHaptic } from './ui';
import { palette } from '../theme';

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const WD = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const W = 318, H = 330, CELL = 38, WHEEL = 34;
const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function DatePopover({ anchor, value, onChange, onClose, max, min }: { anchor: { x: number; y: number; w: number; h: number } | null; value: Date; onChange: (d: Date) => void; onClose: () => void; max?: Date; min?: Date }) {
  const { width: SW, height: SH } = useWindowDimensions();
  const h = useHaptic();
  const [view, setView] = useState({ y: value.getFullYear(), m: value.getMonth() });
  const [wheel, setWheel] = useState(false);
  const p = useSharedValue(0);
  useEffect(() => {
    if (!anchor) return;
    setView({ y: value.getFullYear(), m: value.getMonth() });
    setWheel(false);
    p.value = 0;
    p.value = withSpring(1, { damping: 20, stiffness: 260, mass: 0.7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);
  const close = () => {
    p.value = withTiming(0, { duration: 150 });
    setTimeout(onClose, 140);
  };
  const st = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 1.6), transform: [{ scale: 0.4 + 0.6 * p.value }] }));
  if (!anchor) return null;

  const below = anchor.y + anchor.h + 8 + H < SH - 20;
  const left = Math.max(12, Math.min(SW - W - 12, anchor.x - 16));
  const top = below ? anchor.y + anchor.h + 8 : Math.max(20, anchor.y - 8 - H);
  const today = new Date();
  const first = new Date(view.y, view.m, 1).getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const shift = (d: number) => {
    h.select();
    const n = new Date(view.y, view.m + d, 1);
    setView({ y: n.getFullYear(), m: n.getMonth() });
  };
  const ok = (d: Date) => (!max || d <= max) && (!min || d >= min);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      <Animated.View style={[styles.shadow, { left, top, transformOrigin: `${anchor.x - left + 40}px ${below ? 0 : H}px` }, st]}>
        <Glass tint="rgba(250,252,251,0.86)" style={styles.panel}>
          <View style={styles.head}>
            <PressableScale haptic="select" scaleTo={0.96} onPress={() => setWheel((w) => !w)} style={styles.title} accessibilityLabel="เลือกเดือนและปี">
              <T v="bodyStrong" style={{ fontWeight: '700' }}>{`${TH_MONTHS[view.m]} ${view.y + 543}`}</T>
              <Sym name={wheel ? 'chevron.down' : 'chevron.right'} size={14} color={palette.primary} weight="bold" />
            </PressableScale>
            {wheel ? null : (
              <View style={{ flexDirection: 'row', gap: 18 }}>
                <PressableScale haptic="none" scaleTo={0.85} onPress={() => shift(-1)} accessibilityLabel="เดือนก่อน" style={styles.nav}>
                  <Sym name="chevron.left" size={20} color="#111813" weight="semibold" />
                </PressableScale>
                <PressableScale haptic="none" scaleTo={0.85} onPress={() => shift(1)} accessibilityLabel="เดือนถัดไป" style={styles.nav}>
                  <Sym name="chevron.right" size={20} color="#111813" weight="semibold" />
                </PressableScale>
              </View>
            )}
          </View>
          {wheel ? (
            <Wheels view={view} onPick={(y, m) => setView({ y, m })} onDone={() => setWheel(false)} min={min?.getFullYear() ?? 1900} max={max?.getFullYear() ?? today.getFullYear() + 10} />
          ) : (
            <>
              <View style={styles.row}>
                {WD.map((w) => (
                  <T key={w} v="micro" color="rgba(60,60,67,0.32)" center style={styles.cell}>{w}</T>
                ))}
              </View>
              <View style={[styles.row, { flexWrap: 'wrap' }]}>
                {cells.map((d, i) => {
                  if (!d) return <View key={`e${i}`} style={styles.cell} />;
                  const date = new Date(view.y, view.m, d);
                  const sel = same(date, value);
                  const isToday = same(date, today);
                  const can = ok(date);
                  return (
                    <Pressable
                      key={d}
                      disabled={!can}
                      onPress={() => {
                        h.select();
                        onChange(date);
                      }}
                      style={styles.cell}
                      accessibilityLabel={`${d} ${TH_MONTHS[view.m]} ${view.y + 543}`}
                    >
                      <View style={[styles.day, sel && { backgroundColor: 'rgba(20,144,92,0.14)' }]}>
                        <T v="body" color={!can ? 'rgba(60,60,67,0.26)' : sel || isToday ? palette.primary : '#111813'} style={{ fontSize: 20, lineHeight: 26, fontWeight: sel ? '600' : '400' }}>{d}</T>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </Glass>
      </Animated.View>
    </Modal>
  );
}

/** วงล้อเลือกเดือน + ปี (แบบ UIPickerView): เลื่อนแล้วล็อกแถว แถบเน้นตรงกลาง */
function Wheels({ view, onPick, onDone, min, max }: { view: { y: number; m: number }; onPick: (y: number, m: number) => void; onDone: () => void; min: number; max: number }) {
  const years = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const mRef = useRef<ScrollView>(null);
  const yRef = useRef<ScrollView>(null);
  useEffect(() => {
    setTimeout(() => {
      mRef.current?.scrollTo({ y: view.m * WHEEL, animated: false });
      yRef.current?.scrollTo({ y: (view.y - min) * WHEEL, animated: false });
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // เว็บ: เลื่อนด้วยเมาส์/แทร็กแพดไม่มี onMomentumScrollEnd / onScrollEndDrag → เลือกเมื่อหยุดเลื่อน 120ms แล้วจัดแถวให้ตรงแถบ
  const idle = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => () => Object.values(idle.current).forEach(clearTimeout), []);
  const col = (key: string, ref: React.RefObject<ScrollView | null>, items: string[], sel: number, pick: (i: number) => void, flex: number) => {
    const pickIdx = (i: number) => pick(Math.max(0, Math.min(items.length - 1, i)));
    const settle = (y: number) => {
      const i = Math.max(0, Math.min(items.length - 1, Math.round(y / WHEEL)));
      if (Platform.OS === 'web') ref.current?.scrollTo({ y: i * WHEEL, animated: true });
      pick(i);
    };
    return (
      <ScrollView
        ref={ref}
        style={{ flex }}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: WHEEL * 2 }}
        scrollEventThrottle={16}
        onScroll={(e) => {
          if (Platform.OS !== 'web') return;
          const y = e.nativeEvent.contentOffset.y;
          clearTimeout(idle.current[key]);
          idle.current[key] = setTimeout(() => settle(y), 120);
        }}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => settle(e.nativeEvent.contentOffset.y)}
      >
        {items.map((t, i) => (
          // แตะแถว = เลือกแล้วกลับไปหน้าปฏิทินเลือกวันทันที
          <Pressable
            key={t}
            style={styles.wheelRow}
            onPress={() => {
              clearTimeout(idle.current[key]);
              pickIdx(i);
              onDone();
            }} accessibilityRole="button" accessibilityLabel={t}>
            <T v="body" color={i === sel ? '#111813' : 'rgba(60,60,67,0.4)'} style={{ fontSize: 21, lineHeight: 27 }}>{t}</T>
          </Pressable>
        ))}
      </ScrollView>
    );
  };
  return (
    <>
      <View style={styles.wheels}>
        <View pointerEvents="none" style={styles.band} />
        {col('m', mRef, TH_MONTHS, view.m, (i) => onPick(view.y, Math.max(0, Math.min(11, i))), 1.4)}
        {col('y', yRef, years.map((y) => String(y + 543)), view.y - min, (i) => onPick(years[Math.max(0, Math.min(years.length - 1, i))], view.m), 1)}
      </View>
      {/* เลื่อนวงล้อแล้ว → กดตกลงเพื่อไปเลือกวัน */}
      <PressableScale haptic="select" scaleTo={0.94} onPress={onDone} style={styles.done} accessibilityRole="button" accessibilityLabel="ตกลง ไปเลือกวัน">
        <T v="callout" color={palette.primary} style={{ fontWeight: '600' }}>ตกลง</T>
      </PressableScale>
    </>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', width: W, height: H, borderRadius: 26, boxShadow: '0px 18px 50px rgba(0,0,0,0.16), 0px 2px 8px rgba(0,0,0,0.06)' },
  panel: { flex: 1, borderRadius: 26, paddingHorizontal: 12, paddingTop: 10 },
  head: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, paddingRight: 6 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40 },
  nav: { width: 30, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  cell: { width: (W - 24) / 7, height: CELL, alignItems: 'center', justifyContent: 'center' },
  day: { width: 40, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  wheels: { height: WHEEL * 5, flexDirection: 'row', marginTop: 14, overflow: 'hidden' },
  done: { alignSelf: 'flex-end', height: 44, paddingHorizontal: 14, justifyContent: 'center', marginTop: 6 },
  band: { position: 'absolute', left: 4, right: 4, top: WHEEL * 2, height: WHEEL, borderRadius: 9, backgroundColor: 'rgba(120,120,128,0.12)' },
  wheelRow: { height: WHEEL, alignItems: 'center', justifyContent: 'center' },
});
