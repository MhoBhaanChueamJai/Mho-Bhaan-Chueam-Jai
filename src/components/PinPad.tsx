/**
 * แป้นรหัส PIN แบบหน้าจอ Passcode ของ iPhone
 * - จุด 6 ดวง (เติมตามที่กด, สั่นเมื่อผิด)
 * - ปุ่มตัวเลขวงกลม 78pt ใหญ่ กดง่ายสำหรับผู้สูงอายุ
 * - ช่องซ้ายล่างใส่ปุ่มพิเศษได้ (เช่น Face ID), ขวาล่างเป็นปุ่มลบ
 */
import React, { useEffect, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Sym } from './ios';
import { PressableScale, useHaptic } from './ui';
import { PIN_LENGTH } from '../store/security';

export type PinPadHandle = { shake: () => void };

const KEYS = [
  ['1', ''],
  ['2', 'ABC'],
  ['3', 'DEF'],
  ['4', 'GHI'],
  ['5', 'JKL'],
  ['6', 'MNO'],
  ['7', 'PQRS'],
  ['8', 'TUV'],
  ['9', 'WXYZ'],
];

function Dot({ filled, color }: { filled: boolean; color: string }) {
  const s = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    s.value = withSpring(filled ? 1 : 0, { damping: 14, stiffness: 300 });
  }, [filled, s]);
  const st = useAnimatedStyle(() => ({ backgroundColor: filled ? color : 'transparent', transform: [{ scale: 0.85 + s.value * 0.15 }] }));
  return <Animated.View style={[styles.dot, { borderColor: color }, st]} />;
}

function Key({ label, sub, onPress, color, light }: { label: string; sub?: string; onPress: () => void; color: string; light?: boolean }) {
  return (
    <PressableScale haptic="tap" scaleTo={0.9} onPress={onPress} style={[styles.key, { backgroundColor: light ? 'rgba(255,255,255,0.14)' : 'rgba(31,42,36,0.06)' }]} accessibilityLabel={label}>
      <Text style={[styles.keyNum, { color }]}>{label}</Text>
      {sub ? <Text style={[styles.keySub, { color }]}>{sub}</Text> : null}
    </PressableScale>
  );
}

export const PinPad = React.forwardRef<
  PinPadHandle,
  { value: string; onChange: (v: string) => void; onComplete: (v: string) => void; light?: boolean; leftAction?: React.ReactNode }
>(function PinPad({ value, onChange, onComplete, light, leftAction }, ref) {
  const h = useHaptic();
  const color = light ? '#FFFFFF' : '#14201A';
  const x = useSharedValue(0);
  const shakeSt = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  useImperativeHandle(ref, () => ({
    shake: () => {
      h.warn();
      x.value = withSequence(
        withTiming(-14, { duration: 50 }),
        withTiming(14, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    },
  }));

  const press = (d: string) => {
    if (value.length >= PIN_LENGTH) return;
    const next = value + d;
    onChange(next);
    if (next.length === PIN_LENGTH) setTimeout(() => onComplete(next), 120);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={[styles.dots, shakeSt]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <Dot key={i} filled={i < value.length} color={color} />
        ))}
      </Animated.View>
      <View style={styles.grid}>
        {KEYS.map(([n, sub]) => (
          <Key key={n} label={n} sub={sub} color={color} light={light} onPress={() => press(n)} />
        ))}
        <View style={styles.key}>{leftAction}</View>
        <Key label="0" color={color} light={light} onPress={() => press('0')} />
        <View style={styles.key}>
          {value.length ? (
            <PressableScale haptic="select" onPress={() => onChange(value.slice(0, -1))} style={styles.del} accessibilityLabel="ลบ">
              <Sym name="delete.left" size={24} color={color} />
            </PressableScale>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const K = 78;
const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 18, marginBottom: 40 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  grid: { width: K * 3 + 26 * 2, flexDirection: 'row', flexWrap: 'wrap', columnGap: 26, rowGap: 16 },
  key: { width: K, height: K, borderRadius: K / 2, alignItems: 'center', justifyContent: 'center' },
  keyNum: { fontSize: 34, fontWeight: '400', lineHeight: 40 },
  keySub: { fontSize: 10, fontWeight: '600', letterSpacing: 2, opacity: 0.7, marginTop: -2 },
  del: { width: K, height: K, alignItems: 'center', justifyContent: 'center' },
});
