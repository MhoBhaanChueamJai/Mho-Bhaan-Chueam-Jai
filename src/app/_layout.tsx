import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../store/app';
import { palette } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { ready } = useApp();
  const loaded = ready;
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
        <Stack.Screen name="patient/new" options={{ presentation: 'modal', headerShown: true, title: 'ผู้ป่วยใหม่', headerStyle: { backgroundColor: '#F2F2F7' }, headerShadowVisible: false }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'ตั้งค่า', headerLargeTitle: true, headerTransparent: true, headerShadowVisible: false, headerLargeTitleShadowVisible: false, headerBackVisible: false }} />
      </Stack>
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
