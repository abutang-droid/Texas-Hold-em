export interface RakeInput {
  totalPot: number;
  reachedFlop: boolean;
  rakeRate: number;
}

export interface RakeResult {
  rakeAmount: number;
  distributablePot: number;
}

/** No Flop, No Drop — rake only after flop */
export function calculateRake({ totalPot, reachedFlop, rakeRate }: RakeInput): RakeResult {
  if (!reachedFlop || totalPot <= 0) {
    return { rakeAmount: 0, distributablePot: totalPot };
  }
  const rakeAmount = Math.floor(totalPot * rakeRate);
  return {
    rakeAmount,
    distributablePot: totalPot - rakeAmount,
  };
}

export const OFFICIAL_RAKE_RATE = 0.05;
export const PRIVATE_RAKE_RATE = 0.03;
