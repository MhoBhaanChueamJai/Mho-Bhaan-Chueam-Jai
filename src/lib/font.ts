/**
 * ฟอนต์ไทย: iOS ใช้ฟอนต์ระบบ (Thonburi/SF) · Android / เว็บใช้ Noto Sans Thai Looped (หัวกลม สัดส่วนใกล้ฟอนต์ iOS ที่สุด)
 * ฟอนต์ที่โหลดเองต้องแยกชื่อตามน้ำหนัก → แปลง fontWeight เป็นชื่อฟอนต์
 */
import {
  NotoSansThaiLooped_300Light,
  NotoSansThaiLooped_400Regular,
  NotoSansThaiLooped_500Medium,
  NotoSansThaiLooped_600SemiBold,
  NotoSansThaiLooped_700Bold,
  NotoSansThaiLooped_800ExtraBold,
  NotoSansThaiLooped_900Black,
} from '@expo-google-fonts/noto-sans-thai-looped';
import { Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

export const APP_FONTS = {
  NotoSansThaiLooped_300Light,
  NotoSansThaiLooped_400Regular,
  NotoSansThaiLooped_500Medium,
  NotoSansThaiLooped_600SemiBold,
  NotoSansThaiLooped_700Bold,
  NotoSansThaiLooped_800ExtraBold,
  NotoSansThaiLooped_900Black,
};
export const NEEDS_FONT = Platform.OS !== 'ios';

const BY_WEIGHT: Record<string, string> = {
  '100': 'NotoSansThaiLooped_300Light',
  '200': 'NotoSansThaiLooped_300Light',
  '300': 'NotoSansThaiLooped_300Light',
  '400': 'NotoSansThaiLooped_400Regular',
  normal: 'NotoSansThaiLooped_400Regular',
  '500': 'NotoSansThaiLooped_500Medium',
  '600': 'NotoSansThaiLooped_600SemiBold',
  '700': 'NotoSansThaiLooped_700Bold',
  bold: 'NotoSansThaiLooped_700Bold',
  '800': 'NotoSansThaiLooped_800ExtraBold',
  '900': 'NotoSansThaiLooped_900Black',
};

/** เติม fontFamily ตามน้ำหนัก (เฉพาะ Android / เว็บ · ข้ามข้อความที่กำหนดฟอนต์เองไว้แล้ว เช่น ตัวเลขแป้น PIN หรือฟอนต์หนังสือ) */
export function withAppFont(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  if (!NEEDS_FONT) return style;
  const f = StyleSheet.flatten(style) ?? {};
  if (f.fontFamily) return style;
  return [style, { fontFamily: BY_WEIGHT[String(f.fontWeight ?? '400')] ?? BY_WEIGHT['400'], fontWeight: 'normal' }];
}
