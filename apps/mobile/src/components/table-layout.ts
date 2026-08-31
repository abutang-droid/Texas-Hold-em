/** Shared 6-max felt coordinates (percent). Dealer sits at 12 o'clock. */

const CX = 50;
const CY = 52;
const RX = 38;
const RY = 33;

/** 0° = 12 o'clock (dealer), clockwise. */
function ellipseSeat(degFromDealer: number): { top: number; left: number } {
  const rad = (degFromDealer * Math.PI) / 180;
  return {
    top: Math.round((CY - RY * Math.cos(rad)) * 10) / 10,
    left: Math.round((CX + RX * Math.sin(rad)) * 10) / 10,
  };
}

/**
 * Six seats on one ellipse, mirrored across the dealer axis.
 * Pairs are ±30°, ±90°, ±150° so the 12 o'clock gap is the dealer.
 * Clockwise from bottom-left: 0 → 1 → 2 → 3 → 4 → 5.
 *
 *        荷官
 *   2         3
 * 1             4
 *   0         5
 */
const SEAT_DEGREES = [210, 270, 330, 30, 90, 150] as const;

export const SEAT_LAYOUT: Array<{ top: number; left: number }> = SEAT_DEGREES.map(ellipseSeat);

export const DEALER_LAYOUT = { top: 4.5, left: 50 };

export const POT_LAYOUT = { top: 48, left: 50 };

export const BOARD_SLOT_LAYOUT: Array<{ top: number; left: number }> = [
  { top: 40, left: 31 },
  { top: 40, left: 40.5 },
  { top: 40, left: 50 },
  { top: 40, left: 59.5 },
  { top: 40, left: 69 },
];

export function dealSeatOrder(buttonSeat: number, inHandSeats: number[]): number[] {
  const order: number[] = [];
  for (let step = 1; step <= SEAT_LAYOUT.length; step += 1) {
    const seat = (buttonSeat + step) % SEAT_LAYOUT.length;
    if (inHandSeats.includes(seat)) order.push(seat);
  }
  return order;
}
