/**
 * แถบแท็บลอยแบบ iOS 26 สำหรับ Android / เว็บ (iOS ใช้ NativeTabs ของระบบ)
 * - แคปซูลกระจก 4 แท็บ + วงกลมกระจกแยกทางขวาสำหรับ "ครูปัญญา" (role search ของ iOS)
 * - แคปซูลไฮไลต์เลื่อนตามแท็บที่เลือกแบบสปริง · ไอคอนทึบ/สีหลักเมื่อเลือก
 * - เลื่อนเนื้อหาลง → หดเหลือไอคอนแท็บปัจจุบัน (minimizeBehavior="onScrollDown") · เลื่อนขึ้น → กางกลับ
 * ขนาดวัดจาก iOS 26 บน iPhone 17 Pro: แคปซูลสูง 62 · ห่างขอบล่าง 22 · ซ้าย 24 · วงกลม 62 · ช่องไฟ 8
 */
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Keyboard, StyleSheet, useWindowDimensions } from 'react-native';
import { AnimatedText } from '../AppText';
import Animated, { useAnimatedStyle, useDerivedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabMinimized } from './headerScroll';
import { Glass, PressableScale, useHaptic } from '../ui';
import { palette } from '../../theme';
import { showPatients } from '../../lib/roles';
import { useApp } from '../../store/app';

const ICONS: Record<string, { on: number; off: number; label: string }> = {
  home: { on: require('../../../assets/tabs/house-chimney-on.png'), off: require('../../../assets/tabs/house-chimney-off.png'), label: 'หน้าหลัก' },
  patients: { on: require('../../../assets/tabs/users-on.png'), off: require('../../../assets/tabs/users-off.png'), label: 'ผู้ป่วย' },
  herbs: { on: require('../../../assets/tabs/leaf-on.png'), off: require('../../../assets/tabs/leaf-off.png'), label: 'สมุนไพร' },
  vault: { on: require('../../../assets/tabs/book-open-cover-on.png'), off: require('../../../assets/tabs/book-open-cover-off.png'), label: 'คลังภูมิ' },
  ask: { on: require('../../../assets/tabs/sparkles-on.png'), off: require('../../../assets/tabs/sparkles-off.png'), label: 'ครูปัญญา' },
};
const H = 62, MIN_H = 48, PAD = 4, GAP = 8, LEFT = 24, RIGHT = 17;
const SPRING = { damping: 20, stiffness: 220, mass: 0.8 };
const INK = '#111813';

