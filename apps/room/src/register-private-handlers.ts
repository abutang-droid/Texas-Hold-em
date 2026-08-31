import type { Server, Socket } from 'socket.io';
import {
  buyInChips,
  clearUserActiveRoom,
  setPrivateRoomStatusByRoomId,
} from '@texas-holdem/db';
import type { InteractiveTable } from './game/interactive-table.js';
import { broadcastState, emitError, nextSeq } from './room-protocol.js';
import {
  emitDissolveVoteUpdate,
  emitRebuyResult,
  getPrivateSession,
  notifyRebuyNeeded,
} from './private-session.js';

type UserRoomMap = Map<string, string>;
type RoomsMap = Map<string, InteractiveTable>;

export async function cashOutAllPlayers(
  table: InteractiveTable,
  _roomId: string,
): Promise<void> {
  for (const uid of [...table.getSeatedHumanUserIds()]) {
    if (!table.hasPlayer(uid)) continue;
    table.removePlayer(uid);
    await clearUserActiveRoom(Number(uid));
  }
}

async function dissolveRoom(
  io: Server,
  roomId: string,
  table: InteractiveTable,
  userRoom: UserRoomMap,
): Promise<void> {
  table.setPaused(true);
  await cashOutAllPlayers(table, roomId);
  await setPrivateRoomStatusByRoomId(roomId, 'DISSOLVED');
  for (const uid of [...userRoom.entries()]) {
    if (uid[1] === roomId) userRoom.delete(uid[0]);
  }
  io.to(roomId).emit('room_dissolved', {
    seq: nextSeq(roomId),
    serverTs: Date.now(),
    payload: { roomId },
  });
}

export function registerPrivateHandlers(opts: {
  io: Server;
  socket: Socket;
  userId: string;
  nickname: string;
  userRoom: UserRoomMap;
  rooms: RoomsMap;
}): void {
  const { io, socket, userId, nickname, userRoom, rooms } = opts;

  const trackHostPresence = (roomId: string, connected: boolean) => {
    const table = rooms.get(roomId);
    if (!table?.isPrivate() || table.getHostUserId() !== userId) return;
    getPrivateSession(roomId).markHostSeen(connected);
  };

  socket.on('disconnect', () => {
    const roomId = userRoom.get(userId);
    if (roomId) trackHostPresence(roomId, false);
  });

  socket.on(
    're_buy_request',
    async (msg: { requestId: string; amount: number }, ack?: (r: unknown) => void) => {
      const roomId = userRoom.get(userId);
      const table = roomId ? rooms.get(roomId) : undefined;
      if (!roomId || !table?.isPrivate()) {
        emitError(socket, 'FORBIDDEN', msg.requestId);
        ack?.({ ok: false });
        return;
      }

      const amount = Math.min(table.config.buyInCap, Math.floor(msg.amount));
      if (amount <= 0) {
        emitError(socket, 'INVALID_ACTION', msg.requestId);
        ack?.({ ok: false });
        return;
      }

      const session = getPrivateSession(roomId);
      const requestId = msg.requestId ?? `rebuy-${Date.now()}`;
      const req = session.addRebuyRequest(
        { requestId, userId, nickname, amount },
        (rid) => {
          emitRebuyResult(io, roomId, { requestId: rid, userId, approved: false });
        },
      );

      if (!req) {
        emitError(socket, 'FORBIDDEN', msg.requestId, 'errors.host_offline');
        ack?.({ ok: false, error: 'HOST_OFFLINE' });
        return;
      }

      notifyRebuyNeeded(io, roomId, req, nextSeq(roomId));
      ack?.({ ok: true, requestId });
    },
  );

  socket.on(
    're_buy_response',
    async (
      msg: { requestId: string; targetUserId: string; approved: boolean },
      ack?: (r: unknown) => void,
    ) => {
      const roomId = userRoom.get(userId);
      const table = roomId ? rooms.get(roomId) : undefined;
      if (!roomId || !table?.isPrivate() || table.getHostUserId() !== userId) {
        emitError(socket, 'FORBIDDEN', msg.requestId);
        ack?.({ ok: false });
        return;
      }

      const session = getPrivateSession(roomId);
      const rebuy = session.getRebuy(msg.requestId);
      if (!rebuy || rebuy.userId !== msg.targetUserId) {
        emitError(socket, 'INVALID_ACTION', msg.requestId);
        ack?.({ ok: false });
        return;
      }

      session.removeRebuy(msg.requestId);

      if (msg.approved) {
        try {
          await buyInChips(
            Number(rebuy.userId),
            rebuy.amount,
            `rebuy:${roomId}:${msg.requestId}`,
          );
          table.addChipsToPlayer(rebuy.userId, rebuy.amount);
          broadcastState(io, roomId, table);
        } catch {
          emitRebuyResult(io, roomId, {
            requestId: msg.requestId,
            userId: rebuy.userId,
            approved: false,
          });
          ack?.({ ok: false });
          return;
        }
      }

      emitRebuyResult(io, roomId, {
        requestId: msg.requestId,
        userId: rebuy.userId,
        approved: msg.approved,
        amount: msg.approved ? rebuy.amount : undefined,
      });
      ack?.({ ok: true });
    },
  );

  socket.on(
    'dissolve_vote_response',
    (msg: { requestId?: string; approved: boolean }, ack?: (r: unknown) => void) => {
      const roomId = userRoom.get(userId);
      const table = roomId ? rooms.get(roomId) : undefined;
      if (!roomId || !table?.isPrivate()) {
        emitError(socket, 'FORBIDDEN', msg.requestId);
        ack?.({ ok: false });
        return;
      }

      const session = getPrivateSession(roomId);
      session.castDissolveVote(userId, msg.approved, (approved) => {
        if (approved) void dissolveRoom(io, roomId, table, userRoom);
      });

      if (session.dissolveVote) {
        emitDissolveVoteUpdate(io, roomId, session.dissolveVote, table.getSeatedCount());
      }
      ack?.({ ok: true });
    },
  );
}

export function handleDissolveVoteStart(opts: {
  io: Server;
  roomId: string;
  table: InteractiveTable;
  hostUserId: string;
  userRoom: UserRoomMap;
}): void {
  const { io, roomId, table, hostUserId, userRoom } = opts;
  const seated = table.getSeatedHumanUserIds();

  if (seated.length <= 2) {
    void dissolveRoom(io, roomId, table, userRoom);
    return;
  }

  const session = getPrivateSession(roomId);
  const vote = session.startDissolveVote(hostUserId, seated, (approved) => {
    if (approved) void dissolveRoom(io, roomId, table, userRoom);
    else {
      io.to(roomId).emit('dissolve_vote_failed', {
        seq: nextSeq(roomId),
        serverTs: Date.now(),
        payload: { roomId, reason: 'TIMEOUT_OR_REJECTED' },
      });
    }
  });
  emitDissolveVoteUpdate(io, roomId, vote, table.getSeatedCount());
}

export function onPlayerJoinedPrivateRoom(roomId: string, userId: string, table: InteractiveTable): void {
  if (!table.isPrivate()) return;
  if (table.getHostUserId() === userId) {
    getPrivateSession(roomId).markHostSeen(true);
  }
}
