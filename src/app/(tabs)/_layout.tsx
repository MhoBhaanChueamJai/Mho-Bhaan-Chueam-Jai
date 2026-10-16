import { Redirect } from 'expo-router';
import { Badge, Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { useApp } from '../../store/app';
import { palette } from '../../theme';

/**
 * แท็บบาร์ native ของ iOS 26 (Liquid Glass ของ Apple)
 * - แคปซูลกระจกเลื่อนตามแท็บที่เลือก ไม่หดตัว (ให้ปุ่มครูปัญญา AI อยู่ให้เห็นตลอด)
 * - แท็บ "ครูปัญญา" (ไมค์) กดแล้วเปิดหน้าแชทเต็มจอ
 */
export default function TabsLayout() {
  const { settings, isPractitioner } = useApp();
  if (!settings.loggedIn) return <Redirect href="/login" />;
  return (
    <NativeTabs tintColor={palette.primary} minimizeBehavior="never">
      <NativeTabs.Trigger name="home">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>หน้าหลัก</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="patients">
        <Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
        <Label>ผู้ป่วย</Label>
        {isPractitioner ? <Badge>2</Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="herbs">
        <Icon sf={{ default: 'leaf', selected: 'leaf.fill' }} />
        <Label>สมุนไพร</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="vault">
        <Icon sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }} />
        <Label>คลังภูมิ</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ask">
        <Icon sf={{ default: "sparkles", selected: "sparkles" }} />
        <Label>ครูปัญญา</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
