import * as jose from 'jose';
import type { OAuthProvider } from './oauth.js';

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const GOOGLE_JWKS = jose.createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const APPLE_JWKS = jose.createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

function googleClientIds(): string[] {
  return (process.env.GOOGLE_OAUTH_CLIENT_ID ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function appleClientIds(): string[] {
  const ids = [
    process.env.APPLE_CLIENT_ID,
    process.env.APPLE_BUNDLE_ID,
    'com.texasholdem.app',
  ]
    .filter((id): id is string => Boolean(id?.trim()))
    .map((id) => id.trim());
  return [...new Set(ids)];
}

export async function verifyGoogleIdToken(
  idToken: string,
): Promise<{ sub: string; email?: string } | null> {
  const audiences = googleClientIds();
  if (audiences.length === 0) return null;

  try {
    const { payload } = await jose.jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience: audiences,
    });
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}

export async function verifyAppleIdToken(
  idToken: string,
): Promise<{ sub: string; email?: string } | null> {
  const audiences = appleClientIds();
  if (audiences.length === 0) return null;

  try {
    const { payload } = await jose.jwtVerify(idToken, APPLE_JWKS, {
      issuer: 'https://appleid.apple.com',
      audience: audiences,
    });
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}

export async function verifyProviderIdToken(
  provider: OAuthProvider,
  idToken: string,
): Promise<{ sub: string; email?: string } | null> {
  if (provider === 'GOOGLE') return verifyGoogleIdToken(idToken);
  return verifyAppleIdToken(idToken);
}
