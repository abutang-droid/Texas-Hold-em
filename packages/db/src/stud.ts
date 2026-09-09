import { query, withTransaction } from './pool.js';
import { addChips, deductChips, findUserById } from './users.js';

export interface StudHandRow {
  id: number;
  user_id: string;
  status: 'DECISION' | 'SETTLED';
  ante: string;
  raise_amount: string;
  player_cards: string[];
  dealer_cards: string[];
  community: string[];
  remaining: string[];
  result_json: unknown;
  chips_balance: string | null;
  created_at: Date;
  settled_at: Date | null;
}

export async function findOpenStudHand(userId: number): Promise<StudHandRow | null> {
  const res = await query<StudHandRow>(
    `SELECT * FROM stud_hands WHERE user_id = $1 AND status = 'DECISION' ORDER BY id DESC LIMIT 1`,
    [userId],
  );
  return res.rows[0] ?? null;
}

export async function findStudHandById(id: number, userId: number): Promise<StudHandRow | null> {
  const res = await query<StudHandRow>(
    `SELECT * FROM stud_hands WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return res.rows[0] ?? null;
}

export async function insertStudHand(input: {
  userId: number;
  ante: number;
  playerCards: string[];
  dealerCards: string[];
  community: string[];
  remaining: string[];
}): Promise<{ row: StudHandRow; chipsBalance: number }> {
  return withTransaction(async (client) => {
    const chipsBalance = await deductChips(
      client,
      input.userId,
      input.ante,
      'BUY_IN',
      `stud-ante-${input.userId}-${Date.now()}`,
    );
    const res = await client.query<StudHandRow>(
      `INSERT INTO stud_hands (
        user_id, status, ante, raise_amount, player_cards, dealer_cards, community, remaining, chips_balance
      ) VALUES ($1, 'DECISION', $2, 0, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7)
      RETURNING *`,
      [
        input.userId,
        input.ante,
        JSON.stringify(input.playerCards),
        JSON.stringify(input.dealerCards),
        JSON.stringify(input.community),
        JSON.stringify(input.remaining),
        chipsBalance,
      ],
    );
    return { row: res.rows[0], chipsBalance };
  });
}

export async function settleStudHand(input: {
  handId: number;
  userId: number;
  raiseAmount: number;
  deductRaise: boolean;
  payout: number;
  playerCards: string[];
  dealerCards: string[];
  community: string[];
  remaining: string[];
  result: unknown;
}): Promise<{ row: StudHandRow; chipsBalance: number }> {
  return withTransaction(async (client) => {
    const locked = await client.query<StudHandRow>(
      `SELECT * FROM stud_hands WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [input.handId, input.userId],
    );
    const current = locked.rows[0];
    if (!current) throw new Error('HAND_NOT_FOUND');
    if (current.status !== 'DECISION') throw new Error('HAND_NOT_OPEN');

    let chipsBalance = Number(
      (await client.query<{ chips_balance: string }>('SELECT chips_balance FROM users WHERE id = $1', [input.userId]))
        .rows[0]?.chips_balance ?? 0,
    );
    if (input.deductRaise && input.raiseAmount > 0) {
      chipsBalance = await deductChips(
        client,
        input.userId,
        input.raiseAmount,
        'BUY_IN',
        `stud-raise-${input.handId}`,
      );
    }
    if (input.payout > 0) {
      chipsBalance = await addChips(
        client,
        input.userId,
        input.payout,
        'GAME_WIN',
        `stud-payout-${input.handId}`,
      );
    } else {
      const u = await client.query<{ chips_balance: string }>(
        'SELECT chips_balance FROM users WHERE id = $1',
        [input.userId],
      );
      chipsBalance = Number(u.rows[0]?.chips_balance ?? chipsBalance);
    }

    const res = await client.query<StudHandRow>(
      `UPDATE stud_hands SET
        status = 'SETTLED',
        raise_amount = $3,
        player_cards = $4::jsonb,
        dealer_cards = $5::jsonb,
        community = $6::jsonb,
        remaining = $7::jsonb,
        result_json = $8::jsonb,
        chips_balance = $9,
        settled_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
      [
        input.handId,
        input.userId,
        input.raiseAmount,
        JSON.stringify(input.playerCards),
        JSON.stringify(input.dealerCards),
        JSON.stringify(input.community),
        JSON.stringify(input.remaining),
        JSON.stringify(input.result),
        chipsBalance,
      ],
    );
    return { row: res.rows[0], chipsBalance };
  });
}

export async function currentStudBalance(userId: number): Promise<number> {
  const user = await findUserById(userId);
  return Number(user?.chips_balance ?? 0);
}
