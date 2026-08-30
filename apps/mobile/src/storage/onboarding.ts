import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'th_onboarding_done';

let onboardingDone = false;
let hydrated = false;

export function isOnboardingComplete(): boolean {
  return onboardingDone;
}

export function isOnboardingHydrated(): boolean {
  return hydrated;
}

export async function hydrateOnboarding(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  onboardingDone = raw === '1';
  hydrated = true;
  return onboardingDone;
}

export async function completeOnboarding(): Promise<void> {
  onboardingDone = true;
  await AsyncStorage.setItem(KEY, '1');
}
