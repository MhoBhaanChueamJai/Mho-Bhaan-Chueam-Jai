/**
 * สวิตช์แบบ UISwitch ของ iOS — iOS ใช้ของระบบ · Android / เว็บวาดเอง (Android เป็น Material เล็ก · เว็บเป็นวงกลมเปล่า)
 * ราง 51×31 · ปุ่มกลมขาวมีเงา · เปิด = สีหลัก · เลื่อนแบบสปริงและปุ่มยืดเล็กน้อยตอนกด
 */
import React, { useState } from 'react';
import { Platform, Pressable, Switch as RNSwitch, type SwitchProps } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useHaptic } from './ui';

function IOSLikeSwitch({ value, onValueChange, trackColor, disabled }: SwitchProps) {
  const h = useHaptic();
  const [down, setDown] = useState(false);
  const on = useDerivedValue(() => withSpring(value ? 1 : 0, { damping: 18, stiffness: 240 }));
  const press = useDerivedValue(() => withTiming(down ? 1 : 0, { duration: 140 }));
  const onC = (trackColor?.true as string) ?? '#34C759';
  const trackSt = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(on.value, [0, 1], ['rgba(120,120,128,0.16)', onC]) }));
  const knobSt = useAnimatedStyle(() => ({ width: 27 + 6 * press.value, transform: [{ translateX: on.value * (20 - 6 * press.value) }] }));
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      onPress={() => {
        h.select();
        onValueChange?.(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value, disabled: !!disabled }}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View style={[{ width: 51, height: 31, borderRadius: 16, padding: 2 }, trackSt]}>
        <Animated.View style={[{ height: 27, borderRadius: 14, backgroundColor: '#FFFFFF', boxShadow: '0px 3px 8px rgba(0,0,0,0.15), 0px 1px 1px rgba(0,0,0,0.16)' }, knobSt]} />
      </Animated.View>
    </Pressable>
  );
}

export const Switch = Platform.OS === 'ios' ? RNSwitch : IOSLikeSwitch;
