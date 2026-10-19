/** แถบแจ้ง "ครูปัญญาไม่พร้อมใช้งานชั่วคราว" — แสดงเฉพาะตอนเซิร์ฟเวอร์ AI ล่ม หายเองเมื่อกลับมา */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Sym } from './ios';
import { T } from './ui';
import { useAiStatus } from '../lib/aiHealth';

export function AiDownBanner({ dark, style }: { dark?: boolean; style?: StyleProp<ViewStyle> }) {
  const ok = useAiStatus();
  if (ok !== false) return null;
  return (
    <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOut.duration(200)} style={[styles.bar, dark ? styles.dark : styles.light, style]} accessibilityRole="alert">
      <Sym name="wifi.exclamationmark" size={18} color={dark ? '#FFC97A' : '#B86E00'} />
      <View style={{ flex: 1 }}>
        <T v="subhead" color={dark ? '#FFE3B8' : '#7A4A00'} style={{ fontWeight: '700' }}>ครูปัญญาไม่พร้อมใช้งานชั่วคราว</T>
        <T v="caption" color={dark ? 'rgba(255,227,184,0.8)' : '#8A5A10'}>เซิร์ฟเวอร์ AI ขัดข้อง ส่วนอื่นของแอปใช้ได้ตามปกติ · ลองใหม่ภายหลัง</T>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 18 },
  light: { backgroundColor: '#FDF1DC', borderWidth: 1, borderColor: '#F3D9A8' },
  dark: { backgroundColor: 'rgba(255,170,60,0.14)', borderWidth: 1, borderColor: 'rgba(255,190,100,0.35)' },
});
