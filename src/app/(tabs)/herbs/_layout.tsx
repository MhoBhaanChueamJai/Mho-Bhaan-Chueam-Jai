import { Stack } from 'expo-router';
import React from 'react';
import { tabStackOptions } from '../../../components/tabStack';

/** Stack ของแท็บ — หัวหน้าจอมาตรฐาน (Large Title) ชุดเดียวกันทุกแท็บ */
export default function TabStack() {
  return (
    <Stack screenOptions={tabStackOptions}>
      <Stack.Screen name="index" options={{ title: 'คลังสมุนไพร' }} />
    </Stack>
  );
}
