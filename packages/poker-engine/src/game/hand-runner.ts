import type { Card } from '../cards/card.js';
import { createDeck, dealCards, shuffleDeck } from '../cards/deck.js';
import { evaluateBestHand } from '../eval/hand-evaluator.js';
import { decideBotAction } from '../bot/rule-bot.js';
import {
  applyAction,
  countActivePlayers,
  getValidActions,
  isBettingRoundComplete,
  nextActiveSeat,
} from './actions.js';
import { calculateSidePots } from '../pot/side-pot.js';
import { calculateRake } from '../pot/rake.js';
import type { PlayerState, SettlementResult, TableConfig } from './settlement.js';
import { distributePotToWinners } from './settlement.js';

export type HandPhase = 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN' | 'END_HAND';

export interface HandLogEntry {
  type: string;
  seatIndex?: number;
  action?: string;
  amount?: number;
  cards?: string;
  message?: string;
}

export interface HandResult {
  handId: string;
  phase: HandPhase;
  communityCards: Card[];
  players: PlayerState[];
  settlement: SettlementResult | null;
  log: HandLogEntry[];
  reachedFlop: boolean;
}

function seatOrderFromButton(buttonSeat: number, seats: number[]): number[] {
  const sorted = [...seats].sort((a, b) => a - b);
  const start = sorted.findIndex((s) => s === buttonSeat);
  const order: number[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    order.push(sorted[(start + i) % sorted.length]);
  }
  return order;
}

export class HandRunner {
  private deck: Card[] = [];
  private communityCards: Card[] = [];
  private players: PlayerState[] = [];
  private buttonSeat = 0;
  private currentSeat = 0;
  private currentBet = 0;
  private minRaise = 0;
  private phase: HandPhase = 'PRE_FLOP';
  private reachedFlop = false;
  private log: HandLogEntry[] = [];
  private readonly config: TableConfig;

  constructor(config: Partial<TableConfig> = {}) {
    this.config = {
      maxSeats: 9,
      smallBlind: 1,
      bigBlind: 2,
      rakeRate: 0.05,
      roomType: 'OFFICIAL',
      ...config,
    };
  }

  initPlayers(
    specs: Array<{ seatIndex: number; userId: string; nickname: string; chips: number; isBot?: boolean }>,
  ): void {
    this.players = specs.map((s) => ({
      seatIndex: s.seatIndex,
      userId: s.userId,
      nickname: s.nickname,
      chips: s.chips,
      betThisRound: 0,
      totalBetInHand: 0,
      status: 'ACTIVE' as const,
      holeCards: [],
      isBot: s.isBot ?? false,
    }));
    this.buttonSeat = specs[0]?.seatIndex ?? 0;
  }

  startHand(handId: string): void {
    this.log = [{ type: 'HAND_START', message: handId }];
    this.deck = shuffleDeck(createDeck());
    this.communityCards = [];
    this.reachedFlop = false;
    this.phase = 'PRE_FLOP';
    this.currentBet = 0;

    for (const p of this.players) {
      p.betThisRound = 0;
      p.totalBetInHand = 0;
      p.status = p.chips > 0 ? 'ACTIVE' : 'SIT_OUT';
      p.holeCards = [];
    }

    const active = this.players.filter((p) => p.status === 'ACTIVE');
    for (const p of active) {
      const { dealt, remaining } = dealCards(this.deck, 2);
      p.holeCards = dealt;
      this.deck = remaining;
    }

    this.postBlinds(active);
  }

  private postBlinds(active: PlayerState[]): void {
    const seats = active.map((p) => p.seatIndex).sort((a, b) => a - b);
    const btnIdx = seats.indexOf(this.buttonSeat);
    const sbSeat = seats[(btnIdx + 1) % seats.length];
    const bbSeat = seats[(btnIdx + 2) % seats.length];

    this.postBlind(sbSeat, this.config.smallBlind);
    this.postBlind(bbSeat, this.config.bigBlind);
    this.currentBet = this.config.bigBlind;
    this.minRaise = this.config.bigBlind;
    this.currentSeat = nextActiveSeat(this.players, bbSeat) ?? bbSeat;
  }

  private postBlind(seatIndex: number, amount: number): void {
    const p = this.players.find((pl) => pl.seatIndex === seatIndex);
    if (!p) return;
    const pay = Math.min(amount, p.chips);
    p.chips -= pay;
    p.betThisRound += pay;
    p.totalBetInHand += pay;
    if (p.chips === 0) p.status = 'ALL_IN';
    this.log.push({ type: 'BLIND', seatIndex, amount: pay });
  }

  private resetBetsForNewRound(): void {
    for (const p of this.players) {
      p.betThisRound = 0;
    }
    this.currentBet = 0;
    this.minRaise = this.config.bigBlind;
  }

  private dealCommunity(count: number): void {
    const { dealt, remaining } = dealCards(this.deck, count);
    this.communityCards.push(...dealt);
    this.deck = remaining;
    if (this.communityCards.length >= 3) this.reachedFlop = true;
    this.log.push({
      type: 'COMMUNITY',
      cards: dealt.map((c) => `${c.rank}${c.suit}`).join(' '),
    });
  }

  private getPotSize(): number {
    return this.players.reduce((s, p) => s + p.totalBetInHand, 0);
  }

