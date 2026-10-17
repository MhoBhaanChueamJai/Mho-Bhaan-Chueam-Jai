/**
 * โครงหน้าจอ PIN (ปลดล็อก / ตั้ง PIN) — ชั้นเดียวแบบหน้าใส่รหัสของ iPhone บนพื้นสว่างเรียบ
 * ปุ่มบนสุด → รูป/ไอคอน → หัวข้อ → คำอธิบาย → ข้อความแจ้ง → จุด PIN + แป้นตัวเลข (Liquid Glass) → footer
 */
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ios } from './ios';
import { T } from './ui';
import { palette } from '../theme';

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
    <View style={[styles.page, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 8 }]}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <View>{topLeft}</View>
        <View>{topRight}</View>
      </View>
      <Animated.View entering={FadeIn.duration(250)} style={styles.body}>
        <View style={styles.head}>
          {hero}
          <T v="h2" center style={{ marginTop: 14 }}>{title}</T>
          {subtitle ? (
            <T v="callout" color={ios.secondary} center style={{ marginTop: 4, maxWidth: 300 }}>{subtitle}</T>
          ) : null}
        </View>
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

/** กรอบรูป/ไอคอนด้านบน */
export function HeroRing({ children }: { children: React.ReactNode }) {
  return <View style={styles.ring}>{children}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 44 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', paddingHorizontal: 24 },
  ring: { borderRadius: 999, boxShadow: '0px 4px 14px rgba(0,0,0,0.08)' },
  msg: { minHeight: 30, justifyContent: 'center', marginTop: 10, marginBottom: 8, paddingHorizontal: 24 },
});
