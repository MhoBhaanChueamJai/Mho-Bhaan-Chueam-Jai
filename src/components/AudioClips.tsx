/**
 * เครื่องเล่น "เสียงเล่าต้นฉบับ" ของตำรา (โหมดเล่า) — เล่นทุกช่วงต่อกันเหมือนไฟล์เดียว
 * แถบความคืบหน้ารวม · เวลาที่เล่น/ทั้งหมด · แตะแถบเพื่อข้ามไปช่วงนั้น
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { WisdomAudio } from '../data/mock';
import { clock, playableUri, totalSeconds } from '../lib/wisdomAudio';
import { palette } from '../theme';
import { Sym, ios } from './ios';
import { PressableScale, T } from './ui';

export function AudioClips({ clips, by }: { clips: WisdomAudio[]; by?: string }) {
  const total = Math.max(1, totalSeconds(clips));
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState(0); // วินาทีรวม
  const [failed, setFailed] = useState(false);
  const player = useRef<AudioPlayer | null>(null);
  const idx = useRef(0);
  const gen = useRef(0);
  const barW = useRef(1);
  const before = (i: number) => clips.slice(0, i).reduce((s, c) => s + (c.sec || 0), 0);

  const release = () => {
    try {
      player.current?.pause();
      player.current?.remove();
    } catch {}
    player.current = null;
  };
  useEffect(
    () => () => {
      gen.current++;
      release();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** เล่นช่วงที่ i ตั้งแต่วินาทีที่ from แล้วต่อช่วงถัดไปเอง */
  const playFrom = async (i: number, from = 0) => {
    const my = ++gen.current;
    release();
    if (i >= clips.length) {
      setPlaying(false);
      setPos(0);
      idx.current = 0;
      return;
    }
    idx.current = i;
    setLoading(true);
    const uri = await playableUri(clips[i]).catch(() => null);
    if (my !== gen.current) return;
    setLoading(false);
    if (!uri) {
      setFailed(true);
      setPlaying(false);
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    const p = createAudioPlayer({ uri }, { updateInterval: 250 });
    player.current = p;
    p.addListener('playbackStatusUpdate', (s) => {
      if (my !== gen.current) return;
      setPos(before(i) + (s.currentTime ?? 0));
      if (s.didJustFinish) playFrom(i + 1);
    });
    if (from > 0) p.seekTo(from).catch(() => {});
    p.play();
    setPlaying(true);
  };

  const toggle = () => {
    if (playing) {
      player.current?.pause();
      setPlaying(false);
    } else if (player.current) {
      player.current.play();
      setPlaying(true);
    } else playFrom(idx.current);
  };

  /** แตะแถบ → ข้ามไปตำแหน่งนั้น */
  const seek = (x: number) => {
    const target = Math.max(0, Math.min(total - 0.5, (x / barW.current) * total));
    let i = 0;
    while (i < clips.length - 1 && before(i + 1) <= target) i++;
    setPos(target);
    playFrom(i, target - before(i));
  };

  return (
    <View style={styles.card}>
      <PressableScale haptic="press" onPress={toggle} style={styles.play} accessibilityLabel={playing ? 'หยุดเสียงเล่า' : 'ฟังเสียงเล่าต้นฉบับ'}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Sym name={playing ? 'pause.fill' : 'play.fill'} size={18} color="#FFFFFF" />}
      </PressableScale>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T v="subhead" style={{ fontWeight: '700' }}>เสียงเล่าต้นฉบับ{by ? ` · ${by}` : ''}</T>
          <T v="caption" color={ios.secondary}>{clock(pos)} / {clock(total)}</T>
        </View>
        <Pressable onLayout={(e) => (barW.current = Math.max(1, e.nativeEvent.layout.width))} onPress={(e) => seek(e.nativeEvent.locationX)} hitSlop={10} accessibilityLabel="ตำแหน่งเสียง">
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, (pos / total) * 100)}%` }]} />
          </View>
        </Pressable>
        {failed ? <T v="caption" color={palette.coral}>ไฟล์เสียงไม่อยู่ในเครื่องนี้ และยังไม่ได้สำรองขึ้นคลาวด์</T> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.surface, boxShadow: '0px 2px 10px rgba(0,0,0,0.06)' },
  play: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(60,60,67,0.12)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: palette.primary },
});
