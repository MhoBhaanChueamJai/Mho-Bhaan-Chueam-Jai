import { Stack } from 'expo-router';
import React from 'react';
import { palette } from '../../../theme';

/** Stack ของแท็บผู้ป่วย — Large Title แบบ native */
export default function PatientsStack() {
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
      <Stack.Screen name="index" options={{ title: 'ผู้ป่วย' }} />
    </Stack>
  );
}
