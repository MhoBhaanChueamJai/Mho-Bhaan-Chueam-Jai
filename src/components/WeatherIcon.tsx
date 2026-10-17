/**
 * ไอคอนสภาพอากาศแบบแยกชิ้นส่วน (วาดด้วย Skia) — แต่ละส่วนขยับเอง แบบแอปสภาพอากาศของ Apple
 *  แดด: แกนนิ่ง + แสงเรืองเต้น + รัศมีหมุน · เมฆ: แต่ละก้อนลอยคนละจังหวะ · ฝน: เม็ดฝนตกทีละเม็ดเหลื่อมกัน
 *  ฟ้าคะนอง: สายฟ้าแลบเป็นช่วง · หนาว: เกล็ดหิมะร่วงหมุน · หมอก: เส้นหมอกเลื่อน · ฝุ่น: ฝุ่นลอยผ่านแดดหม่น
 *  พระอาทิตย์ขึ้น/ตก: ดวงอาทิตย์เลื่อนจากขอบฟ้า · กลางคืน: พระจันทร์เสี้ยว + ดาวกระพริบ
 * วาดบนพื้นที่สมมติ 100×100 แล้วย่อ/ขยายตาม size · ทุกชิ้นส่วนเคลื่อนบน UI thread (Reanimated shared values)
 */
import { BlurMask, Canvas, Circle, Group, LinearGradient, Line, Path, PathOp, RadialGradient, Shadow, Skia, vec, type SkPath } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import type { SkyKind } from '../lib/weatherHerbs';

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

type Clock = SharedValue<number>;
/** นาฬิกา 0→1 วนซ้ำ (เส้นตรง) */
function useLoop(ms: number): Clock {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false);
  }, [ms, t]);
  return t;
}
const wave = (t: number, phase = 0) => {
  'worklet';
  return Math.sin((t + phase) * Math.PI * 2);
};

/* ───────────── ชิ้นส่วน ───────────── */

function cloudPath(x: number, y: number, w: number): SkPath {
  const p = Skia.Path.Make();
  p.addCircle(x + w * 0.28, y + w * 0.42, w * 0.2);
  p.addCircle(x + w * 0.53, y + w * 0.3, w * 0.27);
  p.addCircle(x + w * 0.77, y + w * 0.45, w * 0.18);
  p.addRRect(Skia.RRectXY(Skia.XYWHRect(x + w * 0.08, y + w * 0.42, w * 0.88, w * 0.21), w * 0.105, w * 0.105));
  return Skia.Path.MakeFromOp(p, Skia.Path.Make(), PathOp.Union) ?? p;
}


/** เมฆหนึ่งก้อน ลอยซ้ายขวา */
function Cloud({ x, y, w, top, bottom, t, amp = 3, phase = 0 }: { x: number; y: number; w: number; top: string; bottom: string; t: Clock; amp?: number; phase?: number }) {
  const path = useMemo(() => cloudPath(x, y, w), [x, y, w]);
  const tr = useDerivedValue(() => [{ translateX: wave(t.value, phase) * amp }]);
  return (
    <Group transform={tr}>
      <Path path={path}>
        <LinearGradient start={vec(0, y + w * 0.05)} end={vec(0, y + w * 0.64)} colors={[top, bottom]} />
        {/* เงานุ่มใต้เมฆ ให้เห็นชัดบนพื้นขาว */}
        <Shadow dx={0} dy={w * 0.04} blur={w * 0.05} color="rgba(30,50,80,0.28)" />
      </Path>
    </Group>
  );
}

