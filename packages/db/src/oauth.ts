import { createHash, randomBytes } from 'node:crypto';
import type { SupportedLocale } from '@texas-holdem/shared';
import { query, withTransaction } from './pool.js';
import type { UserRow } from './users.js';

export type OAuthProvider = 'APPLE' | 'GOOGLE';

const REGISTER_BONUS = 100;
const REFRESH_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Dev/sandbox: idToken format `dev:{provider}:{sub}` or `dev:{sub}` */
export async function verifyOAuthIdToken(
  provider: OAuthProvider,
  idToken: string,
): Promise<{ sub: string; email?: string } | null> {
  if (!idToken) return null;

  const devMode = process.env.OAUTH_DEV_MODE !== 'false';
  if (devMode && idToken.startsWith('dev:')) {
    const parts = idToken.split(':');
    const sub = parts.length >= 3 ? parts[2]! : parts[1]!;
    if (!sub) return null;
    return { sub: `${provider.toLowerCase()}_${sub}` };
  }

  if (!devMode) {
    const { verifyProviderIdToken } = await import('./oauth-verify.js');
    const verified = await verifyProviderIdToken(provider, idToken);
    if (!verified) return null;
    return {
      sub: `${provider.toLowerCase()}_${verified.sub}`,
      email: verified.email,
    };
  }

  if (idToken.length < 10) return null;
  return { sub: `${provider.toLowerCase()}_${createHash('sha256').update(idToken).digest('hex').slice(0, 16)}` };
}

export async function findUserByOAuth(
  provider: OAuthProvider,
  sub: string,
): Promise<UserRow | null> {
  const res = await query<UserRow>(
    `SELECT * FROM users WHERE oauth_provider = $1 AND oauth_sub = $2`,
    [provider, sub],
  );
  return res.rows[0] ?? null;
}

export async function loginOrRegisterOAuth(opts: {
  provider: OAuthProvider;
  sub: string;
  nickname: string;
  locale: SupportedLocale;
  linkGuestUserId?: number;
}): Promise<UserRow> {
  return withTransaction(async (client) => {
    const existing = await client.query<UserRow>(
      `SELECT * FROM users WHERE oauth_provider = $1 AND oauth_sub = $2 FOR UPDATE`,
      [opts.provider, opts.sub],
    );
    if (existing.rows[0]) return existing.rows[0];

    if (opts.linkGuestUserId) {
      const guest = await client.query<UserRow>(
        `SELECT * FROM users WHERE id = $1 AND account_type = 'GUEST' FOR UPDATE`,
        [opts.linkGuestUserId],
      );
      if (guest.rows[0] && !guest.rows[0].oauth_provider) {
        const updated = await client.query<UserRow>(
          `UPDATE users SET account_type = 'REGISTERED', oauth_provider = $1, oauth_sub = $2, nickname = $3
           WHERE id = $4 RETURNING *`,
          [opts.provider, opts.sub, opts.nickname, opts.linkGuestUserId],
        );
        return updated.rows[0];
      }
    }

    const userRes = await client.query<UserRow>(
      `INSERT INTO users (account_type, oauth_provider, oauth_sub, nickname, chips_balance, preferred_locale)
       VALUES ('REGISTERED', $1, $2, $3, 0, $4) RETURNING *`,
      [opts.provider, opts.sub, opts.nickname, opts.locale],
    );
    const user = userRes.rows[0];
    await client.query(
      `INSERT INTO chip_transactions (user_id, amount, balance_after, type, reference_id)
       VALUES ($1, $2, $2, 'EVENT_GIFT', 'REGISTER_BONUS')`,
      [user.id, REGISTER_BONUS],
    );
    await client.query(`UPDATE users SET chips_balance = $1 WHERE id = $2`, [REGISTER_BONUS, user.id]);
    const final = await client.query<UserRow>('SELECT * FROM users WHERE id = $1', [user.id]);
    return final.rows[0];
  });
}

export async function createRefreshSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const hash = hashToken(token);
  const expires = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO user_sessions (user_id, refresh_token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hash, expires],
  );
  return token;
}

export async function rotateRefreshSession(
  refreshToken: string,
): Promise<{ userId: number; newRefreshToken: string } | null> {
  const hash = hashToken(refreshToken);
  const res = await query<{ user_id: string; id: number }>(
    `SELECT user_id, id FROM user_sessions WHERE refresh_token_hash = $1 AND expires_at > NOW()`,
    [hash],
  );
  const row = res.rows[0];
  if (!row) return null;
  await query(`DELETE FROM user_sessions WHERE id = $1`, [row.id]);
  const newRefreshToken = await createRefreshSession(Number(row.user_id));
  return { userId: Number(row.user_id), newRefreshToken };
}

export async function revokeUserSessions(userId: number): Promise<void> {
  await query(`DELETE FROM user_sessions WHERE user_id = $1`, [userId]);
}
