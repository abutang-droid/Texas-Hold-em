import '../src/i18n';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { isOnboardingComplete } from '../src/storage/onboarding';
import { restoreSession, getToken } from '../src/api/client';
import { colors } from '../src/theme';

function OnboardingGate() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavigationState?.key) return;
    if (!isOnboardingComplete() && segments[0] !== 'onboarding') {
      router.replace('/onboarding');
    }
  }, [rootNavigationState?.key, router, segments]);

  return null;
}

function AuthGate({ sessionReady }: { sessionReady: boolean }) {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!sessionReady || !rootNavigationState?.key) return;
    const top = segments[0];
    const inAuth = top === 'auth';
    const inOnboarding = top === 'onboarding';
    if (!getToken() && !inAuth && !inOnboarding) {
      router.replace('/auth/login');
    }
  }, [sessionReady, rootNavigationState?.key, router, segments]);

  return null;
}

export default function RootLayout() {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    restoreSession().finally(() => setSessionReady(true));
  }, []);

  if (!sessionReady) {
    return (
      <View style={styles.boot}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.brand.secondary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <OnboardingGate />
      <AuthGate sessionReady={sessionReady} />
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
