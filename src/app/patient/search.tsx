/**
 * ค้นหาผู้ป่วย — เปิดจากปุ่มแว่นขยายบนหัวจอหน้าผู้ป่วย
 * แอนิเมชัน: ปุ่มวงกลม 44pt ที่มุมขวาบน ยืดออกไปทางซ้ายจนเป็นช่องค้นหาเต็มแถว แล้วเปิดคีย์บอร์ด
 * กด "ยกเลิก" → ช่องหดกลับเป็นปุ่มวงกลม แล้วปิดหน้า
 */
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from '../../components/ios';
import { Avatar, Chip, PressableScale, T } from '../../components/ui';
import { avatars, lastVisit, type Patient } from '../../data/mock';
import { statusTone } from '../../data/tones';
import { useApp } from '../../store/app';
import { control, palette } from '../../theme';

const SUGGEST = ['ปวดเข่า', 'ท้องอืด', 'หลังคลอด', 'นอนไม่หลับ', 'ความดัน'];
const STATUS: Patient['status'][] = ['นัดวันนี้', 'ติดตามอาการ', 'ส่งต่อ รพ.สต.', 'หายดี'];

/** ไฮไลต์คำที่ค้นในข้อความ */
function Hi({ text, q, v = 'body', color = ios.label, bold }: { text: string; q: string; v?: 'body' | 'caption'; color?: string; bold?: boolean }) {
  if (!q) return <T v={v} color={color} numberOfLines={1} style={bold ? { fontWeight: '600' } : undefined}>{text}</T>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <T v={v} color={color} numberOfLines={1} style={bold ? { fontWeight: '600' } : undefined}>{text}</T>;
  return (
    <T v={v} color={color} numberOfLines={1} style={bold ? { fontWeight: '600' } : undefined}>
      {text.slice(0, i)}
      <T v={v} color={palette.primary} style={{ fontWeight: '700', backgroundColor: palette.primarySoft }}>{text.slice(i, i + q.length)}</T>
      {text.slice(i + q.length)}
    </T>
  );
}

export default function PatientSearch() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { patients } = useApp();
  const input = useRef<TextInput>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Patient['status'] | null>(null);

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

  const results = useMemo(() => {
    const k = q.trim().toLowerCase();
    return patients.filter((p) => {
      if (status && p.status !== status) return false;
      if (!k) return true;
      const v = lastVisit(p);
      return [p.name, p.phone, p.chronic, v?.diagnosis, v?.symptoms, p.address.village].filter(Boolean).join(' ').toLowerCase().includes(k);
    });
  }, [patients, q, status]);
  const searching = !!q.trim() || !!status;

  return (
    <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
      {/* แถบค้นหา: ปุ่มวงกลมยืดเป็นช่องพิมพ์ */}
      <View style={styles.bar}>
        <Animated.View style={[styles.field, fieldSt]}>
          <Sym name="magnifyingglass" size={17} color={ios.secondary} />
          <Animated.View style={[{ flex: 1 }, textSt]}>
            <TextInput
              ref={input}
              value={q}
              onChangeText={setQ}
              placeholder="ชื่อ อาการ หรือเบอร์โทร"
              placeholderTextColor={ios.tertiary}
              returnKeyType="search"
              style={styles.input}
              accessibilityLabel="ค้นหาผู้ป่วย"
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 14 }}>
            {STATUS.map((s) => (
              <Chip key={s} label={s} active={status === s} onPress={() => setStatus(status === s ? null : s)} />
            ))}
          </ScrollView>

          {!searching ? (
            <Animated.View entering={FadeIn}>
              <T v="caption" color={ios.secondary} style={styles.sec}>ค้นหาบ่อย</T>
              <View style={styles.suggest}>
                {SUGGEST.map((s) => (
                  <PressableScale key={s} haptic="select" onPress={() => setQ(s)} style={styles.sItem}>
                    <Sym name="magnifyingglass" size={13} color={ios.secondary} />
                    <T v="callout">{s}</T>
                  </PressableScale>
                ))}
              </View>
              <T v="caption" color={ios.secondary} style={[styles.sec, { marginTop: 22 }]}>ผู้ป่วยทั้งหมด {patients.length} ราย</T>
            </Animated.View>
          ) : (
            <T v="caption" color={ios.secondary} style={styles.sec}>พบ {results.length} ราย</T>
          )}

          <View style={styles.group}>
            {results.map((p, i) => {
              const v = lastVisit(p);
              const st = statusTone[p.status];
              return (
                <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(i, 8) * 30).duration(220)}>
                  <PressableScale
                    scaleTo={0.99}
                    haptic="select"
                    onPress={() => {
                      Keyboard.dismiss();
                      router.replace(`/patient/${p.id}`);
                    }}
                    style={[styles.row, i < results.length - 1 && styles.sep]}
                  >
                    <Avatar name={p.name} src={avatars[p.id]} size={44} />
                    <View style={{ flex: 1 }}>
                      <Hi text={p.name} q={q.trim()} bold />
                      <Hi text={v ? v.diagnosis : 'ยังไม่มีการรักษา'} q={q.trim()} v="caption" color={ios.secondary} />
                    </View>
                    <View style={[styles.status, { backgroundColor: st.bg }]}>
                      <T v="micro" color={st.fg}>{p.status}</T>
                    </View>
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>

          {searching && !results.length ? (
            <Animated.View entering={FadeIn} style={styles.empty}>
              <Sym name="person.crop.circle.badge.questionmark" size={28} color={ios.tertiary} />
              <T v="body" style={{ fontWeight: '600', marginTop: 8 }}>ไม่พบผู้ป่วย</T>
              <T v="callout" color={ios.secondary} center>ลองค้นด้วยชื่อเล่น อาการ หรือเบอร์โทร</T>
            </Animated.View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.bg },
  bar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16, height: 52 },
  field: { height: control.icon, borderRadius: control.icon / 2, backgroundColor: '#F1F3EF', flexDirection: 'row', alignItems: 'center', paddingLeft: 13.5, paddingRight: 6, gap: 8, overflow: 'hidden' },
  input: { fontSize: 17, color: palette.ink, height: control.icon, outlineStyle: 'none' } as any,
  clear: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  cancelWrap: { position: 'absolute', right: 8 },
  cancel: { height: control.icon, paddingHorizontal: 8, justifyContent: 'center' },
  sec: { paddingHorizontal: 4, marginBottom: 8 },
  suggest: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sItem: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#F1F3EF' },
  group: { backgroundColor: palette.surface, borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 64 },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ios.separator },
  status: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 2 },
});
