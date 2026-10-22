/**
 * แถบหัวจอแบบ iOS 26 สำหรับ Android / เว็บ (iOS ใช้แถบ native ของระบบ)
 * - ปุ่มซ้าย/ขวาอยู่ในกระจกฝ้า: ปุ่มเดี่ยว = วงกลม 44 · หลายปุ่ม = แคปซูล 44 (แบบ iOS 26 ห่อ bar item ให้เอง)
 * - ชื่อหน้าอยู่กึ่งกลาง 17pt semibold · หน้า Large Title: ชื่อเล็กปรากฏเมื่อเลื่อนเลย Large Title
 * - หัวโปร่ง: ขอบบนค่อยๆ ทึบเมื่อเนื้อหาเลื่อนเข้าใต้แถบ (แทน scroll edge effect)
 */
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BAR_H, LARGE_H, headerScrollY, topOf } from './headerScroll';
import { Sym } from '../ios';
import { COLUMN } from '../layout';
import { Glass, PressableScale, T } from '../ui';
import { palette } from '../../theme';

/** หน้าที่เนื้อหากว้างแบบกริด (แท็บ · รายงาน) — หน้าอื่นใช้คอลัมน์อ่าน */
const GRID_ROUTES = new Set(['index', 'report']);

const isLight = (c?: string) => !!c && /^(#fff|#ffffff|white|rgba?\(\s*255\s*,\s*255\s*,\s*255)/i.test(c.trim());

/** ห่อปุ่มบนแถบด้วยกระจก (วงกลมเมื่อมีปุ่มเดียว · แคปซูลเมื่อหลายปุ่ม) */
export function BarGlass({ children, dark, clear }: { children: React.ReactNode; dark?: boolean; clear?: boolean }) {
  // clear = บนภาพหัวเต็มจอ: กระจกใสเห็นภาพทะลุ (แบบ Liquid Glass บนภาพ)
  const tint = clear ? (dark ? 'rgba(20,24,22,0.16)' : 'rgba(255,255,255,0.3)') : dark ? 'rgba(20,24,22,0.32)' : 'rgba(255,255,255,0.72)';
  return (
    <View style={clear ? styles.itemShadowSoft : styles.itemShadow}>
      <Glass interactive tint={tint} style={styles.item}>
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
  // หน้าภาพหัวเต็มจอ (ซ่อนขอบเบลอบน iOS) → ปุ่มกระจกใส ไม่มีขอบไล่สี
  const hero = (options as { scrollEdgeEffects?: { top?: string } }).scrollEdgeEffects?.top === 'hidden';
  const y = headerScrollY(route.key);
  const bg = (options.headerStyle as { backgroundColor?: string } | undefined)?.backgroundColor ?? (transparent ? undefined : palette.bg);

  const titleSt = useAnimatedStyle(() => (large ? { opacity: interpolate(y.value, [LARGE_H * 0.55, LARGE_H], [0, 1], Extrapolation.CLAMP) } : { opacity: 1 }));
  const edgeSt = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 24], [0, 1], Extrapolation.CLAMP) }));

  const title = typeof options.headerTitle === 'string' ? options.headerTitle : (options.title ?? '');
  const left = options.headerLeft?.({ tintColor: tint, canGoBack: !!back });
  const right = options.headerRight?.({ tintColor: tint, canGoBack: !!back });
  // เปิดจากลิงก์ตรง (ไม่มีหน้าก่อนหน้า) → ยังมีปุ่มย้อนกลับไปหน้าหลัก เหมือนแอปที่เปิดหน้านี้จากหน้าอื่นเสมอ
  const webRoot = !back && route.name !== 'index';
  const showBack = !left && (!!back || webRoot) && options.headerBackVisible !== false;
  const goBack = () => (back ? navigation.goBack() : router.replace('/home'));

  return (
    <View style={[{ paddingTop: topOf(insets.top), height: topOf(insets.top) + BAR_H }, transparent ? styles.abs : { backgroundColor: bg }]} pointerEvents="box-none">
      {/* หัวโปร่ง: ขอบบนทึบขึ้นเมื่อเลื่อน (แทนขอบเบลอของ iOS 26) */}
      {transparent && !dark && !hero ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { bottom: -18 }, edgeSt]}>
          <LinearGradient colors={[palette.bg, 'rgba(247,251,249,0.86)', 'rgba(247,251,249,0)']} locations={[0, 0.62, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      <View style={[styles.bar, { maxWidth: GRID_ROUTES.has(route.name) ? COLUMN.grid : COLUMN.read }]} pointerEvents="box-none">
        <View style={styles.side} pointerEvents="box-none">
          {left ? (
            <BarGlass dark={dark} clear={hero}>{left}</BarGlass>
          ) : showBack ? (
            <BarGlass dark={dark} clear={hero}>
              <PressableScale haptic="select" scaleTo={0.9} onPress={goBack} accessibilityLabel="ย้อนกลับ" style={styles.btn}>
                <Sym name="chevron.left" size={23} color={tint} weight="semibold" />
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
          {right ? <BarGlass dark={dark} clear={hero}>{right}</BarGlass> : null}
        </View>
      </View>
      {options.headerShadowVisible && !transparent ? <View style={styles.hair} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  // จอกว้าง: ปุ่มบนแถบอยู่ในแนวเดียวกับคอลัมน์เนื้อหา (ไม่ชิดขอบจอ)
  bar: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, width: '100%', alignSelf: 'center' },
  side: { minWidth: 44, zIndex: 2 },
  itemShadow: { borderRadius: 22, boxShadow: '0px 4px 16px rgba(20,40,30,0.10), 0px 1px 3px rgba(20,40,30,0.06)' },
  itemShadowSoft: { borderRadius: 22, boxShadow: '0px 2px 10px rgba(0,0,0,0.08)' },
  item: { minWidth: 44, height: 44, borderRadius: 22, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  btn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { position: 'absolute', left: 96, right: 96, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '600' },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.12)' },
});
