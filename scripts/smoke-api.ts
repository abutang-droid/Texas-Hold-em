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

  console.log('3. Mock recharge');
  const recharge = await req<{ chipsBalance: number }>(
    '/api/v1/shop/mock-recharge',
    { method: 'POST', body: JSON.stringify({ amount: 50, requestId: `smoke-${Date.now()}` }) },
    login.token,
  );
  console.log('   balance:', recharge.chipsBalance);

  console.log('4. Quick start');
  const match = await req<{ roomId: string; wsUrl: string }>(
    '/api/v1/match/quick-start',
    { method: 'POST', body: JSON.stringify({}) },
    login.token,
  );
  console.log('   room:', match.roomId, match.wsUrl);

  console.log('5. Weekly leaderboard');
  const lb = await req<{ list: unknown[] }>('/api/v1/leaderboard/weekly-profit');
  console.log('   entries:', lb.list.length);

  console.log('\nSmoke test passed.');
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
