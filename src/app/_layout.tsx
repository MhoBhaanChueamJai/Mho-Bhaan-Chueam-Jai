import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LockScreen } from '../components/LockScreen';
import { AlertHost } from '../lib/alert';
import { platformHeader } from '../components/nav/platformHeader';
import { usePushRouting } from '../lib/pushRouting';
import { useSkiaWeb } from '../lib/skiaWeb';
import { APP_FONTS, NEEDS_FONT } from '../lib/font';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AppProvider, useApp } from '../store/app';
import { palette } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** ออกจากแอปเกินเวลานี้ แล้วกลับมาต้องปลดล็อกใหม่ */
const RELOCK_MS = 60_000;

function Root() {
  const { ready, settings, unlocked, setUnlocked } = useApp();
  const loaded = ready;
  const lockEnabled = settings.loggedIn && (settings.pinEnabled || settings.faceIdEnabled);
  const leftAt = useRef(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') leftAt.current = Date.now();
      if (st === 'active' && leftAt.current && Date.now() - leftAt.current > RELOCK_MS) setUnlocked(false);
    });
    return () => sub.remove();
  }, [setUnlocked]);
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  // แจ้งเตือนแบบ Push: เข้าสู่ระบบ + ปลดล็อกแล้ว → ลงทะเบียนเครื่อง · กดแจ้งเตือน → เปิดหน้าที่ระบุ (เว็บไม่มี push)
  const inside = loaded && settings.loggedIn && (!lockEnabled || unlocked);
  usePushRouting(inside);
  if (!loaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, headerBackButtonDisplayMode: 'minimal', headerBackTitle: 'กลับ', contentStyle: { backgroundColor: palette.bg }, animation: 'default', ...platformHeader }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="patient/tell" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="id-scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="herb/scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        {/* ผลสแกนสมุนไพร: Sheet ของ iOS (แบบแผ่นรับตำรา) */}
        <Stack.Screen name="herb/found" options={sheet({ presentation: 'formSheet', sheetAllowedDetents: [1.0], sheetGrabberVisible: false, contentStyle: { backgroundColor: palette.bg } })} />
        <Stack.Screen name="wisdom/scan-qr" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        {/* Sheet ของ iOS (แบบหน้ากิจกรรมใหม่ในปฏิทิน): ตัวอย่างตำราที่ได้จากรหัส */}
        <Stack.Screen name="wisdom/got" options={sheet({ presentation: 'formSheet', sheetAllowedDetents: [1.0], sheetGrabberVisible: false, contentStyle: { backgroundColor: palette.bg } })} />
        <Stack.Screen name="wisdom/share" options={sheet({ presentation: 'modal' })} />
        <Stack.Screen name="wisdom/read" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="wisdom/voice" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="wisdom/tell" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="patient/voice" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="patient/visit" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="assistant" />
        <Stack.Screen name="privacy" options={sheet({ presentation: 'modal', headerShown: true, title: 'นโยบายความเป็นส่วนตัว', headerShadowVisible: false, headerStyle: { backgroundColor: '#FFFFFF' } })} />
        <Stack.Screen name="pin-setup" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="patient/search" options={{ animation: 'fade', animationDuration: 120, gestureEnabled: false }} />
        <Stack.Screen name="herb/search" options={{ animation: 'fade', animationDuration: 120, gestureEnabled: false }} />
        <Stack.Screen name="wisdom/search" options={{ animation: 'fade', animationDuration: 120, gestureEnabled: false }} />
        <Stack.Screen name="patient/referral" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="patient/consent" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="report" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="stock" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="appointments" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="interactions" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="wisdom/media" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
        <Stack.Screen name="stock-item" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="patient/record" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="patient/new" options={{ headerShown: true, title: 'เพิ่มผู้ป่วย', headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="wisdom/new" options={{ headerShown: true, title: 'เพิ่มภูมิปัญญา', headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="wisdom/receive" options={{ headerShown: true, title: 'รับตำราจากเพื่อน', headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'ตั้งค่า', headerLargeTitle: true, headerTransparent: true, headerShadowVisible: false, headerLargeTitleShadowVisible: false, headerBackVisible: false }} />
        <Stack.Screen name="account/edit" options={sheet({ presentation: 'formSheet', sheetAllowedDetents: [1.0], sheetGrabberVisible: false, contentStyle: { backgroundColor: palette.bg } })} />
        <Stack.Screen name="account/password" options={sheet({ presentation: 'formSheet', sheetAllowedDetents: [1.0], sheetGrabberVisible: false, contentStyle: { backgroundColor: palette.bg } })} />
        <Stack.Screen name="forgot" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="reset-password" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="feedback" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="help" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="knowledge" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg } }} />
        {/* แหล่งอ้างอิง: แผ่นเต็มจอแบบเดียวกับแก้ไขข้อมูลบัญชี (ปัดลงหรือ ✕ เพื่อปิด) */}
        <Stack.Screen name="source" options={sheet({ presentation: 'formSheet', sheetAllowedDetents: [1.0], sheetGrabberVisible: false, contentStyle: { backgroundColor: palette.bg } })} />
        <Stack.Screen name="role" options={{ headerShown: true, title: 'บทบาทของคุณ', headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="about" options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="profile" options={{ headerShown: true, title: 'ข้อมูลส่วนตัว', headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'แจ้งเตือน', headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="ai-settings" options={{ headerShown: true, title: 'ตั้งค่า AI', headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg } }} />
      </Stack>
      {lockEnabled && !unlocked ? <LockScreen /> : null}
      <AlertHost />
    </>
  );
}

/** Android / เว็บ: ชีท/โมดัลแบบ iOS วาดเอง (SheetFrame) — หน้าโปร่ง ไม่มีแอนิเมชันของ stack (ชีทเลื่อนขึ้นเอง) */
const sheet = (o: NativeStackNavigationOptions): NativeStackNavigationOptions =>
  Platform.OS === 'ios' ? o : { ...o, presentation: 'transparentModal', animation: 'none', headerShown: false, contentStyle: { backgroundColor: 'transparent' } };

export default function Layout() {
  const skia = useSkiaWeb();
  // Android / เว็บ: โหลดฟอนต์ไทยที่ใกล้ฟอนต์ iOS ก่อนวาด (iOS ใช้ฟอนต์ระบบ)
  const [fonts] = useFonts(NEEDS_FONT ? { ...APP_FONTS, ...Ionicons.font, ...MaterialCommunityIcons.font } : {});
  if (!skia || (NEEDS_FONT && !fonts)) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.bg }}>
      <SafeAreaProvider>
        <AppProvider>
          <Root />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
