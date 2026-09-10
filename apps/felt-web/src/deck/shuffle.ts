import type { PlayingCard } from './types';

function randomIndex(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0]! % maxExclusive;
}

/**
 * In-place Fisher–Yates shuffle. Returns the same array for chaining.
 * Uses `crypto.getRandomValues` so it is safe in the browser (no node:crypto).
 */
export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/** Fisher–Yates on a copy — original deck stays ordered. */
export function shuffleDeck(deck: readonly PlayingCard[]): PlayingCard[] {
  return shuffleInPlace([...deck]);
}
