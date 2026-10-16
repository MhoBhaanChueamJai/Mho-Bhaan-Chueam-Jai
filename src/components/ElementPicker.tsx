/**
 * ตัวเลือกธาตุเจ้าเรือน — ไอคอนธาตุ 3D สไตล์น่ารัก (แบบอีโมจิ 3D: ทรงมน มันวาว ไฮไลต์ + เงานุ่ม)
 * วาดด้วย Skia (Path + Gradient + Blur) ในปุ่ม Liquid Glass
 * ไม่ได้เลือก = ภาพนิ่ง · เลือก = เล่นแอนิเมชันของธาตุ
 *   ไฟ  — เปลวไฟอ้วนกลม 2 ชั้น พลิ้วไหว ยืดหด + ประกายไฟลอยขึ้น
 *   น้ำ — หยดน้ำใสมันวาว เด้งดึ๋ง + วงน้ำกระเพื่อมที่พื้น
 *   ลม — ริ้วลมม้วนเป็นหลอดนุ่ม ไหลเลื่อนเป็นจังหวะ
 *   ดิน — ก้อนดินกลมมนมีหญ้าคลุม + ต้นอ่อนแตกใบ โตขึ้นและใบโบกไหว
 */
import { BlurMask, Canvas, Circle, Group, LinearGradient, Oval, Path, RadialGradient, Skia, vec } from '@shopify/react-native-skia';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Easing, useDerivedValue, useFrameCallback, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Glass, PressableScale, T } from './ui';
import type { Patient } from '../data/mock';
import { palette } from '../theme';

type El = Patient['element'];

const P = (d: string) => Skia.Path.MakeFromSVGString(d)!;
// ไฟ
const FLAME_OUT = P('M50 8 C 60 24 80 36 79 60 C 78 79 65 91 50 91 C 35 91 22 79 21 61 C 20 47 29 39 35 30 C 37 40 41 45 46 45 C 43 31 45 19 50 8 Z');
const FLAME_IN = P('M50 40 C 58 51 66 60 65 72 C 64 83 57 88 50 88 C 43 88 36 83 35 72 C 34 62 43 53 50 40 Z');
// น้ำ
const DROP = P('M50 8 C 58 24 77 42 77 62 C 77 79 65 91 50 91 C 35 91 23 79 23 62 C 23 42 42 24 50 8 Z');
// ลม (ริ้วม้วน)
const WIND_A = P('M14 38 H56 C67 38 71 27 64 21 C58 16 50 20 51 27');
const WIND_B = P('M10 54 H70 C83 54 87 69 78 75 C71 80 62 76 64 68');
const WIND_C = P('M22 70 H46');
// ดิน
const MOUND = P('M16 70 C 16 52 32 44 50 44 C 68 44 84 52 84 70 C 84 82 70 88 50 88 C 30 88 16 82 16 70 Z');
const GRASS = P('M17 64 C 20 52 34 45 50 45 C 66 45 80 52 83 64 C 78 61 74 66 70 62 C 66 66 61 61 57 64 C 53 60 48 65 44 61 C 40 65 35 60 31 64 C 27 60 22 66 17 64 Z');
const STEM = P('M50 46 C 50 38 49 32 50 26');
const LEAF_L = P('M50 30 C 42 30 35 25 34 18 C 42 17 49 22 50 30 Z');
const LEAF_R = P('M50 28 C 57 27 63 21 64 14 C 56 14 50 20 50 28 Z');

const TINT: Record<El, string> = { ไฟ: '#FF7A2F', น้ำ: '#2BA7F0', ลม: '#4FBFD0', ดิน: '#9A6A3F' };

function Shadow({ w = 26 }: { w?: number }) {
  return (
    <Oval x={50 - w} y={88} width={w * 2} height={8} color="rgba(30,40,30,0.18)">
      <BlurMask blur={3} style="normal" />
    </Oval>
  );
}

