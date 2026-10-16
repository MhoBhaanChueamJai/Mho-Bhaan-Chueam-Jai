/**
 * ตัวเลือกธาตุเจ้าเรือน — ไอคอนธาตุ 3D สไตล์น่ารัก (แบบอีโมจิ 3D: ทรงมน มันวาว ไฮไลต์ + เงานุ่ม)
 * วาดด้วย Skia (Path + Gradient + Blur) ในปุ่ม Liquid Glass
 * ไม่ได้เลือก = ภาพนิ่ง · เลือก = เล่นแอนิเมชันของธาตุ
 *   ไฟ  — เปลวไฟอ้วนกลม 2 ชั้น พลิ้วไหว ยืดหด + ประกายไฟลอยขึ้น
 *   น้ำ — หยดน้ำใสมันวาว เด้งดึ๋ง + วงน้ำกระเพื่อมที่พื้น
 *   ลม — พายุหมุน (ทอร์นาโด) วงกรวยซ้อน บิดส่ายเป็นเกลียว + เศษใบไม้/หินหมุนรอบ
 *   ดิน — ภูเขาหิน 2 ยอด หิมะบนยอด ก้อนหินที่ฐาน + เมฆลอยผ่าน หินกระโดดดึ๋ง
 */
import { BlurMask, Canvas, Circle, CornerPathEffect, Group, LinearGradient, Oval, Path, RadialGradient, Skia, vec } from '@shopify/react-native-skia';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, useDerivedValue, useFrameCallback, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Sym, ios } from './ios';
import { Glass, PressableScale, T } from './ui';
import { ELEMENT_PROFILE, ageSamutthan, seasonNow } from '../lib/elements';
import type { Patient } from '../data/mock';
import { palette } from '../theme';

type El = Patient['element'];

const P = (d: string) => Skia.Path.MakeFromSVGString(d)!;
// ไฟ
const FLAME_OUT = P('M50 8 C 60 24 80 36 79 60 C 78 79 65 91 50 91 C 35 91 22 79 21 61 C 20 47 29 39 35 30 C 37 40 41 45 46 45 C 43 31 45 19 50 8 Z');
const FLAME_IN = P('M50 40 C 58 51 66 60 65 72 C 64 83 57 88 50 88 C 43 88 36 83 35 72 C 34 62 43 53 50 40 Z');
// น้ำ
const DROP = P('M50 8 C 58 24 77 42 77 62 C 77 79 65 91 50 91 C 35 91 23 79 23 62 C 23 42 42 24 50 8 Z');
// ดิน = ภูเขาหิน 2 ยอด (แบ่งด้านรับแสง/ด้านเงา) + หิมะบนยอด
const BACK_LIT = P('M68 34 L50 86 L70 86 Z');
const BACK_SH = P('M68 34 L70 86 L93 86 Z');
const FRONT_LIT = P('M40 20 L8 86 L44 86 Z');
const FRONT_SH = P('M40 20 L44 86 L74 86 Z');
const SNOW_F = P('M40 20 L49.5 39.5 L45 37 L41 42 L37 37 L31 40.5 Z');
const SNOW_B = P('M68 34 L75.5 49 L72 47 L68.5 50 L65 46.5 L61.5 48.5 Z');
const ROCK_A = P('M14 86 C 14 80 19 77 24 78 C 29 77 33 81 32 86 Z');
const ROCK_B = P('M70 86 C 70 81 74 79 78 80 C 82 80 85 83 84 86 Z');

