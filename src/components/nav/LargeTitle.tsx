/**
 * Large Title แบบ iOS สำหรับ Android / เว็บ (iOS ใช้ของระบบ → คืนค่าว่าง)
 * วางไว้บนสุดของเนื้อหาที่เลื่อนได้ · เลื่อนขึ้นแล้วหัวข้อเล็กปรากฏบนแถบ · ดึงลงแล้วหัวข้อขยายเล็กน้อยแบบ iOS
 */
import { useRoute } from '@react-navigation/native';
import React from 'react';
import { Platform, View } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BAR_H, headerScrollY, tabMinimized, topOf } from './headerScroll';
import { T } from '../ui';

const NATIVE = Platform.OS === 'ios';

/** ผูกกับ Animated.ScrollView/FlatList ของหน้า: {...useLargeTitleScroll()} */
export function useLargeTitleScroll() {
  const route = useRoute();
  const y = headerScrollY(route.key);
  const onScroll = useAnimatedScrollHandler((e) => {
    const ny = e.contentOffset.y;
    // แถบแท็บหดเมื่อเลื่อนลง (เลยหัวข้อใหญ่ไปแล้ว) · กางเมื่อเลื่อนขึ้นหรือกลับถึงบนสุด
    if (ny > y.value + 6 && ny > 60) tabMinimized.value = 1;
    else if (ny < y.value - 6 || ny < 20) tabMinimized.value = 0;
    y.value = ny;
  });
  return NATIVE ? {} : { onScroll, scrollEventThrottle: 16 };
}

export function LargeTitle({ title, bleed = 0 }: { title: string; bleed?: number }) {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const y = headerScrollY(route.key);
  // ดึงเกินขอบบน → ขยายจากมุมซ้าย (สูงสุด ~12%) · เลื่อนขึ้น → จางเมื่อชื่อเล็กปรากฏ
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 36], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(y.value, [-160, 0], [1.12, 1], Extrapolation.CLAMP) }],
  }));
  if (NATIVE) return null;
  return (
    <View style={{ paddingTop: topOf(insets.top) + BAR_H, paddingHorizontal: 16, paddingBottom: 6, marginHorizontal: -bleed }}>
      <Animated.View style={[{ transformOrigin: 'left center' }, st]}>
        <T v="hero" numberOfLines={1}>{title}</T>
      </Animated.View>
    </View>
  );
}
