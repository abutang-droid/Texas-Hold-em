import { Platform } from 'react-native';
import * as IAP from 'expo-iap';

export interface NativePurchaseResult {
  receiptToken: string;
  productId: string;
}

export function isNativeIapSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export async function purchaseNativeProduct(productId: string): Promise<NativePurchaseResult | null> {
  if (!isNativeIapSupported()) return null;

  await IAP.initConnection();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      updatedSub.remove();
      errorSub.remove();
      IAP.endConnection().catch(() => undefined);
    };

    const updatedSub = IAP.purchaseUpdatedListener(async (purchase) => {
      cleanup();
      const receipt = purchase.purchaseToken;
      if (!receipt) {
        reject(new Error('INVALID_RECEIPT'));
        return;
      }
      try {
        await IAP.finishTransaction({ purchase, isConsumable: true });
      } catch {
        /* best effort */
      }
      resolve({ receiptToken: receipt, productId: purchase.productId });
    });

    const errorSub = IAP.purchaseErrorListener((error) => {
      cleanup();
      reject(new Error(error.message || 'PURCHASE_FAILED'));
    });

    IAP.requestPurchase({
      request: {
        apple: { sku: productId },
        google: { skus: [productId] },
      },
      type: 'in-app',
    }).catch((err: Error) => {
      cleanup();
      reject(err);
    });
  });
}