const TINT: Record<El, string> = { ไฟ: '#FF7A2F', น้ำ: '#2BA7F0', ลม: '#4FBFD0', ดิน: '#8C7461' };

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

  // ── ลม (พายุหมุน) ── วงกรวยบิดส่ายเป็นเกลียว + เศษใบไม้/หินหมุนรอบ
  const ringX = (i: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => [{ translateX: Math.sin(t.value * 5 - i * 0.8) * (2 + i * 1.2) * e.value + i * 1.3 }]);
  const tw = [ringX(0), ringX(1), ringX(2), ringX(3), ringX(4), ringX(5)];
  const orb = (ph: number, rad: number, y: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => {
      const a = t.value * 4 + ph;
      return [{ translateX: 50 + Math.cos(a) * rad }, { translateY: y + Math.sin(a) * rad * 0.28 }, { rotate: a }];
    });
  const deb1 = orb(0, 30, 34), deb2 = orb(2.4, 24, 52), deb3 = orb(4.2, 18, 66);
  const debO = useDerivedValue(() => e.value);

  // ── ดิน (ภูเขาหิน) ── เมฆลอยผ่านหลังภูเขา + ก้อนหินกระโดดดึ๋ง
  const cloudX = useDerivedValue(() => 8 + ((t.value * 14) % 90));
  const cloudO = useDerivedValue(() => 0.9 * e.value);
  const hopA = useDerivedValue(() => [{ translateY: -Math.abs(Math.sin(t.value * 5)) * 7 * e.value }]);
  const hopB = useDerivedValue(() => [{ translateY: -Math.abs(Math.sin(t.value * 5 + 1.4)) * 6 * e.value }]);

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
              <Shadow w={16} />
              <Group transform={tw[5]}>
                <Oval x={44.0} y={77} width={12} height={13}>
                  <LinearGradient start={vec(44.0, 77)} end={vec(56.0, 90)} colors={['#F3FBFE', '#B9DCE8', '#7FA9BC']} />
                </Oval>
                <Oval x={45.44} y={79} width={4.199999999999999} height={4} color="rgba(255,255,255,0.7)">
                  <BlurMask blur={1} style="normal" />
                </Oval>
              </Group>
              <Group transform={tw[4]}>
                <Oval x={39.5} y={67} width={21} height={13}>
                  <LinearGradient start={vec(39.5, 67)} end={vec(60.5, 80)} colors={['#F3FBFE', '#B9DCE8', '#7FA9BC']} />
                </Oval>
                <Oval x={42.02} y={69} width={7.35} height={4} color="rgba(255,255,255,0.7)">
                  <BlurMask blur={1} style="normal" />
                </Oval>
              </Group>
              <Group transform={tw[3]}>
                <Oval x={34.5} y={56} width={31} height={13}>
                  <LinearGradient start={vec(34.5, 56)} end={vec(65.5, 69)} colors={['#F3FBFE', '#B9DCE8', '#7FA9BC']} />
                </Oval>
                <Oval x={38.22} y={58} width={10.85} height={4} color="rgba(255,255,255,0.7)">
                  <BlurMask blur={1} style="normal" />
                </Oval>
              </Group>
              <Group transform={tw[2]}>
                <Oval x={29.0} y={44} width={42} height={13}>
                  <LinearGradient start={vec(29.0, 44)} end={vec(71.0, 57)} colors={['#F3FBFE', '#B9DCE8', '#7FA9BC']} />
                </Oval>
                <Oval x={34.04} y={46} width={14.7} height={4} color="rgba(255,255,255,0.7)">
                  <BlurMask blur={1} style="normal" />
                </Oval>
              </Group>
              <Group transform={tw[1]}>
                <Oval x={23.0} y={32} width={54} height={13}>
                  <LinearGradient start={vec(23.0, 32)} end={vec(77.0, 45)} colors={['#F3FBFE', '#B9DCE8', '#7FA9BC']} />
                </Oval>
                <Oval x={29.48} y={34} width={18.9} height={4} color="rgba(255,255,255,0.7)">
                  <BlurMask blur={1} style="normal" />
                </Oval>
              </Group>
              <Group transform={tw[0]}>
                <Oval x={17.0} y={20} width={66} height={13}>
                  <LinearGradient start={vec(17.0, 20)} end={vec(83.0, 33)} colors={['#F3FBFE', '#B9DCE8', '#7FA9BC']} />
                </Oval>
                <Oval x={24.92} y={22} width={23.099999999999998} height={4} color="rgba(255,255,255,0.7)">
                  <BlurMask blur={1} style="normal" />
                </Oval>
              </Group>
              {/* ปากกรวยด้านบน */}
              <Group transform={tw[0]}>
                <Oval x={22} y={21} width={56} height={8} color="rgba(90,130,150,0.35)">
                  <BlurMask blur={1.2} style="normal" />
                </Oval>
              </Group>
              {/* เศษใบไม้/หินหมุนรอบพายุ */}
              <Group opacity={debO}>
                <Group transform={deb1}>
                  <Oval x={-4} y={-2} width={8} height={4} color="#6CC24A" />
                </Group>
                <Group transform={deb2}>
                  <Circle cx={0} cy={0} r={2.4} color="#9C8B7A" />
                </Group>
                <Group transform={deb3}>
                  <Oval x={-3.5} y={-1.6} width={7} height={3.2} color="#8BD45E" />
                </Group>
              </Group>
            </>
          ) : (
            <>
              <Shadow w={38} />
              {/* เมฆลอยด้านหลัง */}
              <Group opacity={cloudO}>
                <Oval x={cloudX} y={22} width={20} height={9} color="#FFFFFF">
                  <BlurMask blur={1.2} style="normal" />
                </Oval>
              </Group>
              {/* ยอดหลัง */}
              <Path path={BACK_LIT}>
                <CornerPathEffect r={5} />
                <LinearGradient start={vec(60, 34)} end={vec(60, 86)} colors={['#B3A698', '#8E8174']} />
              </Path>
              <Path path={BACK_SH}>
                <CornerPathEffect r={5} />
                <LinearGradient start={vec(80, 34)} end={vec(80, 86)} colors={['#86796C', '#5F554C']} />
              </Path>
              <Path path={SNOW_B} color="#F4F8FF">
                <CornerPathEffect r={2} />
              </Path>
              {/* ยอดหน้า */}
              <Path path={FRONT_LIT}>
                <CornerPathEffect r={6} />
                <LinearGradient start={vec(28, 20)} end={vec(28, 86)} colors={['#D2C1AE', '#A48F79']} />
              </Path>
              <Path path={FRONT_SH}>
                <CornerPathEffect r={6} />
                <LinearGradient start={vec(58, 20)} end={vec(58, 86)} colors={['#8F7B68', '#66574A']} />
              </Path>
              <Path path={SNOW_F}>
                <CornerPathEffect r={2} />
                <LinearGradient start={vec(36, 20)} end={vec(44, 42)} colors={['#FFFFFF', '#DDE8F5']} />
              </Path>
              {/* ไฮไลต์สันเขาด้านรับแสง */}
              <Group transform={[{ translateX: 30 }, { translateY: 52 }, { rotate: 0.45 }, { translateX: -30 }, { translateY: -52 }]}>
                <Oval x={27} y={42} width={5} height={22} color="rgba(255,255,255,0.4)">
                  <BlurMask blur={1.6} style="normal" />
                </Oval>
              </Group>
              {/* ก้อนหินที่ฐาน (กระโดดเมื่อเลือก) */}
              <Group transform={hopA}>
                <Path path={ROCK_A}>
                  <LinearGradient start={vec(22, 77)} end={vec(22, 86)} colors={['#B9AA9A', '#7C6D60']} />
                </Path>
              </Group>
              <Group transform={hopB}>
                <Path path={ROCK_B}>
                  <LinearGradient start={vec(77, 79)} end={vec(77, 86)} colors={['#A99A8B', '#6F6156']} />
                </Path>
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
          <PressableScale key={el} haptic="select" scaleTo={0.94} hitSlop={6} onPress={() => onChange(el)} style={styles.item} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`ธาตุ${el}`}>
            {/* ปุ่มวงกลม Liquid Glass ใส่ไอคอน · ชื่อธาตุอยู่นอกวง */}
            <View style={[styles.circleShadow, on && { boxShadow: `0px 8px 20px ${TINT[el]}66` }]}>
              {/* ไม่ใช้ glass แบบ interactive และให้ภาพไอคอนไม่รับการแตะ → แตะแล้วเลือกได้ทันที ไม่ต้องรอแอนิเมชัน */}
              <Glass tint={on ? `${TINT[el]}2E` : 'rgba(255,255,255,0.6)'} style={[styles.circle, { borderColor: on ? TINT[el] : 'rgba(255,255,255,0.95)' }]}>
                <View pointerEvents="none">
                  <ElementIcon el={el} active={on} size={50} />
                </View>
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
  insight: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator, gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tasteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  taste: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999 },
  circle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
});

