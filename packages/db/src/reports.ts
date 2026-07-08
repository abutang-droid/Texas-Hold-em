import { query } from './pool.js';

export interface ReportRow {
  id: number;
  reporter_user_id: string;
  reported_user_id: string | null;
  room_id: string | null;
  hand_id: string | null;
  category: string;
  description: string | null;
  status: string;
  created_at: Date;
}

export async function createReport(input: {
  reporterUserId: number;
  reportedUserId?: number;
  roomId?: string;
  handId?: string;
  category: string;
  description?: string;
}): Promise<ReportRow> {
  const res = await query<ReportRow>(
    `INSERT INTO report_tickets (reporter_user_id, reported_user_id, room_id, hand_id, category, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.reporterUserId,
      input.reportedUserId ?? null,
      input.roomId ?? null,
      input.handId ?? null,
      input.category,
      input.description ?? null,
    ],
  );
  return res.rows[0];
}

export async function listReports(limit = 50): Promise<ReportRow[]> {
  const res = await query<ReportRow>(
    `SELECT * FROM report_tickets ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return res.rows;
}

export async function updateReportStatus(id: number, status: string): Promise<ReportRow | null> {
  const res = await query<ReportRow>(
    `UPDATE report_tickets SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id],
  );
  return res.rows[0] ?? null;
}

export async function createRiskAlert(input: {
  alertType: string;
  userId?: number;
  roomId?: string;
  detail: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO risk_alerts (alert_type, user_id, room_id, detail_json) VALUES ($1, $2, $3, $4)`,
    [input.alertType, input.userId ?? null, input.roomId ?? null, JSON.stringify(input.detail)],
  );
}
