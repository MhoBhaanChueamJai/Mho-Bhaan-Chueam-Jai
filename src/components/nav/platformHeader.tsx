/** Android / เว็บ: ใช้แถบหัวแบบ iOS 26 ที่วาดเอง (iOS ใช้ของระบบ) */
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import React from 'react';
import { Platform } from 'react-native';
import { NavHeader } from './NavHeader';

export const platformHeader =
  Platform.OS === 'ios' ? {} : { header: (p: NativeStackHeaderProps) => <NavHeader {...p} /> };
