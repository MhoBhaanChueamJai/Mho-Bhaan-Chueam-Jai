/**
 * แผนที่แบบเบา (ภาพแผนที่ OpenStreetMap) — ใช้ได้ทุกแพลตฟอร์ม ไม่ต้องมีคีย์
 * ลากเพื่อเลื่อน · ปุ่ม +/− ซูม · แตะแผนที่ = เลือกตำแหน่ง · แตะหมุด = เลือกหมุด
 * ตามนโยบาย OSM: ระบุชื่อแอปใน User-Agent และแสดงเครดิต © OpenStreetMap
 */
import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Sym } from './ios';
import { PressableScale, T } from './ui';
import { elevation, palette } from '../theme';

const TILE = 256;
const UA = { 'User-Agent': 'MhoBhaanChueamJai/1.0 (herb spots; github.com/MhoBhaanChueamJai)' };
const worldX = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z;
const worldY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z;
};
const lonOf = (x: number, z: number) => (x / (TILE * 2 ** z)) * 360 - 180;
const latOf = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / (TILE * 2 ** z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

export type Pin = { id: string; lat: number; lon: number; color?: string; selected?: boolean };

export function TileMap({ center, zoom: z0 = 15, pins, onPress, onPinPress, height = 300, marker }: { center: { lat: number; lon: number }; zoom?: number; pins: Pin[]; onPress?: (lat: number, lon: number) => void; onPinPress?: (id: string) => void; height?: number; marker?: { lat: number; lon: number } | null }) {
  const [w, setW] = useState(0);
  const [z, setZ] = useState(z0);
  const [c, setC] = useState(center);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  // ตำแหน่งกลางจอ (พิกเซลของโลก) รวมระยะที่กำลังลาก
  const cx = worldX(c.lon, z) - drag.x;
  const cy = worldY(c.lat, z) - drag.y;
  const left = cx - w / 2;
  const top = cy - height / 2;

  const tiles = useMemo(() => {
    if (!w) return [];
    const out: { k: string; x: number; y: number; url: string }[] = [];
    const n = 2 ** z;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++)
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        out.push({ k: `${z}/${tx}/${ty}`, x: tx * TILE - left, y: ty * TILE - top, url: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png` });
      }
    return out;
  }, [w, z, left, top, height]);

  const endDrag = (dx: number, dy: number) => {
    setC({ lat: latOf(worldY(c.lat, z) - dy, z), lon: lonOf(worldX(c.lon, z) - dx, z) });
    setDrag({ x: 0, y: 0 });
  };
  const tap = (x: number, y: number) => onPress?.(latOf(top + y, z), lonOf(left + x, z));
  const pan = Gesture.Pan()
    .minDistance(6)
    .onUpdate((e) => runOnJS(setDrag)({ x: e.translationX, y: e.translationY }))
    .onEnd((e) => runOnJS(endDrag)(e.translationX, e.translationY));
  const tapG = Gesture.Tap().onEnd((e) => runOnJS(tap)(e.x, e.y));

  const at = (lat: number, lon: number) => ({ left: worldX(lon, z) - left, top: worldY(lat, z) - top });

  return (
    <View style={[styles.box, { height }]} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <GestureDetector gesture={Gesture.Exclusive(pan, tapG)}>
        <View style={StyleSheet.absoluteFill}>
          {tiles.map((t) => (
            <Image key={t.k} source={{ uri: t.url, headers: UA }} style={{ position: 'absolute', left: t.x, top: t.y, width: TILE, height: TILE }} cachePolicy="disk" />
          ))}
          {pins.map((p) => {
            const pos = at(p.lat, p.lon);
            if (pos.left < -20 || pos.left > w + 20 || pos.top < -40 || pos.top > height + 20) return null;
            return (
              <PressableScale key={p.id} haptic="select" onPress={() => onPinPress?.(p.id)} hitSlop={8} style={[styles.pin, { left: pos.left - 15, top: pos.top - 34 }]} accessibilityLabel="หมุดสมุนไพร">
                <Sym name="mappin.circle.fill" size={p.selected ? 34 : 30} color={p.color ?? palette.primary} />
              </PressableScale>
            );
          })}
          {marker ? (
            <View pointerEvents="none" style={[styles.pin, { left: at(marker.lat, marker.lon).left - 15, top: at(marker.lat, marker.lon).top - 34 }]}>
              <Sym name="mappin.circle.fill" size={34} color={palette.coral} />
            </View>
          ) : null}
        </View>
      </GestureDetector>
      <View style={styles.zoom}>
        <PressableScale haptic="select" onPress={() => setZ((x) => Math.min(19, x + 1))} style={[styles.zbtn, elevation.e1]} accessibilityLabel="ขยายแผนที่">
          <Sym name="plus" size={18} color={palette.ink} weight="semibold" />
        </PressableScale>
        <PressableScale haptic="select" onPress={() => setZ((x) => Math.max(5, x - 1))} style={[styles.zbtn, elevation.e1]} accessibilityLabel="ย่อแผนที่">
          <Sym name="minus" size={18} color={palette.ink} weight="semibold" />
        </PressableScale>
      </View>
      <View style={styles.credit} pointerEvents="none">
        <T v="micro" color="#333">© OpenStreetMap</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#E8EEE9' },
  pin: { position: 'absolute', width: 30, height: 34, alignItems: 'center' },
  zoom: { position: 'absolute', right: 10, top: 10, gap: 8 },
  zbtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  credit: { position: 'absolute', right: 6, bottom: 4, paddingHorizontal: 5, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.75)' },
});
