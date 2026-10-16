/**
 * โครงหน้าจอ PIN (ปลดล็อก / ตั้ง PIN) ให้เข้าชุดกับหน้าเข้าสู่ระบบ
 * ส่วนบน: พื้นเขียวเข้ม + แสงเรือง + ไอคอน/รูป + หัวข้อ
 * ส่วนล่าง: แผ่นขาวโค้งมน ใส่จุด PIN และแป้นตัวเลข
 */
import { BlurMask, Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './ui';

export function PinShell({
  hero,
  title,
  subtitle,
  message,
  topLeft,
  topRight,
  children,
  footer,
}: {
  hero: React.ReactNode;
  title: string;
  subtitle?: string;
  message?: string;
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cx = width / 2;
  const cy = insets.top + 110;
  return (
    <View style={styles.page}>
      <LinearGradient colors={['#071A11', '#0E3524', '#0B2A1C']} style={StyleSheet.absoluteFill} />
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={cx} cy={cy} r={width * 0.55}>
          <RadialGradient c={vec(cx, cy)} r={width * 0.55} colors={['rgba(94,214,150,0.38)', 'rgba(46,125,87,0.12)', 'rgba(14,53,36,0)']} />
          <BlurMask blur={24} style="normal" />
        </Circle>
      </Canvas>

      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <View>{topLeft}</View>
        <View>{topRight}</View>
      </View>

      <Animated.View entering={FadeInDown.duration(400)} style={styles.head}>
        {hero}
        <T v="h2" color="#FFFFFF" center style={{ marginTop: 14, fontWeight: '700' }}>{title}</T>
        {subtitle ? (
          <T v="callout" color="rgba(214,240,224,0.8)" center style={{ marginTop: 4, maxWidth: 300 }}>{subtitle}</T>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(450)} style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.msg}>
          {message ? (
            <Animated.View entering={FadeIn}>
              <T v="callout" color="#D9534A" center style={{ fontWeight: '600' }}>{message}</T>
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.body}>
          {children}
          {footer}
        </View>
      </Animated.View>
    </View>
  );
}

/** รูป/ไอคอนตรงกลางพร้อมวงแสง */
export function HeroRing({ children }: { children: React.ReactNode }) {
  return <View style={styles.ring}>{children}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0B2A1C' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, minHeight: 48 },
  head: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28 },
  ring: { padding: 5, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(94,214,150,0.55)', backgroundColor: 'rgba(255,255,255,0.06)' },
  sheet: { flex: 1, backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderCurve: 'continuous', alignItems: 'center', paddingTop: 18 },
  body: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingBottom: 24 },
  msg: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 24, marginBottom: 6 },
});
