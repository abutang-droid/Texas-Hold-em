import { query } from './pool.js';

export interface HandActionRecord {
  seatIndex: number;
  userId: string;
  actionType: string;
  amount?: number;
  phase: string;
  ts: number;
}

export interface HandHistoryInput {
  handId: string;
  roomId: string;
  roomType: 'OFFICIAL' | 'PRIVATE';
  potSize: number;
  rakeAmount: number;
  boardCards: string;
  winners: unknown;
  actions: HandActionRecord[];
  playerSnapshot: Record<string, unknown>;
}

export interface HandHistoryRow {
  hand_id: string;
  room_id: string;
  room_type: string;
  pot_size: string;
  rake_amount: string;
  board_cards: string | null;
  winners_json: unknown;
  actions_json: unknown;
  player_snapshot: unknown;
  created_at: Date;
}

export async function saveHandHistory(input: HandHistoryInput): Promise<void> {
  await query(
    `INSERT INTO hand_histories (
      hand_id, room_id, room_type, pot_size, rake_amount,
      board_cards, winners_json, actions_json, player_snapshot
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (hand_id) DO NOTHING`,
    [
      input.handId,
      input.roomId,
      input.roomType,
      input.potSize,
      input.rakeAmount,
      input.boardCards || null,
      JSON.stringify(input.winners),
      JSON.stringify(input.actions),
      JSON.stringify(input.playerSnapshot),
    ],
  );
}

export async function getHandById(handId: string): Promise<HandHistoryRow | null> {
  const res = await query<HandHistoryRow>('SELECT * FROM hand_histories WHERE hand_id = $1', [handId]);
  return res.rows[0] ?? null;
}

export async function listHandHistories(opts: {
  roomId?: string;
  limit?: number;
  offset?: number;
}): Promise<HandHistoryRow[]> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;
  if (opts.roomId) {
    const res = await query<HandHistoryRow>(
      `SELECT * FROM hand_histories WHERE room_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [opts.roomId, limit, offset],
    );
    return res.rows;
  }
  const res = await query<HandHistoryRow>(
    `SELECT * FROM hand_histories ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return res.rows;
}
