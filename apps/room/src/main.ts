import { InteractiveTable } from './game/interactive-table.js';
import {
  verifyAccessToken,
  buyInChips,
  cashOutChips,
  recordHandExp,
  addWeeklyProfit,
} from '@texas-holdem/db';
import type { ActionType } from '@texas-holdem/poker-engine';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const rooms = new Map<string, InteractiveTable>();
const roomTicks = new Map<string, ReturnType<typeof setInterval>>();
const userRoom = new Map<string, string>();

function getOrCreateRoom(roomId: string): InteractiveTable {
  let table = rooms.get(roomId);
  if (!table) {
    table = new InteractiveTable(roomId);
    table.setHandEndHandler((results) => {
      void (async () => {
        for (const r of results) {
          if (r.isBot) continue;
          const uid = Number(r.userId);
          if (!Number.isFinite(uid)) continue;
          if (r.profit !== 0) await addWeeklyProfit(uid, r.profit);
          await recordHandExp(uid, 10);
        }
      })().catch((err) => console.error('hand end sync failed', err));
    });
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

function broadcastState(io: Server, roomId: string, table: InteractiveTable): void {
  const sockets = io.sockets.adapter.rooms.get(roomId);
  if (!sockets) return;
  for (const sid of sockets) {
    const s = io.sockets.sockets.get(sid);
    const userId = s?.data.userId as string | undefined;
    s?.emit('room_state_sync', {
      seq: Date.now(),
      serverTs: Date.now(),
      payload: table.getPublicState(userId),
    });
  }
}

async function leaveTable(
  io: Server,
  userId: string,
  socketId?: string,
): Promise<void> {
  const roomId = userRoom.get(userId);
  if (!roomId) return;
  const table = rooms.get(roomId);
  if (!table || !table.hasPlayer(userId)) {
    userRoom.delete(userId);
    return;
  }
  try {
    const chips = table.removePlayer(userId);
    await cashOutChips(Number(userId), chips, `${roomId}:${userId}:leave`);
  } catch (err) {
    console.error('cash out failed', err);
  }
  userRoom.delete(userId);
  const s = socketId ? io.sockets.sockets.get(socketId) : undefined;
  s?.leave(roomId);
  broadcastState(io, roomId, table);
  io.to(roomId).emit('player_left', { payload: { userId } });
}

export function startRoomServer(port: number): void {
  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'room', version: '0.2.0' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const io = new Server(httpServer, {
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
      async (msg: { roomId: string; buyInAmount?: number }, ack?: (r: unknown) => void) => {
        try {
          const table = getOrCreateRoom(msg.roomId);
          const buyIn = Math.min(100, Math.floor(msg.buyInAmount ?? 100));
          let seat: number;

          if (table.hasPlayer(userId)) {
            table.resumePlayer(userId);
            seat = table.getPublicState(userId).seats.find((s) => s.userId === userId)?.seatIndex ?? 0;
          } else {
            await buyInChips(Number(userId), buyIn, `${msg.roomId}:${userId}`);
            seat = table.addPlayer(userId, nickname, buyIn, false);
          }

          userRoom.set(userId, msg.roomId);
          socket.join(msg.roomId);
          ensureRoomTick(io, msg.roomId);

          const payload = table.getPublicState(userId);
          socket.emit('room_state_sync', { seq: 1, serverTs: Date.now(), payload });
          io.to(msg.roomId).emit('player_joined', {
            payload: { seatIndex: seat, userId, nickname, chips: buyIn, isBot: false },
          });
          ack?.({ ok: true, seatIndex: seat });
        } catch (e) {
          const message = (e as Error).message;
          ack?.({ ok: false, error: message });
        }
      },
    );

    socket.on('leave_room', async (ack?: (r: unknown) => void) => {
      await leaveTable(io, userId, socket.id);
      ack?.({ ok: true });
    });

    socket.on('player_action', (msg: { actionType: ActionType; amount?: number }) => {
      const roomId = userRoom.get(userId);
      if (!roomId) return;
      const table = rooms.get(roomId);
      if (!table) return;
      const state = table.getPublicState(userId);
      const mySeat = state.seats.find((s) => s.userId === userId);
      if (!mySeat) return;
      try {
        table.act(mySeat.seatIndex, msg.actionType, msg.amount);
        io.to(roomId).emit('action_result', {
          payload: {
            seatIndex: mySeat.seatIndex,
            userId,
            actionType: msg.actionType,
            amount: msg.amount,
          },
        });
        let safety = 0;
        while (safety < 20) {
          safety += 1;
          const acted = table.tick();
          if (acted === null) break;
        }
        broadcastState(io, roomId, table);
      } catch {
        socket.emit('error', { code: 'INVALID_ACTION', messageKey: 'errors.invalid_action' });
      }
    });

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
