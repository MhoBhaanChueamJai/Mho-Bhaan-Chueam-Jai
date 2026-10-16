import { Stack, router } from 'expo-router';
import { BookHeart, CircleCheck, EllipsisVertical, Mic, ScrollText } from '../../../components/icons';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Sym, ios } from '../../../components/ios';
import { Badge, Button, Card, HeaderButton, IconTile, PressableScale, T } from '../../../components/ui';
import { legacy } from '../../../data/mock';
import { useApp } from '../../../store/app';
import { elevation, palette, radius, space } from '../../../theme';


export default function Vault() {
  const { wisdoms } = useApp();
  const recorded = legacy.recorded + (wisdoms.length - 3);
  const list = wisdoms;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label="ค้นหาภูมิปัญญา" onPress={() => router.push('/wisdom/search')}>
                <Sym name="magnifyingglass" size={20} color={palette.primary} weight="semibold" />
              </HeaderButton>
              <HeaderButton label="เพิ่มภูมิปัญญา" onPress={() => router.push({ pathname: '/capture', params: { mode: 'wisdom' } })}>
                <Sym name="plus" size={20} color={palette.primary} weight="semibold" />
              </HeaderButton>
            </View>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingTop: 4, paddingHorizontal: space.xl, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
        <T v="callout" color={ios.secondary} style={{ paddingHorizontal: 4 }}>สมุดข่อยดิจิทัลของคุณหมอ</T>



        {/* สรุปแบบการ์ด Total records ใน ref */}
        <Animated.View entering={FadeInDown.duration(420)} style={{ marginTop: space.xl }}>
          <Card style={styles.row}>
            <IconTile size={56}>
              <BookHeart size={28} color={palette.teal} />
            </IconTile>
            <View style={{ flex: 1 }}>
              <T v="title">บันทึกแล้ว {recorded} เรื่อง</T>
              <T v="subhead" color={palette.inkSoft}>เสียงเล่ารวม {legacy.minutes} นาที · ศิษย์ {legacy.apprentices} คน</T>
            </View>
            <View style={styles.topBadge}>
              <Badge label="สำรองแล้ว" />
            </View>
          </Card>
        </Animated.View>

        <View style={{ marginTop: space.md, gap: space.md }}>
          {list.map((w, i) => (
            <Animated.View key={w.id} entering={FadeInDown.delay(80 + i * 70).duration(420)} layout={LinearTransition.duration(280)}>
              <Card onPress={() => router.push(`/wisdom/${w.id}`)} style={styles.row}>
                <IconTile size={56}>
                  {w.source === 'สแกนตำรา' ? <ScrollText size={30} color={palette.orange} /> : <Mic size={30} color={palette.primary} />}
                </IconTile>
                <View style={{ flex: 1 }}>
                  <T v="title" numberOfLines={2}>{w.title}</T>
                  <T v="subhead" color={palette.inkSoft}>
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
        <Animated.View entering={FadeInDown.delay(300).duration(420)}>
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
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 88 },
  topBadge: { position: 'absolute', top: 12, right: 12 },
  info: { marginTop: space.xxl, backgroundColor: palette.surface, borderRadius: radius.lg, padding: space.xl, alignItems: 'center' },
});
