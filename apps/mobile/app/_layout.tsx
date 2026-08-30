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

export default function RootLayout() {
  const [bootReady, setBootReady] = useState(false);
  const [authTick, setAuthTick] = useState(0);
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const navReady = !!rootNavigationState?.key;

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

  if (!bootReady) {
    return (
      <View style={styles.boot}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.brand.secondary} />
      </View>
    );
  }

  const top = segments[0];
  const inAuth = top === 'auth';
  const inOnboarding = top === 'onboarding';
  const hasToken = !!getToken();

  // 1) Login / guest first — API calls require a token
  if (navReady && !hasToken && !inAuth) {
    return <Redirect href="/auth/login" />;
  }

  // 2) Optional onboarding after auth
  if (navReady && hasToken && !isOnboardingComplete() && !inOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#121418' } }} />
    </>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg.lobby,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
