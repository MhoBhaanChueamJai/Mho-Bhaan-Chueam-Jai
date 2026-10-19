/**
 * วิดีโอแนะนำแอปส่วนบนของหน้าเข้าสู่ระบบ — 2 นาที เล่นวนแบบเงียบ (ฝังในแอป)
 * ซ่อนไว้จนวิดีโอพร้อมเล่น (กันจอดำแวบ) · ฉากโทนมืดเปลี่ยนแถบสถานะเป็นตัวขาว
 */
import { useEvent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { FILM } from './loginFilmSource';

/** ช่วงที่ส่วนบนของวิดีโอเป็นโทนมืด (วินาที): ครูปัญญา AI · สวนสมุนไพร + สแกนตำรา */
const DARK: [number, number][] = [
  [18.4, 31.0],
  [44.6, 70.8],
];

export function LoginFilm({ height }: { height: number }) {
  const player = useVideoPlayer(FILM, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    p.timeUpdateEventInterval = 0.5;
    p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const dark = DARK.some(([a, b]) => currentTime >= a && currentTime < b);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (status !== 'readyToPlay') return;
    setShown(true);
    // เว็บ: play() ตอนสร้าง player อาจถูกข้ามเพราะวิดีโอยังไม่พร้อม → สั่งเล่นอีกครั้ง (ปิดเสียงอยู่แล้ว เล่นอัตโนมัติได้)
    if (!player.playing) player.play();
  }, [status, player]);
  const fade = useAnimatedStyle(() => ({ opacity: withTiming(shown ? 1 : 0, { duration: 400 }) }), [shown]);

  return (
    <View style={[styles.wrap, { height }]}>
      <StatusBar style={dark ? 'light' : 'dark'} animated />
      <Animated.View style={[StyleSheet.absoluteFill, fade]}>
        <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // สีเดียวกับเฟรมแรกของวิดีโอ (พื้นสว่างมิ้นต์) ระหว่างรอโหลด
  wrap: { width: '100%', overflow: 'hidden', backgroundColor: '#F1F8F4' },
  // เว็บ: แท็ก <video> ไม่ยืดตาม left/right/top/bottom → ต้องกำหนดกว้าง/สูงเอง (ไม่งั้นแสดงขนาดจริงของวิดีโอ)
  video: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
});
