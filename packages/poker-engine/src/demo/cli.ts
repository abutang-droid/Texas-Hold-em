#!/usr/bin/env tsx
/**
 * Phase 1 CLI demo — simulates a 9-max official table hand with rule-based bots.
 */
import { HandRunner } from '../game/hand-runner.js';
import { cardsToString } from '../eval/hand-evaluator.js';

const runner = new HandRunner({
  maxSeats: 9,
  smallBlind: 1,
  bigBlind: 2,
  rakeRate: 0.05,
  roomType: 'OFFICIAL',
});

const players = Array.from({ length: 9 }, (_, i) => ({
  seatIndex: i,
  userId: `user_${i + 1}`,
  nickname: i === 0 ? 'You' : `Bot_${i}`,
  chips: 100,
  isBot: i !== 0,
}));

runner.initPlayers(players);
const result = runner.runToCompletion(`H${Date.now()}`);

console.log('\n=== Texas Hold\'em Phase 1 Demo (9-max) ===\n');
console.log(`Hand: ${result.handId}`);
console.log(`Reached flop: ${result.reachedFlop}`);
console.log(`Community: ${result.communityCards.map((c) => c.rank + c.suit).join(' ') || '(none)'}`);
console.log(`Total rake: ${result.settlement?.totalRake ?? 0}\n`);

console.log('--- Players ---');
for (const p of result.players) {
  const won = result.settlement?.winners.find((w) => w.seatIndex === p.seatIndex);
  console.log(
    `Seat ${p.seatIndex} ${p.nickname.padEnd(8)} | chips: ${String(p.chips).padStart(4)}` +
    ` | ${cardsToString(p.holeCards)}` +
    (won ? ` | WON ${won.winAmount} (${won.hand.categoryName})` : ''),
  );
}

console.log('\n--- Action log (last 15) ---');
for (const entry of result.log.slice(-15)) {
  if (entry.type === 'ACTION') {
    console.log(`  [${entry.type}] seat ${entry.seatIndex}: ${entry.action}${entry.amount ? ` ${entry.amount}` : ''}`);
  } else {
    console.log(`  [${entry.type}] ${entry.cards ?? entry.message ?? ''}`);
  }
}

console.log('\nDemo complete.\n');
