import { createRiskAlert } from './reports.js';
import { query } from './pool.js';

export interface HandResultForRisk {
  roomId: string;
  roomType: 'OFFICIAL' | 'PRIVATE';
  buyInCap: number;
  results: Array<{ userId: string; profit: number; isBot: boolean }>;
}

/** Private room: single-hand loss >= 70% of buy-in cap to primary winner */
export async function checkHandForChipDumping(summary: HandResultForRisk): Promise<void> {
  if (summary.roomType !== 'PRIVATE') return;
  const threshold = summary.buyInCap * 0.7;
  const humans = summary.results.filter((r) => !r.isBot && Number.isFinite(Number(r.userId)));

  for (const loser of humans.filter((r) => r.profit < 0)) {
    const loss = -loser.profit;
    if (loss < threshold) continue;

    const winner = humans
      .filter((r) => r.profit > 0 && r.userId !== loser.userId)
      .sort((a, b) => b.profit - a.profit)[0];
    if (!winner || winner.profit < threshold * 0.5) continue;

    await createRiskAlert({
      alertType: 'CHIP_DUMPING_SUSPECT',
      userId: Number(loser.userId),
      roomId: summary.roomId,
      detail: {
        loserUserId: Number(loser.userId),
        winnerUserId: Number(winner.userId),
        handLoss: loss,
        winnerGain: winner.profit,
        buyInCap: summary.buyInCap,
      },
    });
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
