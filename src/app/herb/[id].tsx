import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, Droplets, FlaskConical, Heart, MessageCircleHeart, ShieldCheck, Sprout, Volume2, VolumeX } from '../../components/icons';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSpeaker } from '../../components/audio';
import { Button, Card, GlassDock, HeaderBack, HeaderButton, IconBubble, T } from '../../components/ui';
import { herbs, tasteTone } from '../../data/herbs';
import { elementColor, palette, radius, space } from '../../theme';

const HERO = 420;

export default function HerbDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const herb = herbs.find((h) => h.id === id) ?? herbs[0];
  const insets = useSafeAreaInsets();
  const tts = useSpeaker();
  const [fav, setFav] = useState(false);
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(y.value, [-200, 0, HERO], [-100, 0, HERO * 0.45]) }, { scale: interpolate(y.value, [-200, 0], [1.5, 1], 'clamp') }],
  }));
  const el = elementColor[herb.element];
  const tone = tasteTone[herb.taste];
  const read = `${herb.name} รส${herb.taste} สรรพคุณ ${herb.uses.join(' ')} วิธีใช้ ${herb.howto} ข้อควรระวัง ${herb.caution}`;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Animated.View style={[styles.hero, heroStyle]}>
        <Image source={herb.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      </Animated.View>

      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View style={{ height: HERO - 40 }} />
        <View style={styles.sheet}>
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <View style={[styles.taste, { backgroundColor: tone.bg }]}>
              <T v="micro" color={tone.fg}>รส{herb.taste}</T>
            </View>
            <T v="hero" style={{ marginTop: space.sm }}>{herb.name}</T>
            <T v="callout" color={palette.inkSoft} style={{ fontStyle: 'italic' }}>{herb.sci}</T>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.facts}>
            {[
              { k: 'ชื่อท้องถิ่น', v: herb.local, Icon: Sprout, c: palette.green },
              { k: 'ส่วนที่ใช้', v: herb.part, Icon: FlaskConical, c: palette.orange },
              { k: 'ธาตุ', v: el.label.replace('ธาตุ', ''), Icon: Droplets, c: el.fg },
            ].map(({ k, v, Icon, c }) => (
              <View key={k} style={styles.fact}>
                <IconBubble size={44}>
                  <Icon size={24} color={c} />
                </IconBubble>
                <T v="caption" color={palette.inkMute} style={{ marginTop: space.sm }}>{k}</T>
                <T v="callout" center numberOfLines={2}>{v}</T>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(220).springify()}>
            <T v="h2" style={styles.h}>สรรพคุณ</T>
            <View style={{ gap: space.sm }}>
              {herb.uses.map((u) => (
                <View key={u} style={styles.use}>
                  <ShieldCheck size={22} color={palette.primary} />
                  <T v="body">{u}</T>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(280).springify()}>
            <T v="h2" style={styles.h}>วิธีใช้</T>
            <Card tone="cyan">
              <T v="body">{herb.howto}</T>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(340).springify()}>
            <T v="h2" style={styles.h}>ข้อควรระวัง</T>
            <View style={styles.warn}>
              <AlertTriangle size={24} color={palette.coral} />
              <T v="body" style={{ flex: 1 }}>{herb.caution}</T>
            </View>
          </Animated.View>

          <T v="caption" color={palette.inkMute} style={{ marginTop: space.xl }}>ภาพ: {herb.credit}</T>
        </View>
      </Animated.ScrollView>

      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: palette.ink,
          headerBackVisible: false,
          headerLeft: () => <HeaderBack fallback="/herbs" />,
          headerRight: () => (
            <HeaderButton onPress={() => setFav((x) => !x)} label="บันทึกเป็นรายการโปรด">
              <Heart size={20} color={fav ? palette.coral : palette.ink} fill={fav ? palette.coral : 'transparent'} />
            </HeaderButton>
          ),
        }}
      />

      <GlassDock>
        <Button
          kind="secondary"
          style={{ flex: 1 }}
          label={tts.speaking ? 'หยุด' : 'อ่านให้ฟัง'}
          icon={tts.speaking ? <VolumeX size={22} color={palette.primary} /> : <Volume2 size={22} color={palette.primary} />}
          onPress={() => (tts.speaking ? tts.stop() : tts.speak(read))}
        />
        <Button
          style={{ flex: 1.3 }}
          label="ถามครูปัญญา"
          icon={<MessageCircleHeart size={22} color={palette.white} />}
          onPress={() => router.push({ pathname: '/assistant', params: { q: `${herb.name} ใช้ร่วมกับยาแผนปัจจุบันได้ไหม` } })}
        />
      </GlassDock>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: HERO, backgroundColor: palette.bgDeep },
  sheet: { backgroundColor: palette.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.xl, paddingTop: space.xl, minHeight: 700 },
  taste: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill },
  facts: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  fact: { flex: 1, alignItems: 'center', backgroundColor: palette.clay, borderRadius: radius.lg, paddingVertical: space.lg, paddingHorizontal: space.xs },
  h: { marginTop: space.xxl, marginBottom: space.md },
  use: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: palette.surface, paddingHorizontal: space.lg, minHeight: 60, borderRadius: radius.md },
  warn: { flexDirection: 'row', gap: space.sm, backgroundColor: palette.coralSoft, padding: space.lg, borderRadius: radius.lg },
});
