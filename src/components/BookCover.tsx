/**
 * ปกหนังสือตำรา — สีปกหนังตามประเภท, สันหนังสือ, ขอบกระดาษ, กรอบลายทอง, ตราไอคอนบนปก, ชื่อเรื่องปั๊มทอง
 * ใช้กับคลังภูมิ (แถวล่าสุด / ชั้นหนังสือทั้งหมด)
 */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sym } from './ios';
import type { Wisdom } from '../data/mock';

export const COVER_TONE: Record<Wisdom['kind'], { a: string; b: string; icon: string }> = {
  ตำรับยา: { a: '#2A6B48', b: '#123A26', icon: 'leaf.fill' },
  วิธีรักษา: { a: '#2E5A92', b: '#152D52', icon: 'hand.raised.fill' },
  'คาถา/พิธี': { a: '#5E3F8C', b: '#2E1D4D', icon: 'sparkles' },
  ตำราโบราณ: { a: '#8A5E2C', b: '#4A3014', icon: 'scroll.fill' },
};
const GOLD = '#E9C77B';

export function BookCover({ w, width }: { w: Wisdom; width: number }) {
  const tone = COVER_TONE[w.kind] ?? COVER_TONE['ตำรับยา'];
  const h = Math.round(width * 1.42);
  const k = width / 150; // สเกลรายละเอียดตามขนาดปก
  const spine = Math.round(12 * k);
  return (
    <View style={{ width: width + 4 * k, height: h }}>
      {/* ขอบกระดาษด้านขวา (หน้าหนังสือ) */}
      <View style={[styles.pages, { left: 6 * k, top: 4 * k, bottom: 4 * k, right: 0, borderRadius: 6 * k }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ position: 'absolute', right: (1 + i * 1.3) * k, top: 2 * k, bottom: 2 * k, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(120,100,70,0.35)' }} />
        ))}
      </View>
      {/* ปก */}
      <View style={[styles.cover, { width, height: h, borderTopRightRadius: 8 * k, borderBottomRightRadius: 8 * k, borderTopLeftRadius: 4 * k, borderBottomLeftRadius: 4 * k }]}>
        <LinearGradient colors={[tone.a, tone.b]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* สันหนังสือ */}
        <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.15)', 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0.25)']} locations={[0, 0.55, 0.8, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: spine }} />
        <View style={{ position: 'absolute', left: spine, top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.18)' }} />
        {/* แสงเงาบนผิวปก */}
        <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.18)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* กรอบลายทอง */}
        <View style={[styles.frame, { left: spine + 7 * k, right: 8 * k, top: 8 * k, bottom: 8 * k, borderRadius: 4 * k, borderWidth: Math.max(1, 1.2 * k) }]}>
          <View style={[styles.frame, { left: 3 * k, right: 3 * k, top: 3 * k, bottom: 3 * k, borderRadius: 3 * k, borderWidth: StyleSheet.hairlineWidth, opacity: 0.7 }]} />
        </View>
        {/* ตราไอคอนบนปก */}
        <View style={{ position: 'absolute', left: spine, right: 0, top: h * 0.16, alignItems: 'center' }}>
          <View style={[styles.emblem, { width: 46 * k, height: 46 * k, borderRadius: 23 * k, borderWidth: 1.5 * k }]}>
            <Sym name={tone.icon as any} size={20 * k} color={GOLD} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 * k, marginTop: 7 * k }}>
            <View style={{ width: 10 * k, height: 1, backgroundColor: GOLD, opacity: 0.7 }} />
            <View style={{ width: 3 * k, height: 3 * k, borderRadius: 2, backgroundColor: GOLD, transform: [{ rotate: '45deg' }] }} />
            <View style={{ width: 10 * k, height: 1, backgroundColor: GOLD, opacity: 0.7 }} />
          </View>
        </View>
        {/* ชื่อเรื่องปั๊มทอง */}
        <View style={{ position: 'absolute', left: spine + 14 * k, right: 14 * k, top: h * 0.5, bottom: 22 * k, alignItems: 'center' }}>
          <Text numberOfLines={3} style={[styles.title, { fontSize: 14.5 * k, lineHeight: 20 * k }]}>{w.title}</Text>
        </View>
        <Text style={[styles.kind, { fontSize: 9 * k, bottom: 13 * k, left: spine }]}>{w.kind}</Text>
        {/* ริบบิ้นรอตรวจทาน */}
        {w.verified ? null : <View style={[styles.ribbon, { right: 14 * k, width: 12 * k, height: 26 * k }]} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pages: { position: 'absolute', backgroundColor: '#F4EBD6', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(120,100,70,0.3)' },
  cover: { position: 'absolute', left: 0, top: 0, overflow: 'hidden', backgroundColor: '#1E3A2A' },
  frame: { position: 'absolute', borderColor: 'rgba(233,199,123,0.75)' },
  emblem: { alignItems: 'center', justifyContent: 'center', borderColor: GOLD, backgroundColor: 'rgba(0,0,0,0.18)' },
  title: { color: GOLD, fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  kind: { position: 'absolute', right: 0, textAlign: 'center', color: 'rgba(233,199,123,0.8)', fontWeight: '600', letterSpacing: 1 },
  ribbon: { position: 'absolute', top: 0, backgroundColor: '#C9483B', borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
});
