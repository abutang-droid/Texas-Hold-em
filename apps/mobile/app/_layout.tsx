import '../src/i18n';
import { useEffect } from 'react';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { isOnboardingComplete } from '../src/storage/onboarding';

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

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <OnboardingGate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#121418' } }} />
    </>
  );
}
