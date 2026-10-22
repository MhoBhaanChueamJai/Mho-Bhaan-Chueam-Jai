/** หน้า "ไม่พบข้อมูล" — ใช้เมื่อ id ใน route ไม่ตรงกับข้อมูล (ลิงก์เก่า / ข้อมูลถูกลบ / ยังซิงก์ไม่เสร็จ) */
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../theme';
import { Sym, ios } from './ios';
import { Button, T } from './ui';

export function NotFound({ title = 'ไม่พบข้อมูล', detail = 'ข้อมูลนี้อาจถูกลบไปแล้ว หรือยังซิงก์ไม่เสร็จ' }: { title?: string; detail?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { paddingTop: insets.top + 80 }]}>
      <Sym name="questionmark.folder" size={44} color={ios.tertiary} />
      <T v="h2" center style={{ marginTop: 14 }}>{title}</T>
      <T v="callout" color={ios.secondary} center style={{ marginTop: 6 }}>{detail}</T>
      <Button label="กลับ" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} style={{ alignSelf: 'stretch', height: 52, marginTop: 28, maxWidth: 420, width: '100%', marginHorizontal: 'auto' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', paddingHorizontal: 32, backgroundColor: palette.bg },
});
