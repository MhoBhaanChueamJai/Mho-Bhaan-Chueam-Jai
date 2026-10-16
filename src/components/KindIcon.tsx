/** ไอคอนประเภทตำรา (Flaticon UIcons solid rounded): ตำรับยา = ครกบดยา · วิธีรักษา = นวด · คาถา/พิธี = หนังสือเวทมนตร์ · ตำราโบราณ = คัมภีร์+ขนนก */
import { Image } from 'expo-image';
import React from 'react';
import type { Wisdom } from '../data/mock';

export const KIND_ICON_SRC: Record<Wisdom['kind'], number> = {
  ตำรับยา: require('../../assets/icons/kind-remedy.png'),
  วิธีรักษา: require('../../assets/icons/kind-treatment.png'),
  'คาถา/พิธี': require('../../assets/icons/kind-ritual.png'),
  ตำราโบราณ: require('../../assets/icons/kind-ancient.png'),
};

export function KindIcon({ kind, size = 18, color = '#000' }: { kind: Wisdom['kind']; size?: number; color?: string }) {
  return <Image source={KIND_ICON_SRC[kind]} style={{ width: size, height: size }} tintColor={color} />;
}
