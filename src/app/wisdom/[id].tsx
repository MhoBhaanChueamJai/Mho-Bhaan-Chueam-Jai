import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, BadgeCheck, Volume2, VolumeX } from '../../components/icons';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSpeaker } from '../../components/audio';
import { Backdrop, Badge, Button, Card, GlassDock, HeaderBack, HeaderButton, T } from '../../components/ui';
import { Sym } from '../../components/ios';
import { manuscriptImage } from '../../data/herbs';
import { doctor } from '../../data/mock';
import { useApp } from '../../store/app';
import { palette, radius, space } from '../../theme';

export default function WisdomDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wisdoms } = useApp();
  const w = wisdoms.find((x) => x.id === id) ?? wisdoms[0];
  const insets = useSafeAreaInsets();
  const tts = useSpeaker();
  /** แชร์ให้เพื่อนหมอ: เปิดหน้าคิวอาร์โค้ด (เพื่อนสแกนรับ) + ส่งต่อทาง LINE ได้ */
  const share = () => router.push({ pathname: '/wisdom/share', params: { id: w.id } });
  const read = [w.title, w.summary, w.ingredients?.join(' '), w.method, w.caution].filter(Boolean).join(' ');

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <Stack.Screen options={{ headerShown: true, title: w.kind, headerTransparent: true, headerShadowVisible: false, headerTintColor: palette.ink, headerBackVisible: false, headerLeft: () => <HeaderBack fallback="/vault" color={palette.ink} />,
          headerRight: () => (
            <HeaderButton label="แชร์ตำราให้เพื่อน" onPress={share}>
              <Sym name="qrcode" size={19} color={palette.ink} weight="semibold" />
            </HeaderButton>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: insets.bottom + 130 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(420)}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Badge label={w.source} />
            {w.verified ? <Badge label="ตรวจทานแล้ว" bg={palette.lime} fg={palette.green} /> : <Badge label="รอตรวจทาน" bg={palette.peach} fg="#A8642B" />}
          </View>
          <T v="h1" style={{ marginTop: space.md }}>{w.title}</T>
          <T v="callout" color={palette.inkSoft}>{w.sharedBy ? `ได้รับจาก ${w.sharedBy}` : `บันทึกโดย ${doctor.short}`} · {w.date}</T>
        </Animated.View>

        {w.source === 'สแกนตำรา' ? (
          <Animated.View entering={FadeInDown.delay(60).duration(420)} style={{ marginTop: space.xl }}>
            <Image source={manuscriptImage} style={styles.scan} contentFit="cover" />
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(100).duration(420)} style={{ marginTop: space.xl }}>
          <Card tone="white">
            <T v="body">{w.summary}</T>
            {w.indication ? (
              <>
                <T v="title" style={styles.h}>สรรพคุณ</T>
                <T v="body">{w.indication}</T>
              </>
            ) : null}
          </Card>
        </Animated.View>

        {w.ingredients?.length ? (
          <Animated.View entering={FadeInDown.delay(150).duration(420)} style={{ marginTop: space.md }}>
            <Card tone="lime">
              <T v="title">ตัวยา</T>
              {w.ingredients.map((x, i) => (
                <View key={x} style={styles.ing}>
                  <View style={styles.num}>
                    <T v="micro">{i + 1}</T>
                  </View>
                  <T v="body" style={{ flex: 1 }}>{x}</T>
                </View>
              ))}
            </Card>
          </Animated.View>
        ) : null}

        {w.method ? (
          <Animated.View entering={FadeInDown.delay(200).duration(420)} style={{ marginTop: space.md }}>
            <Card tone="cyan">
              <T v="title">วิธีปรุงและวิธีใช้</T>
              <T v="body" style={{ marginTop: 4 }}>{w.method}</T>
            </Card>
          </Animated.View>
        ) : null}

        {w.caution ? (
          <Animated.View entering={FadeInDown.delay(250).duration(420)} style={styles.warn}>
            <AlertTriangle size={22} color={palette.coral} />
            <T v="body" style={{ flex: 1 }}>{w.caution}</T>
          </Animated.View>
        ) : null}

        <View style={styles.verify}>
          <BadgeCheck size={22} color={w.verified ? palette.green : palette.inkMute} />
          <T v="caption" color={palette.inkSoft} style={{ flex: 1 }}>
            {w.verified ? 'คุณหมอตรวจทานแล้ว เนื้อหาตรงกับที่ถ่ายทอด' : 'AI เรียบเรียงให้แล้ว รอคุณหมอฟังและยืนยันความถูกต้อง'}
          </T>
        </View>
      </ScrollView>

      <GlassDock>
        <Button
          style={{ flex: 1 }}
          label={tts.speaking ? 'หยุดอ่าน' : 'ฟังด้วยเสียง'}
          icon={tts.speaking ? <VolumeX size={22} color={palette.white} /> : <Volume2 size={22} color={palette.white} />}
          onPress={() => (tts.speaking ? tts.stop() : tts.speak(read))}
        />
      </GlassDock>
    </View>
  );
}

const styles = StyleSheet.create({
  scan: { height: 210, borderRadius: radius.lg },
  h: { marginTop: space.lg, marginBottom: 2 },
  ing: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  num: { width: 28, height: 28, borderRadius: 14, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  warn: { flexDirection: 'row', gap: space.sm, backgroundColor: palette.coralSoft, padding: space.lg, borderRadius: radius.lg, marginTop: space.md },
  verify: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: space.xl, paddingHorizontal: space.xs },
});
