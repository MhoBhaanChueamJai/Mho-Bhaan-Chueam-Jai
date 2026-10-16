/**
 * กั้นส่วน "การรักษาผู้ป่วย" ไว้เฉพาะหมอพื้นบ้านที่ยืนยันตัวตนแล้ว
 * สมาชิกทั่วไปจะเห็นหน้าชวนยืนยันตัวตนแทน (ฐานข้อมูลก็กันด้วย RLS อีกชั้น)
 */
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Sym, ios } from './ios';
import { Button, PressableScale, T } from './ui';
import { useApp } from '../store/app';
import { palette } from '../theme';

export function PractitionerGate({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  const { isPractitioner } = useApp();
  if (isPractitioner) return <>{children}</>;
  return <VerifyPrompt compact={compact} />;
}

export function VerifyPrompt({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <PressableScale onPress={() => router.push('/verify')} scaleTo={0.98} style={styles.compact}>
        <View style={styles.badgeSm}>
          <Sym name="lock.fill" size={15} color={palette.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="body" style={{ fontWeight: '600' }}>ยืนยันตัวตนหมอพื้นบ้าน</T>
          <T v="caption" color={ios.secondary}>ปลดล็อกการรักษาและบันทึกข้อมูลผู้ป่วย</T>
        </View>
        <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
      </PressableScale>
    );
  }
  return (
    <View style={styles.page}>
      <Animated.View entering={FadeInDown.duration(350)} style={{ alignItems: 'center', paddingHorizontal: 32 }}>
        <View style={styles.badge}>
          <Sym name="lock.fill" size={26} color={palette.primary} />
        </View>
        <T v="h2" center style={{ marginTop: 18, fontWeight: '700' }}>สำหรับหมอพื้นบ้านที่ได้รับการรับรอง</T>
        <T v="callout" color={ios.secondary} center style={{ marginTop: 8 }}>
          การรักษาและบันทึกข้อมูลผู้ป่วยใช้ได้หลังยืนยันตัวตนด้วยเลขที่หนังสือรับรองการเป็นหมอพื้นบ้าน
        </T>
        <View style={styles.list}>
          {['ตรวจกับทะเบียนกรมการแพทย์แผนไทยฯ', 'ใช้เวลาไม่ถึง 1 นาที', 'ยืนยันครั้งเดียว ใช้ได้ทุกเครื่อง'].map((t) => (
            <View key={t} style={styles.li}>
              <Sym name="checkmark.circle.fill" size={17} color={palette.primary} />
              <T v="callout">{t}</T>
            </View>
          ))}
        </View>
        <Button label="ยืนยันตัวตนหมอพื้นบ้าน" onPress={() => router.push('/verify')} style={{ alignSelf: 'stretch', marginTop: 28 }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.bg, justifyContent: 'center' },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  list: { alignSelf: 'stretch', gap: 10, marginTop: 24 },
  li: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.mint, borderRadius: 18, padding: 14 },
  badgeSm: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
