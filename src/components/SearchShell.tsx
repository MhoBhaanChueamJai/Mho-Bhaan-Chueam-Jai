/**
 * โครงหน้าค้นหาแบบเดียวกับ "ค้นหาผู้ป่วย" — ใช้ร่วมกับหน้าค้นหาสมุนไพร / คลังภูมิ
 * แอนิเมชัน: ปุ่มวงกลม 44pt มุมขวาบน ยืดเป็นช่องค้นหาเต็มแถวแล้วเปิดคีย์บอร์ด
 * กด "ยกเลิก" → หดกลับเป็นปุ่มวงกลม แล้วปิดหน้า
 */
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Keyboard, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeInDown, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from './ios';
import { Glass, PressableScale, T } from './ui';
import { control, elevation, palette } from '../theme';

/** ไฮไลต์คำที่ค้นในข้อความ */
export function Hi({ text, q, v = 'body', color = ios.label, bold }: { text: string; q: string; v?: 'body' | 'subhead' | 'caption'; color?: string; bold?: boolean }) {
  const st = bold ? { fontWeight: '600' as const } : undefined;
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <T v={v} color={color} numberOfLines={1} style={st}>{text}</T>;
  return (
    <T v={v} color={color} numberOfLines={1} style={st}>
      {text.slice(0, i)}
      <T v={v} color={palette.primary} style={{ fontWeight: '700', backgroundColor: palette.primarySoft }}>{text.slice(i, i + q.length)}</T>
      {text.slice(i + q.length)}
    </T>
  );
}

/** คำแนะนำ: หัวเล็ก + แถวชิป Liquid Glass เลื่อนแนวนอน (ไม่มีกรอบการ์ด) */
export function SuggestCard({ title, note, items, onPick }: { title: string; note?: React.ReactNode; items: { q: string; icon: string }[]; onPick: (q: string) => void }) {
  if (!items.length) return null;
  return (
    <View style={{ marginTop: 14 }}>
      <View style={styles.sugHead}>
        <Sym name="sparkles" size={14} color={palette.primary} />
        <T v="subhead" color={palette.primaryDeep} style={{ fontWeight: '600', flex: 1 }}>{title}</T>
        {typeof note === 'string' ? <T v="micro" color={ios.tertiary}>{note}</T> : note}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.chipScroll} contentContainerStyle={styles.chips}>
        {items.map((s, i) => (
          <Animated.View key={s.q + i} entering={FadeInDown.delay(i * 40).duration(220)}>
            <PressableScale haptic="select" scaleTo={0.95} onPress={() => onPick(s.q)} accessibilityLabel={`ค้นหา ${s.q}`} style={[styles.chipShadow, elevation.e2]}>
              <Glass interactive tint="rgba(255,255,255,0.7)" style={styles.chip}>
                <Sym name={s.icon as any} size={14} color={palette.primary} />
                <T v="callout" color={palette.primaryDeep} style={{ fontWeight: '600' }} numberOfLines={1}>{s.q}</T>
              </Glass>
            </PressableScale>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

export function SearchShell({
  q,
  setQ,
  placeholder,
  label,
  onSubmit,
  children,
}: {
  q: string;
  setQ: (v: string) => void;
  placeholder: string;
  label: string;
  onSubmit?: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const input = useRef<TextInput>(null);
  // 0 = ปุ่มวงกลม, 1 = ช่องค้นหาเต็มแถว
  const open = useSharedValue(0);
  const PAD = 16;
  const CANCEL = 64;
  const full = width - PAD * 2 - CANCEL;

  useEffect(() => {
    open.value = withSpring(1, { damping: 18, stiffness: 160, mass: 0.8 });
    const t = setTimeout(() => input.current?.focus(), 260);
    return () => clearTimeout(t);
  }, [open]);

  const close = () => {
    Keyboard.dismiss();
    open.value = withTiming(0, { duration: 260, easing: Easing.inOut(Easing.cubic) }, (done) => {
      if (done) runOnJS(router.back)();
    });
  };

  const fieldSt = useAnimatedStyle(() => ({
    width: interpolate(open.value, [0, 1], [control.icon, full]),
    marginRight: interpolate(open.value, [0, 1], [0, CANCEL]),
  }));
  const textSt = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0.5, 1], [0, 1], 'clamp') }));
  const cancelSt = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0.6, 1], [0, 1], 'clamp'), transform: [{ translateX: interpolate(open.value, [0, 1], [24, 0]) }] }));
  const bodySt = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0.3, 1], [0, 1], 'clamp'), transform: [{ translateY: interpolate(open.value, [0, 1], [12, 0]) }] }));

  return (
    <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
      <View style={styles.bar}>
        <Animated.View style={[styles.field, elevation.e2, fieldSt]}>
          <Sym name="magnifyingglass" size={17} color={ios.secondary} />
          <Animated.View style={[{ flex: 1 }, textSt]}>
            <TextInput
              ref={input}
              value={q}
              onChangeText={setQ}
              placeholder={placeholder}
              placeholderTextColor={ios.tertiary}
              returnKeyType="search"
              onSubmitEditing={onSubmit}
              style={styles.input}
              accessibilityLabel={label}
            />
          </Animated.View>
          {q ? (
            <PressableScale haptic="select" onPress={() => setQ('')} style={styles.clear} accessibilityLabel="ล้าง">
              <Sym name="xmark.circle.fill" size={17} color={ios.tertiary} />
            </PressableScale>
          ) : null}
        </Animated.View>
        <Animated.View style={[styles.cancelWrap, cancelSt]}>
          <PressableScale haptic="select" onPress={close} style={styles.cancel} accessibilityLabel="ยกเลิก">
            <T v="body" color={palette.primary}>ยกเลิก</T>
          </PressableScale>
        </Animated.View>
      </View>

      <Animated.View style={[{ flex: 1 }, bodySt]}>
        <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/** ปุ่มแว่นขยายวงกลมบนหัวหน้า (ตำแหน่งเดียวกับจุดเริ่มแอนิเมชัน) */
export function SearchButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <PressableScale haptic="select" onPress={onPress} style={[styles.btn, elevation.e2]} accessibilityLabel={label}>
      <Sym name="magnifyingglass" size={19} color={palette.primary} weight="semibold" />
    </PressableScale>
  );
}

export const searchStyles = StyleSheet.create({
  sec: { paddingHorizontal: 4, marginBottom: 8, marginTop: 16 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 20, borderCurve: 'continuous', padding: 10, paddingRight: 14 },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.bg },
  bar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16, height: 52 },
  field: { height: control.icon, borderRadius: control.icon / 2, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingLeft: 13.5, paddingRight: 6, gap: 8 },
  input: { fontSize: 17, color: palette.ink, height: control.icon, outlineStyle: 'none' } as any,
  clear: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  cancelWrap: { position: 'absolute', right: 8 },
  cancel: { height: control.icon, paddingHorizontal: 8, justifyContent: 'center' },
  sugHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginBottom: 8 },
  // ScrollView แนวนอนตัดทุกอย่างที่ล้นขอบ → เผื่อพื้นที่ให้เงา e2 (บน ~12, ล่าง ~28) แล้วดึงระยะกลับด้วย margin ติดลบ
  chipScroll: { marginHorizontal: -16, marginTop: -12, marginBottom: -24 },
  chips: { gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  chipShadow: { borderRadius: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.9)' },
  btn: { width: control.icon, height: control.icon, borderRadius: control.icon / 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
