import { saveSession, loadSession, clearSession, type StoredSession } from '../storage/session';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface UserProfile {
  id: number;
  nickname: string;
  chipsBalance: number;
  level: number;
  totalExp: number;
  preferredLocale: string;
}

let token: string | null = null;
let refreshToken: string | null = null;

export function setToken(t: string) {
  token = t;
}

export function getToken() {
  return token;
}

export function getRefreshToken() {
  return refreshToken;
}

export async function persistAuth(data: {
  token: string;
  refreshToken: string;
  user: UserProfile;
}): Promise<void> {
  token = data.token;
  refreshToken = data.refreshToken;
  await saveSession(data);
}

export async function restoreSession(): Promise<StoredSession | null> {
  const session = await loadSession();
  if (!session?.token) return null;
  token = session.token;
  refreshToken = session.refreshToken;
  return session;
}

export async function logout(): Promise<void> {
  token = null;
  refreshToken = null;
  await clearSession();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const json = await res.json();
  if (!res.ok) {
    const payload = json.message;
    const messageKey =
      (typeof payload === 'object' && payload?.messageKey) ||
      json.messageKey ||
      (typeof payload === 'string' ? payload : null) ||
      json.message ||
      'Request failed';
    const err = new Error(messageKey) as Error & { code?: string };
    err.code = (typeof payload === 'object' && payload?.code) || json.code;
    throw err;
  }
  return json.data as T;
}

export async function guestLogin(deviceId?: string) {
  const data = await request<{
    token: string;
    refreshToken: string;
    deviceId: string;
    user: UserProfile;
  }>('/api/v1/auth/guest', { method: 'POST', body: JSON.stringify({ deviceId }) });
  await persistAuth(data);
  return data;
}

export async function registerWithEmail(email: string, password: string, nickname?: string) {
  const data = await request<{
    token: string;
    refreshToken: string;
    user: UserProfile;
  }>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, nickname }),
  });
  await persistAuth(data);
  return data;
}

export async function loginWithEmail(email: string, password: string) {
  const data = await request<{
    token: string;
    refreshToken: string;
    user: UserProfile;
  }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await persistAuth(data);
  return data;
}

export async function oauthLogin(provider: 'APPLE' | 'GOOGLE', idToken: string, nickname?: string) {
  const data = await request<{
    token: string;
    refreshToken: string;
    user: UserProfile;
  }>('/api/v1/auth/oauth', {
    method: 'POST',
    body: JSON.stringify({ provider, idToken, nickname }),
  });
  await persistAuth(data);
  return data;
}

export async function setLeaderboardStealth(enabled: boolean) {
  return request<{ leaderboardStealth: boolean }>('/api/v1/user/leaderboard-stealth', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

export async function getProfile() {
  return request<UserProfile>('/api/v1/user/profile');
}

export interface ShopProduct {
  id: string;
  chips: number;
  priceCents: number;
  label: string;
}

export async function getShopProducts() {
  return request<{
    products: ShopProduct[];
    firstRechargeBonusEnabled: boolean;
    firstRechargeBonusPct: number;
    iapSandboxMode: boolean;
  }>('/api/v1/shop/products');
}

export async function mockRecharge(amount: number, requestId: string) {
  return request<{
    chipsBalance: number;
    amount: number;
    bonusChips: number;
    isFirstRecharge: boolean;
  }>('/api/v1/shop/mock-recharge', {
    method: 'POST',
    body: JSON.stringify({ amount, requestId }),
  });
}

export async function shopRecharge(
  channel: 'MOCK' | 'APPLE_IAP' | 'GOOGLE_PLAY',
  amount: number,
  requestId: string,
  receiptToken?: string,
  productId?: string,
) {
  return request<{
    chipsBalance: number;
    amount: number;
    bonusChips: number;
    isFirstRecharge: boolean;
  }>('/api/v1/shop/recharge', {
    method: 'POST',
    body: JSON.stringify({ channel, amount, requestId, receiptToken, productId }),
  });
}

export async function getLeaderboard() {
  return request<{
    profit: Array<{ userId: number; nickname: string; score: number }>;
    biggestPot: Array<{ userId: number; nickname: string; score: number }>;
    refreshedAt: string;
    refreshMinutes: number;
  }>('/api/v1/leaderboard');
}

export async function getCompliance() {
  return request<{
    ageVerified: boolean;
    migrationRequired: boolean;
    migrationMessage: string;
    isSelfExcluded: boolean;
    selfExcludedUntil: string | null;
  }>('/api/v1/user/compliance');
}

export async function declareAge() {
  return request<{ ok: boolean }>('/api/v1/user/age-declaration', {
    method: 'POST',
    body: JSON.stringify({ confirmed: true }),
  });
}

export async function acknowledgeMigration() {
  return request<{ ok: boolean }>('/api/v1/migration/acknowledge', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function selfExclude(days: number) {
  return request<{ selfExcludedUntil: string }>('/api/v1/user/self-exclude', {
    method: 'POST',
    body: JSON.stringify({ days }),
  });
}

export async function quickStart() {
  return request<{ roomId: string; wsUrl: string; buyInCap: number }>('/api/v1/match/quick-start', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getWeeklyTop() {
  return request<{ list: Array<{ userId: number; nickname: string; profit: number }> }>(
    '/api/v1/leaderboard/weekly-profit',
  );
}

export async function getPrivatePermission() {
  return request<{
    hasPermission: boolean;
    officialHandsPlayed: number;
    canCreateTwoPlayer: boolean;
    fee: number;
  }>('/api/v1/private/permission');
}

export async function grantPrivatePermission() {
  return request<{ privateRoomPermission: boolean }>('/api/v1/private/grant-permission', {
    method: 'POST',
    body: JSON.stringify({ agreed: true }),
  });
}

export async function createPrivateRoom(config: {
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
  buyInCap: number;
}) {
  return request<{
    roomCode: string;
    roomId: string;
    inviteText: string;
    deepLink: string;
    buyInCap: number;
    blinds: { sb: number; bb: number };
  }>('/api/v1/private/create-room', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function joinPrivateRoom(roomCode: string) {
  return request<{
    roomCode: string;
    roomId: string;
    buyInCap: number;
    blinds: { sb: number; bb: number };
  }>('/api/v1/private/join-room', {
    method: 'POST',
    body: JSON.stringify({ roomCode }),
  });
}

export async function submitReport(input: {
  reportedUserId?: number;
  roomId?: string;
  handId?: string;
  category: string;
  description?: string;
}) {
  return request<{ id: number; status: string }>('/api/v1/private/report', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
