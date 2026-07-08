import type { Server } from 'socket.io';

const REBUY_TIMEOUT_MS = 60_000;
const DISSOLVE_TIMEOUT_MS = 60_000;
const HOST_OFFLINE_MS = 5 * 60_000;

export interface RebuyRequest {
  requestId: string;
  userId: string;
  nickname: string;
  amount: number;
  createdAt: number;
  deadline: number;
  timer: ReturnType<typeof setTimeout>;
}

export interface DissolveVote {
  initiatedBy: string;
  deadline: number;
  votes: Map<string, boolean>;
  requiredApprovals: number;
  timer: ReturnType<typeof setTimeout>;
}

export class PrivateRoomSession {
  hostLastSeen = Date.now();
  hostSocketConnected = false;
  private rebuyRequests = new Map<string, RebuyRequest>();
  dissolveVote: DissolveVote | null = null;

  markHostSeen(connected: boolean): void {
    this.hostLastSeen = Date.now();
    this.hostSocketConnected = connected;
  }

  isHostAvailable(): boolean {
    return this.hostSocketConnected && Date.now() - this.hostLastSeen < HOST_OFFLINE_MS;
  }

  addRebuyRequest(
    req: Omit<RebuyRequest, 'timer' | 'deadline' | 'createdAt'>,
    onTimeout: (requestId: string) => void,
  ): RebuyRequest | null {
    if (!this.isHostAvailable()) return null;
    const createdAt = Date.now();
    const deadline = createdAt + REBUY_TIMEOUT_MS;
    const timer = setTimeout(() => {
      this.rebuyRequests.delete(req.requestId);
      onTimeout(req.requestId);
    }, REBUY_TIMEOUT_MS);
    const full: RebuyRequest = { ...req, createdAt, deadline, timer };
    this.rebuyRequests.set(req.requestId, full);
    return full;
  }

  getRebuy(requestId: string): RebuyRequest | undefined {
    return this.rebuyRequests.get(requestId);
  }

  removeRebuy(requestId: string): void {
    const r = this.rebuyRequests.get(requestId);
    if (r) clearTimeout(r.timer);
    this.rebuyRequests.delete(requestId);
  }

  startDissolveVote(
    initiatedBy: string,
    seatedHumanIds: string[],
    onComplete: (approved: boolean) => void,
  ): DissolveVote {
    if (this.dissolveVote) clearTimeout(this.dissolveVote.timer);
    const requiredApprovals = Math.ceil((seatedHumanIds.length * 2) / 3);
    const votes = new Map<string, boolean>();
    votes.set(initiatedBy, true);

    const timer = setTimeout(() => {
      const approved = this.countApprovals(votes) >= requiredApprovals;
      this.dissolveVote = null;
      onComplete(approved);
    }, DISSOLVE_TIMEOUT_MS);

    this.dissolveVote = {
      initiatedBy,
      deadline: Date.now() + DISSOLVE_TIMEOUT_MS,
      votes,
      requiredApprovals,
      timer,
    };
    return this.dissolveVote;
  }

  castDissolveVote(userId: string, approved: boolean, onComplete: (approved: boolean) => void): void {
    if (!this.dissolveVote) return;
    this.dissolveVote.votes.set(userId, approved);
    if (this.countApprovals(this.dissolveVote.votes) >= this.dissolveVote.requiredApprovals) {
      clearTimeout(this.dissolveVote.timer);
      this.dissolveVote = null;
      onComplete(true);
    }
  }

  private countApprovals(votes: Map<string, boolean>): number {
    let n = 0;
    for (const v of votes.values()) if (v) n += 1;
    return n;
  }
}

const sessions = new Map<string, PrivateRoomSession>();

export function getPrivateSession(roomId: string): PrivateRoomSession {
  let s = sessions.get(roomId);
  if (!s) {
    s = new PrivateRoomSession();
    sessions.set(roomId, s);
  }
  return s;
}

export function notifyRebuyNeeded(
  io: Server,
  roomId: string,
  req: RebuyRequest,
  seq: number,
): void {
  io.to(roomId).emit('re_buy_approval_needed', {
    seq,
    serverTs: Date.now(),
    payload: {
      requestId: req.requestId,
      userId: req.userId,
      nickname: req.nickname,
      amount: req.amount,
      deadline: req.deadline,
    },
  });
}

export function emitRebuyResult(
  io: Server,
  roomId: string,
  payload: { requestId: string; userId: string; approved: boolean; amount?: number },
): void {
  io.to(roomId).emit('re_buy_result', {
    seq: Date.now(),
    serverTs: Date.now(),
    payload,
  });
}

export function emitDissolveVoteUpdate(
  io: Server,
  roomId: string,
  vote: DissolveVote,
  seatedCount: number,
): void {
  io.to(roomId).emit('dissolve_vote_update', {
    seq: Date.now(),
    serverTs: Date.now(),
    payload: {
      initiatedBy: vote.initiatedBy,
      deadline: vote.deadline,
      requiredApprovals: vote.requiredApprovals,
      currentApprovals: [...vote.votes.values()].filter(Boolean).length,
      seatedCount,
    },
  });
}
