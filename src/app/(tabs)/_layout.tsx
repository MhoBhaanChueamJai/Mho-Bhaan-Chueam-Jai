import { Redirect } from 'expo-router';
import { Badge, Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { useApp } from '../../store/app';
import { palette } from '../../theme';

/**
 * แท็บบาร์ native ของ iOS 26 (Liquid Glass ของ Apple)
 * - แคปซูลกระจกเลื่อนตามแท็บที่เลือก, หดตัวเมื่อเลื่อนลง
 * - แท็บ "ครูปัญญา" ใช้ role="search" → แยกเป็นปุ่มกระจกวงกลมทางขวา
 */
export default function TabsLayout() {
  const { settings } = useApp();
  if (!settings.loggedIn) return <Redirect href="/login" />;
  return (
    <NativeTabs tintColor={palette.primary} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="home">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>หน้าหลัก</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="patients">
        <Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
        <Label>ผู้ป่วย</Label>
        <Badge>2</Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="herbs">
        <Icon sf={{ default: 'leaf', selected: 'leaf.fill' }} />
        <Label>สมุนไพร</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="vault">
        <Icon sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }} />
        <Label>คลังภูมิ</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ask" role="search">
        <Icon sf="mic.fill" />
        <Label>ครูปัญญา</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
