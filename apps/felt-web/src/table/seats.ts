export const MAX_SEATS = 6;

export interface SeatPlayer {
  id: string;
  name: string;
  stack: number;
  initials: string;
}

export const DEMO_PLAYERS: SeatPlayer[] = [
  { id: 'hero', name: '你', stack: 200, initials: 'YOU' },
  { id: 's1', name: '林晚', stack: 185, initials: 'LW' },
  { id: 's2', name: '阿凯', stack: 240, initials: 'AK' },
  { id: 's3', name: 'Nora', stack: 160, initials: 'N' },
  { id: 's4', name: '老周', stack: 310, initials: 'Z' },
  { id: 's5', name: 'Mika', stack: 95, initials: 'M' },
];

/** CSS placement on the oval felt. Seat 0 is the hero (bottom center). */
export const SEAT_CLASS: string[] = [
  'bottom-[4%] left-1/2 -translate-x-1/2',
  'bottom-[20%] left-[5%] sm:left-[8%]',
  'top-[14%] left-[8%] sm:left-[12%]',
  'top-[3%] left-1/2 -translate-x-1/2',
  'top-[14%] right-[8%] sm:right-[12%]',
  'bottom-[20%] right-[5%] sm:right-[8%]',
];