/** ดวงอาทิตย์: แกนนิ่ง + แสงเรือง + รัศมีหมุน */
function Sun({ cx, cy, r, t, spin, inner, outer, glow, rays = true }: { cx: number; cy: number; r: number; t: Clock; spin: Clock; inner: string; outer: string; glow: string; rays?: boolean }) {
  const rot = useDerivedValue(() => [{ rotate: spin.value * Math.PI * 2 }]);
  const glowR = useDerivedValue(() => r * (1.35 + 0.12 * wave(t.value)));
  const rayList = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), []);
  return (
    <Group>
      <Circle cx={cx} cy={cy} r={glowR} color={glow} opacity={0.5}>
        <BlurMask blur={r * 0.45} style="normal" />
      </Circle>
      {rays ? (
        <Group transform={rot} origin={vec(cx, cy)}>
          {rayList.map((a) => (
            <Line key={a} p1={vec(cx + Math.cos(a) * r * 1.32, cy + Math.sin(a) * r * 1.32)} p2={vec(cx + Math.cos(a) * r * 1.68, cy + Math.sin(a) * r * 1.68)} color={outer} strokeWidth={r * 0.26} strokeCap="round" />
          ))}
        </Group>
      ) : null}
      <Circle cx={cx} cy={cy} r={r}>
        <RadialGradient c={vec(cx - r * 0.35, cy - r * 0.35)} r={r * 1.5} colors={['#FFFBE0', inner, outer]} positions={[0, 0.35, 1]} />
        <Shadow dx={0} dy={r * 0.08} blur={r * 0.12} color="rgba(200,90,0,0.25)" />
      </Circle>
    </Group>
  );
}

/** เม็ดฝนทรงหยดน้ำ (ไล่สีฟ้า): หล่นเฉียงจากใต้เมฆ แล้วจางหาย วนซ้ำ */
function Drop({ x, y0, len, fall, t, phase, color, width }: { x: number; y0: number; len: number; fall: number; t: Clock; phase: number; color: string; width: number }) {
  const shape = useMemo(() => {
    const r = width * 0.75;
    const p = Skia.Path.Make();
    p.moveTo(0, -len);
    p.cubicTo(r * 0.4, -len * 0.55, r * 1.1, -r * 0.4, r, 0);
    p.arcToOval(Skia.XYWHRect(-r, -r, r * 2, r * 2), 0, 180, false);
    p.cubicTo(-r * 1.1, -r * 0.4, -r * 0.4, -len * 0.55, 0, -len);
    p.close();
    return p;
  }, [len, width]);
  const p = useDerivedValue(() => (t.value + phase) % 1);
  const tr = useDerivedValue(() => [{ translateX: x - p.value * fall * 0.22 }, { translateY: y0 + len + p.value * fall }, { rotate: 0.22 }]);
  const op = useDerivedValue(() => (p.value < 0.15 ? p.value / 0.15 : 1 - (p.value - 0.15) / 0.85));
  return (
    <Group transform={tr} opacity={op}>
      <Path path={shape}>
        <LinearGradient start={vec(0, -len)} end={vec(0, width)} colors={['#A8DBFF', color]} />
      </Path>
    </Group>
  );
}

/** เกล็ดหิมะ: ร่วงช้าพร้อมหมุน */
function Flake({ x, y0, size, fall, t, phase, color }: { x: number; y0: number; size: number; fall: number; t: Clock; phase: number; color: string }) {
  const p = useDerivedValue(() => (t.value + phase) % 1);
  const tr = useDerivedValue(() => [{ translateX: x + wave(p.value) * 3 }, { translateY: y0 + p.value * fall }, { rotate: p.value * Math.PI }]);
  const op = useDerivedValue(() => (p.value < 0.2 ? p.value / 0.2 : 1 - (p.value - 0.2) / 0.8));
  const arms = [0, Math.PI / 3, (2 * Math.PI) / 3];
  return (
    <Group transform={tr} opacity={op}>
      {arms.map((a) => (
        <Line key={a} p1={vec(-Math.cos(a) * size, -Math.sin(a) * size)} p2={vec(Math.cos(a) * size, Math.sin(a) * size)} color={color} strokeWidth={size * 0.32} strokeCap="round" />
      ))}
    </Group>
  );
}

/** ดาว: กระพริบ */
function Star({ x, y, s, t, phase }: { x: number; y: number; s: number; t: Clock; phase: number }) {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(x, y - s);
    p.quadTo(x, y, x + s, y);
    p.quadTo(x, y, x, y + s);
    p.quadTo(x, y, x - s, y);
    p.quadTo(x, y, x, y - s);
    p.close();
    return p;
  }, [x, y, s]);
  const op = useDerivedValue(() => 0.35 + 0.65 * Math.max(0, wave(t.value, phase)));
  return <Path path={path} color="#FFD24A" opacity={op} />;
}

