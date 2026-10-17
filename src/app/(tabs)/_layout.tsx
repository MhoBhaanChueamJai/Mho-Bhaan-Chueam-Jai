import { Redirect, usePathname } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import React, { useEffect } from 'react';
import { askLaunch } from '../../lib/askLaunch';
import { useApp } from '../../store/app';
import { palette } from '../../theme';

/**
 * แท็บบาร์ native ของ iOS 26 (Liquid Glass ของ Apple)
 * - แคปซูลกระจกเลื่อนตามแท็บที่เลือก หดตัวเมื่อเลื่อนลง
 * - แท็บ "ครูปัญญา" ใช้ role="search" → แยกเป็นปุ่มกระจกวงกลมทางขวา อยู่ให้เห็นแม้แท็บบาร์หด
 * - แท็บ "ครูปัญญา" (ไมค์) กดแล้วเปิดหน้าแชทเต็มจอ
 * - ไอคอน: Flaticon UIcons (regular rounded = ไม่ได้เลือก · solid rounded = เลือกอยู่) → assets/tabs
 */
export default function TabsLayout() {
  const { settings } = useApp();
  // จำแท็บล่าสุด (ไม่นับแท็บครูปัญญา) → ปิดแชทแล้วกลับไปที่เดิม
  const path = usePathname();
  useEffect(() => {
    // เฉพาะหน้าของแท็บ (ไม่นับหน้าที่เปิดซ้อนบนแท็บ เช่น /assistant)
    const m = path?.match(/^\/(home|patients|herbs|vault)\b/);
    if (m) askLaunch.lastTab = `/${m[1]}`;
  }, [path]);
  if (!settings.loggedIn) return <Redirect href="/login" />;
  return (
    <NativeTabs tintColor={palette.primary} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="home">
        <Icon src={{ default: require('../../../assets/tabs/house-chimney-off.png'), selected: require('../../../assets/tabs/house-chimney-on.png') }} />
        <Label>หน้าหลัก</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="patients">
        <Icon src={{ default: require('../../../assets/tabs/users-off.png'), selected: require('../../../assets/tabs/users-on.png') }} />
        <Label>ผู้ป่วย</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="herbs">
        <Icon src={{ default: require('../../../assets/tabs/leaf-off.png'), selected: require('../../../assets/tabs/leaf-on.png') }} />
        <Label>สมุนไพร</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="vault">
        <Icon src={{ default: require('../../../assets/tabs/book-open-cover-off.png'), selected: require('../../../assets/tabs/book-open-cover-on.png') }} />
        <Label>คลังภูมิ</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ask" role="search">
        <Icon src={{ default: require('../../../assets/tabs/sparkles-off.png'), selected: require('../../../assets/tabs/sparkles-on.png') }} />
        <Label>ครูปัญญา</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
