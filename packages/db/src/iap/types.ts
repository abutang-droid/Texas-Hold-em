export type RechargeChannel = 'MOCK' | 'APPLE_IAP' | 'GOOGLE_PLAY';

export interface VerifiedIapPurchase {
  channel: RechargeChannel;
  productId: string;
  transactionId: string;
  chips: number;
  fiatAmountCents: number;
  sandbox: boolean;
}