/* ───────────── ไอคอนแต่ละแบบ ───────────── */

const C = {
  white: ['#FFFFFF', '#CFDAE8'] as const,
  light: ['#F4F7FB', '#B9C6D6'] as const,
  gray: ['#D3DAE4', '#8C99AD'] as const,
  storm: ['#9DA8BA', '#4F5B70'] as const,
};

function SunIcon({ hot }: { hot?: boolean }) {
  const t = useLoop(hot ? 1800 : 2600);
  const spin = useLoop(hot ? 9000 : 16000);
  return hot ? (
    <Sun cx={50} cy={50} r={26} t={t} spin={spin} inner="#FFC43D" outer="#E5251B" glow="#FF5A2E" />
  ) : (
    <Sun cx={50} cy={50} r={26} t={t} spin={spin} inner="#FFD84A" outer="#FF8A00" glow="#FFB547" />
  );
}

function PartlyIcon() {
  const t = useLoop(4200);
  const spin = useLoop(16000);
  return (
    <>
      <Sun cx={62} cy={34} r={19} t={t} spin={spin} inner="#FFD84A" outer="#FF8A00" glow="#FFB547" />
      <Cloud x={2} y={30} w={84} top={C.white[0]} bottom={C.white[1]} t={t} amp={3} />
    </>
  );
}

function CloudyIcon() {
  const t = useLoop(5200);
  return (
    <>
      <Cloud x={26} y={10} w={70} top={C.gray[0]} bottom={C.gray[1]} t={t} amp={3} phase={0.5} />
      <Cloud x={2} y={30} w={84} top={C.white[0]} bottom={C.white[1]} t={t} amp={4} />
    </>
  );
}

function FogLine({ y, w, t, phase }: { y: number; w: number; t: Clock; phase: number }) {
  const p1 = useDerivedValue(() => vec(50 - w / 2 + wave(t.value, phase) * 7, y));
  const p2 = useDerivedValue(() => vec(50 + w / 2 + wave(t.value, phase) * 7, y));
  const op = useDerivedValue(() => 0.55 + 0.35 * wave(t.value, phase + 0.25));
  return <Line p1={p1} p2={p2} color="#9FAEC2" strokeWidth={7} strokeCap="round" opacity={op} />;
}
function FogIcon() {
  const t = useLoop(4400);
  const lines = [
    { y: 70, w: 56, ph: 0 },
    { y: 80, w: 46, ph: 0.33 },
    { y: 90, w: 58, ph: 0.66 },
  ];
  return (
    <>
      <Cloud x={8} y={4} w={84} top={C.light[0]} bottom={C.light[1]} t={t} amp={2} />
      {lines.map((l) => (
        <FogLine key={l.y} y={l.y} w={l.w} t={t} phase={l.ph} />
      ))}
    </>
  );
}

function RainIcon({ level }: { level: 'drizzle' | 'rain' | 'heavy' }) {
  const drift = useLoop(5000);
  const t = useLoop(level === 'heavy' ? 650 : level === 'rain' ? 900 : 1400);
  const cloud = level === 'heavy' ? C.storm : level === 'rain' ? C.gray : C.light;
  const drops =
    level === 'heavy'
      ? [22, 36, 50, 64, 78].map((x, i) => ({ x, ph: (i * 0.37) % 1 }))
      : level === 'rain'
        ? [30, 44, 58, 72].map((x, i) => ({ x, ph: i * 0.27 }))
        : [34, 52, 70].map((x, i) => ({ x, ph: i * 0.33 }));
  return (
    <>
      {drops.map((d) => (
        <Drop key={d.x} x={d.x} y0={58} len={level === 'drizzle' ? 10 : level === 'rain' ? 14 : 16} fall={26} t={t} phase={d.ph} color={level === 'heavy' ? '#1F5FBF' : '#2F86E8'} width={level === 'drizzle' ? 6 : 7.5} />
      ))}
      <Cloud x={4} y={4} w={92} top={cloud[0]} bottom={cloud[1]} t={drift} amp={2} />
    </>
  );
}

