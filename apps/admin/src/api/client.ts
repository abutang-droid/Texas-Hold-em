const STORAGE_KEY = 'th_admin_key';

export function getAdminKey(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setAdminKey(key: string): void {
  sessionStorage.setItem(STORAGE_KEY, key);
}

export function clearAdminKey(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const key = getAdminKey();
  if (!key) throw new Error('Not authenticated');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    ...(options.headers as Record<string, string>),
  };
  const res = await fetch(path, { ...options, headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.messageKey ?? json.message ?? 'Request failed');
  return json.data as T;
}

export interface AdminUser {
  id: number;
  nickname: string;
  chipsBalance: number;
  level: number;
  totalExp: number;
  status: string;
  preferredLocale: string;
}

export interface AdminHand {
  handId: string;
  roomId: string;
  roomType: string;
  potSize: number;
  rakeAmount: number;
  boardCards: string | null;
  winners: unknown;
  actions: unknown;
  playerSnapshot: unknown;
  createdAt: string;
}

export interface SystemConfig {
  privateRoomEnabled: boolean;
  privateRoomGlobalPause: boolean;
}

export interface ReportTicket {
  id: number;
  reporterUserId: number;
  reportedUserId: number | null;
  roomId: string | null;
  handId: string | null;
  category: string;
  description: string | null;
  status: string;
  createdAt: string;
}

export interface EconomyStats {
  totalUsers: number;
  totalChipsInCirculation: number;
  totalRakeCollected: number;
  handsPlayed: number;
  privateRoomsActive: number;
}

export const adminApi = {
  searchUsers: (q: string) => request<{ list: AdminUser[] }>(`/api/v1/admin/users?q=${encodeURIComponent(q)}`),
  banUser: (id: number, status: 'BANNED' | 'FROZEN' | 'ACTIVE') =>
    request<AdminUser>(`/api/v1/admin/users/${id}/ban`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  adjustChips: (id: number, amount: number, reason: string) =>
    request<{ chipsBalance: number }>(`/api/v1/admin/users/${id}/adjust-chips`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    }),
  listHands: (roomId?: string) =>
    request<{ list: AdminHand[] }>(
      `/api/v1/admin/hands${roomId ? `?roomId=${encodeURIComponent(roomId)}` : ''}`,
    ),
  getHand: (handId: string) => request<AdminHand>(`/api/v1/admin/hands/${handId}`),
  getConfig: () => request<SystemConfig>('/api/v1/admin/config'),
  updateConfig: (config: Partial<SystemConfig>) =>
    request<SystemConfig>('/api/v1/admin/config', {
      method: 'POST',
      body: JSON.stringify(config),
    }),
  listReports: () => request<{ list: ReportTicket[] }>('/api/v1/admin/reports'),
  updateReport: (id: number, status: string) =>
    request<ReportTicket>(`/api/v1/admin/reports/${id}`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  getEconomy: () => request<EconomyStats>('/api/v1/admin/economy'),
};
