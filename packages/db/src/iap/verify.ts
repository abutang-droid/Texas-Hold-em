import type { RechargeChannel } from './types.js';
import { verifyApplePurchase } from './apple.js';
import { verifyGooglePurchase } from './google.js';
import type { VerifiedIapPurchase } from './types.js';

export async function verifyIapPurchase(opts: {
  channel: RechargeChannel;
  productId: string;
  receiptToken: string;
  packageName?: string;
}): Promise<VerifiedIapPurchase> {
  const sandboxMode = process.env.IAP_SANDBOX_MODE !== 'false';

  if (opts.channel === 'APPLE_IAP') {
    return verifyApplePurchase({
      receiptToken: opts.receiptToken,
      productId: opts.productId,
      sandboxMode,
    });
  }
  if (opts.channel === 'GOOGLE_PLAY') {
    return verifyGooglePurchase({
      productId: opts.productId,
      purchaseToken: opts.receiptToken,
      packageName: opts.packageName,
      sandboxMode,
    });
  }
  throw new Error('INVALID_CHANNEL');
}

export { getIapProducts, getProductById } from './catalog.js';
export type { IapProduct } from './catalog.js';
export type { VerifiedIapPurchase } from './types.js';
