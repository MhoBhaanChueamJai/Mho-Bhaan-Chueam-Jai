/** BlurView ที่เบลอจริงบน Android (ค่าเริ่มต้นของ expo-blur บน Android เป็นแค่สีโปร่ง ไม่เบลอ) */
import { BlurView as ExpoBlurView, type BlurViewProps } from 'expo-blur';
import React from 'react';

export function BlurView(props: BlurViewProps) {
  return <ExpoBlurView experimentalBlurMethod="dimezisBlurView" {...props} />;
}
