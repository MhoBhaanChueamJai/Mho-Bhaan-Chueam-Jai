/**
 * ตัวเลือกธาตุเจ้าเรือน — ไอคอนธาตุ 3D วาดด้วย shader (Skia SkSL) ในปุ่ม Liquid Glass
 * ไม่ได้เลือก = ภาพนิ่ง · เลือก = เล่นแอนิเมชันของธาตุ (energy 0→1 + เวลาเดิน)
 *   ไฟ  — เปลวไฟหลายชั้น แกนร้อนขาวเหลือง ลุกโชนสูงขึ้น มีสะเก็ดไฟลอย แสงเรืองที่ฐาน
 *   น้ำ — หยดน้ำทรงหยด แสงหักเห ไฮไลต์สะท้อน กระเพื่อม + วงคลื่นที่ฐาน
 *   ลม — กระแสลมหมุนวนเป็นริ้ว มีมิติแสงเงา หมุนเร็วขึ้นเมื่อเลือก
 *   ดิน — ก้อนดินทรงกลมผิวหิน หญ้าคลุมด้านบน แสงตกกระทบ เงาสัมผัส หมุนช้าๆ เมื่อเลือก
 */
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { Sym } from './ios';
import { Glass, PressableScale, T } from './ui';
import type { Patient } from '../data/mock';
import { palette } from '../theme';

type El = Patient['element'];

const LIB = `
float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float noise(float2 p) {
  float2 i = floor(p); float2 f = fract(p); float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), u.x), mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x), u.y);
}
float fbm(float2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + float2(1.7, 9.2); a *= 0.5; }
  return v;
}
`;

const FIRE = `uniform float2 res; uniform float t; uniform float e;
${LIB}
half4 main(float2 fc) {
  float2 uv = fc / res;
  float2 q = float2((uv.x - 0.5) * 1.5, 1.0 - uv.y);
  float rise = t * (0.5 + 1.8 * e);
  float h = 0.5 + 0.38 * e;
  float n = fbm(float2(q.x * 2.4, q.y * 2.0 - rise));
  float n2 = fbm(float2(q.x * 5.0 + 3.0, q.y * 4.0 - rise * 1.7));
  float y = q.y + (n - 0.5) * (0.18 + 0.12 * e);
  float width = mix(0.40, 0.015, clamp(y / h, 0.0, 1.0));
  float x = abs(q.x + (n2 - 0.5) * (0.16 + 0.1 * e) * q.y);
  float body = (1.0 - smoothstep(width * 0.5, width, x)) * (1.0 - smoothstep(h * 0.7, h * 1.05, y)) * smoothstep(0.05, 0.15, q.y);
  float core = (1.0 - smoothstep(width * 0.12, width * 0.55, x)) * (1.0 - smoothstep(h * 0.2, h * 0.65, y)) * smoothstep(0.07, 0.17, q.y);
  float3 col = float3(0.62, 0.05, 0.02) * body;
  col = mix(col, float3(1.0, 0.42, 0.04), body * smoothstep(0.15, 0.9, body));
  col = mix(col, float3(1.0, 0.82, 0.30), core);
  col = mix(col, float3(1.0, 0.98, 0.86), core * core * core);
  float2 sp = float2(q.x * 8.0, q.y * 8.0 - t * 3.2);
  float s = step(0.965, hash(floor(sp))) * (1.0 - smoothstep(0.0, 0.22, length(fract(sp) - 0.5))) * e * smoothstep(0.35, 0.9, q.y) * (1.0 - smoothstep(0.9, 1.0, q.y));
  col += float3(1.0, 0.62, 0.22) * s;
  float a = clamp(max(body, s), 0.0, 1.0);
  float g = exp(-dot(float2(q.x * 1.3, (q.y - 0.1) * 3.2), float2(q.x * 1.3, (q.y - 0.1) * 3.2)) * 5.0) * (0.25 + 0.45 * e);
  col += float3(1.0, 0.32, 0.05) * g * (1.0 - a);
  a = clamp(a + g * 0.55, 0.0, 1.0);
  return half4(half3(col), half(a));
}`;

