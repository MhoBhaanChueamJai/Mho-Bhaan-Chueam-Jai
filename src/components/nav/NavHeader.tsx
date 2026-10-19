/**
 * แถบหัวจอแบบ iOS 26 สำหรับ Android / เว็บ (iOS ใช้แถบ native ของระบบ)
 * - ปุ่มซ้าย/ขวาอยู่ในกระจกฝ้า: ปุ่มเดี่ยว = วงกลม 44 · หลายปุ่ม = แคปซูล 44 (แบบ iOS 26 ห่อ bar item ให้เอง)
 * - ชื่อหน้าอยู่กึ่งกลาง 17pt semibold · หน้า Large Title: ชื่อเล็กปรากฏเมื่อเลื่อนเลย Large Title
 * - หัวโปร่ง: ขอบบนค่อยๆ ทึบเมื่อเนื้อหาเลื่อนเข้าใต้แถบ (แทน scroll edge effect)
 */
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BAR_H, LARGE_H, headerScrollY, topOf } from './headerScroll';
import { Sym } from '../ios';
import { Glass, PressableScale, T } from '../ui';
import { palette } from '../../theme';

const isLight = (c?: string) => !!c && /^(#fff|#ffffff|white|rgba?\(\s*255\s*,\s*255\s*,\s*255)/i.test(c.trim());

/** ห่อปุ่มบนแถบด้วยกระจก (วงกลมเมื่อมีปุ่มเดียว · แคปซูลเมื่อหลายปุ่ม) */
export function BarGlass({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <View style={styles.itemShadow}>
      <Glass interactive tint={dark ? 'rgba(20,24,22,0.32)' : 'rgba(255,255,255,0.72)'} style={styles.item}>
        {children}
      </Glass>
    </View>
  );
}

export function NavHeader({ options, back, navigation, route }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  const tint = options.headerTintColor ?? palette.ink;
  const dark = isLight(tint);
  const transparent = !!options.headerTransparent;
  const large = !!options.headerLargeTitle;
  const y = headerScrollY(route.key);
  const bg = (options.headerStyle as { backgroundColor?: string } | undefined)?.backgroundColor ?? (transparent ? undefined : palette.bg);

  const titleSt = useAnimatedStyle(() => (large ? { opacity: interpolate(y.value, [LARGE_H * 0.55, LARGE_H], [0, 1], Extrapolation.CLAMP) } : { opacity: 1 }));
  const edgeSt = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 24], [0, 1], Extrapolation.CLAMP) }));

  const title = typeof options.headerTitle === 'string' ? options.headerTitle : (options.title ?? '');
  const left = options.headerLeft?.({ tintColor: tint, canGoBack: !!back });
  const right = options.headerRight?.({ tintColor: tint, canGoBack: !!back });
  const showBack = !left && !!back && options.headerBackVisible !== false;

  return (
    <View style={[{ paddingTop: topOf(insets.top), height: topOf(insets.top) + BAR_H }, transparent ? styles.abs : { backgroundColor: bg }]} pointerEvents="box-none">
      {/* หัวโปร่ง: ขอบบนทึบขึ้นเมื่อเลื่อน (แทนขอบเบลอของ iOS 26) */}
      {transparent && !dark ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { bottom: -18 }, edgeSt]}>
          <LinearGradient colors={[palette.bg, 'rgba(247,251,249,0.86)', 'rgba(247,251,249,0)']} locations={[0, 0.62, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      <View style={styles.bar} pointerEvents="box-none">
        <View style={styles.side} pointerEvents="box-none">
          {left ? (
            <BarGlass dark={dark}>{left}</BarGlass>
          ) : showBack ? (
            <BarGlass dark={dark}>
              <PressableScale haptic="select" scaleTo={0.9} onPress={() => navigation.goBack()} accessibilityLabel="ย้อนกลับ" style={styles.btn}>
                <Sym name="chevron.left" size={20} color={tint} weight="semibold" />
              </PressableScale>
            </BarGlass>
          ) : null}
        </View>
        {options.headerTitle && typeof options.headerTitle === 'function' ? (
          <View style={styles.titleWrap} pointerEvents="none">{options.headerTitle({ children: title, tintColor: tint })}</View>
        ) : title ? (
          <Animated.View style={[styles.titleWrap, titleSt]} pointerEvents="none">
            <T v="title" color={tint} numberOfLines={1} style={styles.title}>{title}</T>
          </Animated.View>
        ) : null}
        <View style={[styles.side, { alignItems: 'flex-end' }]} pointerEvents="box-none">
          {right ? <BarGlass dark={dark}>{right}</BarGlass> : null}
        </View>
      </View>
      {options.headerShadowVisible && !transparent ? <View style={styles.hair} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  bar: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  side: { minWidth: 44, zIndex: 2 },
  itemShadow: { borderRadius: 22, boxShadow: '0px 4px 16px rgba(20,40,30,0.10), 0px 1px 3px rgba(20,40,30,0.06)' },
  item: { minWidth: 44, height: 44, borderRadius: 22, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  btn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { position: 'absolute', left: 96, right: 96, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '600' },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.12)' },
});
