import type { Card } from '@texas-holdem/poker-engine';
import {
  applyAction,
  countActivePlayers,
  decideBotAction,
  evaluateBestHand,
  getValidActions,
  isBettingRoundComplete,
  nextSeatNeedingAction,
  nextSeatWithChips,
  createBettingRoundState,
  markBlindPosted,
  recordPlayerAction,
  resetBettingRound,
  createDeck,
  dealCards,
  burnAndDeal,
  shuffleDeck,
  calculateSidePots,
  calculateRake,
  distributePotToWinners,
  assignBlindSeats,
  firstToActSeat,
  dealOrderFromButton,
  seatsClockwiseFromLeftOfButton,
  shouldRunoutBoard,
  type PlayerState,
  type ActionType,
  type BettingRoundState,
} from '@texas-holdem/poker-engine';
import {
  ACTION_TIME_MS,
  HAND_PAUSE_MS,
  MAX_TABLE_SEATS,
  OFFICIAL_BIG_BLIND,
  OFFICIAL_MAX_BUY_IN,
  OFFICIAL_SMALL_BLIND,
  TIME_BANK_MS,
} from '@texas-holdem/shared';

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
  hostUserId?: string;
  paused?: boolean;
  buttonSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  communityCards: string[];
  potTotal: number;
  pots: Array<{ amount: number; eligibleSeats: number[] }>;
  currentTurnSeat: number | null;
  actionDeadline: number | null;
  mySeatIndex: number | null;
  role: 'spectator' | 'player' | null;
  pendingSitIn: boolean;
  emptySeats: number[];
  spectators: Array<{ userId: string; nickname: string; avatarUrl: string | null }>;
  seats: Array<{
    seatIndex: number;
    userId: string;
    nickname: string;
    chips: number;
    betThisRound: number;
    status: string;
    isBot: boolean;
    avatarUrl?: string | null;
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
  autoAction?: boolean;
}

export type TableEvent =
  | {
      type: 'game_started';
      handId: string;
      buttonSeat: number;
      sbSeat: number;
      bbSeat: number;
      blinds: { sb: number; bb: number };
    }
  | {
      type: 'hole_cards_dealt';
      handId: string;
      deals: Array<{ userId: string; seatIndex: number; cards: string[] }>;
    }
  | {
      type: 'community_cards_dealt';
      handId: string;
      phase: 'FLOP' | 'TURN' | 'RIVER';
      cards: string[];
      boardCards: string[];
    }
  | {
      type: 'action_result';
      handId: string;
      seatIndex: number;
      userId: string;
      actionType: ActionType;
      amount?: number;
      chipsRemaining: number;
      potTotal: number;
      autoAction: boolean;
    }
  | { type: 'pot_updated'; handId: string; potTotal: number }
  | {
      type: 'showdown_result';
      handId: string;
      boardCards: string[];
      players: Array<{ seatIndex: number; userId: string; holeCards: string[] }>;
    };

export interface ActResult {
  seatIndex: number;
  userId: string;
  actionType: ActionType;
  amount?: number;
  autoAction: boolean;
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

const BOT_NAMES = [
  'Mike_D',
  'PokerKing88',
  'LuckyAce',
  'RiverRat',
  'ChipStack',
  'BluffMaster',
];

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
  maxSeats: MAX_TABLE_SEATS,
  smallBlind: OFFICIAL_SMALL_BLIND,
  bigBlind: OFFICIAL_BIG_BLIND,
  buyInCap: OFFICIAL_MAX_BUY_IN,
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
  private sbSeat = 0;
  private bbSeat = 0;
  private currentSeat = 0;
  private currentBet = 0;
  private minRaise = 2;
  private turnStartedAt = 0;
  private botActAt = 0;
  private reachedFlop = false;
  private actionDeadline: number | null = null;
  private botFillTimer: ReturnType<typeof setTimeout> | null = null;
  private realPlayerCount = 0;
  private paused = false;
  private pendingKick = new Set<string>();
  private pendingSitIn = new Set<string>();
  private pendingStandUp = new Set<string>();
  private spectators = new Map<string, { userId: string; nickname: string; avatarUrl: string | null }>();
  private finishingHand = false;
  private onPlayerRemoved?: (userId: string, chips: number) => void;

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

