import type { Card } from '@texas-holdem/poker-engine';
import {
  applyAction,
  countActivePlayers,
  decideBotAction,
  evaluateBestHand,
  getValidActions,
  isBettingRoundComplete,
  nextActiveSeat,
  createDeck,
  dealCards,
  shuffleDeck,
  calculateSidePots,
  calculateRake,
  distributePotToWinners,
  type PlayerState,
  type ActionType,
} from '@texas-holdem/poker-engine';

export type HandPhase = 'WAITING' | 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN' | 'END_HAND';

export interface SeatInfo {
  seatIndex: number;
  userId: string;
  nickname: string;
  isBot: boolean;
  chips: number;
  status: string;
  betThisRound: number;
}

export interface PublicTableState {
  roomId: string;
  roomType: 'OFFICIAL' | 'PRIVATE';
  phase: HandPhase;
  handId: string | null;
  maxSeats: number;
  blinds: { sb: number; bb: number };
  buyInCap: number;
  buttonSeat: number;
  communityCards: string[];
  potTotal: number;
  pots: Array<{ amount: number; eligibleSeats: number[] }>;
  currentTurnSeat: number | null;
  actionDeadline: number | null;
  mySeatIndex: number | null;
  seats: Array<{
    seatIndex: number;
    userId: string;
    nickname: string;
    chips: number;
    betThisRound: number;
    status: string;
    isBot: boolean;
    holeCards: string[] | ['**', '**'];
  }>;
}

export interface HandActionRecord {
  seatIndex: number;
  userId: string;
  actionType: string;
  amount?: number;
  phase: string;
  ts: number;
}

export interface HandEndSummary {
  handId: string;
  roomId: string;
  roomType: 'OFFICIAL' | 'PRIVATE';
  boardCards: string;
  potSize: number;
  buyInCap: number;
  rakeAmount: number;
  winners: Array<{ seatIndex: number; userId: string; winAmount: number }>;
  actions: HandActionRecord[];
  playerSnapshot: Record<string, { nickname: string; chips: number; isBot: boolean }>;
  results: Array<{ userId: string; profit: number; isBot: boolean }>;
}

const BOT_NAMES = ['Mike_D', 'PokerKing88', 'LuckyAce', 'RiverRat', 'ChipStack', 'BluffMaster'];

export interface TableConfig {
  roomType: 'OFFICIAL' | 'PRIVATE';
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
  buyInCap: number;
  rakeRate: number;
  hostUserId?: string;
}

const OFFICIAL_DEFAULT: TableConfig = {
  roomType: 'OFFICIAL',
  maxSeats: 9,
  smallBlind: 1,
  bigBlind: 2,
  buyInCap: 100,
  rakeRate: 0.05,
};

export class InteractiveTable {
  readonly roomId: string;
  readonly config: TableConfig;
  private players: PlayerState[] = [];
  private deck: Card[] = [];
  private communityCards: Card[] = [];
  private phase: HandPhase = 'WAITING';
  private handId: string | null = null;
  private buttonSeat = 0;
  private currentSeat = 0;
  private currentBet = 0;
  private minRaise = 2;
  private reachedFlop = false;
  private actionDeadline: number | null = null;
  private botFillTimer: ReturnType<typeof setTimeout> | null = null;
  private realPlayerCount = 0;
  private paused = false;
  private pendingKick = new Set<string>();

  constructor(roomId: string, config?: Partial<TableConfig>) {
    this.roomId = roomId;
    this.config = { ...OFFICIAL_DEFAULT, ...config };
    this.minRaise = this.config.bigBlind;
  }

  getHostUserId(): string | undefined {
    return this.config.hostUserId;
  }

