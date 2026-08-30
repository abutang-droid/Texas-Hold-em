import type { Server, Socket } from 'socket.io';
import {
  saveHandHistory,
  recordHandExp,
  addWeeklyProfit,
  addWeeklyBiggestPot,
  saveRoomSnapshot,
  setUserActiveRoom,
  clearUserActiveRoom,
  getUserActiveRoom,
  checkHandForChipDumping,
  clearOfficialRoomIp,
  cashOutChips,
} from '@texas-holdem/db';
import type { ActionType } from '@texas-holdem/poker-engine';
import type { HandEndSummary, InteractiveTable, TableEvent } from './game/interactive-table.js';

const roomSeq = new Map<string, number>();
const requestCache = new Map<string, unknown>();

export function nextSeq(roomId: string): number {
  const seq = (roomSeq.get(roomId) ?? 0) + 1;
  roomSeq.set(roomId, seq);
  return seq;
}

export function emitError(
  socket: Socket,
  code: string,
  requestId?: string,
  messageKey?: string,
): void {
  socket.emit('error', {
    payload: { code, messageKey, requestId },
  });
}

export function cacheRequestResult(requestId: string | undefined, result: unknown): void {
  if (!requestId) return;
  requestCache.set(requestId, result);
  setTimeout(() => requestCache.delete(requestId), 60_000);
}

export function getCachedRequest<T>(requestId: string | undefined): T | undefined {
  if (!requestId) return undefined;
  return requestCache.get(requestId) as T | undefined;
}

export function wireTableHandlers(table: InteractiveTable, io: Server, roomId: string): void {
  table.setOnPlayerRemoved((userId, chips) => {
    if (chips > 0) {
      void cashOutChips(Number(userId), chips, `${roomId}:${userId}:out:${Date.now()}`).catch(
        (err: unknown) => console.error('cashOutChips failed', err),
      );
    }
    if (table.config.roomType !== 'OFFICIAL') return;
    void clearOfficialRoomIp(roomId, userId).catch((err: unknown) =>
      console.error('clearOfficialRoomIp failed', err),
    );
  });

  table.setHandEndHandler((summary) => {
    void persistHandEnd(summary).catch((err) => console.error('hand persist failed', err));
    io.to(roomId).emit('hand_ended', {
      seq: nextSeq(roomId),
      serverTs: Date.now(),
      payload: {
        handId: summary.handId,
        nextHandIn: 3000,
        potSize: summary.potSize,
        boardCards: summary.boardCards,
        winners: summary.winners.map((w) => ({
          seatIndex: w.seatIndex,
          userId: w.userId,
          winAmount: w.winAmount,
          nickname: summary.playerSnapshot[w.userId]?.nickname ?? `Seat ${w.seatIndex + 1}`,
        })),
      },
    });
  });
}

async function persistHandEnd(summary: HandEndSummary): Promise<void> {
  await saveHandHistory({
    handId: summary.handId,
    roomId: summary.roomId,
    roomType: summary.roomType,
    potSize: summary.potSize,
    rakeAmount: summary.rakeAmount,
    boardCards: summary.boardCards,
    winners: summary.winners,
    actions: summary.actions,
    playerSnapshot: summary.playerSnapshot,
  });

  for (const r of summary.results) {
    if (r.isBot) continue;
    const uid = Number(r.userId);
    if (!Number.isFinite(uid)) continue;
    if (r.profit !== 0) await addWeeklyProfit(uid, r.profit);
    await recordHandExp(uid, 10);
  }

  for (const w of summary.winners) {
    const uid = Number(w.userId);
    if (!Number.isFinite(uid)) continue;
    await addWeeklyBiggestPot(uid, w.winAmount);
  }

  await checkHandForChipDumping({
    roomId: summary.roomId,
    roomType: summary.roomType,
    buyInCap: summary.buyInCap,
    results: summary.results,
  });
}

export async function syncRoomSnapshot(table: InteractiveTable): Promise<void> {
  const base = table.getSnapshot();
  await saveRoomSnapshot(table.roomId, {
    ...base,
    serverTs: Date.now(),
  });
}

export function broadcastState(io: Server, roomId: string, table: InteractiveTable): void {
  flushTableEvents(io, roomId, table);
  const sockets = io.sockets.adapter.rooms.get(roomId);
  if (!sockets) return;
  const seq = nextSeq(roomId);
  const serverTs = Date.now();
  for (const sid of sockets) {
    const s = io.sockets.sockets.get(sid);
    const userId = s?.data.userId as string | undefined;
    const payload = table.getPublicState(userId);
    s?.emit('room_state_sync', { seq, serverTs, payload });
    emitActionTurnIfNeeded(s, table, seq, serverTs, userId);
  }
  void syncRoomSnapshot(table).catch((err) => console.error('snapshot sync failed', err));
}

