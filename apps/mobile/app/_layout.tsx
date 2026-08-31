import '../src/i18n';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { hydrateOnboarding, isOnboardingComplete } from '../src/storage/onboarding';
import {
  bootstrapSession,
  getToken,
  logout,
  setAuthChangeHandler,
  setUnauthorizedHandler,
} from '../src/api/client';
import { colors } from '../src/theme';

const LAYOUT_REV = '2026-08-31-nav4';

function NavigationGuards({ bootReady, authTick }: { bootReady: boolean; authTick: number }) {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const navReady = !!rootNavigationState?.key;

  useEffect(() => {
    if (!bootReady || !navReady) return;

    const top = segments[0];
    const inAuth = top === 'auth';
    const inOnboarding = top === 'onboarding';
    const hasToken = !!getToken();

    if (!hasToken && !inAuth) {
      router.replace('/auth/login');
      return;
    }
    if (hasToken && !isOnboardingComplete() && !inOnboarding) {
      router.replace('/onboarding');
    }
  }, [bootReady, navReady, segments, router, authTick]);

  return null;
}

export default function RootLayout() {
  const [bootReady, setBootReady] = useState(false);
  const [authTick, setAuthTick] = useState(0);

  useEffect(() => {
    if (__DEV__) {
      console.log(`[mobile] layout ${LAYOUT_REV}`);
    }
    const bump = () => setAuthTick((n) => n + 1);
    setUnauthorizedHandler(() => {
      void logout().then(bump);
    });
    setAuthChangeHandler(bump);
    let cancelled = false;
    const finish = () => {
      if (!cancelled) setBootReady(true);
    };
    const watchdog = setTimeout(finish, 6000);
    Promise.all([bootstrapSession(), hydrateOnboarding()]).finally(() => {
      clearTimeout(watchdog);
      finish();
    });
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      setUnauthorizedHandler(null);
      setAuthChangeHandler(null);
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.lobby } }} />
      <NavigationGuards bootReady={bootReady} authTick={authTick} />
      {!bootReady ? (
        <View style={styles.bootOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.brand.secondary} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  bootOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.lobby,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
