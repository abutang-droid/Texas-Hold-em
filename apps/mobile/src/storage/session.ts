import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '../api/client';

const SESSION_KEY = 'th_session';

export interface StoredSession {
  token: string;
  refreshToken: string;
  user: UserProfile;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
