import type { VerifiedIapPurchase } from './types.js';
import { getProductById } from './catalog.js';
import { verifyStoreKitJws } from './apple-jws.js';

interface AppleVerifyResponse {
  status: number;
  receipt?: {
    in_app?: Array<{
      product_id: string;
      transaction_id: string;
      quantity: string;
    }>;
  };
  latest_receipt_info?: Array<{
    product_id: string;
    transaction_id: string;
    quantity: string;
  }>;
}

function isJws(token: string): boolean {
  return token.split('.').length === 3;
}


async function verifyLegacyReceipt(
  receiptData: string,
  sandbox: boolean,
): Promise<{ productId: string; transactionId: string }> {
  const sharedSecret = process.env.APPLE_IAP_SHARED_SECRET;
  if (!sharedSecret) throw new Error('APPLE_CONFIG_MISSING');

  const url = sandbox
    ? 'https://sandbox.itunes.apple.com/verifyReceipt'
    : 'https://buy.itunes.apple.com/verifyReceipt';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receiptData,
      password: sharedSecret,
      'exclude-old-transactions': true,
    }),
  });

  if (!res.ok) throw new Error('APPLE_VERIFY_FAILED');
  const data = (await res.json()) as AppleVerifyResponse;

  if (data.status === 21007 && !sandbox) {
    return verifyLegacyReceipt(receiptData, true);
  }
  if (data.status !== 0) throw new Error('APPLE_VERIFY_FAILED');

  const items = data.latest_receipt_info ?? data.receipt?.in_app ?? [];
  const latest = items[items.length - 1];
  if (!latest?.product_id || !latest.transaction_id) throw new Error('APPLE_VERIFY_FAILED');

  return { productId: latest.product_id, transactionId: latest.transaction_id };
}

export async function verifyApplePurchase(opts: {
  receiptToken: string;
  productId?: string;
  sandboxMode: boolean;
}): Promise<VerifiedIapPurchase> {
  const sandboxPrefix = opts.receiptToken.startsWith('sandbox:apple:');
  if (opts.sandboxMode && sandboxPrefix) {
    const parts = opts.receiptToken.split(':');
    const productId = opts.productId ?? parts[2] ?? '';
    const product = await getProductById(productId);
    if (!product) throw new Error('PRODUCT_NOT_FOUND');
    return {
      channel: 'APPLE_IAP',
      productId,
      transactionId: `sandbox-apple-${Date.now()}`,
      chips: product.chips,
      fiatAmountCents: product.priceCents,
      sandbox: true,
    };
  }

  let productId = opts.productId;
  let transactionId: string;

  if (isJws(opts.receiptToken)) {
    const decoded = verifyStoreKitJws(opts.receiptToken);
    if (!decoded?.productId || !decoded.transactionId) throw new Error('INVALID_RECEIPT');
    const expectedBundle = process.env.APPLE_BUNDLE_ID ?? 'com.texasholdem.app';
    if (decoded.bundleId && decoded.bundleId !== expectedBundle) throw new Error('INVALID_RECEIPT');
    productId = decoded.productId;
    transactionId = decoded.transactionId;
  } else {
    const verified = await verifyLegacyReceipt(opts.receiptToken, opts.sandboxMode);
    productId = productId ?? verified.productId;
    transactionId = verified.transactionId;
  }

  const product = await getProductById(productId!);
  if (!product) throw new Error('PRODUCT_NOT_FOUND');

  return {
    channel: 'APPLE_IAP',
    productId: product.id,
    transactionId,
    chips: product.chips,
    fiatAmountCents: product.priceCents,
    sandbox: opts.sandboxMode,
  };
}
