import '../src/i18n';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRootNavigationState, useSegments, Redirect } from 'expo-router';
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

function NavigationGuards({ bootReady }: { bootReady: boolean }) {
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const navReady = !!rootNavigationState?.key;

  if (!bootReady || !navReady) return null;

  const top = segments[0];
  const inAuth = top === 'auth';
  const inOnboarding = top === 'onboarding';
  const hasToken = !!getToken();

  if (!hasToken && !inAuth) {
    return <Redirect href="/auth/login" />;
  }

  if (hasToken && !isOnboardingComplete() && !inOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return null;
}

export default function RootLayout() {
  const [bootReady, setBootReady] = useState(false);
  const [authTick, setAuthTick] = useState(0);

  useEffect(() => {
    const bump = () => setAuthTick((n) => n + 1);
    setUnauthorizedHandler(() => {
      void logout().then(bump);
    });
    setAuthChangeHandler(bump);
    Promise.all([bootstrapSession(), hydrateOnboarding()]).finally(() => setBootReady(true));
    return () => {
      setUnauthorizedHandler(null);
      setAuthChangeHandler(null);
    };
  }, []);

  void authTick;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#121418' } }} />
      <NavigationGuards bootReady={bootReady} />
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
