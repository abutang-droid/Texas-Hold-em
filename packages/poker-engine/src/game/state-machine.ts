import { createMachine, assign } from 'xstate';
import type { GamePhase } from './settlement.js';

export interface PhaseContext {
  phase: GamePhase;
  reachedFlop: boolean;
}

export const phaseMachine = createMachine({
  id: 'handPhase',
  initial: 'PRE_FLOP',
  types: {} as {
    context: PhaseContext;
    events: { type: 'ROUND_COMPLETE' } | { type: 'FOLD_WIN' };
  },
  context: {
    phase: 'PRE_FLOP',
    reachedFlop: false,
  },
  states: {
    PRE_FLOP: {
      on: {
        ROUND_COMPLETE: { target: 'FLOP', actions: assign({ phase: 'FLOP', reachedFlop: true }) },
        FOLD_WIN: { target: 'END_HAND', actions: assign({ phase: 'END_HAND' }) },
      },
    },
    FLOP: {
      on: {
        ROUND_COMPLETE: { target: 'TURN', actions: assign({ phase: 'TURN' }) },
        FOLD_WIN: { target: 'END_HAND', actions: assign({ phase: 'END_HAND' }) },
      },
    },
    TURN: {
      on: {
        ROUND_COMPLETE: { target: 'RIVER', actions: assign({ phase: 'RIVER' }) },
        FOLD_WIN: { target: 'END_HAND', actions: assign({ phase: 'END_HAND' }) },
      },
    },
    RIVER: {
      on: {
        ROUND_COMPLETE: { target: 'SHOWDOWN', actions: assign({ phase: 'SHOWDOWN' }) },
        FOLD_WIN: { target: 'END_HAND', actions: assign({ phase: 'END_HAND' }) },
      },
    },
    SHOWDOWN: {
      on: {
        ROUND_COMPLETE: { target: 'END_HAND', actions: assign({ phase: 'END_HAND' }) },
      },
    },
    END_HAND: { type: 'final' },
  },
});

export function getNextPhase(current: GamePhase): GamePhase | null {
  const order: GamePhase[] = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN', 'END_HAND'];
  const idx = order.indexOf(current);
  if (idx < 0 || idx >= order.length - 1) return null;
  return order[idx + 1];
}
