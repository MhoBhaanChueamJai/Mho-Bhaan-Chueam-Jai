/**
 * ตัวเลือกธาตุเจ้าเรือน — ไอคอนธาตุแบบไอคอนระบบ (SF Symbols) ในปุ่ม Liquid Glass
 *   ไฟ = flame.fill · น้ำ = drop.fill · ลม = wind · ดิน = mountain.2.fill
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Sym, ios } from './ios';
import { Glass, PressableScale, T } from './ui';
import { ELEMENT_PROFILE, ageSamutthan, seasonNow } from '../lib/elements';
import type { Patient } from '../data/mock';
import { palette } from '../theme';

type El = Patient['element'];

const TINT: Record<El, string> = { ไฟ: '#FF7A2F', น้ำ: '#2BA7F0', ลม: '#4FBFD0', ดิน: '#8C7461' };
const SYMBOL: Record<El, string> = { ไฟ: 'flame.fill', น้ำ: 'drop.fill', ลม: 'wind', ดิน: 'mountain.2.fill' };

export function ElementIcon({ el, size = 58 }: { el: El; active?: boolean; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Sym name={SYMBOL[el] as any} size={size * 0.74} color={TINT[el]} weight="semibold" />
    </View>
  );
}

const ORDER: El[] = ['ดิน', 'น้ำ', 'ลม', 'ไฟ'];

export function ElementPicker({ value, onChange }: { value: El | null; onChange: (el: El) => void }) {
  return (
    <View style={styles.row}>
      {ORDER.map((el) => {
        const on = value === el;
        return (
          <PressableScale key={el} haptic="select" scaleTo={0.94} hitSlop={6} onPress={() => onChange(el)} style={styles.item} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`ธาตุ${el}`}>
            {/* ปุ่มวงกลม Liquid Glass ใส่ไอคอน · ชื่อธาตุอยู่นอกวง */}
            <View style={[styles.circleShadow, on && { boxShadow: `0px 8px 20px ${TINT[el]}66` }]}>
              {/* ไม่ใช้ glass แบบ interactive และให้ภาพไอคอนไม่รับการแตะ → แตะแล้วเลือกได้ทันที ไม่ต้องรอแอนิเมชัน */}
              <Glass tint={on ? `${TINT[el]}2E` : 'rgba(255,255,255,0.6)'} style={[styles.circle, { borderColor: on ? TINT[el] : 'rgba(255,255,255,0.95)' }]}>
                <View pointerEvents="none">
                  <ElementIcon el={el} active={on} size={50} />
                </View>
              </Glass>
            </View>
            <T v="subhead" color={on ? TINT[el] : palette.ink} style={{ fontWeight: on ? '700' : '500', marginTop: 8 }}>{el}</T>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { flex: 1, alignItems: 'center' },
  circleShadow: { width: 68, height: 68, borderRadius: 34, boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 20px rgba(0,0,0,0.06)' },
  insight: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator, gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tasteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  taste: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999 },
  circle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
});

/**
 * วิเคราะห์ธาตุแบบละเอียด (แสดงใต้ตัวเลือกเมื่อเลือกธาตุแล้ว)
 * ธาตุเจ้าเรือนเกิด + อายุสมุฏฐาน (เมื่อทราบอายุ) + อุตุสมุฏฐาน (ฤดูปัจจุบัน)
 */
export function ElementInsight({ el, age }: { el: El; age?: number }) {
  const p = ELEMENT_PROFILE[el];
  const tint = TINT[el];
  const ag = age != null && age > 0 ? ageSamutthan(age) : null;
  const ss = seasonNow();
  // สรุปสั้น 3 บรรทัด: มักเป็น · รสที่เหมาะ · วัย/ฤดู
  return (
    <Animated.View key={el} entering={FadeInDown.duration(320)} exiting={FadeOut.duration(150)} layout={LinearTransition.duration(280)} style={styles.insight}>
      <View style={styles.line}>
        <Sym name="stethoscope" size={13} color={tint} />
        <T v="subhead" color={ios.secondary} style={{ flex: 1 }} numberOfLines={2}>
          <T v="subhead" style={{ fontWeight: '600' }}>มักเป็น </T>
          {p.prone.join(' · ')}
        </T>
      </View>
      <View style={styles.line}>
        <Sym name="leaf.fill" size={13} color={tint} />
        <T v="subhead" style={{ fontWeight: '600' }}>รสที่เหมาะ</T>
        <View style={styles.tasteRow}>
          {p.tastes.map((x) => (
            <View key={x} style={[styles.taste, { backgroundColor: `${tint}1F` }]}>
              <T v="caption" color={tint} style={{ fontWeight: '700' }}>{x}</T>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.line}>
        <Sym name="calendar" size={13} color={tint} />
        <T v="subhead" color={ios.secondary} style={{ flex: 1 }} numberOfLines={2}>
          {ag ? `${ag.stage} (${ag.dosha.split(' ')[0]}) · ` : ''}
          {ss.name.split(' ')[0]} ({ss.dosha.split(' ')[0]})
        </T>
      </View>
    </Animated.View>
  );
}
