/**
 * ปกตำรา — ภาพปกหนังสือผ้าเก่าแบบภาพถ่ายจริง (สร้างด้วย AI) 4 สีตามประเภท
 * สันและมุมหุ้มหนัง ป้ายกระดาษว่าง (เขียนชื่อเรื่องทับลงไป) ตราปั๊มทองตามประเภท
 * rect = ตำแหน่งป้ายกระดาษบนภาพ (สัดส่วน x, y, กว้าง, สูง) · ริบบิ้นแดงห้อยล่าง = รอตรวจทาน
 */
import { Image } from 'expo-image';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { Wisdom } from '../data/mock';

export const COVERS: Record<Wisdom['kind'], { src: number; aspect: number; rect: [number, number, number, number] }> = {
  ตำรับยา: { src: require('../../assets/vault/covers/green.png'), aspect: 1.4229, rect: [0.2943, 0.0974, 0.3786, 0.1737] },
  วิธีรักษา: { src: require('../../assets/vault/covers/blue.png'), aspect: 1.4181, rect: [0.2875, 0.1508, 0.3847, 0.1675] },
  'คาถา/พิธี': { src: require('../../assets/vault/covers/plum.png'), aspect: 1.4918, rect: [0.3001, 0.1116, 0.364, 0.1693] },
  ตำราโบราณ: { src: require('../../assets/vault/covers/brown.png'), aspect: 1.4779, rect: [0.2718, 0.1364, 0.4504, 0.1839] },
};
const INK = '#3B2A1A';
const SERIF = Platform.select({ ios: 'Sukhumvit Set', default: undefined });
/** ทุกเล่มขนาดเท่ากัน = กว้าง × 1.45 (ภาพต้นฉบับต่างกัน ≤3% → ปรับให้เต็มกรอบ) */
export const COVER_RATIO = 1.45;

export function BookCover({ w, width }: { w: Wisdom; width: number }) {
  const c = COVERS[w.kind] ?? COVERS['ตำรับยา'];
  const H = width * COVER_RATIO;
  const ih = H;
  const top = 0;
  const [rx, ry, rw, rh] = c.rect;
  const k = width / 150;
  return (
    <View style={{ width, height: H }}>
      {/* เงาใต้เล่ม (เฉพาะตัวหนังสือ ไม่รวมช่องว่างด้านบน) */}
      <View style={{ position: 'absolute', left: width * 0.03, top: top + ih * 0.02, width: width * 0.94, height: ih * 0.97, borderRadius: 4 * k, backgroundColor: 'rgba(0,0,0,0.01)', boxShadow: '0px 10px 16px rgba(20,40,30,0.28), 0px 2px 4px rgba(20,40,30,0.2)' }} />
      <Image source={c.src} style={{ position: 'absolute', left: 0, top, width, height: ih }} contentFit="fill" />
      {/* ชื่อเรื่องบนป้ายกระดาษ (ตัวหมึก) */}
      <View style={{ position: 'absolute', left: width * (rx + 0.015), top: top + ih * (ry + 0.015), width: width * (rw - 0.03), height: ih * (rh - 0.03), alignItems: 'center', justifyContent: 'center' }}>
        <Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.55} style={[styles.title, { fontSize: 11 * k, lineHeight: 13.5 * k, fontFamily: SERIF }]}>{w.title}</Text>
      </View>
      {/* ริบบิ้นที่คั่นห้อยล่าง = รอตรวจทาน */}
      {w.verified ? null : <View style={[styles.ribbon, { right: width * 0.2, width: 9 * k, height: H * 0.12, bottom: -H * 0.03 }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: INK, fontWeight: '700', textAlign: 'center' },
  ribbon: { position: 'absolute', backgroundColor: '#A8352A', borderBottomLeftRadius: 1, borderBottomRightRadius: 1, boxShadow: '0px 1px 2px rgba(0,0,0,0.35)' },
});
