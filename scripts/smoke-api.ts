/**
 * API smoke test — requires PostgreSQL + Redis (docker compose up -d).
 * Usage: DATABASE_URL=... REDIS_URL=... JWT_SECRET=dev tsx scripts/smoke-api.ts
 */
const API = process.env.API_URL ?? 'http://localhost:3000';

async function req<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json.data as T;
}

async function main() {
  console.log('1. Health check');
  const health = await fetch(`${API}/health`);
  if (!health.ok) throw new Error('API not reachable');
  console.log('   OK', await health.json());

  console.log('2. Guest login');
  const login = await req<{ token: string; user: { chipsBalance: number } }>('/api/v1/auth/guest', {
    method: 'POST',
    body: JSON.stringify({ nickname: 'SmokeTest' }),
  });
  console.log('   chips:', login.user.chipsBalance);
  let token = login.token;

  console.log('2b. Age declaration');
  await req('/api/v1/user/age-declaration', {
    method: 'POST',
    body: JSON.stringify({ confirmed: true }),
  }, login.token);

  console.log('2c. OAuth dev login');
  const oauth = await req<{ token: string; user: { nickname: string } }>(
    '/api/v1/auth/oauth',
    {
      method: 'POST',
      body: JSON.stringify({ provider: 'GOOGLE', idToken: `dev:google:smoke-${Date.now()}` }),
    },
    token,
  );
  token = oauth.token;
  console.log('   oauth user:', oauth.user.nickname);

  console.log('3. Mock recharge');
  const recharge = await req<{ chipsBalance: number }>(
    '/api/v1/shop/mock-recharge',
    { method: 'POST', body: JSON.stringify({ amount: 50, requestId: `smoke-${Date.now()}` }) },
    token,
  );
  console.log('   balance:', recharge.chipsBalance, 'bonus:', (recharge as { bonusChips?: number }).bonusChips ?? 0);

  console.log('4. Quick start');
  const match = await req<{ roomId: string; wsUrl: string }>(
    '/api/v1/match/quick-start',
    { method: 'POST', body: JSON.stringify({}) },
    token,
  );
  console.log('   room:', match.roomId, match.wsUrl);

  console.log('5. Dual leaderboard');
  const lb = await req<{ profit: unknown[]; biggestPot: unknown[] }>('/api/v1/leaderboard');
  console.log('   profit:', lb.profit.length, 'biggest:', lb.biggestPot.length);

  console.log('\nSmoke test passed.');
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
