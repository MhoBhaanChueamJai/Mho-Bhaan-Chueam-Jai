/**
 * โครงหน้าจอ PIN (ปลดล็อก / ตั้ง PIN) แบบมินิมอล
 * พื้นขาวเรียบ: ปุ่มบนสุด → รูป/ไอคอนเล็ก → หัวข้อ → ข้อความ → จุด PIN + แป้นตัวเลข
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ios } from './ios';
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
    <View style={[styles.page, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.topBar}>
        <View>{topLeft}</View>
        <View>{topRight}</View>
      </View>

      <View style={styles.body}>
        <Animated.View entering={FadeIn.duration(250)} style={styles.head}>
          {hero}
          <T v="h2" center style={{ marginTop: 14, fontWeight: '600' }}>{title}</T>
          {subtitle ? (
            <T v="callout" color={ios.secondary} center style={{ marginTop: 4, maxWidth: 300 }}>{subtitle}</T>
          ) : null}
          <View style={styles.msg}>
            {message ? (
              <Animated.View entering={FadeIn}>
                <T v="callout" color="#D9534A" center>{message}</T>
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>
        {children}
        {footer}
      </View>
    </View>
  );
}

/** รูป/ไอคอนตรงกลาง (เรียบ ไม่มีวงแสง) */
export function HeroRing({ children }: { children: React.ReactNode }) {
  return <View>{children}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, minHeight: 44 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 24 },
  head: { alignItems: 'center', paddingHorizontal: 24, marginBottom: 8 },
  msg: { minHeight: 30, justifyContent: 'center', marginTop: 6 },
});