  setOnPlayerRemoved(handler: (userId: string, chips: number) => void): void {
    this.onPlayerRemoved = handler;
  }

  hasSpectator(userId: string): boolean {
    return this.spectators.has(userId);
  }

  isPresent(userId: string): boolean {
    return this.hasPlayer(userId) || this.hasSpectator(userId);
  }

  addSpectator(userId: string, nickname: string, avatarUrl?: string | null): void {
    if (this.hasPlayer(userId)) return;
    this.spectators.set(userId, {
      userId,
      nickname,
      avatarUrl: avatarUrl ?? null,
    });
  }

  removeSpectator(userId: string): void {
    this.spectators.delete(userId);
  }

  ensureOfficialGameRunning(): void {
    if (this.config.roomType !== 'OFFICIAL') return;
    this.fillOfficialBots();
    this.tryStartHand();
  }

  private isHandLive(): boolean {
    return (
      this.phase === 'PRE_FLOP' ||
      this.phase === 'FLOP' ||
      this.phase === 'TURN' ||
      this.phase === 'RIVER'
    );
  }

  private usedSeats(): Set<number> {
    return new Set(this.players.map((p) => p.seatIndex));
  }

  emptySeatIndexes(): number[] {
    const used = this.usedSeats();
    const empty: number[] = [];
    for (let i = 0; i < this.config.maxSeats; i += 1) {
      if (!used.has(i)) empty.push(i);
    }
    return empty;
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
    const avatar = this.avatarByUserId.get(userId) ?? null;
    const standing = this.pendingStandUp.has(userId);
    this.pendingStandUp.delete(userId);
    this.pendingKick.delete(userId);
    this.pendingSitIn.delete(userId);
    if (!p.isBot) {
      this.realPlayerCount = Math.max(0, this.realPlayerCount - 1);
    }
    this.avatarByUserId.delete(userId);
    this.players.splice(idx, 1);
    if (standing && !p.isBot) {
      this.addSpectator(userId, p.nickname, avatar);
    }
    if (!p.isBot && this.realPlayerCount === 0 && this.spectators.size === 0) {
      this.players = this.players.filter((pl) => !pl.isBot);
    }
    if (!p.isBot) {
      this.onPlayerRemoved?.(userId, chips);
    }
    return chips;
  }

