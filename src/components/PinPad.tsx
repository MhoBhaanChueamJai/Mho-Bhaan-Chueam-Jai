/**
 * แป้นรหัส PIN แบบหน้าจอ Passcode ของ iPhone
 * - จุด 6 ดวง (เติมตามที่กด, สั่นเมื่อผิด)
 * - ปุ่มตัวเลขวงกลม Liquid Glass 76pt ใหญ่ กดง่ายสำหรับผู้สูงอายุ
 * - ช่องซ้ายล่างใส่ปุ่มพิเศษได้ (เช่น Face ID), ขวาล่างเป็นปุ่มลบ
 */
import React, { useEffect, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Sym } from './ios';
import { Glass, PressableScale, useHaptic } from './ui';
import { PIN_LENGTH } from '../store/security';
import { palette } from '../theme';

export type PinPadHandle = { shake: () => void };

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** จุด PIN: ว่าง = วงขอบเทา, กรอกแล้ว = เม็ดเขียวขยายขึ้นแบบสปริง */
function Dot({ filled, color }: { filled: boolean; color: string }) {
  const s = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    s.value = withSpring(filled ? 1 : 0, { damping: 12, stiffness: 320 });
  }, [filled, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: s.value }));
  return (
    <View style={styles.dotSlot}>
      <Animated.View style={[styles.dotFill, { backgroundColor: color }, st]} />
    </View>
  );
}

function Key({ label, onPress, color, light }: { label: string; onPress: () => void; color: string; light?: boolean }) {
  return (
    <PressableScale haptic="tap" scaleTo={0.9} onPress={onPress} style={[styles.key, styles.keyShadow]} accessibilityLabel={label}>
      <Glass interactive tint={light ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.7)'} style={styles.keyGlass}>
        <Text style={[styles.keyNum, { color }]}>{label}</Text>
      </Glass>
    </PressableScale>
  );
}

export const PinPad = React.forwardRef<
  PinPadHandle,
  { value: string; onChange: (v: string) => void; onComplete: (v: string) => void; light?: boolean; leftAction?: React.ReactNode }
>(function PinPad({ value, onChange, onComplete, light, leftAction }, ref) {
  const h = useHaptic();
  const color = light ? '#FFFFFF' : '#14201A';
  const dotColor = light ? '#FFFFFF' : palette.primary;
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
          <Dot key={i} filled={i < value.length} color={dotColor} />
        ))}
      </Animated.View>
      <View style={styles.grid}>
        {KEYS.map((n) => (
          <Key key={n} label={n} color={color} light={light} onPress={() => press(n)} />
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

const K = 76;
const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 14, marginBottom: 30 },
  dotSlot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(60,60,67,0.25)', alignItems: 'center', justifyContent: 'center' },
  dotFill: { width: 16, height: 16, borderRadius: 8, margin: -1.5 },
  grid: { width: K * 3 + 26 * 2, flexDirection: 'row', flexWrap: 'wrap', columnGap: 26, rowGap: 16 },
  key: { width: K, height: K, borderRadius: K / 2, alignItems: 'center', justifyContent: 'center' },
  keyGlass: { width: K, height: K, borderRadius: K / 2, alignItems: 'center', justifyContent: 'center' },
  keyShadow: { boxShadow: '0px 2px 8px rgba(0,0,0,0.06)' },
  keyNum: { fontSize: 32, fontWeight: '400' },
  del: { width: K, height: K, alignItems: 'center', justifyContent: 'center' },
});
