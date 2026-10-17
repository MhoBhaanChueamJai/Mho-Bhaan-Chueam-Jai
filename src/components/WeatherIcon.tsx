/**
 * ไอคอนสภาพอากาศแบบมีแอนิเมชัน + สีตามสภาพอากาศ (SF Symbols หลายสี)
 * แดด = หมุนช้า · เมฆ = ลอยไปมา · หมอก = จางเข้าออก · ฝน = เม็ดฝนไล่ (variable color) + โยกเบาๆ
 * ฟ้าร้อง = แวบ · หนาว = เกล็ดหิมะหมุนช้า · ฝุ่น = กระพริบเบาๆ
 * พระอาทิตย์ขึ้น = ลอยขึ้น · พระอาทิตย์ตก = ลอยลง · กลางคืน = ดาวกระพริบ
 */
import { SymbolView, type SFSymbol } from 'expo-symbols';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { SkyKind } from '../lib/weatherHerbs';
import { Sym } from './ios';

/** สีหลักของแต่ละสภาพอากาศ (ใช้กับตัวอักษรด้วย) */
export const SKY_COLOR: Record<SkyKind, string> = {
  sun: '#EE7A12', // ส้ม
  hot: '#D92D20', // แดง
  partly: '#D98A12',
  cloudy: '#6E7C91',
  fog: '#7D8B99',
  drizzle: '#3E8FD8',
  rain: '#2F7BD6',
  heavy: '#1F5FBF',
  thunder: '#6D4CE0',
  cold: '#2A9CC8',
  dust: '#9A6B3C',
  sunrise: '#E8780C',
  sunset: '#D9534A',
  night: '#4B4FA8',
};

const SKY: Record<SkyKind, { sym: SFSymbol; colors: string[] }> = {
  sun: { sym: 'sun.max.fill', colors: ['#F58A1F'] },
  hot: { sym: 'sun.max.fill', colors: ['#E0301E'] },
  partly: { sym: 'cloud.sun.fill', colors: ['#A3AFBD', '#F5A524'] },
  cloudy: { sym: 'cloud.fill', colors: ['#8E9AAF'] },
  fog: { sym: 'cloud.fog.fill', colors: ['#9AA5B1', '#B8C2CC'] },
  drizzle: { sym: 'cloud.drizzle.fill', colors: ['#9AA6B2', '#4C9BE6'] },
  rain: { sym: 'cloud.rain.fill', colors: ['#8E9AAF', '#2F7BD6'] },
  heavy: { sym: 'cloud.heavyrain.fill', colors: ['#6B7A90', '#1F5FBF'] },
  thunder: { sym: 'cloud.bolt.rain.fill', colors: ['#6B7A90', '#F5B800', '#3D84E0'] },
  cold: { sym: 'snowflake', colors: ['#3FB0DD'] },
  dust: { sym: 'aqi.medium', colors: ['#A07850'] },
  sunrise: { sym: 'sunrise.fill', colors: ['#F07E2E', '#F5A524'] },
  sunset: { sym: 'sunset.fill', colors: ['#D9534A', '#F08A3C'] },
  night: { sym: 'moon.stars.fill', colors: ['#5B5FC7', '#F5C842'] },
};

export function WeatherIcon({ sky, size = 22 }: { sky: SkyKind; size?: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (sky === 'sun' || sky === 'hot' || sky === 'cold') t.value = withRepeat(withTiming(1, { duration: sky === 'cold' ? 16000 : 12000, easing: Easing.linear }), -1);
    else if (sky === 'thunder') t.value = withRepeat(withSequence(withTiming(0, { duration: 1600 }), withTiming(1, { duration: 70 }), withTiming(0, { duration: 90 }), withTiming(1, { duration: 70 }), withTiming(0, { duration: 260 })), -1);
    else t.value = withRepeat(withTiming(1, { duration: sky === 'heavy' ? 700 : sky === 'rain' || sky === 'drizzle' ? 1100 : 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [sky, t]);
  const st = useAnimatedStyle(() => {
    switch (sky) {
      case 'sun':
      case 'hot':
      case 'cold':
        return { transform: [{ rotate: `${t.value * 360}deg` }] };
      case 'partly':
      case 'cloudy':
        return { transform: [{ translateX: (t.value - 0.5) * size * 0.16 }] };
      case 'fog':
      case 'dust':
        return { opacity: 0.55 + t.value * 0.45 };
      case 'thunder':
        return { opacity: 1 - t.value * 0.55, transform: [{ scale: 1 + t.value * 0.08 }] };
      case 'sunrise':
        return { transform: [{ translateY: (0.5 - t.value) * size * 0.18 }] };
      case 'sunset':
        return { transform: [{ translateY: (t.value - 0.5) * size * 0.18 }] };
      case 'night':
        return { opacity: 0.75 + t.value * 0.25 };
      default:
        return { transform: [{ translateY: (t.value - 0.5) * size * 0.08 }] };
    }
  });
  const k = SKY[sky];
  const rainy = sky === 'drizzle' || sky === 'rain' || sky === 'heavy' || sky === 'thunder';
  return (
    <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, st]}>
      {Platform.OS === 'web' ? (
        <Sym name={k.sym} size={size} color={k.colors[k.colors.length - 1]} />
      ) : (
        <SymbolView
          name={k.sym}
          size={size}
          type="palette"
          colors={k.colors}
          style={{ width: size, height: size }}
          // เม็ดฝนไล่ทีละชั้น
          animationSpec={rainy ? { repeating: true, speed: sky === 'heavy' ? 1.6 : 1, variableAnimationSpec: { iterative: true } } : undefined}
        />
      )}
    </Animated.View>
  );
}
