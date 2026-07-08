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

export function setToken(t: string) {
  token = t;
}

export function getToken() {
  return token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.messageKey ?? json.message ?? 'Request failed');
  return json.data as T;
}

export async function guestLogin(deviceId?: string) {
  const data = await request<{ token: string; deviceId: string; user: UserProfile }>(
    '/api/v1/auth/guest',
    { method: 'POST', body: JSON.stringify({ deviceId }) },
  );
  setToken(data.token);
  return data;
}

export async function getProfile() {
  return request<UserProfile>('/api/v1/user/profile');
}

export async function mockRecharge(amount: number, requestId: string) {
  return request<{ chipsBalance: number }>('/api/v1/shop/mock-recharge', {
    method: 'POST',
    body: JSON.stringify({ amount, requestId }),
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
