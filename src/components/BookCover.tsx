/**
 * ปกตำราแบบหนังสือภาพประกอบวินเทจ (ลายเส้นปั๊มทอง/ทองแดงบนพื้นสี สร้างด้วย AI) 4 แบบตามประเภท
 * กรอบลายดอกไม้ไทย + ช่องโค้งว่างกลางปก (ใส่ชื่อเรื่องสีเดียวกับลายเส้น) + ภาพประกอบประจำประเภท
 * rect = ช่องชื่อเรื่องบนภาพ (สัดส่วน x, y, กว้าง, สูง) · ริบบิ้นแดงห้อยล่าง = รอตรวจทาน
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import type { Wisdom } from '../data/mock';

export const COVERS: Record<Wisdom['kind'], { src: number; ink: string; rect: [number, number, number, number] }> = {
  ตำรับยา: { src: require('../../assets/vault/covers/remedy.jpg'), ink: '#E2C47E', rect: [0.28, 0.2, 0.44, 0.2] },
  วิธีรักษา: { src: require('../../assets/vault/covers/treatment.jpg'), ink: '#E6B49C', rect: [0.29, 0.27, 0.42, 0.21] },
  'คาถา/พิธี': { src: require('../../assets/vault/covers/ritual.jpg'), ink: '#E8CF97', rect: [0.28, 0.25, 0.44, 0.21] },
  ตำราโบราณ: { src: require('../../assets/vault/covers/ancient.jpg'), ink: '#E2C47E', rect: [0.27, 0.27, 0.46, 0.21] },
};
const SERIF = Platform.select({ ios: 'Sukhumvit Set', default: undefined });
export const COVER_RATIO = 700 / 480;

export function BookCover({ w, width }: { w: Wisdom; width: number }) {
  const c = COVERS[w.kind] ?? COVERS['ตำรับยา'];
  const H = width * COVER_RATIO;
  const [rx, ry, rw, rh] = c.rect;
  const k = width / 150;
  return (
    <View style={{ width, height: H }}>
      {/* เงาใต้เล่ม */}
      <View style={[StyleSheet.absoluteFill, { borderRadius: 4 * k, backgroundColor: '#000', boxShadow: '0px 10px 16px rgba(20,30,25,0.30), 0px 2px 4px rgba(20,30,25,0.22)' }]} />
      <View style={[StyleSheet.absoluteFill, { borderTopRightRadius: 5 * k, borderBottomRightRadius: 5 * k, borderTopLeftRadius: 2 * k, borderBottomLeftRadius: 2 * k, overflow: 'hidden' }]}>
        <Image source={c.src} style={StyleSheet.absoluteFill} contentFit="cover" />
        {/* สันหนังสือ: เงาร่องพับด้านซ้าย + แสงบนผิวปก */}
        <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0)']} locations={[0, 0.35, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.09 }} />
        <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.16)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* ชื่อเรื่องในช่องโค้งกลางปก (สีเดียวกับลายเส้นปั๊ม) */}
        <View style={{ position: 'absolute', left: width * rx, top: H * ry, width: width * rw, height: H * rh, alignItems: 'center', justifyContent: 'center' }}>
          <Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.55} style={[styles.title, { color: c.ink, fontSize: 12.5 * k, lineHeight: 16 * k, fontFamily: SERIF }]}>{w.title}</Text>
        </View>
      </View>
      {/* ริบบิ้นที่คั่นห้อยล่าง = รอตรวจทาน */}
      {w.verified ? null : <View style={[styles.ribbon, { right: width * 0.16, width: 9 * k, height: H * 0.12, bottom: -H * 0.03 }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '700', textAlign: 'center', letterSpacing: 0.3, textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 },
  ribbon: { position: 'absolute', backgroundColor: '#A8352A', borderBottomLeftRadius: 1, borderBottomRightRadius: 1, boxShadow: '0px 1px 2px rgba(0,0,0,0.35)' },
});
