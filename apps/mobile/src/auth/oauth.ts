import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { oauthLogin } from '../api/client';

WebBrowser.maybeCompleteAuthSession();

function googleClientIds() {
  return {
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  };
}

export function isGoogleSignInConfigured(): boolean {
  const ids = googleClientIds();
  return Boolean(ids.webClientId || ids.iosClientId || ids.androidClientId);
}

export function useGoogleAuthRequest() {
  const ids = googleClientIds();
  return Google.useAuthRequest({
    iosClientId: ids.iosClientId,
    androidClientId: ids.androidClientId,
    webClientId: ids.webClientId,
    scopes: ['openid', 'profile', 'email'],
  });
}

export async function signInWithGoogleIdToken(idToken: string, nickname?: string) {
  return oauthLogin('GOOGLE', idToken, nickname);
}

export function isAppleSignInAvailable(): boolean {
  return Platform.OS === 'ios';
}

export async function signInWithApple(nickname?: string) {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) {
    throw new Error('errors.invalid_oauth');
  }
  const displayName =
    nickname ||
    [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ') ||
    undefined;
  return oauthLogin('APPLE', credential.identityToken, displayName);
}