function TabBar({ state, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const h = useHaptic();
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setKb(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setKb(false));
    return () => (a.remove(), b.remove());
  }, []);
  const { settings } = useApp();
  // ประชาชนทั่วไปไม่มีแท็บผู้ป่วย
  const routes = state.routes.filter((r) => r.name !== 'ask' && (r.name !== 'patients' || showPatients(settings.userKind)));
  const ask = state.routes.find((r) => r.name === 'ask');
  const cur = state.routes[state.index]?.name;
  const sel = Math.max(0, routes.findIndex((r) => r.name === cur));
  const capW = Math.min(width, 520) - LEFT - RIGHT - H - GAP;
  const tabW = (capW - PAD * 2) / routes.length;
  // จอกว้าง: แถบกว้างไม่เกิน 520 อยู่กึ่งกลางจอ (แบบแถบแท็บของ iPad)
  const off = Math.max(0, (width - 520) / 2);
  const bottom = Math.max(22, insets.bottom - 12);

  const m = useDerivedValue(() => withSpring(tabMinimized.value, SPRING));
  const pillX = useDerivedValue(() => withSpring(PAD + sel * tabW, SPRING));
  const capSt = useAnimatedStyle(() => ({ width: capW + (MIN_H - capW) * m.value, height: H + (MIN_H - H) * m.value, borderRadius: 31 - 7 * m.value }));
  const pillSt = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value * (1 - m.value) }], opacity: 1 - m.value, width: tabW }));
  const rowSt = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, m.value * 1.6) }));
  const miniSt = useAnimatedStyle(() => ({ opacity: Math.max(0, m.value * 1.6 - 0.6) }));
  const circSt = useAnimatedStyle(() => ({ width: H + (MIN_H - H) * m.value, height: H + (MIN_H - H) * m.value, borderRadius: 31 - 7 * m.value }));
  const wrapSt = useAnimatedStyle(() => ({ opacity: withTiming(kb ? 0 : 1, { duration: 160 }), transform: [{ translateY: withTiming(kb ? 40 : 0, { duration: 200 }) }] }));

  const go = (name: string, key: string) => {
    h.select();
    tabMinimized.value = 0;
    const ev = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (!ev.defaultPrevented) navigation.navigate(name as never);
  };
  const curIcon = ICONS[routes[sel]?.name ?? 'home'];

  return (
    <Animated.View style={[styles.wrap, { bottom, left: LEFT + off, right: RIGHT + off }, wrapSt]} pointerEvents={kb ? 'none' : 'box-none'}>
      <Animated.View style={[styles.shadow, capSt]}>
        <Glass interactive tint="rgba(255,255,255,0.78)" style={StyleSheet.absoluteFill} />
        {/* แคปซูลไฮไลต์แท็บที่เลือก */}
        <Animated.View style={[styles.pill, pillSt]} />
        <Animated.View style={[styles.row, rowSt]}>
          {routes.map((r, i) => {
            const on = i === sel;
            const ic = ICONS[r.name];
            return (
              <PressableScale key={r.key} haptic="none" scaleTo={0.92} onPress={() => go(r.name, r.key)} style={[styles.tab, { width: tabW }]} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={ic.label}>
                <Image source={on ? ic.on : ic.off} style={[styles.icon, { tintColor: on ? palette.primary : INK }]} />
                <AnimatedText numberOfLines={1} style={[styles.label, { color: on ? palette.primary : INK }]}>{ic.label}</AnimatedText>
              </PressableScale>
            );
          })}
        </Animated.View>
        {/* หดแล้ว: เหลือไอคอนแท็บปัจจุบัน กดเพื่อกางกลับ */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, miniSt]} pointerEvents="box-none">
          <PressableScale haptic="select" scaleTo={0.9} onPress={() => (tabMinimized.value = 0)} style={styles.center} accessibilityLabel={curIcon.label}>
            <Image source={curIcon.on} style={[styles.icon, { tintColor: palette.primary }]} />
          </PressableScale>
        </Animated.View>
      </Animated.View>
      {ask ? (
        <Animated.View style={[styles.shadow, circSt]}>
          <Glass interactive tint="rgba(255,255,255,0.78)" style={StyleSheet.absoluteFill} />
          <PressableScale haptic="none" scaleTo={0.9} onPress={() => go(ask.name, ask.key)} style={[StyleSheet.absoluteFill, styles.center]} accessibilityRole="tab" accessibilityLabel={ICONS.ask.label}>
            <Image source={cur === 'ask' ? ICONS.ask.on : ICONS.ask.off} style={[styles.icon, { tintColor: cur === 'ask' ? palette.primary : INK }]} />
          </PressableScale>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** แท็บของแอปแบบ JS (Android / เว็บ) — ลำดับและชื่อเดียวกับ NativeTabs ของ iOS */
export function GlassTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="patients" />
      <Tabs.Screen name="herbs" />
      <Tabs.Screen name="vault" />
      <Tabs.Screen name="ask" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end', gap: GAP },
  shadow: { overflow: 'hidden', boxShadow: '0px 8px 28px rgba(20,40,30,0.14), 0px 1px 4px rgba(20,40,30,0.08)' },
  pill: { position: 'absolute', left: 0, top: PAD + 0.5, bottom: PAD + 0.5, borderRadius: 27, backgroundColor: 'rgba(120,128,124,0.14)' },
  row: { flexDirection: 'row', paddingHorizontal: PAD, height: H, alignItems: 'center' },
  tab: { height: H - PAD * 2, alignItems: 'center', justifyContent: 'center', gap: 2 },
  icon: { width: 26, height: 26 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  center: { alignItems: 'center', justifyContent: 'center', flex: 1 },
});
