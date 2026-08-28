import type { PoolClient } from 'pg';
import { query, withTransaction } from './pool.js';
import { addChips } from './users.js';
import { getSystemConfig } from './system-config.js';
import { verifyIapPurchase } from './iap/verify.js';

import type { RechargeChannel } from './iap/types.js';

export type { RechargeChannel } from './iap/types.js';

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

async function findCompletedByReference(
  client: PoolClient,
  userId: number,
  requestId: string,
): Promise<RechargeResult | null> {
  const dup = await client.query(
    `SELECT id, status FROM recharge_orders WHERE reference_id = $1`,
    [requestId],
  );
  if (dup.rows[0]?.status !== 'COMPLETED') return null;
  const u = await client.query<{ chips_balance: string }>(
    'SELECT chips_balance FROM users WHERE id = $1',
    [userId],
  );
  const order = await client.query<{ amount_chips: string; bonus_chips: string }>(
    `SELECT amount_chips, bonus_chips FROM recharge_orders WHERE reference_id = $1`,
    [requestId],
  );
  return {
    chipsBalance: Number(u.rows[0]?.chips_balance ?? 0),
    amount: Number(order.rows[0]?.amount_chips ?? 0),
    bonusChips: Number(order.rows[0]?.bonus_chips ?? 0),
    isFirstRecharge: false,
  };
}

async function findCompletedByStoreTransaction(
  client: PoolClient,
  userId: number,
  storeTransactionId: string,
): Promise<RechargeResult | null> {
  const dup = await client.query<{ reference_id: string }>(
    `SELECT reference_id FROM recharge_orders
     WHERE store_transaction_id = $1 AND status = 'COMPLETED' LIMIT 1`,
    [storeTransactionId],
  );
  if (!dup.rows[0]) return null;
  return findCompletedByReference(client, userId, dup.rows[0].reference_id);
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
  let amount = Math.floor(opts.amount);
  let fiatAmountCents = opts.fiatAmountCents;
  let productId = opts.productId;
  let storeTransactionId: string | undefined;

  if (opts.channel === 'APPLE_IAP' || opts.channel === 'GOOGLE_PLAY') {
    if (!opts.productId || !opts.receiptToken) {
      throw new Error('INVALID_RECEIPT');
    }
    try {
      const verified = await verifyIapPurchase({
        channel: opts.channel,
        productId: opts.productId,
        receiptToken: opts.receiptToken,
      });
      amount = verified.chips;
      fiatAmountCents = verified.fiatAmountCents;
      productId = verified.productId;
      storeTransactionId = verified.transactionId;
    } catch (e) {
      const msg = (e as Error).message;
      if (
        msg === 'PRODUCT_NOT_FOUND' ||
        msg === 'APPLE_VERIFY_FAILED' ||
        msg === 'GOOGLE_VERIFY_FAILED' ||
        msg === 'INVALID_RECEIPT' ||
        msg === 'APPLE_CONFIG_MISSING' ||
        msg === 'GOOGLE_CONFIG_MISSING' ||
        msg === 'GOOGLE_AUTH_FAILED'
      ) {
        throw new Error('INVALID_RECEIPT');
      }
      throw e;
    }
  } else if (!amount || amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }

  return withTransaction(async (client) => {
    const byRef = await findCompletedByReference(client, opts.userId, opts.requestId);
    if (byRef) return byRef;

    if (storeTransactionId) {
      const byStore = await findCompletedByStoreTransaction(
        client,
        opts.userId,
        storeTransactionId,
      );
      if (byStore) return byStore;
    }

    const dailyTotal = await getDailyRechargeTotal(client, opts.userId);
    if (dailyTotal + amount > cfg.dailyRechargeLimit) {
      throw new Error('DAILY_LIMIT_EXCEEDED');
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
        product_id, receipt_token, store_transaction_id, status, reference_id, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'COMPLETED', $9, NOW())
      ON CONFLICT (reference_id) DO UPDATE SET
        status = 'COMPLETED',
        completed_at = NOW(),
        store_transaction_id = COALESCE(recharge_orders.store_transaction_id, EXCLUDED.store_transaction_id)`,
      [
        opts.userId,
        opts.channel,
        amount,
        bonus,
        fiatAmountCents ?? null,
        productId ?? null,
        opts.receiptToken ?? null,
        storeTransactionId ?? null,
        opts.requestId,
      ],
    );

    await addChips(client, opts.userId, amount, 'RECHARGE', opts.requestId);
    if (bonus > 0) {
      await addChips(client, opts.userId, bonus, 'EVENT_GIFT', `${opts.requestId}:bonus`);
    }
    await addDailyRechargeTotal(client, opts.userId, amount);
    if (isFirst) {
      await client.query(`UPDATE users SET has_completed_recharge = TRUE WHERE id = $1`, [
        opts.userId,
      ]);
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
