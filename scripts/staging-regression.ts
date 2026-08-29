/**
 * Staging full regression (API layer) — official / private / shop / auth
 *
 * Mac against Staging:
 *   bash scripts/staging-regression.sh
 *
 * Or:
 *   API_URL=http://192.168.31.53:3000 ROOM_URL=http://192.168.31.53:3001 \
 *     pnpm staging:regression
 */
const API = process.env.API_URL ?? 'http://localhost:3000';
const ROOM = process.env.ROOM_URL ?? 'http://localhost:3001';

type Result = { name: string; ok: boolean; detail?: string };

const results: Result[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.log(`  ✗ ${name} — ${detail}`);
}

async function req<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`${path} invalid JSON (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(`${path} ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json.data as T;
}

async function section(title: string, fn: () => Promise<void>) {
  console.log(`\n=== ${title} ===`);
  try {
    await fn();
  } catch (e) {
    fail(title, (e as Error).message);
  }
}

async function main() {
  console.log('Texas Hold\'em · Staging Regression');
  console.log(`API:  ${API}`);
  console.log(`Room: ${ROOM}`);

  let token = '';
  let roomCode = '';
  let hostToken = '';

  await section('Infrastructure', async () => {
    const apiHealth = await fetch(`${API}/health`);
    if (!apiHealth.ok) throw new Error(`API health ${apiHealth.status}`);
    const apiJson = await apiHealth.json();
    pass('API health', JSON.stringify(apiJson));

    const roomHealth = await fetch(`${ROOM}/health`);
    if (!roomHealth.ok) throw new Error(`Room health ${roomHealth.status}`);
    const roomJson = await roomHealth.json();
    pass('Room health', JSON.stringify(roomJson));
  });

  await section('Auth (email)', async () => {
    const email = `regression-${Date.now()}@example.com`;
    const password = 'regresspass8';

    const reg = await req<{ token: string; user: { chipsBalance: number; nickname: string } }>(
      '/api/v1/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, nickname: 'Regression' }),
      },
    );
    if (reg.user.chipsBalance < 100) throw new Error(`expected >=100 chips, got ${reg.user.chipsBalance}`);
    pass('Email register', `chips=${reg.user.chipsBalance}`);
    token = reg.token;

    const login = await req<{ token: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    token = login.token;
    pass('Email login');

    await req('/api/v1/user/age-declaration', {
      method: 'POST',
      body: JSON.stringify({ confirmed: true }),
    }, token);
    pass('Age declaration');

    const profile = await req<{ chipsBalance: number; nickname: string }>('/api/v1/user/profile', {}, token);
    pass('User profile', `${profile.nickname} balance=${profile.chipsBalance}`);
  });

  await section('Shop', async () => {
    const catalog = await req<{
      products: Array<{ id: string; chips: number }>;
      iapSandboxMode: boolean;
    }>('/api/v1/shop/products', {}, token);
    if (!catalog.products.length) throw new Error('no products');
    pass('Shop products', `${catalog.products.length} items, sandbox=${catalog.iapSandboxMode}`);

    const mock = await req<{ chipsBalance: number }>(
      '/api/v1/shop/mock-recharge',
      { method: 'POST', body: JSON.stringify({ amount: 100, requestId: `reg-${Date.now()}` }) },
      token,
    );
    if (mock.chipsBalance < 100) throw new Error('mock recharge failed');
    pass('Mock recharge', `balance=${mock.chipsBalance}`);

    const product = catalog.products[0]!;
    const iap = await req<{ chipsBalance: number }>(
      '/api/v1/shop/recharge',
      {
        method: 'POST',
        body: JSON.stringify({
          channel: 'APPLE_IAP',
          productId: product.id,
          requestId: `iap-reg-${Date.now()}`,
          receiptToken: `sandbox:apple:${product.id}`,
        }),
      },
      token,
    );
    pass('IAP sandbox recharge', `balance=${iap.chipsBalance}`);
  });

  await section('Profile & avatars', async () => {
    const presets = await req<{ presets: Array<{ id: string }> }>(
      '/api/v1/user/avatar-presets',
      {},
      token,
    );
    if (!presets.presets.length) throw new Error('no avatar presets');
    pass('Avatar presets', `${presets.presets.length} presets`);

    const updated = await req<{ nickname: string; avatarUrl: string | null }>(
      '/api/v1/user/profile',
      {
        method: 'PATCH',
        body: JSON.stringify({ nickname: 'RegressUser', avatarUrl: 'preset:spade' }),
      },
      token,
    );
    if (updated.avatarUrl !== 'preset:spade') throw new Error('avatar update failed');
    pass('Profile update', `nick=${updated.nickname}`);
  });

  await section('Official table (API)', async () => {
    const match = await req<{ roomId: string; wsUrl: string; buyInCap: number }>(
      '/api/v1/match/quick-start',
      { method: 'POST', body: JSON.stringify({}) },
      token,
    );
    if (!/^R\d+/.test(match.roomId)) throw new Error(`unexpected official roomId ${match.roomId}`);
    pass('Quick start', `room=${match.roomId} cap=${match.buyInCap}`);

    const lb = await req<{ profit: unknown[]; biggestPot: unknown[] }>('/api/v1/leaderboard');
    pass('Dual leaderboard', `profit=${lb.profit.length} biggest=${lb.biggestPot.length}`);
  });

  await section('Private room (API)', async () => {
    hostToken = token;

    const permBefore = await req<{ hasPermission: boolean; fee: number }>(
      '/api/v1/private/permission',
      {},
      hostToken,
    );
    pass('Private permission check', `has=${permBefore.hasPermission} fee=${permBefore.fee}`);

    if (!permBefore.hasPermission) {
      await req('/api/v1/private/grant-permission', {
        method: 'POST',
        body: JSON.stringify({ agreed: true }),
      }, hostToken);
      pass('Grant private permission', 'fee deducted');
    } else {
      pass('Grant private permission', 'already granted');
    }

    const created = await req<{
      roomCode: string;
      roomId: string;
      deepLink: string;
      buyInCap: number;
    }>(
      '/api/v1/private/create-room',
      {
        method: 'POST',
        body: JSON.stringify({ maxSeats: 6, smallBlind: 5, bigBlind: 10, buyInCap: 500 }),
      },
      hostToken,
    );
    if (!created.roomCode || created.roomCode.length !== 6) {
      throw new Error(`invalid room code ${created.roomCode}`);
    }
    roomCode = created.roomCode;
    pass('Create private room', `code=${roomCode} id=${created.roomId}`);

    const guestEmail = `guest-${Date.now()}@example.com`;
    const guest = await req<{ token: string }>(
      '/api/v1/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          email: guestEmail,
          password: 'regresspass8',
          nickname: 'GuestJoin',
        }),
      },
    );
    await req('/api/v1/user/age-declaration', {
      method: 'POST',
      body: JSON.stringify({ confirmed: true }),
    }, guest.token);

    const joined = await req<{ roomId: string; roomCode: string }>(
      '/api/v1/private/join-room',
      { method: 'POST', body: JSON.stringify({ roomCode }) },
      guest.token,
    );
    if (joined.roomCode !== roomCode) throw new Error('join room code mismatch');
    pass('Join private room', `room=${joined.roomId}`);
  });

  console.log('\n========================================');
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);
  console.log(`PASSED: ${passed.length}  FAILED: ${failed.length}`);

  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }

  console.log('\nAPI regression OK.');
  console.log('\n--- Manual UI checklist (Mac Web) ---');
  console.log('  [ ] Login / register screen');
  console.log('  [ ] Lobby balance + quick start → play one hand');
  console.log('  [ ] Shop mock recharge updates balance');
  console.log('  [ ] Private room create + share + join via code');
  console.log(`  [ ] Deep link texasholdem://room/${roomCode || 'XXXXXX'} (device only)`);
  console.log('  [ ] Showdown overlay no flicker');
  console.log('  [ ] Admin http://192.168.31.53:5173 users/hands/economy');
}

main().catch((err) => {
  console.error('\nRegression aborted:', err);
  process.exit(1);
});
