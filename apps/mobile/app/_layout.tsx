import '../src/i18n';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRootNavigationState, useSegments, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { isOnboardingComplete } from '../src/storage/onboarding';
import {
  bootstrapSession,
  getToken,
  logout,
  setAuthChangeHandler,
  setUnauthorizedHandler,
} from '../src/api/client';
import { colors } from '../src/theme';

export default function RootLayout() {
  const [sessionReady, setSessionReady] = useState(false);
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
    bootstrapSession().finally(() => setSessionReady(true));
    return () => {
      setUnauthorizedHandler(null);
      setAuthChangeHandler(null);
    };
  }, []);

  void authTick;

  if (!sessionReady) {
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

  if (navReady && !isOnboardingComplete() && !inOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  if (navReady && !hasToken && !inAuth && !inOnboarding) {
    return <Redirect href="/auth/login" />;
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
