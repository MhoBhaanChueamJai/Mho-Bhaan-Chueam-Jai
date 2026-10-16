/**
 * ปกตำราแบบ "ปกผ้า + ป้ายกระดาษ" (สมุดบันทึกวินเทจ)
 * ผ้าทอสีเข้มตามประเภท · สันหนังสือร่องลึก · ป้ายกระดาษสีครีมแปะด้านบน (ชื่อเรื่อง) · ไอคอนปั๊มนูนด้านล่าง
 * ขอบกระดาษโผล่ด้านขวา · ริบบิ้นแดง = รอตรวจทาน
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sym } from './ios';
import type { Wisdom } from '../data/mock';

export const COVER_TONE: Record<Wisdom['kind'], { cloth: string; deep: string; icon: string }> = {
  ตำรับยา: { cloth: '#2F5D46', deep: '#1D3D2D', icon: 'leaf.fill' },
  วิธีรักษา: { cloth: '#2D4466', deep: '#1B2B44', icon: 'hand.raised.fill' },
  'คาถา/พิธี': { cloth: '#5A3D6E', deep: '#3A274A', icon: 'sparkles' },
  ตำราโบราณ: { cloth: '#8A5A33', deep: '#5C3A1F', icon: 'scroll.fill' },
};
const CLOTH = require('../../assets/vault/cloth.png');
const CLOTH_D = require('../../assets/vault/cloth-dark.png');
const PAPER = '#F3EAD3';
const INK = '#3B2A1A';

export function BookCover({ w, width }: { w: Wisdom; width: number }) {
  const tone = COVER_TONE[w.kind] ?? COVER_TONE['ตำรับยา'];
  const h = Math.round(width * 1.42);
  const k = width / 150;
  const spine = Math.round(13 * k);
  const iconSize = 26 * k;
  return (
    <View style={{ width: width + 4 * k, height: h }}>
      {/* ขอบกระดาษด้านขวา */}
      <View style={[styles.pages, { left: 6 * k, top: 4 * k, bottom: 4 * k, right: 0, borderRadius: 5 * k }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ position: 'absolute', right: (1 + i * 1.3) * k, top: 2 * k, bottom: 2 * k, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(120,100,70,0.35)' }} />
        ))}
      </View>
      {/* ปกผ้า */}
      <View style={[styles.cover, { width, height: h, backgroundColor: tone.cloth, borderTopRightRadius: 7 * k, borderBottomRightRadius: 7 * k, borderTopLeftRadius: 3 * k, borderBottomLeftRadius: 3 * k }]}>
        <Image source={CLOTH} style={StyleSheet.absoluteFill} contentFit="cover" />
        <Image source={CLOTH_D} style={StyleSheet.absoluteFill} contentFit="cover" />
        {/* แสงเงาผิวผ้า */}
        <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.25)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* สันหนังสือ + ร่องพับ */}
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: spine, backgroundColor: tone.deep, opacity: 0.85 }} />
        <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.35)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: spine, top: 0, bottom: 0, width: 4 * k }} />

        {/* ป้ายกระดาษ */}
        <View style={[styles.label, { left: spine + 12 * k, right: 11 * k, top: 16 * k, height: h * 0.42, borderRadius: 3 * k, padding: 4 * k }]}>
          <View style={[styles.labelIn, { borderRadius: 2 * k, paddingHorizontal: 6 * k, paddingVertical: 7 * k }]}>
            <Text numberOfLines={3} style={[styles.title, { fontSize: 13.5 * k, lineHeight: 18.5 * k }]}>{w.title}</Text>
            <View style={{ width: 22 * k, height: 1, backgroundColor: 'rgba(59,42,26,0.45)', marginVertical: 5 * k }} />
            <Text numberOfLines={1} style={[styles.kind, { fontSize: 8.5 * k }]}>{w.kind}</Text>
          </View>
        </View>

        {/* ไอคอนปั๊มนูน (เงาเข้มล่างขวา + ไฮไลต์บนซ้าย) */}
        <View style={{ position: 'absolute', left: spine, right: 0, bottom: h * 0.13, alignItems: 'center' }}>
          <View style={{ width: iconSize + 6 * k, height: iconSize + 6 * k, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', transform: [{ translateX: 0.8 * k }, { translateY: 1 * k }] }}>
              <Sym name={tone.icon as any} size={iconSize} color="rgba(0,0,0,0.45)" />
            </View>
            <View style={{ position: 'absolute', transform: [{ translateX: -0.6 * k }, { translateY: -0.8 * k }] }}>
              <Sym name={tone.icon as any} size={iconSize} color="rgba(255,255,255,0.28)" />
            </View>
            <Sym name={tone.icon as any} size={iconSize} color={tone.deep} />
          </View>
        </View>

        {/* ริบบิ้นที่คั่นห้อยด้านล่าง = รอตรวจทาน */}
        {w.verified ? null : <View style={[styles.ribbon, { right: 16 * k, width: 11 * k, height: h * 0.16 }]} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pages: { position: 'absolute', backgroundColor: '#F4EBD6', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(120,100,70,0.3)' },
  cover: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  label: { position: 'absolute', backgroundColor: PAPER, boxShadow: '0px 1px 2px rgba(0,0,0,0.35)' },
  labelIn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(59,42,26,0.35)' },
  title: { color: INK, fontWeight: '700', textAlign: 'center' },
  kind: { color: 'rgba(59,42,26,0.7)', fontWeight: '600', letterSpacing: 1 },
  ribbon: { position: 'absolute', bottom: 0, backgroundColor: '#B8402F', boxShadow: '0px 1px 2px rgba(0,0,0,0.35)' },
});
