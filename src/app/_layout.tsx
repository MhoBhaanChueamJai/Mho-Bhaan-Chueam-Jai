import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LockScreen } from '../components/LockScreen';
import { loadSkia } from '../lib/loadSkia';
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
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg }, animation: 'default' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom' }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="assistant" />
        <Stack.Screen name="pin-setup" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="patient/new" options={{ presentation: 'modal', headerShown: true, title: 'ผู้ป่วยใหม่', headerStyle: { backgroundColor: '#F2F2F7' }, headerShadowVisible: false }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'ตั้งค่า', headerLargeTitle: true, headerTransparent: true, headerShadowVisible: false, headerLargeTitleShadowVisible: false, headerBackVisible: false }} />
      </Stack>
      {lockEnabled && !unlocked ? <LockScreen /> : null}
    </>
  );
}

/** เว็บ: โหลด CanvasKit (Skia) ก่อนแสดงผล — iOS ไม่ต้อง */
function useSkiaWeb() {
  const [ok, setOk] = useState(Platform.OS !== 'web');
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    loadSkia().finally(() => setOk(true));
  }, []);
  return ok;
}

export default function Layout() {
  const skiaReady = useSkiaWeb();
  if (!skiaReady) return null;
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
