import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ShieldCheck } from '../../components/icons';
import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop, Button, Chip, PressableScale, SearchBar, T, TopScrim } from '../../components/ui';
import { herbs, tastes, tasteTone } from '../../data/herbs';
import { elevation, palette, radius, space } from '../../theme';

export default function Herbs() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [taste, setTaste] = useState<string>('ทั้งหมด');

  const list = useMemo(
    () =>
      herbs.filter(
        (h) => (taste === 'ทั้งหมด' || h.taste === taste) && (!q || [h.name, h.local, h.sci, ...h.uses].join(' ').toLowerCase().includes(q.toLowerCase())),
      ),
    [q, taste],
  );

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <FlatList
        data={list}
        keyExtractor={(h) => h.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: insets.top + space.lg, paddingBottom: 140, gap: space.md }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={{ marginBottom: space.sm }}>
            <T v="h1">คลังสมุนไพร</T>
            <T v="callout" color={palette.inkSoft}>{herbs.length} ชนิด · อ้างอิงบัญชียาหลักแห่งชาติ</T>
            <SearchBar style={{ marginTop: space.xl }} value={q} onChangeText={setQ} placeholder="ค้นหาชื่อ หรืออาการ เช่น ปวดเข่า" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl, marginTop: space.lg - 20, marginBottom: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: space.xl, paddingVertical: 28 }}>
              {tastes.map((t) => (
                <Chip key={t} label={t === 'ทั้งหมด' ? 'ทั้งหมด' : `รส${t}`} active={taste === t} onPress={() => setTaste(t)} />
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: space.xxxl, gap: space.lg }}>
            <T v="title" color={palette.inkSoft}>ไม่พบ “{q}” ในคลัง</T>
            <Button label="ถามครูปัญญาแทน" onPress={() => router.push({ pathname: '/assistant', params: { q } })} />
          </View>
        }
        renderItem={({ item, index }) => {
          const tone = tasteTone[item.taste];
          return (
            <Animated.View entering={FadeInDown.delay((index % 6) * 60).springify().damping(18)} layout={LinearTransition.springify()} style={{ flex: 1 / 2 }}>
              <PressableScale scaleTo={0.96} onPress={() => router.push(`/herb/${item.id}`)} style={[styles.card, elevation.e1]} accessibilityLabel={item.name}>
                <View>
                  <Image source={item.image} style={styles.img} contentFit="cover" transition={250} />
                  {item.nationalList ? (
                    <View style={styles.seal}>
                      <ShieldCheck size={16} color={palette.primary} />
                    </View>
                  ) : null}
                </View>
                <View style={{ padding: space.sm, paddingTop: space.sm, gap: 4 }}>
                  <T v="title" numberOfLines={1}>{item.name}</T>
                  <T v="caption" color={palette.inkSoft} numberOfLines={1}>{item.uses[0]}</T>
                  <View style={[styles.taste, { backgroundColor: tone.bg }]}>
                    <T v="micro" color={tone.fg}>รส{item.taste}</T>
                  </View>
                </View>
              </PressableScale>
            </Animated.View>
          );
        }}
      />
      <TopScrim height={insets.top} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: radius.lg, padding: 8 },
  img: { height: 150, borderRadius: radius.md, backgroundColor: palette.bgDeep },
  seal: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  taste: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, marginTop: 4 },
});