function ElementIcon({ el, active, size = 58 }: { el: El; active: boolean; size?: number }) {
  const t = useSharedValue(0);
  const e = useSharedValue(0);
  const cb = useFrameCallback((f) => {
    t.value += (f.timeSincePreviousFrame ?? 16) / 1000;
  }, false);
  useEffect(() => {
    cb.setActive(active);
    e.value = active ? withSpring(1, { damping: 9, stiffness: 140 }) : withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const k = size / 100;
  // ทั้งไอคอนลอยเด้งเบาๆ เมื่อเลือก (หมุนรอบฐาน)
  const bob = useDerivedValue(() => [{ translateY: -Math.abs(Math.sin(t.value * 3.2)) * 5 * e.value }]);

  // ── ไฟ ──
  const flameOut = useDerivedValue(() => {
    const w = Math.sin(t.value * 11) * e.value;
    return [{ translateX: 50 }, { translateY: 91 }, { scaleY: 1 + 0.08 * w + 0.06 * e.value }, { scaleX: 1 - 0.05 * w }, { skewX: Math.sin(t.value * 5) * 0.12 * e.value }, { translateX: -50 }, { translateY: -91 }];
  });
  const flameIn = useDerivedValue(() => {
    const w = Math.sin(t.value * 14 + 1.3) * e.value;
    return [{ translateX: 50 }, { translateY: 88 }, { scaleY: 1 + 0.12 * w }, { scaleX: 1 - 0.06 * w }, { skewX: Math.sin(t.value * 6 + 0.7) * 0.15 * e.value }, { translateX: -50 }, { translateY: -88 }];
  });
  const spark = (i: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => {
      const ph = (t.value * 0.9 + i / 3) % 1;
      return { y: 46 - ph * 40, o: (1 - ph) * e.value, x: 50 + Math.sin((t.value + i) * 4) * 10 + (i - 1) * 12 };
    });
  const s0 = spark(0), s1 = spark(1), s2 = spark(2);
  const s0y = useDerivedValue(() => s0.value.y), s0x = useDerivedValue(() => s0.value.x), s0o = useDerivedValue(() => s0.value.o);
  const s1y = useDerivedValue(() => s1.value.y), s1x = useDerivedValue(() => s1.value.x), s1o = useDerivedValue(() => s1.value.o);
  const s2y = useDerivedValue(() => s2.value.y), s2x = useDerivedValue(() => s2.value.x), s2o = useDerivedValue(() => s2.value.o);

  // ── น้ำ ── เด้งดึ๋ง (ยืด-ยุบ) + วงน้ำ
  const dropT = useDerivedValue(() => {
    const b = Math.sin(t.value * 6.5);
    const sq = b * 0.07 * e.value;
    return [{ translateX: 50 }, { translateY: 91 }, { scaleX: 1 + sq }, { scaleY: 1 - sq }, { translateX: -50 }, { translateY: -91 }];
  });
  const ring = (i: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => ((t.value * 0.7 + i / 2) % 1));
  const r0 = ring(0), r1 = ring(1);
  const r0x = useDerivedValue(() => 50 - (14 + r0.value * 26)), r0w = useDerivedValue(() => (14 + r0.value * 26) * 2), r0o = useDerivedValue(() => (1 - r0.value) * 0.7 * e.value);
  const r1x = useDerivedValue(() => 50 - (14 + r1.value * 26)), r1w = useDerivedValue(() => (14 + r1.value * 26) * 2), r1o = useDerivedValue(() => (1 - r1.value) * 0.7 * e.value);
  const r0y = useDerivedValue(() => 89 - (2 + r0.value * 3)), r0h = useDerivedValue(() => (2 + r0.value * 3) * 2);
  const r1y = useDerivedValue(() => 89 - (2 + r1.value * 3)), r1h = useDerivedValue(() => (2 + r1.value * 3) * 2);

  // ── ลม ── ริ้วลมไหลเลื่อนคนละจังหวะ
  const wA = useDerivedValue(() => [{ translateX: Math.sin(t.value * 4) * 5 * e.value }]);
  const wB = useDerivedValue(() => [{ translateX: Math.sin(t.value * 4 + 1.6) * 6 * e.value }]);
  const wC = useDerivedValue(() => [{ translateX: Math.sin(t.value * 4 + 3.1) * 7 * e.value }]);

  // ── ดิน ── ต้นอ่อนโต + ใบโบก
  const sprout = useDerivedValue(() => {
    const g = 0.75 + 0.3 * e.value;
    return [{ translateX: 50 }, { translateY: 46 }, { scale: g }, { rotate: Math.sin(t.value * 3) * 0.12 * e.value }, { translateX: -50 }, { translateY: -46 }];
  });
  const leafL = useDerivedValue(() => [{ translateX: 50 }, { translateY: 30 }, { rotate: Math.sin(t.value * 5) * 0.25 * e.value }, { translateX: -50 }, { translateY: -30 }]);
  const leafR = useDerivedValue(() => [{ translateX: 50 }, { translateY: 28 }, { rotate: -Math.sin(t.value * 5 + 0.8) * 0.25 * e.value }, { translateX: -50 }, { translateY: -28 }]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale: k }]}>
        <Group transform={bob}>
          {el === 'ไฟ' ? (
            <>
              <Shadow w={24} />
              {/* ย่อเปลวไฟ 0.86 จากฐาน เผื่อที่ให้ยืดสูงตอนลุกโชน ไม่ให้ปลายโดนตัด */}
              <Group transform={[{ translateX: 50 }, { translateY: 91 }, { scale: 0.86 }, { translateX: -50 }, { translateY: -91 }]}>
              <Group transform={flameOut}>
                <Path path={FLAME_OUT}>
                  <LinearGradient start={vec(50, 8)} end={vec(50, 91)} colors={['#FFC24A', '#FF7A2F', '#F0442A']} />
                </Path>
                <Oval x={30} y={44} width={9} height={22} color="rgba(255,255,255,0.45)">
                  <BlurMask blur={2.5} style="normal" />
                </Oval>
              </Group>
              <Group transform={flameIn}>
                <Path path={FLAME_IN}>
                  <LinearGradient start={vec(50, 40)} end={vec(50, 88)} colors={['#FFF6B8', '#FFD24A']} />
                </Path>
                <Oval x={42} y={58} width={6} height={12} color="rgba(255,255,255,0.7)">
                  <BlurMask blur={1.5} style="normal" />
                </Oval>
              </Group>
              </Group>
              <Circle cx={s0x} cy={s0y} r={2.6} color="#FFB23E" opacity={s0o} />
              <Circle cx={s1x} cy={s1y} r={2} color="#FFD25A" opacity={s1o} />
              <Circle cx={s2x} cy={s2y} r={2.3} color="#FF8A3A" opacity={s2o} />
            </>
          ) : el === 'น้ำ' ? (
            <>
              <Shadow w={22} />
              <Oval x={r0x} y={r0y} width={r0w} height={r0h} style="stroke" strokeWidth={1.8} color="#5CC8FF" opacity={r0o} />
              <Oval x={r1x} y={r1y} width={r1w} height={r1h} style="stroke" strokeWidth={1.8} color="#5CC8FF" opacity={r1o} />
              <Group transform={dropT}>
                <Path path={DROP}>
                  <RadialGradient c={vec(40, 48)} r={52} colors={['#A6EBFF', '#45BDF5', '#1A7FDC']} />
                </Path>
                <Oval x={52} y={72} width={18} height={9} color="rgba(255,255,255,0.35)">
                  <BlurMask blur={3} style="normal" />
                </Oval>
                <Group transform={[{ translateX: 38 }, { translateY: 46 }, { rotate: 0.45 }, { translateX: -38 }, { translateY: -46 }]}>
                  <Oval x={33} y={36} width={10} height={22} color="rgba(255,255,255,0.85)">
                    <BlurMask blur={1.5} style="normal" />
                  </Oval>
                </Group>
                <Circle cx={43} cy={66} r={2.6} color="rgba(255,255,255,0.9)" />
              </Group>
            </>
          ) : el === 'ลม' ? (
            <>
              <Shadow w={20} />
              {[{ p: WIND_A, tr: wA }, { p: WIND_B, tr: wB }, { p: WIND_C, tr: wC }].map(({ p, tr }, i) => (
                <Group key={i} transform={tr}>
                  {/* เงาใต้หลอด → มิติ 3D */}
                  <Group transform={[{ translateY: 2.2 }]}>
                    <Path path={p} style="stroke" strokeWidth={9} strokeCap="round" strokeJoin="round" color="rgba(40,140,160,0.35)">
                      <BlurMask blur={1.2} style="normal" />
                    </Path>
                  </Group>
                  <Path path={p} style="stroke" strokeWidth={9} strokeCap="round" strokeJoin="round">
                    <LinearGradient start={vec(10, 20)} end={vec(85, 80)} colors={['#F2FDFF', '#A8ECF6', '#62CBDD']} />
                  </Path>
                  <Group transform={[{ translateY: -1.8 }]}>
                    <Path path={p} style="stroke" strokeWidth={2.4} strokeCap="round" strokeJoin="round" color="rgba(255,255,255,0.85)" />
                  </Group>
                </Group>
              ))}
            </>
          ) : (
            <>
              <Shadow w={30} />
              <Path path={MOUND}>
                <RadialGradient c={vec(40, 56)} r={46} colors={['#D79A62', '#A86A3C', '#7A4824']} />
              </Path>
              {[[30, 76], [44, 81], [62, 78], [70, 70], [38, 69]].map(([x, y], i) => (
                <Circle key={i} cx={x} cy={y} r={1.8} color="rgba(90,50,25,0.45)" />
              ))}
              <Path path={GRASS}>
                <LinearGradient start={vec(50, 45)} end={vec(50, 66)} colors={['#A8E86A', '#55B84A']} />
              </Path>
              <Oval x={28} y={49} width={16} height={6} color="rgba(255,255,255,0.45)">
                <BlurMask blur={2} style="normal" />
              </Oval>
              <Group transform={sprout}>
                <Path path={STEM} style="stroke" strokeWidth={3.2} strokeCap="round" color="#4DAA45" />
                <Group transform={leafL}>
                  <Path path={LEAF_L}>
                    <LinearGradient start={vec(34, 18)} end={vec(50, 30)} colors={['#B6F07A', '#5DBE4C']} />
                  </Path>
                </Group>
                <Group transform={leafR}>
                  <Path path={LEAF_R}>
                    <LinearGradient start={vec(64, 14)} end={vec(50, 28)} colors={['#B6F07A', '#5DBE4C']} />
                  </Path>
                </Group>
              </Group>
            </>
          )}
        </Group>
      </Group>
    </Canvas>
  );
}

