import {
  STUD_ANTE_OPTIONS,
  STUD_PAYTABLE,
  foldStudHand,
  parseStudHand,
  raiseStudHand,
  serializeStudHand,
  startStudHand,
  toStudClientView,
} from '@texas-holdem/poker-engine';
import {
  addWeeklyProfit,
  currentStudBalance,
  findOpenStudHand,
  insertStudHand,
  settleStudHand,
  type StudHandRow,
} from '@texas-holdem/db';

export { STUD_ANTE_OPTIONS, STUD_PAYTABLE };

function rowToHand(row: StudHandRow) {
  return parseStudHand({
    playerCards: row.player_cards,
    dealerCards: row.dealer_cards,
    community: row.community,
    remaining: row.remaining,
    ante: Number(row.ante),
    raiseAmount: Number(row.raise_amount),
    phase: row.status,
    result: (row.result_json as never) ?? null,
  });
}

export function studConfig() {
  return {
    game: 'CARIBBEAN_STUD',
    title: 'Caribbean Stud',
    anteOptions: [...STUD_ANTE_OPTIONS],
    paytable: [...STUD_PAYTABLE],
    dealerQualify: 'PAIR_FOURS',
    raiseMultiple: 2,
  };
}

export function presentStud(row: StudHandRow, chipsBalance: number) {
  const view = toStudClientView(rowToHand(row));
  return {
    handId: Number(row.id),
    ...view,
    chipsBalance,
  };
}

export async function loadOpenStud(userId: number) {
  const chipsBalance = await currentStudBalance(userId);
  const row = await findOpenStudHand(userId);
  if (!row) return { hand: null, chipsBalance };
  return { hand: presentStud(row, chipsBalance), chipsBalance };
}

export async function startCaribbeanStud(userId: number, ante: number) {
  const open = await findOpenStudHand(userId);
  if (open) throw new Error('HAND_IN_PROGRESS');
  const started = startStudHand(ante);
  const packed = serializeStudHand(started);
  const { row, chipsBalance } = await insertStudHand({
    userId,
    ante,
    playerCards: packed.playerCards,
    dealerCards: packed.dealerCards,
    community: packed.community,
    remaining: packed.remaining,
  });
  return presentStud(row, chipsBalance);
}

export async function actCaribbeanStud(userId: number, action: 'fold' | 'raise') {
  const open = await findOpenStudHand(userId);
  if (!open) throw new Error('HAND_NOT_FOUND');
  if (action === 'raise') {
    const balance = await currentStudBalance(userId);
    if (balance < Number(open.ante) * 2) throw new Error('INSUFFICIENT_CHIPS');
  }
  const current = rowToHand(open);
  const next = action === 'fold' ? foldStudHand(current) : raiseStudHand(current);
  const packed = serializeStudHand(next);
  const { row, chipsBalance } = await settleStudHand({
    handId: Number(open.id),
    userId,
    raiseAmount: next.raiseAmount,
    deductRaise: action === 'raise',
    payout: next.result?.payout ?? 0,
    playerCards: packed.playerCards,
    dealerCards: packed.dealerCards,
    community: packed.community,
    remaining: packed.remaining,
    result: next.result,
  });
  if (next.result) {
    try {
      await addWeeklyProfit(userId, next.result.net);
    } catch {
      /* redis optional */
    }
  }
  return presentStud(row, chipsBalance);
}
