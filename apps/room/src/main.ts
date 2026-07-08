import { InteractiveTable } from './game/interactive-table.js';
import {
  verifyAccessToken,
  buyInChips,
  cashOutChips,
} from '@texas-holdem/db';
import type { ActionType } from '@texas-holdem/poker-engine';
import { createServer } from 'node:http';
import {
  broadcastState,
  buildActionResultPayload,
  cacheRequestResult,
  emitError,
  getCachedRequest,
  joinRoomFlow,
  leaveRoomFlow,
  resolveReconnectRoom,
  wireTableHandlers,
} from './room-protocol.js';
import type { Server, Socket } from 'socket.io';
import { Server as SocketServer } from 'socket.io';

const rooms = new Map<string, InteractiveTable>();
const roomTicks = new Map<string, ReturnType<typeof setInterval>>();
const userRoom = new Map<string, string>();

function getOrCreateRoom(roomId: string, io: Server): InteractiveTable {
  let table = rooms.get(roomId);
  if (!table) {
    table = new InteractiveTable(roomId);
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
    while (safety < 20) {
      safety += 1;
      const acted = table.tick();
      if (acted === null) break;
    }
    broadcastState(io, roomId, table);
  }, 500);
  roomTicks.set(roomId, interval);
}

async function handleJoin(
  io: Server,
  socket: Socket,
  userId: string,
  nickname: string,
  msg: { roomId: string; buyInAmount?: number; requestId?: string },
): Promise<{ ok: boolean; seatIndex?: number; error?: string }> {
  const cached = getCachedRequest<{ ok: boolean; seatIndex: number }>(msg.requestId);
  if (cached) return cached;

  const buyIn = Math.min(100, Math.floor(msg.buyInAmount ?? 100));
  const table = getOrCreateRoom(msg.roomId, io);

  try {
    const { seat } = await joinRoomFlow({
      io,
      socket,
      table,
      roomId: msg.roomId,
      userId,
      nickname,
      buyIn,
      buyInFn: async () => {
        await buyInChips(Number(userId), buyIn, `${msg.roomId}:${userId}`);
      },
    });
    userRoom.set(userId, msg.roomId);
    ensureRoomTick(io, msg.roomId);
    const result = { ok: true as const, seatIndex: seat };
    cacheRequestResult(msg.requestId, result);
    return result;
  } catch (e) {
    const message = (e as Error).message;
    const code =
      message === 'INSUFFICIENT_CHIPS'
        ? 'INSUFFICIENT_CHIPS'
        : message === 'ROOM_FULL'
          ? 'ROOM_FULL'
          : 'INVALID_ACTION';
    emitError(socket, code, msg.requestId);
    return { ok: false, error: message };
  }
}

export function startRoomServer(port: number): void {
  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'room', version: '0.2.1' }));
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
        if (!roomId || !rooms.get(roomId)?.hasPlayer(userId)) {
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
          cashOutFn: async (chips) => {
            await cashOutChips(Number(userId), chips, `${roomId}:${userId}:leave`);
          },
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
          table.act(mySeat.seatIndex, msg.actionType, msg.amount);
          const payload = buildActionResultPayload(
            table,
            mySeat.seatIndex,
            userId,
            msg.actionType,
            msg.amount,
          );
          const envelope = { payload };
          io.to(roomId).emit('action_result', envelope);
          cacheRequestResult(msg.requestId, envelope);

          let safety = 0;
          while (safety < 20) {
            safety += 1;
            const acted = table.tick();
            if (acted === null) break;
          }
          broadcastState(io, roomId, table);
        } catch {
          emitError(socket, 'INVALID_ACTION', msg.requestId, 'errors.invalid_action');
        }
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
