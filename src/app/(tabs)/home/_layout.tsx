import { Stack } from 'expo-router';
import React from 'react';
import { palette } from '../../../theme';

/** Stack ของแท็บหน้าหลัก — หัวเรื่องใหญ่ (Large Title) ที่ย่อเป็นแถบกระจกเมื่อเลื่อน */
export default function HomeStack() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerTintColor: palette.primary,
        contentStyle: { backgroundColor: palette.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'วันนี้' }} />
    </Stack>
  );
}
