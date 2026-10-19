/** iOS / Android: ถ่ายภาพ View เป็น SkImage ด้วย Skia (ใช้กับการพลิกหน้าหนังสือ) */
import { makeImageFromView, type SkImage } from '@shopify/react-native-skia';
import type React from 'react';
import type { View } from 'react-native';

export const snapView = (ref: React.RefObject<View>): Promise<SkImage | null> => makeImageFromView(ref);
