import { createSign } from 'node:crypto';
import type { VerifiedIapPurchase } from './types.js';
import { getProductById } from './catalog.js';

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url');
  const unsigned = `${header}.${claim}`;
  const sign = createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(sa.private_key, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error('GOOGLE_AUTH_FAILED');
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('GOOGLE_AUTH_FAILED');
  return json.access_token;
}

export async function verifyGooglePurchase(opts: {
  productId: string;
  purchaseToken: string;
  packageName?: string;
  sandboxMode: boolean;
}): Promise<VerifiedIapPurchase> {
  const sandboxPrefix = opts.purchaseToken.startsWith('sandbox:google:');
  if (opts.sandboxMode && sandboxPrefix) {
    const product = await getProductById(opts.productId);
    if (!product) throw new Error('PRODUCT_NOT_FOUND');
    return {
      channel: 'GOOGLE_PLAY',
      productId: opts.productId,
      transactionId: `sandbox-google-${Date.now()}`,
      chips: product.chips,
      fiatAmountCents: product.priceCents,
      sandbox: true,
    };
  }

  const packageName = opts.packageName ?? process.env.GOOGLE_PLAY_PACKAGE_NAME ?? 'com.texasholdem.app';
  const sa = loadServiceAccount();
  if (!sa) throw new Error('GOOGLE_CONFIG_MISSING');

  const token = await getGoogleAccessToken(sa);
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}` +
    `/purchases/products/${encodeURIComponent(opts.productId)}/tokens/${encodeURIComponent(opts.purchaseToken)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('GOOGLE_VERIFY_FAILED');

  const data = (await res.json()) as {
    purchaseState?: number;
    orderId?: string;
    consumptionState?: number;
  };

  if (data.purchaseState !== 0) throw new Error('GOOGLE_VERIFY_FAILED');

  const product = await getProductById(opts.productId);
  if (!product) throw new Error('PRODUCT_NOT_FOUND');

  return {
    channel: 'GOOGLE_PLAY',
    productId: product.id,
    transactionId: data.orderId ?? opts.purchaseToken.slice(0, 64),
    chips: product.chips,
    fiatAmountCents: product.priceCents,
    sandbox: opts.sandboxMode,
  };
}
