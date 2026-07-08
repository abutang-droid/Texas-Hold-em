import { createRiskAlert } from './reports.js';
import { getRedis } from './redis.js';
import { query } from './pool.js';

export interface HandResultForRisk {
  roomId: string;
  roomType: 'OFFICIAL' | 'PRIVATE';
  buyInCap: number;
  results: Array<{ userId: string; profit: number; isBot: boolean }>;
}

const ROLLING_WINDOW_SEC = 24 * 60 * 60;

/** Private room: single-hand loss >= 70% of buy-in cap to primary winner */
export async function checkHandForChipDumping(summary: HandResultForRisk): Promise<void> {
  if (summary.roomType !== 'PRIVATE') return;
  const threshold = summary.buyInCap * 0.7;
  const humans = summary.results.filter((r) => !r.isBot && Number.isFinite(Number(r.userId)));

  for (const loser of humans.filter((r) => r.profit < 0)) {
    const loss = -loser.profit;
    if (loss < threshold * 0.3) continue;

    const winner = humans
      .filter((r) => r.profit > 0 && r.userId !== loser.userId)
      .sort((a, b) => b.profit - a.profit)[0];
    if (!winner) continue;

    if (loss >= threshold) {
      await createRiskAlert({
        alertType: 'CHIP_DUMPING_SUSPECT',
        userId: Number(loser.userId),
        roomId: summary.roomId,
        detail: {
          kind: 'single_hand',
          loserUserId: Number(loser.userId),
          winnerUserId: Number(winner.userId),
          handLoss: loss,
          winnerGain: winner.profit,
          buyInCap: summary.buyInCap,
        },
      });
    }

    await checkRollingChipDumping({
      loserUserId: Number(loser.userId),
      winnerUserId: Number(winner.userId),
      roomId: summary.roomId,
      lossAmount: loss,
      threshold,
      buyInCap: summary.buyInCap,
    });
  }
}

async function checkRollingChipDumping(opts: {
  loserUserId: number;
  winnerUserId: number;
  roomId: string;
  lossAmount: number;
  threshold: number;
  buyInCap: number;
}): Promise<void> {
  const key = `risk:dump24h:${opts.loserUserId}:${opts.winnerUserId}`;
  const r = getRedis();
  const total = await r.incrby(key, opts.lossAmount);
  await r.expire(key, ROLLING_WINDOW_SEC);

  if (Number(total) >= opts.threshold) {
    await createRiskAlert({
      alertType: 'CHIP_DUMPING_24H',
      userId: opts.loserUserId,
      roomId: opts.roomId,
      detail: {
        kind: 'rolling_24h',
        loserUserId: opts.loserUserId,
        winnerUserId: opts.winnerUserId,
        rollingLoss: Number(total),
        buyInCap: opts.buyInCap,
        windowHours: 24,
      },
    });
    await r.del(key);
  }
}

export interface RiskAlertRow {
  id: number;
  alert_type: string;
  user_id: string | null;
  room_id: string | null;
  detail_json: unknown;
  created_at: Date;
}

export async function listRiskAlerts(limit = 50): Promise<RiskAlertRow[]> {
  const res = await query<RiskAlertRow>(
    `SELECT * FROM risk_alerts ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return res.rows;
}
