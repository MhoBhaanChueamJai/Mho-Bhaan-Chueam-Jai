/**
 * ไอคอนทั้งแอปเป็น SF Symbols ของ Apple (ชุดเดียวกันทั้งระบบ)
 * คงชื่อ component ตามที่ใช้อยู่เดิม เพื่อให้เปลี่ยนเฉพาะที่ import
 */
import { SymbolView, type SFSymbol, type SymbolWeight } from 'expo-symbols';
import React from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import { WebSymbol } from './symbolWeb';
import { iconTier } from '../theme';

type Props = { size?: number; color?: string; fill?: string; strokeWidth?: number; style?: StyleProp<ViewStyle> };

function make(name: SFSymbol, filled?: SFSymbol) {
  const Icon = ({ size = 22, color = '#1F2A24', fill, strokeWidth, style }: Props) => {
    const useFilled = filled && fill && fill !== 'transparent';
    const weight: SymbolWeight = strokeWidth && strokeWidth >= 2.3 ? 'semibold' : 'medium';
    const s = iconTier(size);
    if (Platform.OS !== 'ios') return <WebSymbol name={useFilled ? filled! : name} size={s} color={color} />;
    return <SymbolView name={useFilled ? filled : name} size={s} tintColor={color} weight={weight} style={[{ width: s, height: s }, style]} />;
  };
  Icon.displayName = name;
  return Icon;
}

export const Activity = make('waveform.path.ecg');
export const AlertTriangle = make('exclamationmark.triangle.fill');
export const ArrowUpRight = make('arrow.up.right');
export const Baby = make('figure.and.child.holdinghands');
export const BadgeCheck = make('checkmark.seal.fill');
export const Bone = make('figure.walk');
export const BookHeart = make('book.closed.fill');
export const BookMarked = make('bookmark.fill');
export const Camera = make('camera.fill');
export const Check = make('checkmark');
export const ChevronLeft = make('chevron.left');
export const CircleCheck = make('checkmark.circle');
export const Clock3 = make('clock');
export const Cpu = make('cpu');
export const Droplets = make('drop.fill');
export const EllipsisVertical = make('ellipsis');
export const FileText = make('doc.text');
export const Flame = make('flame.fill');
export const FlaskConical = make('testtube.2');
export const Hand = make('hand.raised.fill');
export const Heart = make('heart', 'heart.fill');
export const Images = make('photo.on.rectangle');
export const Info = make('info.circle');
export const Languages = make('character.bubble');
export const Leaf = make('leaf.fill');
export const MapPin = make('mappin.and.ellipse');
export const MessageCircleHeart = make('bubble.left.and.bubble.right.fill');
export const Mic = make('mic.fill');
export const Phone = make('phone.fill');
export const Plus = make('plus');
export const RefreshCw = make('arrow.clockwise');
export const ScrollText = make('scroll.fill');
export const Search = make('magnifyingglass');
export const SendHorizontal = make('arrow.up.circle.fill');
export const Shield = make('shield.fill');
export const ShieldCheck = make('checkmark.shield.fill');
export const Sprout = make('leaf');
export const Square = make('stop.fill');
export const Vibrate = make('iphone.radiowaves.left.and.right');
export const Volume2 = make('speaker.wave.2.fill');
export const VolumeX = make('speaker.slash.fill');
export const X = make('xmark');
export const HelpCircle = make('questionmark.circle.fill');
export const Keyboard = make('keyboard');
export const RotateCcw = make('arrow.counterclockwise');
export const Stethoscope = make('stethoscope');
