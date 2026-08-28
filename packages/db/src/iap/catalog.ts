import { getConfigValue } from '../system-config.js';

export interface IapProduct {
  id: string;
  chips: number;
  priceCents: number;
  label: Record<string, string>;
}

const DEFAULT_PRODUCTS: IapProduct[] = [
  { id: 'com.texasholdem.chips.100', chips: 100, priceCents: 99, label: { 'zh-CN': '100 筹码', 'en-US': '100 Chips' } },
  { id: 'com.texasholdem.chips.500', chips: 500, priceCents: 499, label: { 'zh-CN': '500 筹码', 'en-US': '500 Chips' } },
  { id: 'com.texasholdem.chips.1000', chips: 1000, priceCents: 999, label: { 'zh-CN': '1000 筹码', 'en-US': '1000 Chips' } },
];

export async function getIapProducts(): Promise<IapProduct[]> {
  const raw = await getConfigValue('iap_products');
  if (Array.isArray(raw) && raw.length > 0) {
    return raw as IapProduct[];
  }
  return DEFAULT_PRODUCTS;
}

export async function getProductById(productId: string): Promise<IapProduct | null> {
  const products = await getIapProducts();
  return products.find((p) => p.id === productId) ?? null;
}