export function flushTableEvents(io: Server, roomId: string, table: InteractiveTable): void {
  const events = table.flushEvents();
  for (const event of events) {
    emitTableEvent(io, roomId, event);
  }
}

function emitTableEvent(io: Server, roomId: string, event: TableEvent): void {
  const seq = nextSeq(roomId);
  const serverTs = Date.now();

  switch (event.type) {
    case 'game_started':
      io.to(roomId).emit('game_started', {
        seq,
        serverTs,
        payload: {
          handId: event.handId,
          buttonSeat: event.buttonSeat,
          sbSeat: event.sbSeat,
          bbSeat: event.bbSeat,
          blindsPosted: event.blinds,
        },
      });
      break;
    case 'hole_cards_dealt': {
      const sockets = io.sockets.adapter.rooms.get(roomId);
      if (!sockets) break;
      for (const sid of sockets) {
        const socket = io.sockets.sockets.get(sid);
        const userId = socket?.data.userId as string | undefined;
        if (!socket || !userId) continue;
        const deal = event.deals.find((d) => d.userId === userId);
        if (!deal) continue;
        socket.emit('hole_cards_dealt', {
          seq,
          serverTs,
          payload: {
            handId: event.handId,
            seatIndex: deal.seatIndex,
            cards: deal.cards,
          },
        });
      }
      break;
    }
    case 'community_cards_dealt':
      io.to(roomId).emit('community_cards_dealt', {
        seq,
        serverTs,
        payload: {
          handId: event.handId,
          phase: event.phase,
          cards: event.cards,
          boardCards: event.boardCards,
        },
      });
      break;
    case 'action_result':
      io.to(roomId).emit('action_result', {
        seq,
        serverTs,
        payload: {
          seatIndex: event.seatIndex,
          userId: event.userId,
          actionType: event.actionType,
          amount: event.amount,
          chipsRemaining: event.chipsRemaining,
          potTotal: event.potTotal,
          autoAction: event.autoAction,
        },
      });
      break;
    case 'pot_updated':
      io.to(roomId).emit('pot_updated', {
        seq,
        serverTs,
        payload: { handId: event.handId, potTotal: event.potTotal },
      });
      break;
    case 'showdown_result':
      io.to(roomId).emit('showdown_result', {
        seq,
        serverTs,
        payload: {
          handId: event.handId,
          boardCards: event.boardCards,
          players: event.players,
        },
      });
      break;
    default:
      break;
  }
}

function emitActionTurnIfNeeded(
  socket: Socket | undefined,
  table: InteractiveTable,
  seq: number,
  serverTs: number,
  userId?: string,
): void {
  if (!socket || !userId) return;
  const turnSeat = table.getCurrentTurnSeat();
  if (turnSeat === null) return;
  const state = table.getPublicState(userId);
  const seat = state.seats.find((s) => s.seatIndex === turnSeat);
  if (!seat || seat.userId !== userId) return;
  const valid = table.getValidTurnActions();
  if (!valid) return;
  socket.emit('action_turn', {
    seq,
    serverTs,
    payload: {
      seatIndex: turnSeat,
      userId: seat.userId,
      deadline: state.actionDeadline,
      validActions: valid.actions,
      callAmount: valid.callAmount,
      minRaise: valid.minRaiseTotal,
      maxRaise: valid.maxRaiseTotal,
    },
  });
}

function emitSelfState(socket: Socket, table: InteractiveTable, roomId: string, userId: string): void {
  const seq = nextSeq(roomId);
  const serverTs = Date.now();
  const payload = table.getPublicState(userId);
  socket.emit('room_state_sync', { seq, serverTs, payload });
  emitActionTurnIfNeeded(socket, table, seq, serverTs, userId);
}

export async function joinRoomFlow(opts: {
  io: Server;
  socket: Socket;
  table: InteractiveTable;
  roomId: string;
  userId: string;
  nickname: string;
  buyIn: number;
  buyInFn: () => Promise<void>;
  avatarUrl?: string | null;
}): Promise<{ seat: number; role: 'player' }> {
  const { io, socket, table, roomId, userId, nickname, buyIn, buyInFn, avatarUrl } = opts;
  let seat: number;
  let isNewPlayer = false;

  if (table.hasPlayer(userId)) {
    table.resumePlayer(userId, avatarUrl);
    seat = table.getPublicState(userId).seats.find((s) => s.userId === userId)?.seatIndex ?? 0;
  } else {
    isNewPlayer = true;
    await buyInFn();
    seat = table.addPlayer(userId, nickname, buyIn, false, avatarUrl);
  }

  await setUserActiveRoom(Number(userId), roomId);
  socket.join(roomId);
  emitSelfState(socket, table, roomId, userId);

  if (isNewPlayer) {
    io.to(roomId).emit('player_joined', {
      seq: nextSeq(roomId),
      serverTs: Date.now(),
      payload: {
        seatIndex: seat,
        userId,
        nickname,
        chips: buyIn,
        isBot: false,
        avatarUrl: avatarUrl ?? null,
      },
    });
  }

  broadcastState(io, roomId, table);

  return { seat, role: 'player' };
}

