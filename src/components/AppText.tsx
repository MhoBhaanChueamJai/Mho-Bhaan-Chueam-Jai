/**
 * Text / TextInput ของแอป — iOS เหมือน React Native เดิมทุกอย่าง
 * Android / เว็บ: ใช้ฟอนต์ไทยที่ใกล้ iOS ที่สุดตามน้ำหนักตัวอักษร (ดู lib/font.ts)
 */
import React from 'react';
import { Platform, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { NEEDS_FONT, withAppFont } from '../lib/font';

export const Text = NEEDS_FONT
  ? React.forwardRef<RNText, TextProps>(function Text(p, ref) {
      return <RNText ref={ref} {...p} style={withAppFont(p.style)} />;
    })
  : RNText;

// เว็บ: ไม่มีกรอบสีน้ำเงินของเบราว์เซอร์ตอนแตะช่อง (ช่องของแอปมีพื้นแคปซูลบอกตำแหน่งอยู่แล้ว เหมือน iOS)
const WEB_NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;
export const TextInput = NEEDS_FONT
  ? React.forwardRef<RNTextInput, TextInputProps>(function TextInput(p, ref) {
      return <RNTextInput ref={ref} {...p} style={[withAppFont(p.style), WEB_NO_OUTLINE]} />;
    })
  : RNTextInput;

export const AnimatedText = NEEDS_FONT ? Animated.createAnimatedComponent(Text as typeof RNText) : Animated.Text;
// ใช้เป็นชนิดของ ref ได้เหมือนเดิม (useRef<TextInput>)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Text = RNText;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type TextInput = RNTextInput;
