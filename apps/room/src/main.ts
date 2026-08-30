import { InteractiveTable, type TableConfig } from './game/interactive-table.js';
import {
  verifyAccessToken,
  buyInChips,
  findPrivateRoomByRoomId,
  findUserById,
  getRakeRate,
  findOfficialIpConflict,
  registerOfficialRoomIp,
  clearOfficialRoomIp,
} from '@texas-holdem/db';
import type { ActionType } from '@texas-holdem/poker-engine';
import { getTableEmoji, isValidTableEmojiId } from '@texas-holdem/shared';
import { createServer } from 'node:http';
import { getClientIp } from './client-ip.js';
import {
  broadcastState,
  cacheRequestResult,
  emitError,
  getCachedRequest,
  joinRoomFlow,
  leaveRoomFlow,
  nextSeq,
  resolveReconnectRoom,
  sitDownFlow,
  spectateRoomFlow,
  standUpFlow,
  wireTableHandlers,
} from './room-protocol.js';
import {
  registerPrivateHandlers,
  handleDissolveVoteStart,
  onPlayerJoinedPrivateRoom,
} from './register-private-handlers.js';
import type { Server, Socket } from 'socket.io';
import { Server as SocketServer } from 'socket.io';

const rooms = new Map<string, InteractiveTable>();
const roomConfigs = new Map<string, Partial<TableConfig>>();
const roomTicks = new Map<string, ReturnType<typeof setInterval>>();
const userRoom = new Map<string, string>();
const emojiCooldown = new Map<string, number>();

async function resolveTableConfig(roomId: string): Promise<Partial<TableConfig> | undefined> {
  if (!roomId.startsWith('P')) return undefined;
  const row = await findPrivateRoomByRoomId(roomId);
  if (!row) return undefined;
  const rakeRate = await getRakeRate('PRIVATE');
  return {
    roomType: 'PRIVATE',
    maxSeats: row.max_seats,
    smallBlind: Number(row.small_blind),
    bigBlind: Number(row.big_blind),
    buyInCap: Number(row.buy_in_cap),
    rakeRate,
    hostUserId: String(row.host_user_id),
  };
}

async function getOrCreateRoom(roomId: string, io: Server): Promise<InteractiveTable> {
  let table = rooms.get(roomId);
  if (!table) {
    let cfg = roomConfigs.get(roomId);
    if (!cfg) {
      cfg = await resolveTableConfig(roomId);
      if (!cfg && !roomId.startsWith('P')) {
        const rakeRate = await getRakeRate('OFFICIAL');
        cfg = { roomType: 'OFFICIAL', rakeRate };
      }
      if (cfg) roomConfigs.set(roomId, cfg);
    }
    table = new InteractiveTable(roomId, cfg);
    wireTableHandlers(table, io, roomId);
    rooms.set(roomId, table);
  }
  return table;
}

function ensureRoomTick(io: Server, roomId: string): void {
  if (roomTicks.has(roomId)) return;
  const interval = setInterval(() => {
    const table = rooms.get(roomId);
    if (!table) {
      clearInterval(interval);
      roomTicks.delete(roomId);
      return;
    }
    let safety = 0;
    let acted = false;
    while (safety < 20) {
      safety += 1;
      const result = table.tick();
      if (result === null) break;
      acted = true;
    }
    if (acted || table.hasPendingEvents()) {
      broadcastState(io, roomId, table);
    }
  }, 500);
  roomTicks.set(roomId, interval);
}