/**
 * วิเคราะห์ธาตุแบบละเอียด (แสดงใต้ตัวเลือกเมื่อเลือกธาตุแล้ว)
 * ธาตุเจ้าเรือนเกิด + อายุสมุฏฐาน (เมื่อทราบอายุ) + อุตุสมุฏฐาน (ฤดูปัจจุบัน)
 */
export function ElementInsight({ el, age }: { el: El; age?: number }) {
  const p = ELEMENT_PROFILE[el];
  const tint = TINT[el];
  const ag = age != null && age > 0 ? ageSamutthan(age) : null;
  const ss = seasonNow();
  // สรุปสั้น 3 บรรทัด: มักเป็น · รสที่เหมาะ · วัย/ฤดู
  return (
    <Animated.View key={el} entering={FadeIn.duration(300)} style={styles.insight}>
      <View style={styles.line}>
        <Sym name="stethoscope" size={13} color={tint} />
        <T v="subhead" color={ios.secondary} style={{ flex: 1 }} numberOfLines={2}>
          <T v="subhead" style={{ fontWeight: '600' }}>มักเป็น </T>
          {p.prone.join(' · ')}
        </T>
      </View>
      <View style={styles.line}>
        <Sym name="leaf.fill" size={13} color={tint} />
        <T v="subhead" style={{ fontWeight: '600' }}>รสที่เหมาะ</T>
        <View style={styles.tasteRow}>
          {p.tastes.map((x) => (
            <View key={x} style={[styles.taste, { backgroundColor: `${tint}1F` }]}>
              <T v="caption" color={tint} style={{ fontWeight: '700' }}>{x}</T>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.line}>
        <Sym name="calendar" size={13} color={tint} />
        <T v="subhead" color={ios.secondary} style={{ flex: 1 }} numberOfLines={2}>
          {ag ? `${ag.stage} (${ag.dosha.split(' ')[0]}) · ` : ''}
          {ss.name.split(' ')[0]} ({ss.dosha.split(' ')[0]})
        </T>
      </View>
    </Animated.View>
  );
}
