import { Image } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { useApp } from '../../store/app';
import { palette } from '../../theme';

/** เว็บ: แถบเมนูล่างแบบ JS (native tabs ใช้ได้เฉพาะ iOS) */
export default function TabsLayoutWeb() {
  const { settings } = useApp();
  if (!settings.loggedIn) return <Redirect href="/login" />;
  // ไอคอนชุดเดียวกับ iOS (Flaticon UIcons: regular = ไม่ได้เลือก · solid = เลือกอยู่)
  const icon = (on: number, off: number) =>
    function TabIcon({ focused, color }: { focused: boolean; color: string }) {
      return <Image source={focused ? on : off} style={{ width: 25, height: 25, tintColor: color }} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: '#8A938C',
        tabBarStyle: { height: 64, paddingTop: 6, paddingBottom: 8, borderTopColor: 'rgba(0,0,0,0.06)' },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'หน้าหลัก', tabBarIcon: icon(require('../../../assets/tabs/house-chimney-on.png'), require('../../../assets/tabs/house-chimney-off.png')) }} />
      <Tabs.Screen name="patients" options={{ title: 'ผู้ป่วย', tabBarIcon: icon(require('../../../assets/tabs/users-on.png'), require('../../../assets/tabs/users-off.png')) }} />
      <Tabs.Screen name="herbs" options={{ title: 'สมุนไพร', tabBarIcon: icon(require('../../../assets/tabs/leaf-on.png'), require('../../../assets/tabs/leaf-off.png')) }} />
      <Tabs.Screen name="vault" options={{ title: 'คลังภูมิ', tabBarIcon: icon(require('../../../assets/tabs/book-open-cover-on.png'), require('../../../assets/tabs/book-open-cover-off.png')) }} />
      <Tabs.Screen name="ask" options={{ title: 'ครูปัญญา', tabBarIcon: icon(require('../../../assets/tabs/sparkles-on.png'), require('../../../assets/tabs/sparkles-off.png')) }} />
    </Tabs>
  );
}
