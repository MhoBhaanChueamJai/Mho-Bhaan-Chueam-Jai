/** รูปและวิดีโอประกอบตำรา — แถวภาพย่อ แตะเพื่อดูเต็มจอ · ตำราของหมอเองเพิ่มได้ (ถ่ายใหม่ / เลือกจากคลังภาพ) */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { MenuView } from './Menu';
import { Sym, ios } from './ios';
import { PressableScale, T } from './ui';
import { Alert } from '../lib/alert';
import { addMedia, mediaUrl, useWisdomMedia, type Media } from '../lib/wisdomMedia';
import { elevation, palette } from '../theme';

function Thumb({ m, wid }: { m: Media; wid: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (m.type === 'image') mediaUrl(m).then(setSrc).catch(() => {});
  }, [m]);
  return (
    <PressableScale haptic="select" scaleTo={0.96} onPress={() => router.push({ pathname: '/wisdom/media', params: { wid, id: m.id } })} style={styles.thumb} accessibilityLabel={m.type === 'video' ? 'เปิดวิดีโอ' : 'เปิดรูป'}>
      {m.type === 'image' && src ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
      {m.type === 'video' ? (
        <View style={[StyleSheet.absoluteFill, styles.video]}>
          <Sym name="play.circle.fill" size={34} color="#FFFFFF" />
          {m.sec ? <T v="micro" color="#FFFFFF" style={{ fontWeight: '700' }}>{Math.floor(m.sec / 60)}:{String(m.sec % 60).padStart(2, '0')}</T> : null}
        </View>
      ) : null}
    </PressableScale>
  );
}

export function WisdomMediaStrip({ wid, canEdit }: { wid: string; canEdit: boolean }) {
  const [items] = useWisdomMedia(wid);
  const [busy, setBusy] = useState(false);
  if (!items.length && !canEdit) return null;
  const add = async (from: 'library' | 'camera') => {
    setBusy(true);
    try {
      await addMedia(wid, items, from);
    } catch {
      Alert.alert('เพิ่มไม่สำเร็จ', 'ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={[styles.card, elevation.e1]}>
      <View style={styles.head}>
        <Sym name="photo.on.rectangle" size={16} color={palette.primary} />
        <T v="bodyStrong" style={{ flex: 1 }}>รูปและวิดีโอ{items.length ? ` · ${items.length}` : ''}</T>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {items.map((m) => (
          <Thumb key={m.id} m={m} wid={wid} />
        ))}
        {canEdit ? (
          <MenuView
            shouldOpenOnLongPress={false}
            themeVariant="light"
            title="เพิ่มรูปหรือวิดีโอ"
            actions={[
              { id: 'camera', title: 'ถ่ายรูป / ถ่ายวิดีโอ', image: 'camera.fill', imageColor: palette.ink },
              { id: 'library', title: 'เลือกจากคลังภาพ', image: 'photo.on.rectangle', imageColor: palette.ink },
            ]}
            onPressAction={({ nativeEvent }) => add(nativeEvent.event === 'camera' ? 'camera' : 'library')}
          >
            <View style={styles.add} accessibilityRole="button" accessibilityLabel="เพิ่มรูปหรือวิดีโอ">
              {busy ? <ActivityIndicator color={palette.primary} /> : <Sym name="plus" size={22} color={palette.primary} weight="semibold" />}
              <T v="caption" color={palette.primary} style={{ fontWeight: '600' }}>{busy ? 'กำลังบันทึก' : 'เพิ่ม'}</T>
            </View>
          </MenuView>
        ) : null}
      </ScrollView>
      {canEdit && !items.length ? <T v="caption" color={ios.tertiary}>ถ่ายท่านวด วิธีปรุงยา หรือต้นสมุนไพร เก็บไว้ให้ลูกศิษย์ดูได้</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 22, backgroundColor: palette.surface, gap: 10, marginTop: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thumb: { width: 96, height: 96, borderRadius: 14, overflow: 'hidden', backgroundColor: palette.mint },
  video: { alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: '#1D2A23' },
  add: { width: 96, height: 96, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: `${palette.primary}66`, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
