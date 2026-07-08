export interface PotSlice {
  amount: number;
  eligibleSeatIndices: number[];
}

export interface PlayerBetState {
  seatIndex: number;
  totalBet: number;
  isFolded: boolean;
  isAllIn: boolean;
}

/**
 * Build main pot and side pots from player bet totals.
 * Players who folded are excluded from eligibility but their bets stay in pots.
 */
export function calculateSidePots(players: PlayerBetState[]): PotSlice[] {
  const active = players.filter((p) => p.totalBet > 0);
  if (active.length === 0) return [];

  const uniqueLevels = [...new Set(active.map((p) => p.totalBet))].sort((a, b) => a - b);
  const pots: PotSlice[] = [];
  let prev = 0;

  for (const level of uniqueLevels) {
    const layer = level - prev;
    if (layer <= 0) continue;

    const contributors = active.filter((p) => p.totalBet >= level);
    const amount = layer * contributors.length;
    const eligibleSeatIndices = contributors
      .filter((p) => !p.isFolded)
      .map((p) => p.seatIndex);

    if (amount > 0 && eligibleSeatIndices.length > 0) {
      pots.push({ amount, eligibleSeatIndices });
    }
    prev = level;
  }

  return pots;
}

export function totalPotAmount(pots: PotSlice[]): number {
  return pots.reduce((sum, p) => sum + p.amount, 0);
}
