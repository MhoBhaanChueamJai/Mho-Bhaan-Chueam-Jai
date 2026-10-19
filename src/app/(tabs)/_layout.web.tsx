import { Redirect } from 'expo-router';
import React from 'react';
import { GlassTabs } from '../../components/nav/GlassTabs';
import { useTabMemory } from '../../components/nav/useTabMemory';
import { useApp } from '../../store/app';

/** เว็บ: แถบแท็บลอยแบบ iOS 26 ที่วาดเอง (NativeTabs ใช้ได้เฉพาะ iOS) */
export default function TabsLayoutWeb() {
  const { settings } = useApp();
  useTabMemory();
  if (!settings.loggedIn) return <Redirect href="/login" />;
  return <GlassTabs />;
}