async function handleJoin(
  io: Server,
  socket: Socket,
  userId: string,
  nickname: string,
  msg: { roomId: string; buyInAmount?: number; requestId?: string },
): Promise<{ ok: boolean; seatIndex?: number; role?: 'spectator' | 'player'; error?: string }> {
  const cached = getCachedRequest<{ ok: boolean; seatIndex: number; role?: 'spectator' | 'player' }>(
    msg.requestId,
  );
  if (cached) return cached;

  const table = await getOrCreateRoom(msg.roomId, io);
  const cap = table.config.buyInCap;
  const actualBuyIn = Math.min(cap, Math.floor(msg.buyInAmount ?? cap));
  const userRow = await findUserById(Number(userId));
  const avatarUrl = userRow?.avatar_url ?? null;

  try {
    if (table.hasPlayer(userId) || table.config.roomType === 'PRIVATE') {
      const { seat, role } = await joinRoomFlow({
        io,
        socket,
        table,
        roomId: msg.roomId,
        userId,
        nickname,
        buyIn: actualBuyIn,
        avatarUrl,
        buyInFn: async () => {
          await buyInChips(Number(userId), actualBuyIn, `${msg.roomId}:${userId}:join:${Date.now()}`);
        },
      });
      userRoom.set(userId, msg.roomId);
      ensureRoomTick(io, msg.roomId);
      onPlayerJoinedPrivateRoom(msg.roomId, userId, table);
      const result = { ok: true as const, seatIndex: seat, role };
      cacheRequestResult(msg.requestId, result);
      return result;
    }

    const { seat, role } = await spectateRoomFlow({
      io,
      socket,
      table,
      roomId: msg.roomId,
      userId,
      nickname,
      avatarUrl,
    });
    userRoom.set(userId, msg.roomId);
    ensureRoomTick(io, msg.roomId);
    const result = { ok: true as const, seatIndex: seat, role };
    cacheRequestResult(msg.requestId, result);
    return result;
  } catch (e) {
    const message = (e as Error).message;
    const code =
      message === 'INSUFFICIENT_CHIPS'
        ? 'INSUFFICIENT_CHIPS'
        : message === 'ROOM_FULL'
          ? 'ROOM_FULL'
          : message === 'SEAT_TAKEN'
            ? 'SEAT_TAKEN'
            : message === 'IP_CONFLICT'
              ? 'IP_CONFLICT'
              : 'INVALID_ACTION';
    emitError(socket, code, msg.requestId);
    return { ok: false, error: message };
  }
}

async function guardOfficialSitIp(
  socket: Socket,
  table: InteractiveTable,
  roomId: string,
  userId: string,
  requestId?: string,
): Promise<{ ok: false; error: string } | null> {
  if (table.config.roomType !== 'OFFICIAL') return null;
  const clientIp = getClientIp(socket);
  try {
    const conflictUserId = await findOfficialIpConflict(roomId, clientIp, userId);
    if (conflictUserId) {
      if (table.hasPlayer(conflictUserId)) {
        emitError(socket, 'IP_CONFLICT', requestId, 'errors.ip_conflict');
        return { ok: false, error: 'IP_CONFLICT' };
      }
      await clearOfficialRoomIp(roomId, conflictUserId);
    }
    await registerOfficialRoomIp(roomId, userId, clientIp);
  } catch (err) {
    console.error('official IP check skipped:', err);
  }
  return null;
}

