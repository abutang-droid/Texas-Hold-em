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
} from '@texas-holdem/db';
import type { ActionType } from '@texas-holdem/poker-engine';
import type { HandEndSummary, InteractiveTable } from './game/interactive-table.js';

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
  table.setGameStartedHandler((info) => {
    io.to(roomId).emit('game_started', {
      seq: nextSeq(roomId),
      serverTs: Date.now(),
      payload: {
        handId: info.handId,
        buttonSeat: info.buttonSeat,
        sbSeat: info.sbSeat,
        bbSeat: info.bbSeat,
        blindsPosted: { sb: 1, bb: 2 },
      },
    });
  });

  table.setHandEndHandler((summary) => {
    void persistHandEnd(summary).catch((err) => console.error('hand persist failed', err));
    io.to(roomId).emit('hand_ended', {
      seq: nextSeq(roomId),
      serverTs: Date.now(),
      payload: { handId: summary.handId, nextHandIn: 3000 },
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

export async function joinRoomFlow(opts: {
  io: Server;
  socket: Socket;
  table: InteractiveTable;
  roomId: string;
  userId: string;
  nickname: string;
  buyIn: number;
  buyInFn: () => Promise<void>;
}): Promise<{ seat: number }> {
  const { io, socket, table, roomId, userId, nickname, buyIn, buyInFn } = opts;
  let seat: number;
  let isNewPlayer = false;

  if (table.hasPlayer(userId)) {
    table.resumePlayer(userId);
    seat = table.getPublicState(userId).seats.find((s) => s.userId === userId)?.seatIndex ?? 0;
  } else {
    isNewPlayer = true;
    await buyInFn();
    seat = table.addPlayer(userId, nickname, buyIn, false);
  }

  await setUserActiveRoom(Number(userId), roomId);
  socket.join(roomId);

  const seq = nextSeq(roomId);
  const serverTs = Date.now();
  const payload = table.getPublicState(userId);
  socket.emit('room_state_sync', { seq, serverTs, payload });
  emitActionTurnIfNeeded(socket, table, seq, serverTs, userId);

  if (isNewPlayer) {
    io.to(roomId).emit('player_joined', {
      seq: nextSeq(roomId),
      serverTs: Date.now(),
      payload: { seatIndex: seat, userId, nickname, chips: buyIn, isBot: false },
    });
  }

  return { seat };
}

export async function leaveRoomFlow(opts: {
  io: Server;
  socket: Socket;
  table: InteractiveTable;
  roomId: string;
  userId: string;
  cashOutFn: (chips: number) => Promise<void>;
}): Promise<void> {
  const { io, socket, table, roomId, userId, cashOutFn } = opts;
  if (!table.hasPlayer(userId)) return;
  const chips = table.removePlayer(userId);
  await cashOutFn(chips);
  await clearUserActiveRoom(Number(userId));
  socket.leave(roomId);
  broadcastState(io, roomId, table);
  io.to(roomId).emit('player_left', {
    seq: nextSeq(roomId),
    serverTs: Date.now(),
    payload: { userId },
  });
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