  isPrivate(): boolean {
    return this.config.roomType === 'PRIVATE';
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  markKickAfterHand(userId: string): void {
    this.pendingKick.add(userId);
  }

  addChipsToPlayer(userId: string, amount: number): void {
    const p = this.players.find((pl) => pl.userId === userId);
    if (!p) throw new Error('NOT_SEATED');
    const cap = this.config.buyInCap;
    const room = p.chips + amount;
    p.chips = Math.min(cap, room);
  }

  getSeatedHumanUserIds(): string[] {
    return this.players.filter((p) => !p.isBot).map((p) => p.userId);
  }

  getSeatedCount(): number {
    return this.players.filter((p) => !p.isBot).length;
  }

  hasPlayer(userId: string): boolean {
    return this.players.some((p) => p.userId === userId);
  }

  getPlayerChips(userId: string): number {
    return this.players.find((p) => p.userId === userId)?.chips ?? 0;
  }

  removePlayer(userId: string): number {
    const idx = this.players.findIndex((p) => p.userId === userId);
    if (idx < 0) throw new Error('NOT_SEATED');
    const p = this.players[idx];
    const chips = p.chips;
    if (!p.isBot) this.realPlayerCount = Math.max(0, this.realPlayerCount - 1);
    this.players.splice(idx, 1);
    return chips;
  }

  resumePlayer(userId: string): void {
    const p = this.players.find((pl) => pl.userId === userId);
    if (p && p.status === 'SIT_OUT') p.status = 'ACTIVE';
  }

  sitOutPlayer(userId: string): void {
    const p = this.players.find((pl) => pl.userId === userId);
    if (p && p.status === 'ACTIVE') p.status = 'SIT_OUT';
  }

  setHandEndHandler(handler: (summary: HandEndSummary) => void): void {
    this.onHandEnd = handler;
  }

  setGameStartedHandler(handler: (info: {
    handId: string;
    buttonSeat: number;
    sbSeat: number;
    bbSeat: number;
  }) => void): void {
    this.onGameStarted = handler;
  }

  getValidTurnActions(): ReturnType<typeof getValidActions> | null {
    if (this.phase === 'WAITING' || this.phase === 'END_HAND' || this.actionDeadline === null) return null;
    return getValidActions({
      players: this.players,
      currentSeat: this.currentSeat,
      bigBlind: this.config.bigBlind,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
    });
  }

  getCurrentTurnSeat(): number | null {
    if (this.phase === 'WAITING' || this.phase === 'END_HAND') return null;
    return this.currentSeat;
  }

  getSnapshot(forUserId?: string): PublicTableState {
    return this.getPublicState(forUserId);
  }

  private onHandEnd?: (summary: HandEndSummary) => void;
  private onGameStarted?: (info: {
    handId: string;
    buttonSeat: number;
    sbSeat: number;
    bbSeat: number;
  }) => void;
  private chipsAtHandStart = new Map<string, number>();
  private actionLog: HandActionRecord[] = [];

  addPlayer(userId: string, nickname: string, chips: number, isBot = false): number {
    const used = new Set(this.players.map((p) => p.seatIndex));
    let seat = 0;
    while (used.has(seat) && seat < this.config.maxSeats) seat += 1;
    if (seat >= this.config.maxSeats) throw new Error('ROOM_FULL');

    const buyIn = Math.min(this.config.buyInCap, chips);
    this.players.push({
      seatIndex: seat,
      userId,
      nickname,
      chips: buyIn,
      betThisRound: 0,
      totalBetInHand: 0,
      status: 'ACTIVE',
      holeCards: [],
      isBot,
    });
    if (!isBot) this.realPlayerCount += 1;
    this.scheduleBotFill();
    this.tryStartHand();
    return seat;
  }

  private scheduleBotFill(): void {
    if (this.config.roomType === 'PRIVATE') return;
    if (this.botFillTimer) clearTimeout(this.botFillTimer);
    if (this.realPlayerCount < 1) return;
    this.botFillTimer = setTimeout(() => {
      const reals = this.players.filter((p) => !p.isBot).length;
      const total = this.players.length;
      if (reals >= 1 && total < 3 && total < this.config.maxSeats) {
        const botId = `bot_${Date.now()}_${total}`;
        this.addPlayer(botId, BOT_NAMES[total % BOT_NAMES.length], this.config.buyInCap, true);
      }
      if (
        this.players.length < 3 &&
        this.players.filter((p) => !p.isBot).length >= 1 &&
        this.players.length < this.config.maxSeats
      ) {
        this.scheduleBotFill();
      }
    }, 5000);
  }

  private tryStartHand(): void {
    if (this.paused) return;
    const active = this.players.filter((p) => p.status !== 'SIT_OUT' && p.chips > 0);
    if (active.length < 2 || this.phase !== 'WAITING' && this.phase !== 'END_HAND') return;
    if (this.phase === 'END_HAND') {
      this.players.forEach((p) => {
        if (p.status !== 'SIT_OUT') p.status = 'ACTIVE';
      });
    }
    this.startHand();
  }

  private startHand(): void {
    this.handId = `H${Date.now()}`;
    this.phase = 'PRE_FLOP';
    this.deck = shuffleDeck(createDeck());
    this.communityCards = [];
    this.reachedFlop = false;
    this.currentBet = 0;

    for (const p of this.players) {
      p.betThisRound = 0;
      p.totalBetInHand = 0;
      if (p.chips > 0 && p.status !== 'SIT_OUT') p.status = 'ACTIVE';
      p.holeCards = [];
    }

    const active = this.players.filter((p) => p.status === 'ACTIVE');
    this.chipsAtHandStart.clear();
    for (const p of this.players) {
      this.chipsAtHandStart.set(p.userId, p.chips);
    }
    for (const p of active) {
      const { dealt, remaining } = dealCards(this.deck, 2);
      p.holeCards = dealt;
      this.deck = remaining;
    }

    const seats = active.map((p) => p.seatIndex).sort((a, b) => a - b);
    const btnIdx = seats.indexOf(this.buttonSeat) >= 0 ? seats.indexOf(this.buttonSeat) : 0;
    const sbSeat = seats[(btnIdx + 1) % seats.length];
    const bbSeat = seats[(btnIdx + 2) % seats.length];
    this.actionLog = [];
    this.postBlind(sbSeat, this.config.smallBlind);
    this.postBlind(bbSeat, this.config.bigBlind);
    this.currentBet = this.config.bigBlind;
    this.minRaise = this.config.bigBlind;
    this.currentSeat = nextActiveSeat(this.players, bbSeat) ?? bbSeat;
    this.setDeadline();
    this.onGameStarted?.({
      handId: this.handId!,
      buttonSeat: this.buttonSeat,
      sbSeat,
      bbSeat,
    });
  }

  private postBlind(seatIndex: number, amount: number): void {
    const p = this.players.find((pl) => pl.seatIndex === seatIndex);
    if (!p) return;
    const pay = Math.min(amount, p.chips);
    p.chips -= pay;
    p.betThisRound += pay;
    p.totalBetInHand += pay;
    if (p.chips === 0) p.status = 'ALL_IN';
  }

  private setDeadline(): void {
    this.actionDeadline = Date.now() + 15000;
  }

  getPotTotal(): number {
    return this.players.reduce((s, p) => s + p.totalBetInHand, 0);
  }

  act(seatIndex: number, action: ActionType, amount?: number): void {
    const p = this.players.find((pl) => pl.seatIndex === seatIndex);
    if (!p || p.status !== 'ACTIVE' || seatIndex !== this.currentSeat) {
      throw new Error('INVALID_ACTION');
    }
    const result = applyAction({
      player: p,
      action,
      amount,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
    });
    Object.assign(p, result.player);
    if (result.raiseSize > 0) this.minRaise = Math.max(this.minRaise, result.raiseSize);
    this.currentBet = result.newCurrentBet;
    this.actionLog.push({
      seatIndex,
      userId: p.userId,
      actionType: action,
      amount,
      phase: this.phase,
      ts: Date.now(),
    });
    this.advanceAfterAction();
  }

  private advanceAfterAction(): void {
    if (countActivePlayers(this.players) <= 1) {
      this.finishHand();
      return;
    }

    if (!isBettingRoundComplete(this.players, this.currentBet)) {
      const next = nextActiveSeat(this.players, this.currentSeat);
      if (next !== null) {
        this.currentSeat = next;
        this.setDeadline();
      }
      return;
    }

    if (this.phase === 'RIVER') {
      this.phase = 'SHOWDOWN';
      this.finishHand();
      return;
    }

    this.advancePhase();
    for (const p of this.players) p.betThisRound = 0;
    this.currentBet = 0;
    this.minRaise = this.config.bigBlind;
    this.currentSeat = nextActiveSeat(this.players, this.buttonSeat) ?? this.buttonSeat;
    this.setDeadline();
  }

  private advancePhase(): void {
    if (this.phase === 'PRE_FLOP') {
      const { dealt, remaining } = dealCards(this.deck, 3);
      this.communityCards.push(...dealt);
      this.deck = remaining;
      this.reachedFlop = true;
      this.phase = 'FLOP';
    } else if (this.phase === 'FLOP') {
      const { dealt, remaining } = dealCards(this.deck, 1);
      this.communityCards.push(...dealt);
      this.deck = remaining;
      this.phase = 'TURN';
    } else if (this.phase === 'TURN') {
      const { dealt, remaining } = dealCards(this.deck, 1);
      this.communityCards.push(...dealt);
      this.deck = remaining;
      this.phase = 'RIVER';
    }
  }

  private finishHand(): void {
    const active = this.players.filter((p) => p.status !== 'FOLDED' && p.status !== 'SIT_OUT');
    const totalPot = this.getPotTotal();
    let rakeAmount = 0;
    const winners: HandEndSummary['winners'] = [];

    if (active.length === 1) {
      const rake = calculateRake({
        totalPot,
        reachedFlop: this.reachedFlop,
        rakeRate: this.config.rakeRate,
      });
      rakeAmount = rake.rakeAmount;
      active[0].chips += rake.distributablePot;
      winners.push({
        seatIndex: active[0].seatIndex,
        userId: active[0].userId,
        winAmount: rake.distributablePot,
      });
    } else if (active.length > 1) {
      const pots = calculateSidePots(
        this.players.map((p) => ({
          seatIndex: p.seatIndex,
          totalBet: p.totalBetInHand,
          isFolded: p.status === 'FOLDED',
          isAllIn: p.status === 'ALL_IN',
        })),
      );
      const settlement = distributePotToWinners(
        pots,
        this.players,
        this.communityCards,
        evaluateBestHand,
        this.reachedFlop,
        this.config.rakeRate,
        active.map((p) => p.seatIndex),
      );
      rakeAmount = settlement.totalRake;
      for (const w of settlement.winners) {
        const p = this.players.find((pl) => pl.seatIndex === w.seatIndex);
        if (p) p.chips += w.winAmount;
        winners.push({
          seatIndex: w.seatIndex,
          userId: p?.userId ?? '',
          winAmount: w.winAmount,
        });
      }
    }

    this.phase = 'END_HAND';
    this.buttonSeat = (this.buttonSeat + 1) % this.config.maxSeats;
    this.actionDeadline = null;

    if (this.onHandEnd && this.handId) {
      const results = this.players.map((p) => ({
        userId: p.userId,
        profit: p.chips - (this.chipsAtHandStart.get(p.userId) ?? p.chips),
        isBot: p.isBot,
      }));
      const playerSnapshot: HandEndSummary['playerSnapshot'] = {};
      for (const p of this.players) {
        playerSnapshot[p.userId] = {
          nickname: p.nickname,
          chips: p.chips,
          isBot: p.isBot,
        };
      }
      this.onHandEnd({
        handId: this.handId,
        roomId: this.roomId,
        roomType: this.config.roomType,
        boardCards: this.communityCards.map((c) => c.rank + c.suit).join(' '),
        potSize: totalPot,
        buyInCap: this.config.buyInCap,
        rakeAmount,
        winners,
        actions: [...this.actionLog],
        playerSnapshot,
        results,
      });
    }

    setTimeout(() => {
      for (const uid of [...this.pendingKick]) {
        if (this.hasPlayer(uid)) this.removePlayer(uid);
        this.pendingKick.delete(uid);
      }
      this.phase = 'WAITING';
      this.tryStartHand();
    }, 3000);
  }

  /** Process bot turn or timeout */
  tick(): ActionType | null {
    if (this.phase === 'WAITING' || this.phase === 'END_HAND' || this.actionDeadline === null) return null;
    const p = this.players.find((pl) => pl.seatIndex === this.currentSeat);
    if (!p || p.status !== 'ACTIVE') return null;

    const timedOut = Date.now() > this.actionDeadline;
    if (!p.isBot && !timedOut) return null;

    const valid = getValidActions({
      players: this.players,
      currentSeat: this.currentSeat,
      bigBlind: this.config.bigBlind,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
    });

    let action: ActionType;
    let amount: number | undefined;
    if (p.isBot) {
      const d = decideBotAction({
        holeCards: p.holeCards,
        communityCards: this.communityCards,
        potSize: this.getPotTotal(),
        toCall: this.currentBet - p.betThisRound,
        stack: p.chips,
        bigBlind: this.config.bigBlind,
        seatIndex: p.seatIndex,
        buttonSeat: this.buttonSeat,
        valid,
      });
      action = d.action;
      amount = d.amount;
    } else {
      if (valid.actions.includes('check')) action = 'check';
      else if (valid.actions.includes('fold')) action = 'fold';
      else action = 'fold';
    }

    this.act(p.seatIndex, action, amount);
    return action;
  }

  getPublicState(forUserId?: string): PublicTableState {
    const mySeat = forUserId
      ? this.players.find((p) => p.userId === forUserId)?.seatIndex ?? null
      : null;
    const potTotal = this.getPotTotal();
    const eligibleSeats = this.players
      .filter((p) => p.status !== 'FOLDED' && p.status !== 'SIT_OUT')
      .map((p) => p.seatIndex);

    return {
      roomId: this.roomId,
      roomType: this.config.roomType,
      phase: this.phase,
      handId: this.handId,
      maxSeats: this.config.maxSeats,
      blinds: { sb: this.config.smallBlind, bb: this.config.bigBlind },
      buyInCap: this.config.buyInCap,
      buttonSeat: this.buttonSeat,
      communityCards: this.communityCards.map((c) => c.rank + c.suit),
      potTotal,
      pots: [{ amount: potTotal, eligibleSeats }],
      currentTurnSeat: this.phase !== 'WAITING' && this.phase !== 'END_HAND' ? this.currentSeat : null,
      actionDeadline: this.actionDeadline,
      mySeatIndex: mySeat,
      seats: this.players.map((p) => ({
        seatIndex: p.seatIndex,
        userId: p.userId,
        nickname: p.nickname,
        chips: p.chips,
        betThisRound: p.betThisRound,
        status: p.status,
        isBot: p.isBot,
        holeCards:
          forUserId && p.userId === forUserId
            ? p.holeCards.map((c) => c.rank + c.suit)
            : (['**', '**'] as ['**', '**']),
      })),
    };
  }
}