function ThunderIcon() {
  const drift = useLoop(5000);
  const t = useLoop(900);
  const flash = useLoop(2600);
  const bolt = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(54, 52);
    p.lineTo(40, 74);
    p.lineTo(50, 74);
    p.lineTo(44, 94);
    p.lineTo(64, 66);
    p.lineTo(53, 66);
    p.lineTo(60, 52);
    p.close();
    return p;
  }, []);
  // แลบสองครั้งติดกันแล้วเงียบ
  const op = useDerivedValue(() => {
    const f = flash.value;
    return (f > 0.62 && f < 0.67) || (f > 0.72 && f < 0.78) ? 1 : 0.08;
  });
  return (
    <>
      {[28, 74].map((x, i) => (
        <Drop key={x} x={x} y0={58} len={14} fall={26} t={t} phase={i * 0.5} color="#2F86E8" width={7.5} />
      ))}
      <Group opacity={op}>
        <Path path={bolt} color="#FFE066">
          <BlurMask blur={4} style="outer" />
        </Path>
        <Path path={bolt}>
          <LinearGradient start={vec(50, 52)} end={vec(50, 94)} colors={['#FFF3A0', '#FFB300']} />
        </Path>
      </Group>
      <Cloud x={4} y={2} w={92} top={C.storm[0]} bottom={C.storm[1]} t={drift} amp={2} />
    </>
  );
}

function ColdIcon() {
  const t = useLoop(3200);
  const spin = useLoop(14000);
  const big = useDerivedValue(() => [{ rotate: spin.value * Math.PI * 2 }]);
  const arms = [0, Math.PI / 3, (2 * Math.PI) / 3];
  return (
    <>
      <Group transform={big} origin={vec(50, 44)}>
        {arms.map((a) => (
          <Group key={a}>
            <Line p1={vec(50 - Math.cos(a) * 28, 44 - Math.sin(a) * 28)} p2={vec(50 + Math.cos(a) * 28, 44 + Math.sin(a) * 28)} color="#3FA9E0" strokeWidth={6} strokeCap="round" />
            {[1, -1].map((sgn) => {
              // กิ่งเล็กปลายแขน
              const ex = 50 + sgn * Math.cos(a) * 18;
              const ey = 44 + sgn * Math.sin(a) * 18;
              return [0.6, -0.6].map((d) => (
                <Line key={`${sgn}${d}`} p1={vec(ex, ey)} p2={vec(ex + sgn * Math.cos(a + d) * 9, ey + sgn * Math.sin(a + d) * 9)} color="#6CC4EE" strokeWidth={4} strokeCap="round" />
              ));
            })}
          </Group>
        ))}
        <Circle cx={50} cy={44} r={6} color="#E8F7FF" />
      </Group>
      {[
        { x: 22, ph: 0 },
        { x: 78, ph: 0.45 },
        { x: 40, ph: 0.75 },
      ].map((f) => (
        <Flake key={f.x} x={f.x} y0={62} size={4} fall={30} t={t} phase={f.ph} color="#7FCDF0" />
      ))}
    </>
  );
}

/** แถบหมอกฝุ่น: เลื่อนผ่านหน้าดวงอาทิตย์ */
function Haze({ y, w, t, phase }: { y: number; w: number; t: Clock; phase: number }) {
  const p1 = useDerivedValue(() => vec(50 - w / 2 + wave(t.value, phase) * 9, y));
  const p2 = useDerivedValue(() => vec(50 + w / 2 + wave(t.value, phase) * 9, y));
  const op = useDerivedValue(() => 0.6 + 0.3 * wave(t.value, phase + 0.25));
  return <Line p1={p1} p2={p2} color="#B48A5E" strokeWidth={7} strokeCap="round" opacity={op} />;
}
function DustIcon() {
  const t = useLoop(4200);
  const spin = useLoop(20000);
  return (
    <>
      <Sun cx={50} cy={40} r={24} t={t} spin={spin} inner="#F6D9A8" outer="#C7884A" glow="#D9A76A" rays={false} />
      <Haze y={58} w={64} t={t} phase={0} />
      <Haze y={70} w={74} t={t} phase={0.35} />
      <Haze y={82} w={56} t={t} phase={0.7} />
    </>
  );
}

