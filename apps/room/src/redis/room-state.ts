import type { GamePhase, RoomType } from '@texas-holdem/shared';

export interface RoomStateSnapshot {
  roomId: string;
  roomType: RoomType;
  phase: GamePhase;
  maxSeats: number;
  blinds: { sb: number; bb: number };
  buyInCap: number;
  seats: unknown[];
  updatedAt: number;
}

export class RoomStateStore {
  constructor(private readonly redis: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    del(key: string): Promise<void>;
  }) {}

  private key(roomId: string): string {
    return `room:state:${roomId}`;
  }

  async get(roomId: string): Promise<RoomStateSnapshot | null> {
    const raw = await this.redis.get(this.key(roomId));
    if (!raw) return null;
    return JSON.parse(raw) as RoomStateSnapshot;
  }

  async set(state: RoomStateSnapshot): Promise<void> {
    await this.redis.set(this.key(state.roomId), JSON.stringify({ ...state, updatedAt: Date.now() }));
  }

  async delete(roomId: string): Promise<void> {
    await this.redis.del(this.key(roomId));
  }
}
