/**
 * ความปลอดภัยของแอป: รหัส PIN 6 หลัก + Face ID
 * - เก็บเฉพาะค่า hash (SHA-256 + salt) ของ PIN ใน Keychain (expo-secure-store) ไม่เก็บตัวเลขจริง
 * - เว็บไม่มี Keychain → ใช้ AsyncStorage แทน
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PIN_KEY = 'mbcj.pin.hash';
const SALT = 'mho-bhaan-chueam-jai';
export const PIN_LENGTH = 6;
export const MAX_ATTEMPTS = 5;

const store = {
  get: (k: string) => (Platform.OS === 'web' ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k)),
  set: (k: string, v: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v)),
  del: (k: string) => (Platform.OS === 'web' ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k)),
};

const hash = (pin: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${SALT}:${pin}`);

export async function savePin(pin: string) {
  await store.set(PIN_KEY, await hash(pin));
}

export async function checkPin(pin: string) {
  const saved = await store.get(PIN_KEY);
  return !!saved && saved === (await hash(pin));
}

export async function clearPin() {
  await store.del(PIN_KEY).catch(() => {});
}

/** เครื่องรองรับ Face ID / Touch ID และตั้งค่าไว้แล้วหรือไม่ */
export async function biometricInfo(): Promise<{ available: boolean; label: string; icon: 'faceid' | 'touchid' }> {
  if (Platform.OS === 'web') return { available: false, label: 'Face ID', icon: 'faceid' };
  try {
    const [hw, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    return { available: hw && enrolled, label: face ? 'Face ID' : 'Touch ID', icon: face ? 'faceid' : 'touchid' };
  } catch {
    return { available: false, label: 'Face ID', icon: 'faceid' };
  }
}

export async function authenticateBiometric(reason = 'ปลดล็อกหมอบ้านเชื่อมใจ') {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: 'ใช้รหัส PIN', disableDeviceFallback: true });
    return r.success;
  } catch {
    return false;
  }
}
