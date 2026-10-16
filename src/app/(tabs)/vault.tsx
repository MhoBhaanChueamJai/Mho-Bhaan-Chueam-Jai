import { router } from 'expo-router';
import { BookHeart, CircleCheck, EllipsisVertical, Mic, Plus, ScrollText } from '../../components/icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchButton } from '../../components/SearchShell';
import { Backdrop, Badge, Button, Card, Chip, IconTile, PressableScale, RoundButton, T, TopScrim } from '../../components/ui';
import { legacy } from '../../data/mock';
import { useApp } from '../../store/app';
import { elevation, palette, radius, space } from '../../theme';

const FILTERS = ['ทั้งหมด', 'เสียงเล่า', 'สแกนตำรา', 'รอตรวจทาน'] as const;
const TONES = ['lime', 'lavender', 'peach', 'cyan'] as const;

export default function Vault() {
  const insets = useSafeAreaInsets();
  const { wisdoms } = useApp();
  const [f, setF] = useState<(typeof FILTERS)[number]>('ทั้งหมด');
  const recorded = legacy.recorded + (wisdoms.length - 3);
  const list = wisdoms.filter((w) => (f === 'ทั้งหมด' ? true : f === 'รอตรวจทาน' ? !w.verified : w.source === f));

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: space.xl, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
        {/* ปุ่มเพิ่ม + ค้นหามุมขวาบน → ค้นหาเปิดหน้าแบบยืดออก */}
        <View style={styles.topBtns}>
          <RoundButton label="เพิ่มภูมิปัญญา" size={44} onPress={() => router.push({ pathname: '/capture', params: { mode: 'wisdom' } })}>
            <Plus size={22} color={palette.white} />
          </RoundButton>
          <SearchButton label="ค้นหาภูมิปัญญา" onPress={() => router.push('/wisdom/search')} />
        </View>
        <T v="h1" style={{ paddingRight: 108 }}>คลังภูมิปัญญา</T>
        <T v="callout" color={palette.inkSoft}>สมุดข่อยดิจิทัลของคุณหมอ</T>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl, marginTop: space.xl - 20, marginBottom: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: space.xl, paddingVertical: 28 }}>
          {FILTERS.map((x) => (
            <Chip key={x} label={x} active={f === x} onPress={() => setF(x)} />
          ))}
        </ScrollView>


        {/* สรุปแบบการ์ด Total records ใน ref */}
        <Animated.View entering={FadeInDown.springify().damping(18)} style={{ marginTop: space.xl }}>
          <Card tone="cyan" style={styles.row}>
            <IconTile size={56}>
              <BookHeart size={28} color={palette.teal} />
            </IconTile>
            <View style={{ flex: 1 }}>
              <T v="title">บันทึกแล้ว {recorded} เรื่อง</T>
              <T v="caption" color={palette.inkSoft}>เสียงเล่ารวม {legacy.minutes} นาที · ศิษย์ {legacy.apprentices} คน</T>
            </View>
            <View style={styles.topBadge}>
              <Badge label="สำรองแล้ว" />
            </View>
          </Card>
        </Animated.View>

        <View style={{ marginTop: space.md, gap: space.md }}>
          {list.map((w, i) => (
            <Animated.View key={w.id} entering={FadeInDown.delay(80 + i * 70).springify().damping(18)} layout={LinearTransition.springify()}>
              <Card tone={TONES[i % TONES.length]} onPress={() => router.push(`/wisdom/${w.id}`)} style={styles.row}>
                <IconTile size={56}>
                  {w.source === 'สแกนตำรา' ? <ScrollText size={30} color={palette.orange} /> : <Mic size={30} color={palette.primary} />}
                </IconTile>
                <View style={{ flex: 1 }}>
                  <T v="title" numberOfLines={2}>{w.title}</T>
                  <T v="caption" color={palette.inkSoft}>
                    {w.source} · {w.date}
                    {w.verified ? '' : ' · รอตรวจทาน'}
                  </T>
                </View>
                <EllipsisVertical size={22} color={palette.ink} />
              </Card>
            </Animated.View>
          ))}
        </View>

        {/* การ์ดอธิบายแบบ ref */}
        <Animated.View entering={FadeInDown.delay(300).springify().damping(18)}>
          <View style={[styles.info, elevation.e1]}>
            <IconTile size={72}>
              <BookHeart size={44} color={palette.primary} />
            </IconTile>
            <T v="title" center style={{ marginTop: space.lg }}>ภูมิปัญญาทั้งหมดของคุณหมอ ในที่เดียว</T>
            <View style={{ gap: space.sm, marginTop: space.lg, alignSelf: 'stretch' }}>
              {['ไม่สูญหาย แม้สมุดข่อยต้นฉบับจะเสื่อม', 'ส่งต่อให้ลูกศิษย์และลูกหลานได้', 'ใช้ขึ้นทะเบียนภูมิปัญญากับ สสจ.'].map((t) => (
                <View key={t} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <CircleCheck size={22} color={palette.inkSoft} />
                  <T v="callout" color={palette.inkSoft} style={{ flex: 1 }}>{t}</T>
                </View>
              ))}
            </View>
            <Button label="เพิ่มภูมิปัญญาด้วยเสียง" style={{ alignSelf: 'stretch', marginTop: space.xl }} onPress={() => router.push({ pathname: '/capture', params: { mode: 'wisdom' } })} />
            <PressableScale onPress={() => router.push('/scan')} style={{ padding: space.md }}>
              <T v="callout" color={palette.primary}>หรือสแกนตำรายาโบราณ</T>
            </PressableScale>
          </View>
        </Animated.View>
      </ScrollView>
      <TopScrim height={insets.top} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBtns: { position: 'absolute', right: 0, top: -4, zIndex: 2, flexDirection: 'row', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 88 },
  topBadge: { position: 'absolute', top: 12, right: 12 },
  info: { marginTop: space.xxl, backgroundColor: palette.surface, borderRadius: radius.lg, padding: space.xl, alignItems: 'center' },
});