const WATER = `uniform float2 res; uniform float t; uniform float e;
${LIB}
half4 main(float2 fc) {
  float2 uv = fc / res;
  float2 p = float2(uv.x - 0.5, uv.y - 0.6);
  p.x += sin(p.y * 14.0 - t * 5.0) * 0.012 * e;
  float r = 0.27;
  float circ = sqrt(max(r * r - p.y * p.y, 0.0));
  // กรวยปลายหยดสัมผัสวงกลมพอดี (tangent) → รูปหยดน้ำเรียบต่อเนื่อง
  float H = 0.44;
  float sa = r / H;
  float ty = -p.y;
  float tip = (ty > r * sa) ? (H - ty) * sa / sqrt(max(1.0 - sa * sa, 0.01)) : 0.0;
  float rad = max(circ, tip);
  float inside = 1.0 - smoothstep(rad - 0.012, rad + 0.004, abs(p.x));
  inside *= (p.y < r && p.y > -H) ? 1.0 : 0.0;
  float nx = p.x / max(rad, 0.001);
  float ny = clamp(p.y / r, -1.0, 1.0);
  float3 nrm = normalize(float3(nx * 0.9, ny * 0.5, sqrt(max(1.0 - nx * nx * 0.8, 0.05))));
  float3 L = normalize(float3(-0.5, -0.7, 0.6));
  float diff = clamp(dot(nrm, L), 0.0, 1.0);
  float fres = pow(1.0 - nrm.z, 2.2);
  float caus = fbm(float2(p.x * 16.0 + t * 0.6, p.y * 16.0 - t * 0.9));
  float3 deep = float3(0.02, 0.30, 0.62);
  float3 shallow = float3(0.30, 0.78, 0.98);
  float3 col = mix(deep, shallow, 0.25 + 0.6 * diff);
  col = mix(col, deep * 0.7, smoothstep(0.05, 0.27, p.y) * 0.45);
  col += float3(0.7, 0.97, 1.0) * smoothstep(0.62, 0.78, caus) * 0.18 * smoothstep(0.0, 0.2, p.y + 0.1);
  col = mix(col, float3(0.75, 0.95, 1.0), fres * 0.6);
  float2 hl = (p - float2(-0.09, 0.0)) * float2(1.0, 0.7);
  col += float3(1.0) * (1.0 - smoothstep(0.0, 0.06, length(hl))) * 0.95;
  col += float3(1.0) * (1.0 - smoothstep(0.0, 0.025, length(p - float2(0.1, 0.12)))) * 0.6;
  float a = inside * 0.96;
  float rp = length(float2(p.x, (p.y - 0.31) * 3.2));
  float ring = 0.0;
  for (int i = 0; i < 3; i++) {
    float ph = fract(t * 0.45 + float(i) / 3.0);
    ring += (1.0 - smoothstep(0.0, 0.02, abs(rp - (0.1 + ph * 0.32)))) * (1.0 - ph);
  }
  ring *= e * (1.0 - inside);
  float sh = exp(-pow(rp * 3.5, 2.0)) * 0.22 * (1.0 - inside);
  float3 outc = col * a + float3(0.4, 0.85, 1.0) * ring * 0.7;
  float oa = clamp(a + ring * 0.7 + sh, 0.0, 1.0);
  return half4(half3(outc), half(oa));
}`;

const WIND = `uniform float2 res; uniform float t; uniform float e;
${LIB}
half4 main(float2 fc) {
  float2 uv = fc / res;
  float2 p = (uv - 0.5) * float2(1.0, 1.15);
  float r = length(p);
  float ang = atan(p.y, p.x);
  float spin = t * (0.35 + 2.6 * e);
  float n = fbm(float2(ang * 1.5 + spin * 0.4, r * 6.0 - spin));
  float bands = sin(ang * 2.0 + r * 22.0 - spin * 3.0 + n * 3.0);
  float streak = smoothstep(0.55, 0.98, bands);
  float env = smoothstep(0.06, 0.14, r) * (1.0 - smoothstep(0.36, 0.46, r));
  float lit = 0.55 + 0.45 * sin(ang - 0.8);
  float3 col = mix(float3(0.55, 0.80, 0.86), float3(0.97, 1.0, 1.0), lit);
  col = mix(col, float3(0.30, 0.62, 0.72), (1.0 - lit) * 0.5);
  float a = streak * env * (0.65 + 0.35 * n);
  float core = (1.0 - smoothstep(0.0, 0.12, r)) * 0.35;
  float3 c = col * a + float3(0.85, 0.97, 1.0) * core;
  float sh = exp(-pow(length(float2(p.x, (p.y - 0.42) * 4.0)) * 3.0, 2.0)) * 0.15;
  return half4(half3(c), half(clamp(a + core + sh, 0.0, 1.0)));
}`;

