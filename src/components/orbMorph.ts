/**
 * ลูกแก้วต่อเนื่องข้ามขั้นตอนในหน้าเดียวกัน — ลูกแก้วใหม่เริ่มที่ตำแหน่ง/ขนาดของลูกแก้วเดิม แล้วเลื่อน/ขยายมาที่ตำแหน่งของตัวเอง
 * ใช้: const m = useOrbMorph(from); <Animated.View ref={m.ref} onLayout={m.onLayout} style={m.style}>…ลูกแก้ว…</Animated.View>
 * จุดเริ่ม: วัดลูกแก้วเดิมด้วย measureOrb(ref) แล้วส่งค่าที่ได้มาเป็น from
 */
import { useRef } from 'react';
import type { View } from 'react-native';
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export type OrbFrom = { x: number; y: number; size: number };

export function useOrbMorph(from?: OrbFrom) {
  const ref = useRef<View>(null);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sc = useSharedValue(1);
  const op = useSharedValue(from ? 0 : 1);
  const done = useRef(false);
  const style = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }] }));
  const onLayout = () => {
    if (!from || done.current) return;
    done.current = true;
    ref.current?.measureInWindow((x, y, w, h) => {
      const ease = { duration: 620, easing: Easing.bezier(0.2, 0.8, 0.2, 1) };
      tx.value = from.x - (x + w / 2);
      ty.value = from.y - (y + h / 2);
      sc.value = from.size / Math.max(1, w);
      op.value = 1;
      tx.value = withTiming(0, ease);
      ty.value = withTiming(0, ease);
      sc.value = withTiming(1, ease);
    });
  };
  return { ref, onLayout, style };
}

/** วัดตำแหน่งลูกแก้วเดิม (จุดกึ่งกลางบนจอ + ขนาด) */
export function measureOrb(ref: React.RefObject<View | null>): Promise<OrbFrom | undefined> {
  return new Promise((res) => {
    if (!ref.current) return res(undefined);
    ref.current.measureInWindow((x, y, w, h) => res(w ? { x: x + w / 2, y: y + h / 2, size: w } : undefined));
  });
}