export async function spectateRoomFlow(opts: {
  io: Server;
  socket: Socket;
  table: InteractiveTable;
  roomId: string;
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
}): Promise<{ seat: number; role: 'spectator' }> {
  const { io, socket, table, roomId, userId, nickname, avatarUrl } = opts;
  table.addSpectator(userId, nickname, avatarUrl);
  table.ensureOfficialGameRunning();
  await setUserActiveRoom(Number(userId), roomId);
  socket.join(roomId);
  emitSelfState(socket, table, roomId, userId);
  broadcastState(io, roomId, table);
  return { seat: -1, role: 'spectator' };
}

export async function sitDownFlow(opts: {
  io: Server;
  socket: Socket;
  table: InteractiveTable;
  roomId: string;
  userId: string;
  nickname: string;
  buyIn: number;
  buyInFn: () => Promise<void>;
  avatarUrl?: string | null;
  seatIndex?: number;
}): Promise<{ seat: number; nextHand: boolean }> {
  const { io, socket, table, roomId, userId, nickname, buyIn, buyInFn, avatarUrl, seatIndex } = opts;
  if (table.hasPlayer(userId)) throw new Error('ALREADY_SEATED');
  const empty = table.emptySeatIndexes();
  if (empty.length === 0) throw new Error('ROOM_FULL');
  if (seatIndex !== undefined && !empty.includes(seatIndex)) throw new Error('SEAT_TAKEN');
  await buyInFn();
  const { seat, nextHand } = table.sitDown(userId, nickname, buyIn, avatarUrl, seatIndex);
  emitSelfState(socket, table, roomId, userId);
  io.to(roomId).emit('player_joined', {
    seq: nextSeq(roomId),
    serverTs: Date.now(),
    payload: {
      seatIndex: seat,
      userId,
      nickname,
      chips: buyIn,
      isBot: false,
      avatarUrl: avatarUrl ?? null,
    },
  });
  broadcastState(io, roomId, table);
  return { seat, nextHand };
}

export async function standUpFlow(opts: {
  io: Server;
  table: InteractiveTable;
  roomId: string;
  userId: string;
}): Promise<{ ok: boolean; deferred?: boolean }> {
  const { io, table, roomId, userId } = opts;
  if (!table.hasPlayer(userId)) return { ok: true };
  const result = table.standUp(userId);
  table.ensureOfficialGameRunning();
  broadcastState(io, roomId, table);
  if (!result.deferred) {
    io.to(roomId).emit('player_left', {
      seq: nextSeq(roomId),
      serverTs: Date.now(),
      payload: { userId },
    });
  }
  return { ok: true, deferred: result.deferred };
}

export async function leaveRoomFlow(opts: {
  io: Server;
  socket: Socket;
  table: InteractiveTable;
  roomId: string;
  userId: string;
}): Promise<void> {
  const { io, socket, table, roomId, userId } = opts;
  const wasSeated = table.hasPlayer(userId);
  if (wasSeated) {
    table.leaveSeat(userId);
  } else {
    table.removeSpectator(userId);
  }
  table.ensureOfficialGameRunning();
  await clearUserActiveRoom(Number(userId));
  socket.leave(roomId);
  broadcastState(io, roomId, table);
  if (wasSeated) {
    io.to(roomId).emit('player_left', {
      seq: nextSeq(roomId),
      serverTs: Date.now(),
      payload: { userId },
    });
  }
}

export async function resolveReconnectRoom(userId: string, roomId?: string): Promise<string | null> {
  if (roomId) return roomId;
  return getUserActiveRoom(Number(userId));
}

export function buildActionResultPayload(
  table: InteractiveTable,
  seatIndex: number,
  userId: string,
  actionType: ActionType,
  amount?: number,
  autoAction = false,
) {
  const seat = table.getPublicState(userId).seats.find((s) => s.seatIndex === seatIndex);
  return {
    seatIndex,
    userId,
    actionType,
    amount,
    chipsRemaining: seat?.chips ?? 0,
    potTotal: table.getPublicState().potTotal,
    autoAction,
  };
}
