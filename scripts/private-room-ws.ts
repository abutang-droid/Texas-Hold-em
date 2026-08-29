/**
 * Private room WebSocket smoke — 2 players join, play one hand to hand_ended.
 *
 * Usage:
 *   API_URL=http://localhost:3000 ROOM_URL=http://localhost:3001 tsx scripts/private-room-ws.ts
 */
import { io, type Socket } from 'socket.io-client';

const API = process.env.API_URL ?? 'http://localhost:3000';
const ROOM = process.env.ROOM_URL ?? 'http://localhost:3001';

async function api<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json.data as T;
}

function connectRoom(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(ROOM, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => reject(e));
    setTimeout(() => reject(new Error('WS connect timeout')), 10000);
  });
}

function once<T>(socket: Socket, event: string, timeoutMs = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (msg: T) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });
}

function waitForActionTurn(
  sockets: Socket[],
  timeoutMs = 20000,
): Promise<{ socket: Socket; seatIndex: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      for (const { socket, handler } of handlers) socket.off('action_turn', handler);
      reject(new Error('Timeout waiting for action_turn'));
    }, timeoutMs);

    const handlers = sockets.map((socket) => {
      const handler = (msg: { payload: { seatIndex: number } }) => {
        clearTimeout(timer);
        for (const h of handlers) h.socket.off('action_turn', h.handler);
        resolve({ socket, seatIndex: msg.payload.seatIndex });
      };
      socket.on('action_turn', handler);
      return { socket, handler };
    });
  });
}

async function main() {
  console.log('1. Guest login x2');
  const a = await api<{ token: string; user: { id: number } }>('/api/v1/auth/guest', {
    nickname: 'WsHost',
  });
  const b = await api<{ token: string; user: { id: number } }>('/api/v1/auth/guest', {
    nickname: 'WsGuest',
  });

  console.log('2. Grant private permission');
  await api('/api/v1/private/grant-permission', { agreed: true }, a.token);

  console.log('3. Create private room');
  const room = await api<{ roomId: string; roomCode: string }>(
    '/api/v1/private/create-room',
    { maxSeats: 2, smallBlind: 1, bigBlind: 2, buyInCap: 100 },
    a.token,
  );
  console.log('   roomId:', room.roomId, 'code:', room.roomCode);

  console.log('4. Join room via API (guest)');
  await api('/api/v1/private/join-room', { roomCode: room.roomCode }, b.token);

  console.log('5. WebSocket connect');
  const hostSocket = await connectRoom(a.token);
  const guestSocket = await connectRoom(b.token);

  const join = (socket: Socket, buyIn: number) =>
    new Promise<void>((resolve, reject) => {
      socket.emit(
        'join_room',
        { roomId: room.roomId, buyInAmount: buyIn, requestId: `join-${Date.now()}` },
        (ack: { ok: boolean; error?: string }) => {
          if (ack?.ok) resolve();
          else reject(new Error(ack?.error ?? 'join failed'));
        },
      );
    });

  console.log('6. join_room host + guest');
  await join(hostSocket, 100);
  await join(guestSocket, 100);

  console.log('7. Wait for game_started on both sockets');
  const [startedA, startedB] = await Promise.all([
    once<{ payload: { handId: string } }>(hostSocket, 'game_started'),
    once<{ payload: { handId: string } }>(guestSocket, 'game_started'),
  ]);
  console.log('   host hand:', startedA.payload.handId);
  console.log('   guest hand:', startedB.payload.handId);

  console.log('8. Fold when action_turn arrives');
  const { socket: activeSocket } = await waitForActionTurn([hostSocket, guestSocket]);
  activeSocket.emit('player_action', {
    actionType: 'fold',
    requestId: `fold-${Date.now()}`,
  });

  console.log('9. Wait for hand_ended on both sockets');
  const [endedA, endedB] = await Promise.all([
    once<{ payload: { handId: string; winners: unknown[] } }>(hostSocket, 'hand_ended'),
    once<{ payload: { handId: string; winners: unknown[] } }>(guestSocket, 'hand_ended'),
  ]);
  console.log('   host winners:', endedA.payload.winners.length);
  console.log('   guest winners:', endedB.payload.winners.length);

  hostSocket.disconnect();
  guestSocket.disconnect();
  console.log('\n✓ Private room WS smoke passed (full hand)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