  act(seatIndex: number, action: Parameters<typeof applyAction>[0]['action'], amount?: number): void {
    const player = this.players.find((p) => p.seatIndex === seatIndex);
    if (!player || player.status !== 'ACTIVE') {
      throw new Error(`Seat ${seatIndex} cannot act`);
    }
    const result = applyAction({
      player,
      action,
      amount,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
    });
    const idx = this.players.findIndex((p) => p.seatIndex === seatIndex);
    this.players[idx] = result.player;
    if (result.raiseSize > 0) {
      this.minRaise = Math.max(this.minRaise, result.raiseSize);
    }
    this.currentBet = result.newCurrentBet;
    this.log.push({ type: 'ACTION', seatIndex, action, amount });
  }

  stepBotIfNeeded(): void {
    const player = this.players.find((p) => p.seatIndex === this.currentSeat);
    if (!player || !player.isBot || player.status !== 'ACTIVE') return;

    const valid = getValidActions({
      players: this.players,
      currentSeat: this.currentSeat,
      bigBlind: this.config.bigBlind,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
    });
    const toCall = this.currentBet - player.betThisRound;
    const decision = decideBotAction({
      holeCards: player.holeCards,
      communityCards: this.communityCards,
      potSize: this.getPotSize(),
      toCall,
      stack: player.chips,
      bigBlind: this.config.bigBlind,
      seatIndex: player.seatIndex,
      buttonSeat: this.buttonSeat,
      valid,
    });
    this.act(player.seatIndex, decision.action, decision.amount);
  }

  private advancePhase(): void {
    if (this.phase === 'PRE_FLOP') {
      this.dealCommunity(3);
      this.phase = 'FLOP';
    } else if (this.phase === 'FLOP') {
      this.dealCommunity(1);
      this.phase = 'TURN';
    } else if (this.phase === 'TURN') {
      this.dealCommunity(1);
      this.phase = 'RIVER';
    } else if (this.phase === 'RIVER') {
      this.phase = 'SHOWDOWN';
    }
  }

  runToCompletion(handId: string, maxSteps = 800): HandResult {
    this.startHand(handId);
    let steps = 0;

    while (steps < maxSteps) {
      steps += 1;

      if (countActivePlayers(this.players) <= 1) {
        return this.finishHand(handId);
      }

      if (isBettingRoundComplete(this.players, this.currentBet)) {
        if (this.phase === 'RIVER') {
          this.phase = 'SHOWDOWN';
          return this.finishHand(handId);
        }
        this.advancePhase();
        this.resetBetsForNewRound();
        this.currentSeat = nextActiveSeat(this.players, this.buttonSeat) ?? this.buttonSeat;
        continue;
      }

      this.stepBotIfNeeded();
      const player = this.players.find((p) => p.seatIndex === this.currentSeat);
      if (player?.isBot) {
        const next = nextActiveSeat(this.players, this.currentSeat);
        if (next !== null) this.currentSeat = next;
        continue;
      }

      const valid = getValidActions({
        players: this.players,
        currentSeat: this.currentSeat,
        bigBlind: this.config.bigBlind,
        currentBet: this.currentBet,
        minRaise: this.minRaise,
      });
      if (valid.actions.includes('check')) {
        this.act(this.currentSeat, 'check');
      } else if (valid.actions.includes('call')) {
        this.act(this.currentSeat, 'call');
      } else if (valid.actions.includes('fold')) {
        this.act(this.currentSeat, 'fold');
      }

      const next = nextActiveSeat(this.players, this.currentSeat);
      if (next !== null) this.currentSeat = next;
    }

    return this.finishHand(handId);
  }

  private finishHand(handId: string): HandResult {
    const active = this.players.filter((p) => p.status !== 'FOLDED' && p.status !== 'SIT_OUT');
    let settlement: SettlementResult | null = null;

    if (active.length === 1) {
      const winner = active[0];
      const totalPot = this.getPotSize();
      const { rakeAmount, distributablePot } = calculateRake({
        totalPot,
        reachedFlop: this.reachedFlop,
        rakeRate: this.config.rakeRate,
      });
      winner.chips += distributablePot;
      settlement = {
        winners: [{
          seatIndex: winner.seatIndex,
          winAmount: distributablePot,
          hand: evaluateBestHand([...winner.holeCards, ...this.communityCards]),
        }],
        potBreakdown: [{
          potIndex: 0,
          amount: totalPot,
          rake: rakeAmount,
          winners: [{ seatIndex: winner.seatIndex, amount: distributablePot }],
        }],
        totalRake: rakeAmount,
      };
    } else if (active.length > 1) {
      const pots = calculateSidePots(
        this.players.map((p) => ({
          seatIndex: p.seatIndex,
          totalBet: p.totalBetInHand,
          isFolded: p.status === 'FOLDED',
          isAllIn: p.status === 'ALL_IN',
        })),
      );
      const seatOrder = seatOrderFromButton(
        this.buttonSeat,
        active.map((p) => p.seatIndex),
      );
      settlement = distributePotToWinners(
        pots,
        this.players,
        this.communityCards,
        evaluateBestHand,
        this.reachedFlop,
        this.config.rakeRate,
        seatOrder,
      );
      for (const w of settlement.winners) {
        const p = this.players.find((pl) => pl.seatIndex === w.seatIndex);
        if (p) p.chips += w.winAmount;
      }
    }

    this.log.push({ type: 'HAND_END', message: `rake=${settlement?.totalRake ?? 0}` });

    return {
      handId,
      phase: 'END_HAND',
      communityCards: [...this.communityCards],
      players: this.players.map((p) => ({ ...p, holeCards: [...p.holeCards] })),
      settlement,
      log: this.log,
      reachedFlop: this.reachedFlop,
    };
  }
}
