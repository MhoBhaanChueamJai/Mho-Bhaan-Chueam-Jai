/**
 * โครงหน้าจอ PIN (ปลดล็อก / ตั้ง PIN) — เข้าชุดกับหน้าเข้าสู่ระบบ
 * ส่วนบนพื้นเขียวมรกต: ปุ่มบนสุด → รูป/ไอคอน → หัวข้อ → คำอธิบาย (ตัวขาว)
 * ส่วนล่างแผ่นขาวมุมโค้ง: ข้อความแจ้ง → จุด PIN + แป้นตัวเลข → footer
 */
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
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
  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      {/* ── หัวเขียว ── */}
      <View style={{ paddingTop: insets.top + 4, paddingBottom: 52 }}>
        <LinearGradient colors={['#0B6E45', '#14905C', '#0F8052']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.topBar}>
          <View>{topLeft}</View>
          <View>{topRight}</View>
        </View>
        <Animated.View entering={FadeIn.duration(250)} style={styles.head}>
          {hero}
          <T v="h2" color="#FFFFFF" center style={{ marginTop: 14 }}>{title}</T>
          {subtitle ? (
            <T v="callout" color="rgba(255,255,255,0.82)" center style={{ marginTop: 4, maxWidth: 300 }}>{subtitle}</T>
          ) : null}
        </Animated.View>
      </View>

      {/* ── แผ่นขาว: แป้นตัวเลข ── */}
      <Animated.View entering={FadeInUp.duration(400)} style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.msg}>
          {message ? (
            <Animated.View entering={FadeIn}>
              <T v="callout" color="#D9534A" center>{message}</T>
            </Animated.View>
          ) : null}
        </View>
        {children}
        {footer}
      </Animated.View>
    </View>
  );
}

/** กรอบรูป/ไอคอนบนพื้นเขียว: วงขาวโปร่งรอบนอก */
export function HeroRing({ children }: { children: React.ReactNode }) {
  return <View style={styles.ring}>{children}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0B6E45' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, minHeight: 44 },
  head: { alignItems: 'center', paddingHorizontal: 24, marginTop: 4 },
  ring: { padding: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' },
  sheet: {
    flex: 1,
    marginTop: -28,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msg: { minHeight: 30, justifyContent: 'center', marginBottom: 6, paddingHorizontal: 24 },
});
