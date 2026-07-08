import '../src/i18n';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { isOnboardingComplete } from '../src/storage/onboarding';

function OnboardingGate() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!isOnboardingComplete() && segments[0] !== 'onboarding') {
      router.replace('/onboarding');
    }
  }, [router, segments]);

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
