/** ดูรูป/วิดีโอประกอบตำราเต็มจอ · ลบได้ (ตำราของหมอเอง) */
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Sym } from '../../components/ios';
import { HeaderButton } from '../../components/ui';
import { Alert } from '../../lib/alert';
import { mediaUrl, removeMedia, useWisdomMedia, type Media } from '../../lib/wisdomMedia';
import { useApp } from '../../store/app';

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => p.play());
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />;
}

export default function WisdomMediaView() {
  const { wid, id } = useLocalSearchParams<{ wid: string; id: string }>();
  const { wisdoms } = useApp();
  const [items] = useWisdomMedia(wid);
  const m: Media | undefined = items.find((x) => x.id === id);
  const w = wisdoms.find((x) => x.id === wid);
  const mine = !!w && !w.builtin && w.source !== 'เพื่อนแชร์' && !w.shareCode;
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (m) mediaUrl(m).then((u) => (u ? setSrc(u) : setFailed(true))).catch(() => setFailed(true));
  }, [m]);
  const remove = () =>
    m &&
    Alert.alert(m.type === 'video' ? 'ลบวิดีโอนี้?' : 'ลบรูปนี้?', 'ลบออกจากตำรา ทั้งในเครื่องและบนคลาวด์', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: () => removeMedia(wid, items, m).then(() => router.back()) },
    ]);
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen
        options={{
          title: '',
          headerTransparent: true,
          headerTintColor: '#FFFFFF',
          headerRight: mine ? () => (<HeaderButton onPress={remove} label="ลบ"><Sym name="trash" size={19} color="#FFFFFF" /></HeaderButton>) : undefined,
        }}
      />
      {!m || failed ? (
        <View style={styles.center}>
          <Sym name="exclamationmark.triangle.fill" size={30} color="#FFFFFF" />
        </View>
      ) : !src ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : m.type === 'video' ? (
        <Player uri={src} />
      ) : (
        <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="contain" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
