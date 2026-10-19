/**
 * แผ่นชีทแบบ iOS สำหรับ Android / เว็บ (iOS ใช้ formSheet/pageSheet ของระบบ → คืนเนื้อหาเดิม)
 * - เลื่อนขึ้นจากล่างแบบสปริง · มุมบนโค้ง 38 · เว้นด้านบนให้เห็นหน้าเดิม (หรี่) แบบ detent เต็มของ iOS
 * - ปัดลงที่ส่วนหัวเพื่อปิด · ปิดด้วยปุ่ม/ย้อนกลับ → เลื่อนลงก่อนแล้วค่อยออกจากหน้า
 * ใช้กับหน้าที่เปิดแบบ formSheet / modal (ตั้ง presentation: 'transparentModal' บน Android / เว็บใน _layout)
 */
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../ui';
import { palette } from '../../theme';

export const SHEET_NATIVE = Platform.OS === 'ios';
/** ระยะเว้นบนของชีท (เท่ากับ detent 1.0 ของ iOS) */
export const sheetTop = (insetTop: number) => (Platform.OS === 'web' ? Math.max(insetTop, 12) : insetTop) + 10;

export function SheetFrame({ children, title, bg = palette.bg }: { children: React.ReactNode; title?: string; bg?: string }) {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: SH } = useWindowDimensions();
  const y = useSharedValue(SH);
  const closing = useRef(false);

  useEffect(() => {
    if (SHEET_NATIVE) return;
    y.value = withSpring(0, { damping: 28, stiffness: 260, mass: 0.9 });
    // ออกจากหน้า (ปุ่มปิด / ย้อนกลับ) → เลื่อนชีทลงก่อน แล้วค่อยทำต่อ
    return nav.addListener('beforeRemove', (e) => {
      if (closing.current) return;
      e.preventDefault();
      closing.current = true;
      y.value = withTiming(SH, { duration: 260, easing: Easing.in(Easing.quad) }, () => runOnJS(nav.dispatch)(e.data.action));
    });
  }, [nav, y, SH]);

  const close = () => nav.goBack();
  // ปัดลงที่ส่วนหัวของชีท
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 140 || e.velocityY > 900) runOnJS(close)();
      else y.value = withSpring(0, { damping: 28, stiffness: 300 });
    });

  const sheetSt = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const dimSt = useAnimatedStyle(() => ({ opacity: 1 - y.value / SH }));
  if (SHEET_NATIVE) return <>{children}</>;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimSt]} />
      <Animated.View style={[styles.sheet, { top: sheetTop(insets.top), backgroundColor: bg }, sheetSt]}>
        <GestureDetector gesture={pan}>
          <View style={title ? styles.grab : styles.grabThin}>
            {title ? (
              <View style={styles.head}>
                <T v="title" numberOfLines={1} style={{ fontWeight: '600' }}>{title}</T>
              </View>
            ) : null}
          </View>
        </GestureDetector>
        <View style={{ flex: 1 }}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(0,0,0,0.28)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 38, borderTopRightRadius: 38, borderCurve: 'continuous', overflow: 'hidden', boxShadow: '0px -4px 24px rgba(0,0,0,0.12)' },
  // พื้นที่จับปัดลง (บนสุดของชีท) — ไม่มีหัว = แถบบางที่ซ้อนทับเนื้อหา
  grab: { zIndex: 5 },
  grabThin: { position: 'absolute', top: 0, left: 0, right: 0, height: 16, zIndex: 5 },
  head: { height: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 60 },
});
