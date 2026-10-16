/**
 * ทรงกลม AI (อ้างอิง Dribbble "Sphere — AI Voice Assistant") — วาดด้วย shader (Skia SkSL)
 * ลูกแก้วมืด ขอบเรืองแสงสี (fresnel) + ริบบิ้นแสงพลิ้วอยู่ข้างใน สีไล่เฉดหมุนวงล้อสีต่อเนื่อง
 * level (0..1) = ระดับเสียง AI/ไมค์ → ริบบิ้นหนาขึ้น คลื่นแรงขึ้น ขอบสว่างขึ้น
 */
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

export const SPHERE_SKSL = `uniform float2 res; uniform float t; uniform float e;
uniform float3 c1; uniform float3 c2; uniform float3 c3;
half4 main(float2 fc) {
  float2 uv = (fc - 0.5 * res) / (0.5 * min(res.x, res.y));
  float r = length(uv);
  float R = 0.86;
  float2 p = uv / R;
  float inside = 1.0 - smoothstep(R - 0.012, R + 0.004, r);
  float z = sqrt(max(1.0 - dot(p, p), 0.0));
  float amp = 0.16 + 0.24 * e;
  float y0 = 0.32 * p.x - amp * sin(p.x * 2.2 + t * 0.9) - 0.05 * sin(p.x * 5.5 - t * 1.8) * (0.4 + e);
  float d = p.y + y0;
  float th = 0.07 + 0.11 * e;
  float core = exp(-d * d / (th * th * 0.12));
  float glow = exp(-d * d / (th * th * 2.2));
  float haze = exp(-d * d * 3.5);
  float along = smoothstep(-1.0, -0.15, p.x) * (1.0 - 0.35 * smoothstep(0.7, 1.0, p.x));
  float k = clamp(p.x * 0.5 + 0.5, 0.0, 1.0);
  float3 col = mix(c1, c2, smoothstep(0.0, 0.55, k));
  col = mix(col, c3, smoothstep(0.45, 1.0, k));
  float3 inner = col * (glow * 0.85 + core * 1.5) * along * (0.75 + 0.7 * e);
  inner += col * haze * 0.32 * along;
  // ริบบิ้นเส้นที่สอง โผล่ตามระดับเสียง (คลื่นสวนทาง)
  float y1 = 0.18 * p.x + (0.12 + 0.2 * e) * sin(p.x * 3.1 - t * 1.3 + 1.7);
  float d1 = p.y + y1 - 0.06;
  float th1 = 0.05 + 0.08 * e;
  inner += mix(c3, c1, k) * (exp(-d1 * d1 / (th1 * th1 * 0.15)) * 1.1 + exp(-d1 * d1 / (th1 * th1 * 2.0)) * 0.5) * along * e * 0.9;
  inner += mix(c2, c3, 0.5) * exp(-dot(p - float2(0.55, -0.15), p - float2(0.55, -0.15)) * 6.0) * 0.18;
  float fres = pow(1.0 - z, 1.9);
  float ang = atan(p.y, p.x);
  float3 rimc = mix(c1, c3, 0.5 + 0.5 * sin(ang * 1.0 + t * 0.35));
  float3 rim = rimc * fres * (0.95 + 0.5 * e);
  float spec = exp(-pow(length(p - float2(-0.38, -0.5)) * 3.2, 2.0)) * 0.10;
  float3 c = (inner + rim + spec) * inside;
  // ขอบนอก: ต่อเนื่องจากขอบใน (ไม่มีรอยต่อ) + แสงฟุ้งรอบลูก
  float og = exp(-pow((r - R + 0.006) * 26.0, 2.0)) * (0.55 + 0.5 * e) + exp(-pow((r - R) * 9.0, 2.0)) * (0.28 + 0.5 * e) * (1.0 - inside);
  c += rimc * og;
  float a = clamp(inside + og * 0.8, 0.0, 1.0);
  return half4(half3(c), half(a));
}`;

const FX = Skia.RuntimeEffect.Make(SPHERE_SKSL);

export function AISphere({ size = 200, level, active = true }: { size?: number; level?: SharedValue<number>; active?: boolean }) {
  const t = useSharedValue(0);
  const zero = useSharedValue(0);
  const src = level ?? zero;
  const speed = useSharedValue(active ? 1 : 0.4);
  useEffect(() => {
    speed.value = withTiming(active ? 1 : 0.4, { duration: 600 });
  }, [active, speed]);
  const e = useDerivedValue(() => withTiming(Math.min(1, src.value), { duration: 120 }));
  // แสงไหลเร็วขึ้นตามเสียง
  useFrameCallback((f) => {
    t.value += ((f.timeSincePreviousFrame ?? 16) / 1000) * (speed.value + 2.4 * e.value);
  });
  // สีไล่เฉดแบบหมุนวงล้อสี (HSV): ผ่านสีสดเสมอ ไม่หม่น · 3 สีห่างกัน 45° ให้ริบบิ้นไล่เฉดในตัว
  const hue = useSharedValue(300);
  useFrameCallback((f) => {
    hue.value = (hue.value + ((f.timeSincePreviousFrame ?? 16) / 1000) * (9 + 14 * e.value)) % 360;
  });
  const uniforms = useDerivedValue(() => {
    const hsv = (h: number, sat: number, v: number) => {
      const c = v * sat;
      const hh = (((h % 360) + 360) % 360) / 60;
      const x = c * (1 - Math.abs((hh % 2) - 1));
      const m = v - c;
      const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
      return [r + m, g + m, b + m];
    };
    const h = hue.value;
    return { res: [size, size], t: t.value, e: e.value, c1: hsv(h, 0.78, 1), c2: hsv(h + 45, 0.85, 1), c3: hsv(h + 95, 0.8, 1) };
  });
  if (!FX) return <View style={{ width: size, height: size }} />;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Canvas style={{ width: size, height: size }}>
        <Fill>
          <Shader source={FX} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
}
