import { isOnboardingComplete } from '../storage/onboarding';

/** Route after successful login/register/guest auth. */
export function postAuthRoute(): '/onboarding' | '/' {
  return isOnboardingComplete() ? '/' : '/onboarding';
}