export function startRoomServer(port: number): void {
  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'room', version: '0.5.1' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const io = new SocketServer(httpServer, {
    cors: { origin: true },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('UNAUTHORIZED'));
    const payload = verifyAccessToken(token);
    if (!payload) return next(new Error('UNAUTHORIZED'));
    socket.data.userId = String(payload.sub);
    socket.data.nickname = payload.nickname;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    const nickname = socket.data.nickname as string;

    registerPrivateHandlers({ io, socket, userId, nickname, userRoom, rooms });

    socket.on(
      'join_room',
      async (msg: { roomId: string; buyInAmount?: number; requestId?: string }, ack?: (r: unknown) => void) => {
        const result = await handleJoin(io, socket, userId, nickname, msg);
        ack?.(result);
      },
    );

    socket.on(
      'reconnect_room',
      async (msg: { roomId?: string; requestId?: string }, ack?: (r: unknown) => void) => {
        const roomId = await resolveReconnectRoom(userId, msg.roomId);
        const existing = roomId ? rooms.get(roomId) : undefined;
        if (!roomId || !existing || !existing.isPresent(userId)) {
          emitError(socket, 'ROOM_NOT_FOUND', msg.requestId);
          ack?.({ ok: false, error: 'ROOM_NOT_FOUND' });
          return;
        }
        const result = await handleJoin(
          io,
          socket,
          userId,
          nickname,
          { roomId, buyInAmount: 0, requestId: msg.requestId },
        );
        ack?.(result);
      },
    );

    socket.on('leave_room', async (_msg: { requestId?: string } | undefined, ack?: (r: unknown) => void) => {
      const roomId = userRoom.get(userId);
      if (!roomId) {
        ack?.({ ok: true });
        return;
      }
      const table = rooms.get(roomId);
      if (!table) {
        ack?.({ ok: true });
        return;
      }
      try {
        await leaveRoomFlow({
          io,
          socket,
          table,
          roomId,
          userId,
        });
        userRoom.delete(userId);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: (e as Error).message });
      }
    });

    socket.on(
      'sit_out',
      (msg: { requestId?: string; sitOut?: boolean }, ack?: (r: unknown) => void) => {
        const roomId = userRoom.get(userId);
        const table = roomId ? rooms.get(roomId) : undefined;
        if (!roomId || !table) {
          emitError(socket, 'ROOM_NOT_FOUND', msg.requestId);
          ack?.({ ok: false });
          return;
        }
        if (msg.sitOut !== false) table.sitOutPlayer(userId);
        else table.resumePlayer(userId);
        broadcastState(io, roomId, table);
        ack?.({ ok: true });
      },
    );

    socket.on(
      'sit_down',
      async (
        msg: { requestId?: string; buyInAmount?: number; seatIndex?: number },
        ack?: (r: unknown) => void,
      ) => {
        const roomId = userRoom.get(userId);
        const table = roomId ? rooms.get(roomId) : undefined;
        if (!roomId || !table) {
          emitError(socket, 'ROOM_NOT_FOUND', msg.requestId);
          ack?.({ ok: false, error: 'ROOM_NOT_FOUND' });
          return;
        }
        if (table.hasPlayer(userId)) {
          ack?.({ ok: true, seatIndex: table.getPublicState(userId).mySeatIndex, nextHand: false });
          return;
        }
        const cap = table.config.buyInCap;
        const actualBuyIn = Math.min(cap, Math.floor(msg.buyInAmount ?? cap));
        const ipBlocked = await guardOfficialSitIp(socket, table, roomId, userId, msg.requestId);
        if (ipBlocked) {
          ack?.(ipBlocked);
          return;
        }
        try {
          const userRow = await findUserById(Number(userId));
          const result = await sitDownFlow({
            io,
            socket,
            table,
            roomId,
            userId,
            nickname,
            buyIn: actualBuyIn,
            avatarUrl: userRow?.avatar_url ?? null,
            seatIndex: msg.seatIndex,
            buyInFn: async () => {
              await buyInChips(Number(userId), actualBuyIn, `${roomId}:${userId}:sit:${Date.now()}`);
            },
          });
          ack?.({ ok: true, ...result });
        } catch (e) {
          const message = (e as Error).message;
          const code =
            message === 'INSUFFICIENT_CHIPS'
              ? 'INSUFFICIENT_CHIPS'
              : message === 'ROOM_FULL'
                ? 'ROOM_FULL'
                : message === 'SEAT_TAKEN'
                  ? 'SEAT_TAKEN'
                  : message === 'ALREADY_SEATED'
                    ? 'ALREADY_SEATED'
                    : 'INVALID_ACTION';
          emitError(socket, code, msg.requestId);
          ack?.({ ok: false, error: message });
        }
      },
    );

    socket.on('stand_up', async (msg: { requestId?: string } | undefined, ack?: (r: unknown) => void) => {
      const roomId = userRoom.get(userId);
      const table = roomId ? rooms.get(roomId) : undefined;
      if (!roomId || !table) {
        emitError(socket, 'ROOM_NOT_FOUND', msg?.requestId);
        ack?.({ ok: false, error: 'ROOM_NOT_FOUND' });
        return;
      }
      try {
        const result = await standUpFlow({ io, table, roomId, userId });
        ack?.(result);
      } catch (e) {
        const message = (e as Error).message || 'INVALID_ACTION';
        emitError(socket, 'INVALID_ACTION', msg?.requestId);
        ack?.({ ok: false, error: message });
      }
    });

    socket.on(
      'player_action',
      (msg: { actionType: ActionType; amount?: number; requestId?: string }) => {
        const cached = getCachedRequest(msg.requestId);
        if (cached) {
          socket.emit('action_result', cached);
          return;
        }

        const roomId = userRoom.get(userId);
        if (!roomId) return;
        const table = rooms.get(roomId);
        if (!table) return;
        const state = table.getPublicState(userId);
        const mySeat = state.seats.find((s) => s.userId === userId);
        if (!mySeat) return;
        try {
          table.act(mySeat.seatIndex, msg.actionType, msg.amount, false);
          broadcastState(io, roomId, table);
          cacheRequestResult(msg.requestId, { ok: true });
        } catch {
          emitError(socket, 'INVALID_ACTION', msg.requestId, 'errors.invalid_action');
        }
      },
    );

    socket.on(
      'send_emoji',
      (msg: { emojiId: string; requestId?: string }, ack?: (r: { ok: boolean }) => void) => {
        const roomId = userRoom.get(userId);
        const table = roomId ? rooms.get(roomId) : undefined;
        if (!roomId || !table) {
          emitError(socket, 'ROOM_NOT_FOUND', msg.requestId);
          ack?.({ ok: false });
          return;
        }
        if (table.config.roomType !== 'OFFICIAL') {
          emitError(socket, 'FORBIDDEN', msg.requestId, 'errors.emoji_official_only');
          ack?.({ ok: false });
          return;
        }
        if (!isValidTableEmojiId(msg.emojiId)) {
          emitError(socket, 'INVALID_EMOJI', msg.requestId);
          ack?.({ ok: false });
          return;
        }
        const now = Date.now();
        const last = emojiCooldown.get(userId) ?? 0;
        if (now - last < 3000) {
          emitError(socket, 'RATE_LIMIT', msg.requestId, 'errors.emoji_rate_limit');
          ack?.({ ok: false });
          return;
        }
        emojiCooldown.set(userId, now);

        const seat = table.getPublicState(userId).seats.find((s) => s.userId === userId);
        if (!seat) {
          ack?.({ ok: false });
          return;
        }
        const preset = getTableEmoji(msg.emojiId)!;
        io.to(roomId).emit('emoji_sent', {
          seq: nextSeq(roomId),
          serverTs: now,
          payload: {
            seatIndex: seat.seatIndex,
            userId,
            nickname: seat.nickname,
            emojiId: msg.emojiId,
            emoji: preset.emoji,
          },
        });
        ack?.({ ok: true });
      },
    );

    socket.on(
      'room_admin_action',
      (msg: { action: string; targetUserId?: string; requestId?: string }) => {
        const roomId = userRoom.get(userId);
        const table = roomId ? rooms.get(roomId) : undefined;
        if (!roomId || !table || table.getHostUserId() !== userId) {
          emitError(socket, 'FORBIDDEN', msg.requestId);
          return;
        }
        if (msg.action === 'kick' && msg.targetUserId) {
          table.markKickAfterHand(msg.targetUserId);
        } else if (msg.action === 'pause') {
          table.setPaused(true);
        } else if (msg.action === 'resume') {
          table.setPaused(false);
        } else if (msg.action === 'dissolve_vote') {
          handleDissolveVoteStart({ io, roomId, table, hostUserId: userId, userRoom });
        }
        broadcastState(io, roomId, table);
      },
    );

    socket.on('disconnect', () => {
      const roomId = userRoom.get(userId);
      if (!roomId) return;
      const table = rooms.get(roomId);
      table?.sitOutPlayer(userId);
      userRoom.delete(userId);
    });
  });

  httpServer.listen(port, () => {
    console.log(`Room server (Socket.io) listening on http://localhost:${port}`);
  });
}

const port = Number(process.env.ROOM_PORT ?? 3001);
startRoomServer(port);
