/** Shared 6-max felt coordinates (percent). Dealer sits at 12 o'clock. */
export const SEAT_LAYOUT: Array<{ top: number; left: number }> = [
  { top: 78, left: 50 },
  { top: 66, left: 84 },
  { top: 38, left: 87 },
  { top: 22, left: 70 },
  { top: 22, left: 30 },
  { top: 66, left: 16 },
];

export const DEALER_LAYOUT = { top: 5.5, left: 50 };

export const POT_LAYOUT = { top: 46, left: 50 };

export const BOARD_SLOT_LAYOUT: Array<{ top: number; left: number }> = [
  { top: 38, left: 31 },
  { top: 38, left: 40.5 },
  { top: 38, left: 50 },
  { top: 38, left: 59.5 },
  { top: 38, left: 69 },
];

export function dealSeatOrder(buttonSeat: number, inHandSeats: number[]): number[] {
  const order: number[] = [];
  for (let step = 1; step <= SEAT_LAYOUT.length; step += 1) {
    const seat = (buttonSeat + step) % SEAT_LAYOUT.length;
    if (inHandSeats.includes(seat)) order.push(seat);
  }
  return order;
}
