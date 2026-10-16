import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { palette } from '../../../theme';

/** Stack ของแท็บผู้ป่วย — Large Title แบบ native */
export default function PatientsStack() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        // เว็บไม่มี large title แบบ native → ใช้แถบหัวทึบ ไม่ทับเนื้อหา
        headerTransparent: Platform.OS === 'ios',
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerTintColor: palette.primary,
        headerStyle: { backgroundColor: palette.bg },
        contentStyle: { backgroundColor: palette.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'ผู้ป่วย' }} />
    </Stack>
  );
}
