import {
  OFFICIAL_BIG_BLIND,
  OFFICIAL_MAX_BUY_IN,
  OFFICIAL_SMALL_BLIND,
} from '@texas-holdem/shared';

export interface PublicTableRow {
  roomId: string;
  label: string;
  seatedHumans: number;
  bots: number;
  emptySeats: number;
  maxSeats: number;
  phase: string;
  joinable: boolean;
}

export interface MatchAssignment {
  roomId: string;
  wsUrl: string;
  buyInCap: number;
  blinds: { sb: number; bb: number };
}

function roomBase(): string {
  return (process.env.ROOM_SERVER_URL ?? 'http://localhost:3001').replace(/\/$/, '');
}

async function roomRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${roomBase()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.includes('NO_OPEN_TABLE') ? 'NO_OPEN_TABLE' : 'ROOM_UNAVAILABLE');
  }
  return (await res.json()) as T;
}

export async function listRoomPublicTables(): Promise<PublicTableRow[]> {
  const data = await roomRequest<{ tables: PublicTableRow[] }>('/public-tables');
  return data.tables ?? [];
}

export async function assignPublicTable(excludeRoomId?: string): Promise<MatchAssignment> {
  const data = await roomRequest<{
    roomId: string;
    buyInCap: number;
    blinds: { sb: number; bb: number };
  }>('/public-tables/assign', {
    method: 'POST',
    body: JSON.stringify({ excludeRoomId }),
  });
  return {
    roomId: data.roomId,
    wsUrl: roomBase(),
    buyInCap: data.buyInCap ?? OFFICIAL_MAX_BUY_IN,
    blinds: data.blinds ?? { sb: OFFICIAL_SMALL_BLIND, bb: OFFICIAL_BIG_BLIND },
  };
}
