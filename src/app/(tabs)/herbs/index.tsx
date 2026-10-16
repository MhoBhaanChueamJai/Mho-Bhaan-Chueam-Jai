import { Image } from 'expo-image';
import { Stack, router } from 'expo-router';
import { ShieldCheck } from '../../../components/icons';
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Sym, ios } from '../../../components/ios';
import { Button, HeaderButton, PressableScale, T } from '../../../components/ui';
import { herbs, tastes, tasteTone } from '../../../data/herbs';
import { elevation, palette, radius, space } from '../../../theme';

export default function Herbs() {

  const list = herbs;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderButton label="ค้นหาสมุนไพร" onPress={() => router.push('/herb/search')}>
              <Sym name="magnifyingglass" size={20} color={palette.primary} weight="semibold" />
            </HeaderButton>
          ),
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: palette.bg }}
        data={list}
        keyExtractor={(h) => h.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: 4, paddingBottom: 140, gap: space.md }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={{ marginBottom: space.sm }}>
            <T v="callout" color={ios.secondary} style={{ paddingHorizontal: 4 }}>{herbs.length} ชนิด · อ้างอิงบัญชียาหลักแห่งชาติ</T>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: space.xxxl, gap: space.lg }}>
            <T v="title" color={palette.inkSoft}>ยังไม่มีสมุนไพรในหมวดนี้</T>
            <Button label="ถามครูปัญญาแทน" onPress={() => router.push('/assistant')} />
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
                  <T v="subhead" color={palette.inkSoft} numberOfLines={1}>{item.uses[0]}</T>
                  <View style={[styles.taste, { backgroundColor: tone.bg }]}>
                    <T v="micro" color={tone.fg}>รส{item.taste}</T>
                  </View>
                </View>
              </PressableScale>
            </Animated.View>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: radius.lg, padding: 8 },
  img: { height: 150, borderRadius: radius.md, backgroundColor: palette.bgDeep },
  seal: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  taste: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, marginTop: 4 },
});
