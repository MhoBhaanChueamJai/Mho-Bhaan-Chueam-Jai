/**
 * ปกตำราแบบ "ปกผ้า + ป้ายกระดาษ" (สมุดบันทึกวินเทจ หุ้มหนังสันและมุม)
 * - ผ้าทอละเอียดสีตามประเภท + แสงเงาผิว + ขอบปกนูน (ไฮไลต์บน-ซ้าย เงาล่าง-ขวา)
 * - สันหุ้มหนังสีเข้ม มีสันนูน 3 เส้น เส้นทอง และผ้าคาดหัว-ท้ายลายริ้ว
 * - มุมหุ้มหนังสามเหลี่ยมด้านขวาบน/ล่าง
 * - ป้ายกระดาษเนื้อเยื่อ กรอบเส้นคู่ ลายดอกประดับบน-ล่าง ชื่อเรื่อง + ประเภท
 * - เหรียญตราปั๊มทองวงแหวน + ไอคอนปั๊มนูนในเนื้อผ้า
 * - ขอบกระดาษด้านขวาและด้านล่าง (ความหนาเล่ม) · ริบบิ้นที่คั่นห้อยล่าง = รอตรวจทาน
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, Image as RNImage, StyleSheet, Text, View } from 'react-native';
import { Sym } from './ios';
import type { Wisdom } from '../data/mock';

export const COVER_TONE: Record<Wisdom['kind'], { cloth: string; deep: string; leather: string; icon: string }> = {
  ตำรับยา: { cloth: '#31614A', deep: '#1D3D2D', leather: '#3B2618', icon: 'leaf.fill' },
  วิธีรักษา: { cloth: '#30496D', deep: '#1B2B44', leather: '#2A1E16', icon: 'hand.raised.fill' },
  'คาถา/พิธี': { cloth: '#5C4071', deep: '#3A274A', leather: '#2E1C22', icon: 'sparkles' },
  ตำราโบราณ: { cloth: '#8D5D36', deep: '#5C3A1F', leather: '#3A2414', icon: 'scroll.fill' },
};
const CLOTH = require('../../assets/vault/cloth.png');
const CLOTH_D = require('../../assets/vault/cloth-dark.png');
const PAPER_TX = require('../../assets/vault/paper.png');
const PAPER = '#F1E6CB';
const INK = '#3B2A1A';
const GOLD = '#D9B66A';
const SERIF = Platform.select({ ios: 'Sukhumvit Set', default: undefined });

export function BookCover({ w, width }: { w: Wisdom; width: number }) {
  const tone = COVER_TONE[w.kind] ?? COVER_TONE['ตำรับยา'];
  const h = Math.round(width * 1.42);
  const k = width / 150;
  const spine = Math.round(16 * k);
  const corner = 26 * k;
  const iconSize = 20 * k;
  const ring = 44 * k;
  return (
    <View style={{ width: width + 5 * k, height: h + 3 * k }}>
      {/* ความหนาเล่ม: ขอบกระดาษด้านขวาและล่าง */}
      <View style={[styles.pages, { left: 8 * k, top: 4 * k, bottom: 0, right: 0, borderRadius: 5 * k }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ position: 'absolute', right: (1 + i * 1.1) * k, top: 2 * k, bottom: 2 * k, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(120,100,70,0.3)' }} />
        ))}
        {[0, 1].map((i) => (
          <View key={`b${i}`} style={{ position: 'absolute', bottom: (1 + i * 1.1) * k, left: 2 * k, right: 2 * k, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(120,100,70,0.3)' }} />
        ))}
      </View>

      {/* ปก */}
      <View style={[styles.cover, { width, height: h, backgroundColor: tone.cloth, borderTopRightRadius: 6 * k, borderBottomRightRadius: 6 * k, borderTopLeftRadius: 3 * k, borderBottomLeftRadius: 3 * k }]}>
        {/* เนื้อผ้า */}
        {/* ปูลายผ้าซ้ำ (ไม่ยืดภาพ) ให้เส้นด้ายละเอียดเท่ากันทุกขนาดปก */}
        <RNImage source={CLOTH} resizeMode="repeat" style={{ position: 'absolute', left: 0, top: 0, width, height: h }} />
        <RNImage source={CLOTH_D} resizeMode="repeat" style={{ position: 'absolute', left: 0, top: 0, width, height: h }} />
        <LinearGradient colors={['rgba(255,255,255,0.13)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.28)']} locations={[0, 0.45, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />

        {/* มุมหุ้มหนัง */}
        {[{ top: -corner / 2 }, { bottom: -corner / 2 }].map((pos, i) => (
          <View key={i} style={[styles.corner, { right: -corner / 2, width: corner, height: corner, backgroundColor: tone.leather, ...pos }]}>
            <View style={[StyleSheet.absoluteFill, { borderWidth: 0.6 * k, borderColor: 'rgba(217,182,106,0.45)' }]} />
          </View>
        ))}

        {/* สันหุ้มหนัง + สันนูน + เส้นทอง */}
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: spine, backgroundColor: tone.leather }}>
          <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          {[0.2, 0.5, 0.8].map((p) => (
            <View key={p} style={{ position: 'absolute', left: 0, right: 0, top: h * p - 1.5 * k, height: 3 * k }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.25)' }} />
            </View>
          ))}
          {/* ผ้าคาดหัว-ท้ายลายริ้ว */}
          {[{ top: 0 }, { bottom: 0 }].map((pos, i) => (
            <View key={i} style={{ position: 'absolute', left: 0, right: 0, height: 4 * k, flexDirection: 'row', ...pos }}>
              {[GOLD, '#9C2E25', GOLD, '#9C2E25', GOLD, '#9C2E25'].map((c, j) => (
                <View key={j} style={{ flex: 1, backgroundColor: c, opacity: 0.85 }} />
              ))}
            </View>
          ))}
        </View>
        {/* เส้นทองคั่นสันกับผ้า + ร่องพับ */}
        <View style={{ position: 'absolute', left: spine, top: 0, bottom: 0, width: 1.2 * k, backgroundColor: GOLD, opacity: 0.8 }} />
        <LinearGradient colors={['rgba(0,0,0,0.4)', 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.25)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: spine + 1.2 * k, top: 0, bottom: 0, width: 5 * k }} />

        {/* ขอบปกนูน */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderTopRightRadius: 6 * k, borderBottomRightRadius: 6 * k, borderTopWidth: 0.8 * k, borderRightWidth: 0.8 * k, borderBottomWidth: 1.2 * k, borderTopColor: 'rgba(255,255,255,0.22)', borderRightColor: 'rgba(0,0,0,0.25)', borderBottomColor: 'rgba(0,0,0,0.35)', borderLeftWidth: 0 }]} />

        {/* ป้ายกระดาษ */}
        <View style={[styles.label, { left: spine + 13 * k, right: 12 * k, top: 18 * k, height: h * 0.43, borderRadius: 2.5 * k }]}>
          <Image source={PAPER_TX} style={[StyleSheet.absoluteFill, { borderRadius: 2.5 * k }]} contentFit="cover" />
          <LinearGradient colors={['rgba(120,90,40,0)', 'rgba(120,90,40,0.10)']} start={{ x: 0.5, y: 0.3 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 2.5 * k }]} />
          <View style={[styles.rule, { margin: 4 * k, borderRadius: 1.5 * k, borderWidth: 1.1 * k }]}>
            <View style={[styles.rule2, { margin: 2 * k, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 5 * k, paddingVertical: 3 * k }]}>
              <Text style={[styles.fleuron, { fontSize: 7 * k, lineHeight: 9 * k }]}>❦</Text>
              <Text numberOfLines={3} style={[styles.title, { fontSize: 12 * k, lineHeight: 16 * k, fontFamily: SERIF }]}>{w.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 * k, marginTop: 3 * k }}>
                <View style={{ width: 9 * k, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(59,42,26,0.5)' }} />
                <Text numberOfLines={1} style={[styles.kind, { fontSize: 7.5 * k }]}>{w.kind}</Text>
                <View style={{ width: 9 * k, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(59,42,26,0.5)' }} />
              </View>
            </View>
          </View>
        </View>

        {/* เหรียญตราปั๊มทอง + ไอคอนปั๊มนูน */}
        <View style={{ position: 'absolute', left: spine, right: 0, bottom: h * 0.11, alignItems: 'center' }}>
          <View style={[styles.medal, { width: ring, height: ring, borderRadius: ring / 2, borderWidth: 1.4 * k }]}>
            <View style={{ position: 'absolute', width: ring - 7 * k, height: ring - 7 * k, borderRadius: ring, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,182,106,0.7)' }} />
            <View style={{ position: 'absolute', transform: [{ translateX: 0.7 * k }, { translateY: 0.9 * k }] }}>
              <Sym name={tone.icon as any} size={iconSize} color="rgba(0,0,0,0.5)" />
            </View>
            <View style={{ position: 'absolute', transform: [{ translateX: -0.5 * k }, { translateY: -0.7 * k }] }}>
              <Sym name={tone.icon as any} size={iconSize} color="rgba(255,255,255,0.35)" />
            </View>
            <Sym name={tone.icon as any} size={iconSize} color={GOLD} />
          </View>
          {/* ลายเส้นประดับใต้ตรา */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 * k, marginTop: 5 * k }}>
            <View style={{ width: 14 * k, height: 0.8 * k, backgroundColor: GOLD, opacity: 0.7 }} />
            <View style={{ width: 3 * k, height: 3 * k, backgroundColor: GOLD, transform: [{ rotate: '45deg' }], opacity: 0.85 }} />
            <View style={{ width: 14 * k, height: 0.8 * k, backgroundColor: GOLD, opacity: 0.7 }} />
          </View>
        </View>

        {/* ริบบิ้นที่คั่นห้อยด้านล่าง = รอตรวจทาน */}
        {w.verified ? null : (
          <View style={[styles.ribbon, { right: 30 * k, width: 9 * k, height: h * 0.13 }]}>
            <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(0,0,0,0.2)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pages: { position: 'absolute', backgroundColor: '#F2E8D0', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(120,100,70,0.35)' },
  cover: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  corner: { position: 'absolute', transform: [{ rotate: '45deg' }] },
  label: { position: 'absolute', backgroundColor: PAPER, boxShadow: '0px 1px 2px rgba(0,0,0,0.4), 0px 0px 0px 0.5px rgba(0,0,0,0.15)' },
  rule: { flex: 1, borderColor: 'rgba(59,42,26,0.55)' },
  rule2: { flex: 1, alignItems: 'center', justifyContent: 'center', borderColor: 'rgba(59,42,26,0.4)' },
  fleuron: { color: 'rgba(59,42,26,0.55)', marginBottom: 1 },
  title: { color: INK, fontWeight: '700', textAlign: 'center' },
  kind: { color: 'rgba(59,42,26,0.75)', fontWeight: '600', letterSpacing: 0.8 },
  medal: { alignItems: 'center', justifyContent: 'center', borderColor: GOLD, backgroundColor: 'rgba(0,0,0,0.12)' },
  ribbon: { position: 'absolute', bottom: 0, backgroundColor: '#A8352A', overflow: 'hidden' },
});
