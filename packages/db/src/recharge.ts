import type { PoolClient } from 'pg';
import { query, withTransaction } from './pool.js';
import { addChips } from './users.js';
import { getSystemConfig } from './system-config.js';

export type RechargeChannel = 'MOCK' | 'APPLE_IAP' | 'GOOGLE_PLAY';

export interface RechargeResult {
  chipsBalance: number;
  amount: number;
  bonusChips: number;
  isFirstRecharge: boolean;
}

async function getDailyRechargeTotal(client: PoolClient, userId: number): Promise<number> {
  const res = await client.query<{ total: string }>(
    `SELECT COALESCE(total_chips, 0)::text AS total FROM daily_recharge_stats
     WHERE user_id = $1 AND stat_date = CURRENT_DATE`,
    [userId],
  );
  return Number(res.rows[0]?.total ?? 0);
}

async function addDailyRechargeTotal(
  client: PoolClient,
  userId: number,
  chips: number,
): Promise<void> {
  await client.query(
    `INSERT INTO daily_recharge_stats (user_id, stat_date, total_chips)
     VALUES ($1, CURRENT_DATE, $2)
     ON CONFLICT (user_id, stat_date) DO UPDATE
     SET total_chips = daily_recharge_stats.total_chips + EXCLUDED.total_chips`,
    [userId, chips],
  );
}

function verifySandboxReceipt(channel: RechargeChannel, receipt: string, amount: number): boolean {
  const prefix =
    channel === 'APPLE_IAP' ? 'sandbox:apple:' : channel === 'GOOGLE_PLAY' ? 'sandbox:google:' : '';
  if (!prefix) return true;
  return receipt.startsWith(prefix) && receipt.includes(String(amount));
}

export async function processRecharge(opts: {
  userId: number;
  channel: RechargeChannel;
  amount: number;
  requestId: string;
  receiptToken?: string;
  productId?: string;
  fiatAmountCents?: number;
}): Promise<RechargeResult> {
  const cfg = await getSystemConfig();
  const amount = Math.floor(opts.amount);
  if (!amount || amount <= 0) throw new Error('INVALID_AMOUNT');

  return withTransaction(async (client) => {
    const dup = await client.query(
      `SELECT id, status FROM recharge_orders WHERE reference_id = $1`,
      [opts.requestId],
    );
    if (dup.rows[0]?.status === 'COMPLETED') {
      const u = await client.query<{ chips_balance: string }>(
        'SELECT chips_balance FROM users WHERE id = $1',
        [opts.userId],
      );
      return {
        chipsBalance: Number(u.rows[0]?.chips_balance ?? 0),
        amount,
        bonusChips: 0,
        isFirstRecharge: false,
      };
    }

    const dailyTotal = await getDailyRechargeTotal(client, opts.userId);
    if (dailyTotal + amount > cfg.dailyRechargeLimit) {
      throw new Error('DAILY_LIMIT_EXCEEDED');
    }

    if (opts.channel !== 'MOCK') {
      const sandbox = process.env.IAP_SANDBOX_MODE !== 'false';
      if (sandbox) {
        if (!opts.receiptToken || !verifySandboxReceipt(opts.channel, opts.receiptToken, amount)) {
          throw new Error('INVALID_RECEIPT');
        }
      } else if (!opts.receiptToken) {
        throw new Error('INVALID_RECEIPT');
      }
    }

    const userRes = await client.query<{ has_completed_recharge: boolean }>(
      'SELECT has_completed_recharge FROM users WHERE id = $1 FOR UPDATE',
      [opts.userId],
    );
    const isFirst = !userRes.rows[0]?.has_completed_recharge;
    let bonus = 0;
    if (isFirst && cfg.firstRechargeBonusEnabled) {
      bonus = Math.floor((amount * cfg.firstRechargeBonusPct) / 100);
    }

    await client.query(
      `INSERT INTO recharge_orders (
        user_id, channel, amount_chips, bonus_chips, fiat_amount_cents,
        product_id, receipt_token, status, reference_id, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED', $8, NOW())
      ON CONFLICT (reference_id) DO UPDATE SET status = 'COMPLETED', completed_at = NOW()`,
      [
        opts.userId,
        opts.channel,
        amount,
        bonus,
        opts.fiatAmountCents ?? null,
        opts.productId ?? null,
        opts.receiptToken ?? null,
        opts.requestId,
      ],
    );

    await addChips(client, opts.userId, amount, 'RECHARGE', opts.requestId);
    if (bonus > 0) {
      await addChips(client, opts.userId, bonus, 'EVENT_GIFT', `${opts.requestId}:bonus`);
    }
    await addDailyRechargeTotal(client, opts.userId, amount);
    if (isFirst) {
      await client.query(`UPDATE users SET has_completed_recharge = TRUE WHERE id = $1`, [opts.userId]);
    }

    const bal = await client.query<{ chips_balance: string }>(
      'SELECT chips_balance FROM users WHERE id = $1',
      [opts.userId],
    );
    return {
      chipsBalance: Number(bal.rows[0]?.chips_balance ?? 0),
      amount,
      bonusChips: bonus,
      isFirstRecharge: isFirst && bonus > 0,
    };
  });
}

export interface ChipTransactionRow {
  id: number;
  amount: string;
  balance_after: string;
  type: string;
  reference_id: string;
  created_at: Date;
}

export async function listUserChipTransactions(
  userId: number,
  limit = 50,
): Promise<ChipTransactionRow[]> {
  const res = await query<ChipTransactionRow>(
    `SELECT id, amount, balance_after, type, reference_id, created_at
     FROM chip_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return res.rows;
}
