import type { PotSlice } from './side-pot.js';

export interface SettlementRefund {
  seatIndex: number;
  amount: number;
}

export interface SettlementPotWinner {
  seatIndex: number;
  amount: number;
}

export interface SettlementPotLine {
  kind: 'main' | 'side';
  sideIndex?: number;
  amount: number;
  winners: SettlementPotWinner[];
}

export interface SettlementView {
  refunds: SettlementRefund[];
  pots: SettlementPotLine[];
}

export function uncalledExcess(
  playerBets: Array<{ seatIndex: number; totalBet: number }>,
): SettlementRefund | null {
  const withBet = playerBets.filter((p) => p.totalBet > 0);
  if (withBet.length < 2) return null;
  const ranked = [...withBet].sort((a, b) => b.totalBet - a.totalBet);
  const excess = ranked[0].totalBet - ranked[1].totalBet;
  if (excess <= 0) return null;
  return { seatIndex: ranked[0].seatIndex, amount: excess };
}

export function buildUncontestedSettlementView(opts: {
  winnerSeat: number;
  distributablePot: number;
  playerBets: Array<{ seatIndex: number; totalBet: number }>;
}): SettlementView {
  const refund = uncalledExcess(opts.playerBets);
  const winnerRefund = refund && refund.seatIndex === opts.winnerSeat ? refund : null;
  const potWon = Math.max(0, opts.distributablePot - (winnerRefund?.amount ?? 0));
  const pots: SettlementPotLine[] =
    potWon > 0
      ? [{ kind: 'main', amount: potWon, winners: [{ seatIndex: opts.winnerSeat, amount: potWon }] }]
      : [];
  return {
    refunds: winnerRefund ? [winnerRefund] : [],
    pots,
  };
}

export function buildContestedSettlementView(opts: {
  pots: PotSlice[];
  breakdown: Array<{
    potIndex: number;
    amount: number;
    winners: SettlementPotWinner[];
  }>;
  playerBets: Array<{ seatIndex: number; totalBet: number }>;
}): SettlementView {
  const refund = uncalledExcess(opts.playerBets);
  const refundPotIndex =
    refund == null
      ? -1
      : opts.pots.findIndex(
          (p) =>
            p.eligibleSeatIndices.length === 1 &&
            p.eligibleSeatIndices[0] === refund.seatIndex &&
            p.amount === refund.amount,
        );

  const pots: SettlementPotLine[] = [];
  let sideIndex = 0;
  opts.breakdown.forEach((line) => {
    if (line.potIndex === refundPotIndex) return;
    const kind: 'main' | 'side' = pots.length === 0 ? 'main' : 'side';
    if (kind === 'side') sideIndex += 1;
    pots.push({
      kind,
      sideIndex: kind === 'side' ? sideIndex : undefined,
      amount: line.amount,
      winners: line.winners,
    });
  });

  return {
    refunds: refund && refundPotIndex >= 0 ? [refund] : [],
    pots,
  };
}

export function settlementPauseMs(view: SettlementView): number {
  const steps = view.refunds.length + Math.max(1, view.pots.length);
  return Math.min(10_000, 3200 + steps * 1600);
}
