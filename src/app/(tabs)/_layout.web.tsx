import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { useApp } from '../../store/app';
import { palette } from '../../theme';

/** เว็บ: แถบเมนูล่างแบบ JS (native tabs ใช้ได้เฉพาะ iOS) */
export default function TabsLayoutWeb() {
  const { settings } = useApp();
  if (!settings.loggedIn) return <Redirect href="/login" />;
  const icon = (on: keyof typeof Ionicons.glyphMap, off: keyof typeof Ionicons.glyphMap) =>
    function TabIcon({ focused, color }: { focused: boolean; color: string }) {
      return <Ionicons name={focused ? on : off} size={24} color={color} />;
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
      <Tabs.Screen name="home" options={{ title: 'หน้าหลัก', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="patients" options={{ title: 'ผู้ป่วย', tabBarIcon: icon('people', 'people-outline'), tabBarBadge: 2 }} />
      <Tabs.Screen name="herbs" options={{ title: 'สมุนไพร', tabBarIcon: icon('leaf', 'leaf-outline') }} />
      <Tabs.Screen name="vault" options={{ title: 'คลังภูมิ', tabBarIcon: icon('library', 'library-outline') }} />
      <Tabs.Screen name="ask" options={{ title: 'ครูปัญญา', tabBarIcon: icon('mic', 'mic-outline') }} />
    </Tabs>
  );
}