function HorizonIcon({ rising }: { rising: boolean }) {
  const t = useLoop(3600);
  const spin = useLoop(16000);
  // ดวงอาทิตย์เลื่อนขึ้น (หรือลง) ช้าๆ เหนือเส้นขอบฟ้า
  const p = useLoop(4200);
  const tr = useDerivedValue(() => [{ translateY: (rising ? 1 - p.value : p.value) * 14 }]);
  const op = useDerivedValue(() => (p.value < 0.15 ? p.value / 0.15 : p.value > 0.85 ? (1 - p.value) / 0.15 : 1));
  const clip = useMemo(() => Skia.XYWHRect(0, 0, 100, 70), []);
  return (
    <>
      <Group clip={clip}>
        <Group transform={tr} opacity={op}>
          {rising ? (
            <Sun cx={50} cy={62} r={18} t={t} spin={spin} inner="#FFE27A" outer="#F7931E" glow="#FFB547" />
          ) : (
            <Sun cx={50} cy={58} r={18} t={t} spin={spin} inner="#FFC067" outer="#E2533A" glow="#FF8A5C" />
          )}
        </Group>
      </Group>
      <Line p1={vec(12, 72)} p2={vec(88, 72)} color={rising ? '#F2A33A' : '#D9654A'} strokeWidth={5} strokeCap="round" />
      <Line p1={vec(28, 84)} p2={vec(72, 84)} color={rising ? '#F6C27A' : '#E9957C'} strokeWidth={4} strokeCap="round" opacity={0.7} />
    </>
  );
}

function NightIcon() {
  const t = useLoop(3000);
  const moon = useMemo(() => {
    const a = Skia.Path.Make();
    a.addCircle(44, 54, 30);
    const b = Skia.Path.Make();
    b.addCircle(60, 42, 25);
    return Skia.Path.MakeFromOp(a, b, PathOp.Difference) ?? a;
  }, []);
  const glow = useDerivedValue(() => 0.35 + 0.15 * wave(t.value));
  return (
    <>
      <Path path={moon} color="#FFE48A" opacity={glow}>
        <BlurMask blur={8} style="normal" />
      </Path>
      <Path path={moon}>
        <LinearGradient start={vec(20, 28)} end={vec(62, 80)} colors={['#FFF6CF', '#F2C53D']} />
        <Shadow dx={0} dy={2} blur={3} color="rgba(120,90,0,0.25)" />
      </Path>
      <Star x={74} y={24} s={7} t={t} phase={0} />
      <Star x={84} y={50} s={5} t={t} phase={0.4} />
      <Star x={64} y={70} s={4} t={t} phase={0.7} />
    </>
  );
}

function Scene({ sky }: { sky: SkyKind }) {
  switch (sky) {
    case 'sun':
      return <SunIcon />;
    case 'hot':
      return <SunIcon hot />;
    case 'partly':
      return <PartlyIcon />;
    case 'cloudy':
      return <CloudyIcon />;
    case 'fog':
      return <FogIcon />;
    case 'drizzle':
    case 'rain':
    case 'heavy':
      return <RainIcon level={sky} />;
    case 'thunder':
      return <ThunderIcon />;
    case 'cold':
      return <ColdIcon />;
    case 'dust':
      return <DustIcon />;
    case 'sunrise':
      return <HorizonIcon rising />;
    case 'sunset':
      return <HorizonIcon rising={false} />;
    case 'night':
      return <NightIcon />;
  }
}

export function WeatherIcon({ sky, size = 22 }: { sky: SkyKind; size?: number }) {
  const scale = useMemo(() => [{ scale: size / 100 }], [size]);
  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={scale}>
        <Scene key={sky} sky={sky} />
      </Group>
    </Canvas>
  );
}