const EARTH = `uniform float2 res; uniform float t; uniform float e;
${LIB}
half4 main(float2 fc) {
  float2 uv = fc / res;
  float2 p = (uv - float2(0.5, 0.52)) / 0.36;
  float d = dot(p, p);
  float inside = 1.0 - smoothstep(0.96, 1.0, d);
  float z = sqrt(max(1.0 - d, 0.0));
  float3 nrm = normalize(float3(p.x, p.y, z));
  float rot = t * 0.35 * e;
  float lon = atan(nrm.x, nrm.z) + rot;
  float2 tc = float2(lon * 1.6, nrm.y * 2.2);
  float rock = fbm(tc * 2.0);
  float crack = 1.0 - smoothstep(0.0, 0.02, abs(fbm(tc * 3.5 + 7.0) - 0.5) - 0.01);
  float3 L = normalize(float3(-0.55, -0.75, 0.55));
  float diff = clamp(dot(nrm, L), 0.0, 1.0);
  float3 soil = mix(float3(0.36, 0.22, 0.12), float3(0.62, 0.42, 0.24), rock);
  soil = mix(soil, float3(0.2, 0.12, 0.07), crack * 0.6);
  float grass = 1.0 - smoothstep(-0.45, -0.25, nrm.y + (fbm(tc * 4.0) - 0.5) * 0.35);
  float3 g = mix(float3(0.18, 0.42, 0.14), float3(0.40, 0.68, 0.26), fbm(tc * 6.0));
  float3 col = mix(soil, g, grass);
  col *= 0.28 + 0.85 * diff;
  float3 H = normalize(L + float3(0.0, 0.0, 1.0));
  col += float3(1.0, 0.95, 0.85) * pow(clamp(dot(nrm, H), 0.0, 1.0), 24.0) * 0.25 * (0.4 + grass);
  col += float3(0.5, 0.7, 0.45) * pow(1.0 - z, 3.0) * 0.25;
  float sh = exp(-pow(length(float2(p.x * 0.9, (p.y - 1.12) * 4.0)), 2.0) * 3.0) * 0.35 * (1.0 - inside);
  float2 dp = float2(p.x * 3.0, p.y * 3.0 + t * 0.8);
  float dust = step(0.975, hash(floor(dp))) * (1.0 - smoothstep(0.0, 0.25, length(fract(dp) - 0.5))) * e * (1.0 - inside) * (1.0 - smoothstep(1.0, 1.4, length(p)));
  float3 c = col * inside + float3(0.7, 0.55, 0.35) * dust;
  return half4(half3(c), half(clamp(inside + sh + dust, 0.0, 1.0)));
}`;

const SRC: Record<El, string> = { ไฟ: FIRE, น้ำ: WATER, ลม: WIND, ดิน: EARTH };
const EFFECTS = Object.fromEntries(Object.entries(SRC).map(([k, s]) => [k, Skia.RuntimeEffect.Make(s)])) as Record<El, ReturnType<typeof Skia.RuntimeEffect.Make>>;
/** ภาพนิ่งตอนยังไม่เลือก: เลือกเฟรมที่สวยที่สุดของแต่ละธาตุ */
const IDLE_T: Record<El, number> = { ไฟ: 1.7, น้ำ: 0.3, ลม: 0.9, ดิน: 0.0 };
const TINT: Record<El, string> = { ไฟ: '#F26B1D', น้ำ: '#1E9BE0', ลม: '#5FB8C8', ดิน: '#8A5A2E' };
const FALLBACK: Record<El, string> = { ไฟ: 'flame.fill', น้ำ: 'drop.fill', ลม: 'wind', ดิน: 'mountain.2.fill' };

function ElementIcon({ el, active, size = 58 }: { el: El; active: boolean; size?: number }) {
  const time = useSharedValue(IDLE_T[el]);
  const energy = useSharedValue(0);
  const cb = useFrameCallback((f) => {
    time.value += (f.timeSincePreviousFrame ?? 16) / 1000;
  }, false);
  useEffect(() => {
    cb.setActive(active);
    energy.value = withTiming(active ? 1 : 0, { duration: active ? 900 : 500, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const uniforms = useDerivedValue(() => ({ res: [size, size], t: time.value, e: energy.value }));
  const fx = EFFECTS[el];
  if (!fx) return <Sym name={FALLBACK[el] as any} size={size * 0.55} color={TINT[el]} />;
  return (
    <Canvas style={{ width: size, height: size }}>
      <Fill>
        <Shader source={fx} uniforms={uniforms} />
      </Fill>
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
          <PressableScale key={el} haptic="select" scaleTo={0.94} onPress={() => onChange(el)} style={{ flex: 1 }} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`ธาตุ${el}`}>
            <View style={[styles.cellShadow, on && { boxShadow: `0px 8px 22px ${TINT[el]}55` }]}>
              <Glass interactive tint={on ? `${TINT[el]}26` : 'rgba(255,255,255,0.55)'} style={[styles.cell, { borderColor: on ? TINT[el] : 'rgba(255,255,255,0.9)' }]}>
                <ElementIcon el={el} active={on} />
                <T v="subhead" color={on ? TINT[el] : palette.ink} style={{ fontWeight: on ? '700' : '500', marginTop: 2 }}>{el}</T>
              </Glass>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  cellShadow: { borderRadius: 22, boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 20px rgba(0,0,0,0.05)' },
  cell: { alignItems: 'center', paddingTop: 10, paddingBottom: 10, borderRadius: 22, borderCurve: 'continuous', borderWidth: 1.5 },
});
