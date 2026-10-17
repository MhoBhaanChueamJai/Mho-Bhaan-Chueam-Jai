/**
 * หน้าดูตัวอย่างไอคอนอากาศทุกแบบ (สี + แอนิเมชันจริง) — เปิดจากการแตะแถบอากาศในหน้าสมุนไพร
 */
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from '../components/ios';
import { GlassCircle, T } from '../components/ui';
import { SKY_COLOR, WeatherIcon } from '../components/WeatherIcon';
import { SKY_LABEL, type SkyKind } from '../lib/weatherHerbs';
import { elevation, palette } from '../theme';

const ALL: { k: SkyKind; when: string }[] = [
  { k: 'sun', when: 'ฟ้าโปร่ง แดดออก' },
  { k: 'hot', when: 'รู้สึกร้อน ≥ 40°' },
  { k: 'partly', when: 'มีเมฆบางส่วน' },
  { k: 'cloudy', when: 'เมฆเต็มฟ้า' },
  { k: 'fog', when: 'มีหมอก' },
  { k: 'drizzle', when: 'ฝนตกปรอยๆ' },
  { k: 'rain', when: 'ฝนตก' },
  { k: 'heavy', when: 'ฝนตกหนัก' },
  { k: 'thunder', when: 'ฝนฟ้าคะนอง' },
  { k: 'cold', when: 'อุณหภูมิ ≤ 18°' },
  { k: 'dust', when: 'PM2.5 > 75' },
  { k: 'sunrise', when: 'ช่วงพระอาทิตย์ขึ้น' },
  { k: 'sunset', when: 'ช่วงพระอาทิตย์ตก' },
  { k: 'night', when: 'กลางคืน ฟ้าโปร่ง' },
];

export default function WeatherPreview() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const list = ALL.slice(Number(from) || 0);
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const cellW = Math.floor((W - 32 - 12) / 2);
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <GlassCircle label="ปิด" onPress={() => router.back()} size={44}>
          <Sym name="xmark" size={17} color={palette.ink} weight="semibold" />
        </GlassCircle>
        <T v="title" style={{ flex: 1, textAlign: 'center', marginRight: 44 }}>ไอคอนสภาพอากาศ</T>
      </View>
      <ScrollView contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 24 }]}>
        {list.map(({ k, when }) => (
          <View key={k} style={[styles.cell, elevation.e1, { width: cellW }]}>
            <WeatherIcon sky={k} size={44} />
            <T v="title" color={SKY_COLOR[k]} style={{ marginTop: 12 }}>{SKY_LABEL[k]}</T>
            <T v="caption" color={ios.secondary}>{when}</T>
            {/* แถวตัวอย่างแบบที่ใช้จริงในหน้าสมุนไพร */}
            <View style={styles.sample}>
              <WeatherIcon sky={k} size={18} />
              <T v="caption" color={SKY_COLOR[k]} style={{ fontWeight: '700' }}>31° {SKY_LABEL[k]}</T>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  cell: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 10, borderRadius: 22, borderCurve: 'continuous', backgroundColor: palette.surface },
  sample: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: palette.bg },
});