  resumePlayer(userId: string, avatarUrl?: string | null): void {
    const p = this.players.find((pl) => pl.userId === userId);
    if (p && p.status === 'SIT_OUT') p.status = 'ACTIVE';
    if (avatarUrl !== undefined) this.avatarByUserId.set(userId, avatarUrl);
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
      raiseClosed: this.bettingRound.raiseClosedSeats.has(this.currentSeat),
    });
  }

  getCurrentTurnSeat(): number | null {
    if (this.phase === 'WAITING' || this.phase === 'END_HAND') return null;
    return this.currentSeat;
  }

  getSnapshot(forUserId?: string): PublicTableState {
    return this.getPublicState(forUserId);
  }

  flushEvents(): TableEvent[] {
    const events = this.eventQueue;
    this.eventQueue = [];
    return events;
  }

  hasPendingEvents(): boolean {
    return this.eventQueue.length > 0;
  }

  private pushEvent(event: TableEvent): void {
    this.eventQueue.push(event);
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
  private bettingRound: BettingRoundState = createBettingRoundState();
  private eventQueue: TableEvent[] = [];
  private avatarByUserId = new Map<string, string | null>();

  addPlayer(
    userId: string,
    nickname: string,
    chips: number,
    isBot = false,
    avatarUrl?: string | null,
    seatIndex?: number,
  ): number {
    const used = this.usedSeats();
    let seat = seatIndex ?? 0;
    if (seatIndex !== undefined) {
      if (seatIndex < 0 || seatIndex >= this.config.maxSeats || used.has(seatIndex)) {
        throw new Error('SEAT_TAKEN');
      }
    } else {
      while (used.has(seat) && seat < this.config.maxSeats) seat += 1;
      if (seat >= this.config.maxSeats) throw new Error('ROOM_FULL');
    }

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
      timeBankMs: isBot ? 0 : TIME_BANK_MS,
    });
    if (!isBot) {
      this.realPlayerCount += 1;
      this.avatarByUserId.set(userId, avatarUrl ?? null);
      this.spectators.delete(userId);
      this.fillOfficialBots();
    }
    this.tryStartHand();
    return seat;
  }

  sitDown(
    userId: string,
    nickname: string,
    chips: number,
    avatarUrl?: string | null,
    seatIndex?: number,
  ): { seat: number; nextHand: boolean } {
    if (this.hasPlayer(userId)) throw new Error('ALREADY_SEATED');
    const empty = this.emptySeatIndexes();
    if (empty.length === 0) throw new Error('ROOM_FULL');
    if (seatIndex !== undefined && !empty.includes(seatIndex)) throw new Error('SEAT_TAKEN');
    this.spectators.delete(userId);
    const waitForNext =
      this.isHandLive() ||
      this.phase === 'SHOWDOWN' ||
      this.phase === 'END_HAND' ||
      this.finishingHand;
    const seat = this.addPlayer(userId, nickname, chips, false, avatarUrl, seatIndex);
    if (waitForNext) {
      const p = this.players.find((pl) => pl.userId === userId);
      if (p) p.status = 'SIT_OUT';
      this.pendingSitIn.add(userId);
    }
    return { seat, nextHand: waitForNext };
  }

  standUp(userId: string): { ok: boolean; chips?: number; deferred?: boolean } {
    return this.vacateSeat(userId, 'stand');
  }

  leaveSeat(userId: string): { ok: boolean; chips?: number; deferred?: boolean } {
    return this.vacateSeat(userId, 'leave');
  }

  private vacateSeat(
    userId: string,
    mode: 'stand' | 'leave',
  ): { ok: boolean; chips?: number; deferred?: boolean } {
    if (!this.hasPlayer(userId)) {
      if (mode === 'leave') this.removeSpectator(userId);
      return { ok: true, chips: 0 };
    }
    const p = this.players.find((pl) => pl.userId === userId)!;
    const inPot =
      (this.isHandLive() || this.phase === 'SHOWDOWN') &&
      (p.status === 'ACTIVE' || p.status === 'ALL_IN' || p.totalBetInHand > 0);
    if (inPot) {
      if (p.status === 'ACTIVE') this.forceFoldSeat(p.seatIndex);
      this.pendingKick.add(userId);
      if (mode === 'stand') this.pendingStandUp.add(userId);
      else this.pendingStandUp.delete(userId);
      return { ok: true, deferred: true };
    }
    const nickname = p.nickname;
    const avatar = this.avatarByUserId.get(userId) ?? null;
    if (mode === 'stand') this.pendingStandUp.add(userId);
    const chips = this.removePlayer(userId);
    if (mode === 'stand' && !this.hasSpectator(userId)) {
      this.addSpectator(userId, nickname, avatar);
    }
    return { ok: true, chips };
  }

  forceFoldSeat(seatIndex: number): void {
    const p = this.players.find((pl) => pl.seatIndex === seatIndex);
    if (!p || p.status !== 'ACTIVE') return;
    p.status = 'FOLDED';
    recordPlayerAction(this.bettingRound, seatIndex, 'no_raise');
    if (this.handId) {
      this.pushEvent({
        type: 'action_result',
        handId: this.handId,
        seatIndex,
        userId: p.userId,
        actionType: 'fold',
        chipsRemaining: p.chips,
        potTotal: this.getPotTotal(),
        autoAction: true,
      });
    }
    if (this.currentSeat === seatIndex || countActivePlayers(this.players) <= 1) {
      this.advanceAfterAction();
    }
  }

  /** Official: 5 bots + empty seats for humans. Spectators can watch a live bot game. */
  private fillOfficialBots(): void {
    if (this.config.roomType === 'PRIVATE') return;
    const seatedHumans = this.players.filter((p) => !p.isBot).length;
    if (seatedHumans === 0 && this.spectators.size === 0) {
      this.players = this.players.filter((pl) => !pl.isBot);
      return;
    }
    if (this.phase !== 'WAITING' && this.phase !== 'END_HAND') return;
    if (this.botFillTimer) {
      clearTimeout(this.botFillTimer);
      this.botFillTimer = null;
    }
    const botTarget = Math.min(5, this.config.maxSeats - seatedHumans);
    let botCount = this.players.filter((p) => p.isBot).length;
    while (botCount < botTarget) {
      const n = this.players.length;
      const botId = `bot_${Date.now()}_${n}`;
      const used = this.usedSeats();
      let seat = 0;
      while (used.has(seat) && seat < this.config.maxSeats) seat += 1;
      if (seat >= this.config.maxSeats) break;
      this.players.push({
        seatIndex: seat,
        userId: botId,
        nickname: BOT_NAMES[n % BOT_NAMES.length],
        chips: this.config.buyInCap,
        betThisRound: 0,
        totalBetInHand: 0,
        status: 'ACTIVE',
        holeCards: [],
        isBot: true,
        timeBankMs: 0,
      });
      botCount += 1;
    }
  }

  private promotePendingSitIns(): void {
    for (const uid of [...this.pendingSitIn]) {
      const p = this.players.find((pl) => pl.userId === uid);
      if (p && p.chips > 0) p.status = 'ACTIVE';
      this.pendingSitIn.delete(uid);
    }
  }

  private tryStartHand(): void {
    this.promotePendingSitIns();
    this.fillOfficialBots();
    if (this.paused || this.finishingHand) return;
    if (
      this.config.roomType === 'OFFICIAL' &&
      this.realPlayerCount < 1 &&
      this.spectators.size === 0
    ) {
      return;
    }
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
    const dealOrder = dealOrderFromButton(
      this.buttonSeat,
      active.map((p) => p.seatIndex),
    );
    for (let round = 0; round < 2; round += 1) {
      for (const seat of dealOrder) {
        const p = this.players.find((pl) => pl.seatIndex === seat);
        if (!p) continue;
        const { dealt, remaining } = dealCards(this.deck, 1);
        p.holeCards.push(...dealt);
        this.deck = remaining;
      }
    }

    const { sbSeat, bbSeat } = assignBlindSeats(
      this.buttonSeat,
      active.map((p) => p.seatIndex),
    );
    this.sbSeat = sbSeat;
    this.bbSeat = bbSeat;
    this.bettingRound = createBettingRoundState({
      bbSeat,
      minRaise: this.config.bigBlind,
    });
    this.actionLog = [];
    this.postBlind(sbSeat, this.config.smallBlind);
    this.postBlind(bbSeat, this.config.bigBlind);
    this.currentBet = this.config.bigBlind;
    this.minRaise = this.config.bigBlind;
    this.currentSeat =
      firstToActSeat('PRE_FLOP', this.buttonSeat, bbSeat, this.players) ?? bbSeat;
    this.setDeadline();

    const holeDeals = active.map((p) => ({
      userId: p.userId,
      seatIndex: p.seatIndex,
      cards: p.holeCards.map((c) => c.rank + c.suit),
    }));

    this.pushEvent({
      type: 'game_started',
      handId: this.handId!,
      buttonSeat: this.buttonSeat,
      sbSeat: this.sbSeat,
      bbSeat: this.bbSeat,
      blinds: { sb: this.config.smallBlind, bb: this.config.bigBlind },
    });
    this.pushEvent({
      type: 'hole_cards_dealt',
      handId: this.handId!,
      deals: holeDeals,
    });
    this.pushEvent({ type: 'pot_updated', handId: this.handId!, potTotal: this.getPotTotal() });

    this.onGameStarted?.({
      handId: this.handId!,
      buttonSeat: this.buttonSeat,
      sbSeat: this.sbSeat,
      bbSeat: this.bbSeat,
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
    markBlindPosted(this.bettingRound, seatIndex);
  }

  private setDeadline(): void {
    this.turnStartedAt = Date.now();
    const actor = this.players.find((pl) => pl.seatIndex === this.currentSeat);
    const bank = actor && !actor.isBot ? (actor.timeBankMs ?? TIME_BANK_MS) : 0;
    this.actionDeadline = this.turnStartedAt + ACTION_TIME_MS + bank;
    this.botActAt = actor?.isBot ? this.turnStartedAt + 900 + Math.floor(Math.random() * 1400) : 0;
  }

  private consumeTimeBank(player: PlayerState): void {
    if (player.isBot || !this.turnStartedAt) return;
    const overtime = Date.now() - this.turnStartedAt - ACTION_TIME_MS;
    if (overtime > 0) {
      player.timeBankMs = Math.max(0, (player.timeBankMs ?? 0) - overtime);
    }
  }

  getPotTotal(): number {
    return this.players.reduce((s, p) => s + p.totalBetInHand, 0);
  }

  act(seatIndex: number, action: ActionType, amount?: number, autoAction = false): ActResult {
    const p = this.players.find((pl) => pl.seatIndex === seatIndex);
    if (!p || p.status !== 'ACTIVE' || seatIndex !== this.currentSeat) {
      throw new Error('INVALID_ACTION');
    }
    if (action === 'call' && this.currentBet <= p.betThisRound) {
      action = 'check';
    }
    this.consumeTimeBank(p);
    const betBefore = p.betThisRound;
    const result = applyAction({
      player: p,
      action,
      amount,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      raiseClosed: this.bettingRound.raiseClosedSeats.has(seatIndex),
    });
    Object.assign(p, result.player);
    if (result.raiseClass === 'full_raise' && result.raiseSize > 0) {
      this.minRaise = result.raiseSize;
      this.bettingRound.lastFullRaise = result.raiseSize;
    }
    this.currentBet = result.newCurrentBet;

    const effectiveAmount = p.betThisRound - betBefore;
    const amountOut = effectiveAmount > 0 ? effectiveAmount : undefined;

    recordPlayerAction(this.bettingRound, seatIndex, result.raiseClass);

    this.actionLog.push({
      seatIndex,
      userId: p.userId,
      actionType: action,
      amount: amountOut,
      phase: this.phase,
      ts: Date.now(),
      autoAction,
    });

    const actResult: ActResult = {
      seatIndex,
      userId: p.userId,
      actionType: action,
      amount: amountOut,
      autoAction,
    };

    if (this.handId) {
      this.pushEvent({
        type: 'action_result',
        handId: this.handId,
        seatIndex,
        userId: p.userId,
        actionType: action,
        amount: amountOut,
        chipsRemaining: p.chips,
        potTotal: this.getPotTotal(),
        autoAction,
      });
      this.pushEvent({ type: 'pot_updated', handId: this.handId, potTotal: this.getPotTotal() });
    }

    this.advanceAfterAction();
    return actResult;
  }

  private advanceAfterAction(): void {
    if (countActivePlayers(this.players) <= 1 || shouldRunoutBoard(this.players)) {
      if (shouldRunoutBoard(this.players)) {
        this.runoutBoard();
      }
      this.finishHand();
      return;
    }

    if (!isBettingRoundComplete(this.players, this.currentBet, this.bettingRound)) {
      const next = nextSeatNeedingAction(
        this.players,
        this.currentSeat,
        this.currentBet,
        this.bettingRound,
      );
      if (next !== null && next !== this.currentSeat) {
        this.currentSeat = next;
        this.setDeadline();
        return;
      }
      if (next === null) {
        // Nobody left to act — treat the street as complete.
      } else {
        this.setDeadline();
        return;
      }
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
    resetBettingRound(this.bettingRound, this.config.bigBlind);
    this.currentSeat =
      firstToActSeat(this.phase as 'FLOP' | 'TURN' | 'RIVER', this.buttonSeat, this.bbSeat, this.players)
      ?? this.buttonSeat;
    this.setDeadline();
  }

  private runoutBoard(): void {
    while (this.phase !== 'RIVER' && this.phase !== 'SHOWDOWN' && this.communityCards.length < 5) {
      this.advancePhase();
    }
    this.phase = 'SHOWDOWN';
  }

  private advancePhase(): void {
    const prevLen = this.communityCards.length;
    if (this.phase === 'PRE_FLOP') {
      const { dealt, remaining } = burnAndDeal(this.deck, 3);
      this.communityCards.push(...dealt);
      this.deck = remaining;
      this.reachedFlop = true;
      this.phase = 'FLOP';
      this.emitCommunityDealt('FLOP');
    } else if (this.phase === 'FLOP') {
      const { dealt, remaining } = burnAndDeal(this.deck, 1);
      this.communityCards.push(...dealt);
      this.deck = remaining;
      this.phase = 'TURN';
      this.emitCommunityDealt('TURN');
    } else if (this.phase === 'TURN') {
      const { dealt, remaining } = burnAndDeal(this.deck, 1);
      this.communityCards.push(...dealt);
      this.deck = remaining;
      this.phase = 'RIVER';
      this.emitCommunityDealt('RIVER');
    }
    void prevLen;
  }

  private emitCommunityDealt(phase: 'FLOP' | 'TURN' | 'RIVER'): void {
    if (!this.handId) return;
    const board = this.communityCards.map((c) => c.rank + c.suit);
    let newCards: string[] = board;
    if (phase === 'FLOP') newCards = board.slice(0, 3);
    else if (phase === 'TURN') newCards = board.slice(3, 4);
    else newCards = board.slice(4, 5);
    this.pushEvent({
      type: 'community_cards_dealt',
      handId: this.handId,
      phase,
      cards: newCards,
      boardCards: board,
    });
  }

  private finishHand(): void {
    if (this.finishingHand) return;
    this.finishingHand = true;
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
        seatsClockwiseFromLeftOfButton(
          this.buttonSeat,
          active.map((p) => p.seatIndex),
        ),
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
    this.advanceButtonSeat();
    this.actionDeadline = null;

    if (active.length > 1 && this.handId) {
      this.pushEvent({
        type: 'showdown_result',
        handId: this.handId,
        boardCards: this.communityCards.map((c) => c.rank + c.suit),
        players: active.map((p) => ({
          seatIndex: p.seatIndex,
          userId: p.userId,
          holeCards: p.holeCards.map((c) => c.rank + c.suit),
        })),
      });
    }

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
      this.finishingHand = false;
      for (const uid of [...this.pendingKick]) {
        if (this.hasPlayer(uid)) this.removePlayer(uid);
        this.pendingKick.delete(uid);
      }
      this.phase = 'WAITING';
      this.tryStartHand();
    }, HAND_PAUSE_MS);
  }

  private advanceButtonSeat(): void {
    const seats = this.players
      .filter((p) => p.chips > 0 && p.status !== 'SIT_OUT')
      .map((p) => p.seatIndex);
    const next = nextSeatWithChips(seats, this.buttonSeat, (s) =>
      this.players.some((p) => p.seatIndex === s && p.chips > 0 && p.status !== 'SIT_OUT'),
    );
    if (next !== null) this.buttonSeat = next;
  }

  /** Process bot turn or timeout */
  tick(): ActResult | null {
    if (this.phase === 'WAITING' || this.phase === 'END_HAND' || this.actionDeadline === null) return null;
    const p = this.players.find((pl) => pl.seatIndex === this.currentSeat);
    if (!p || p.status !== 'ACTIVE') {
      const next = nextSeatNeedingAction(
        this.players,
        this.currentSeat,
        this.currentBet,
        this.bettingRound,
      );
      if (next !== null && next !== this.currentSeat) {
        this.currentSeat = next;
        this.setDeadline();
      }
      return null;
    }

    const timedOut = Date.now() > this.actionDeadline;
    if (p.isBot && Date.now() < this.botActAt) return null;
    if (!p.isBot && !timedOut) return null;

    const valid = getValidActions({
      players: this.players,
      currentSeat: this.currentSeat,
      bigBlind: this.config.bigBlind,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      raiseClosed: this.bettingRound.raiseClosedSeats.has(this.currentSeat),
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
        maxSeats: this.config.maxSeats,
        valid,
      });
      action = d.action;
      amount = d.amount;
    } else {
      if (valid.actions.includes('check')) action = 'check';
      else if (valid.actions.includes('fold')) action = 'fold';
      else action = 'fold';
    }

    this.act(p.seatIndex, action, amount, true);
    return {
      seatIndex: p.seatIndex,
      userId: p.userId,
      actionType: action,
      amount,
      autoAction: true,
    };
  }

  getPublicState(forUserId?: string): PublicTableState {
    const mySeat = forUserId
      ? this.players.find((p) => p.userId === forUserId)?.seatIndex ?? null
      : null;
    const potTotal = this.getPotTotal();
    const eligibleSeats = this.players
      .filter((p) => p.status !== 'FOLDED' && p.status !== 'SIT_OUT')
      .map((p) => p.seatIndex);
    const role = !forUserId
      ? null
      : this.hasPlayer(forUserId)
        ? 'player'
        : this.hasSpectator(forUserId)
          ? 'spectator'
          : null;

    return {
      roomId: this.roomId,
      roomType: this.config.roomType,
      phase: this.phase,
      handId: this.handId,
      maxSeats: this.config.maxSeats,
      blinds: { sb: this.config.smallBlind, bb: this.config.bigBlind },
      buyInCap: this.config.buyInCap,
      hostUserId: this.config.hostUserId,
      paused: this.paused,
      buttonSeat: this.buttonSeat,
      smallBlindSeat: this.sbSeat,
      bigBlindSeat: this.bbSeat,
      communityCards: this.communityCards.map((c) => c.rank + c.suit),
      potTotal,
      pots: [{ amount: potTotal, eligibleSeats }],
      currentTurnSeat: this.phase !== 'WAITING' && this.phase !== 'END_HAND' ? this.currentSeat : null,
      actionDeadline: this.actionDeadline,
      mySeatIndex: mySeat,
      role,
      pendingSitIn: forUserId ? this.pendingSitIn.has(forUserId) : false,
      emptySeats: this.emptySeatIndexes(),
      spectators: [...this.spectators.values()],
      seats: this.players.map((p) => ({
        seatIndex: p.seatIndex,
        userId: p.userId,
        nickname: p.nickname,
        chips: p.chips,
        betThisRound: p.betThisRound,
        status: p.status,
        isBot: p.isBot,
        avatarUrl: p.isBot ? null : (this.avatarByUserId.get(p.userId) ?? null),
        holeCards:
          forUserId && p.userId === forUserId
            ? p.holeCards.map((c) => c.rank + c.suit)
            : (['**', '**'] as ['**', '**']),
      })),
    };
  }
}
