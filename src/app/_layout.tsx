import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LockScreen } from '../components/LockScreen';
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
  if (!loaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, headerBackButtonDisplayMode: 'minimal', headerBackTitle: 'กลับ', contentStyle: { backgroundColor: palette.bg }, animation: 'default' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom' }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="id-scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="herb/scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        {/* ผลสแกนสมุนไพร: Sheet ของ iOS (แบบแผ่นรับตำรา) */}
        <Stack.Screen name="herb/found" options={{ presentation: 'formSheet', sheetAllowedDetents: [1.0], sheetGrabberVisible: false, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="wisdom/scan-qr" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        {/* Sheet ของ iOS (แบบหน้ากิจกรรมใหม่ในปฏิทิน): ตัวอย่างตำราที่ได้จากรหัส */}
        <Stack.Screen name="wisdom/got" options={{ presentation: 'formSheet', sheetAllowedDetents: [1.0], sheetGrabberVisible: false, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="wisdom/share" options={{ presentation: 'modal' }} />
        <Stack.Screen name="wisdom/read" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="wisdom/voice" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="patient/voice" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="patient/visit" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="assistant" />
        <Stack.Screen name="verify" options={{ presentation: 'modal', headerShown: true, title: 'ยืนยันตัวตน', headerShadowVisible: false, headerStyle: { backgroundColor: '#FFFFFF' } }} />
        <Stack.Screen name="privacy" options={{ presentation: 'modal', headerShown: true, title: 'นโยบายความเป็นส่วนตัว', headerShadowVisible: false, headerStyle: { backgroundColor: '#FFFFFF' } }} />
        <Stack.Screen name="pin-setup" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="patient/search" options={{ animation: 'fade', animationDuration: 120, gestureEnabled: false }} />
        <Stack.Screen name="herb/search" options={{ animation: 'fade', animationDuration: 120, gestureEnabled: false }} />
        <Stack.Screen name="wisdom/search" options={{ animation: 'fade', animationDuration: 120, gestureEnabled: false }} />
        <Stack.Screen name="patient/new" options={{ headerShown: true, title: 'เพิ่มผู้ป่วย', headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="wisdom/new" options={{ headerShown: true, title: 'เพิ่มภูมิปัญญา', headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="wisdom/receive" options={{ headerShown: true, title: 'รับตำราจากเพื่อน', headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg }, contentStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'ตั้งค่า', headerLargeTitle: true, headerTransparent: true, headerShadowVisible: false, headerLargeTitleShadowVisible: false, headerBackVisible: false }} />
        <Stack.Screen name="profile" options={{ headerShown: true, title: 'ข้อมูลส่วนตัว', headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'แจ้งเตือน', headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg } }} />
        <Stack.Screen name="ai-settings" options={{ headerShown: true, title: 'ตั้งค่า AI', headerBackButtonDisplayMode: 'minimal', headerTintColor: palette.ink, headerShadowVisible: false, headerStyle: { backgroundColor: palette.bg } }} />
      </Stack>
      {lockEnabled && !unlocked ? <LockScreen /> : null}
    </>
  );
}

export default function Layout() {
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