const ORDER: El[] = ['ดิน', 'น้ำ', 'ลม', 'ไฟ'];

export function ElementPicker({ value, onChange }: { value: El | null; onChange: (el: El) => void }) {
  return (
    <View style={styles.row}>
      {ORDER.map((el) => {
        const on = value === el;
        return (
          <PressableScale key={el} haptic="select" scaleTo={0.94} onPress={() => onChange(el)} style={styles.item} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`ธาตุ${el}`}>
            {/* ปุ่มวงกลม Liquid Glass ใส่ไอคอน · ชื่อธาตุอยู่นอกวง */}
            <View style={[styles.circleShadow, on && { boxShadow: `0px 8px 20px ${TINT[el]}66` }]}>
              <Glass interactive tint={on ? `${TINT[el]}2E` : 'rgba(255,255,255,0.6)'} style={[styles.circle, { borderColor: on ? TINT[el] : 'rgba(255,255,255,0.95)' }]}>
                <ElementIcon el={el} active={on} size={50} />
              </Glass>
            </View>
            <T v="subhead" color={on ? TINT[el] : palette.ink} style={{ fontWeight: on ? '700' : '500', marginTop: 8 }}>{el}</T>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { flex: 1, alignItems: 'center' },
  circleShadow: { width: 68, height: 68, borderRadius: 34, boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 20px rgba(0,0,0,0.06)' },
  circle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
});
