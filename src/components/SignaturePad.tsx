/**
 * ช่องเซ็นชื่อ — ลากนิ้วเขียน เก็บเป็นเส้น SVG (path) ในกรอบ 600×240 (ย่อขยายตามความกว้างจอ)
 * ใช้ได้ทุกแพลตฟอร์ม (react-native-svg + gesture handler)
 */
import React, { useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { palette } from '../theme';

export const SIG_W = 600;
export const SIG_H = 240;

export function SignaturePad({ value, onChange, height = 180, onActive }: { value: string; onChange: (path: string) => void; height?: number; onActive?: (on: boolean) => void }) {
  const [w, setW] = useState(0);
  const cur = useRef('');
  const [live, setLive] = useState('');
  const scale = w ? SIG_W / w : 1;
  const pt = (x: number, y: number) => `${Math.round(x * scale)} ${Math.round(y * (SIG_H / height))}`;

  const start = (x: number, y: number) => {
    onActive?.(true);
    cur.current = `M${pt(x, y)}`;
    setLive(cur.current);
  };
  const move = (x: number, y: number) => {
    cur.current += ` L${pt(x, y)}`;
    setLive(cur.current);
  };
  const end = () => {
    onActive?.(false);
    if (cur.current) onChange(`${value} ${cur.current}`.trim());
    cur.current = '';
    setLive('');
  };
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(start)(e.x, e.y))
    .onUpdate((e) => runOnJS(move)(e.x, e.y))
    .onFinalize(() => runOnJS(end)());

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.box, { height }]} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityLabel="ช่องเซ็นชื่อ ลากนิ้วเพื่อเซ็น">
        <View pointerEvents="none" style={[styles.line, { top: height * 0.72 }]} />
        <Svg width="100%" height="100%" viewBox={`0 0 ${SIG_W} ${SIG_H}`} preserveAspectRatio="none" pointerEvents="none">
          <Path d={`${value} ${live}`.trim() || 'M0 0'} stroke={palette.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </View>
    </GestureDetector>
  );
}

/** ลายเซ็นเป็น SVG สำหรับใส่ในเอกสาร PDF */
export const signatureSvg = (path: string, w = 220) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${Math.round((w * SIG_H) / SIG_W)}" viewBox="0 0 ${SIG_W} ${SIG_H}"><path d="${path.replace(/[^MLml0-9 .\-]/g, '')}" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

const styles = StyleSheet.create({
  box: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)', borderStyle: 'dashed', overflow: 'hidden' },
  line: { position: 'absolute', left: 24, right: 24, height: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
});
