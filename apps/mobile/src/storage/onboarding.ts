let onboardingDone = false;

export function isOnboardingComplete(): boolean {
  return onboardingDone;
}

export function completeOnboarding(): void {
  onboardingDone = true;
}
