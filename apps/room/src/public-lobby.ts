import {
  MIN_PUBLIC_TABLES,
  isPublicTableId,
  publicTableId,
  targetPublicTableCount,
} from '@texas-holdem/shared';
import type { InteractiveTable } from './game/interactive-table.js';

export interface PublicTableSummary {
  roomId: string;
  label: string;
  seatedHumans: number;
  bots: number;
  emptySeats: number;
  maxSeats: number;
  phase: string;
  joinable: boolean;
}

export function summarizePublicTable(table: InteractiveTable, index?: number): PublicTableSummary {
  const state = table.getPublicState();
  const seatedHumans = state.seats.filter((s) => !s.isBot).length;
  const bots = state.seats.filter((s) => s.isBot).length;
  const parsed = Number(table.roomId.replace(/\D/g, ''));
  const n = index ?? (Number.isFinite(parsed) ? parsed : 0);
  return {
    roomId: table.roomId,
    label: `公共桌 ${n || table.roomId}`,
    seatedHumans,
    bots,
    emptySeats: state.emptySeats.length,
    maxSeats: state.maxSeats,
    phase: state.phase,
    joinable: state.emptySeats.length > 0,
  };
}

export function countSeatedHumans(rooms: Map<string, InteractiveTable>): number {
  let total = 0;
  for (const [roomId, table] of rooms) {
    if (!isPublicTableId(roomId)) continue;
    total += table.getSeatedCount();
  }
  return total;
}

export function listPublicTables(rooms: Map<string, InteractiveTable>): PublicTableSummary[] {
  const rows: PublicTableSummary[] = [];
  for (const [roomId, table] of rooms) {
    if (table.config.roomType === 'PRIVATE') continue;
    if (!isPublicTableId(roomId)) continue;
    const n = Number(roomId.slice('PUB-'.length));
    rows.push(summarizePublicTable(table, Number.isFinite(n) ? n : undefined));
  }
  rows.sort((a, b) => a.roomId.localeCompare(b.roomId, undefined, { numeric: true }));
  return rows;
}

export async function ensurePublicTables(
  rooms: Map<string, InteractiveTable>,
  create: (roomId: string) => Promise<InteractiveTable>,
): Promise<PublicTableSummary[]> {
  const humans = countSeatedHumans(rooms);
  const needed = targetPublicTableCount(humans);
  for (let i = 1; i <= Math.max(needed, MIN_PUBLIC_TABLES); i += 1) {
    const id = publicTableId(i);
    if (!rooms.has(id)) {
      const table = await create(id);
      table.ensureOfficialGameRunning();
    }
  }
  return listPublicTables(rooms);
}

export function pickJoinableTable(
  rooms: Map<string, InteractiveTable>,
  excludeRoomId?: string,
): InteractiveTable | null {
  const open = listPublicTables(rooms)
    .filter((row) => row.joinable && row.roomId !== excludeRoomId)
    .sort((a, b) => b.seatedHumans - a.seatedHumans || a.emptySeats - b.emptySeats);
  const best = open[0];
  return best ? rooms.get(best.roomId) ?? null : null;
}
