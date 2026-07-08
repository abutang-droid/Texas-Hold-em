import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  getShopProducts,
  shopRecharge,
  getProfile,
  type ShopProduct,
} from '../src/api/client';
import { designTokens } from '@texas-holdem/shared';

function sandboxReceipt(productId: string): string {
  const platform = Platform.OS === 'android' ? 'google' : 'apple';
  return `sandbox:${platform}:${productId}`;
}

export default function ShopScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [balance, setBalance] = useState(0);
  const [bonusPct, setBonusPct] = useState(0);
  const [sandboxMode, setSandboxMode] = useState(true);

  const load = useCallback(async () => {
    try {
      const [catalog, profile] = await Promise.all([getShopProducts(), getProfile()]);
      setProducts(catalog.products);
      setBonusPct(catalog.firstRechargeBonusEnabled ? catalog.firstRechargeBonusPct : 0);
      setSandboxMode(catalog.iapSandboxMode);
      setBalance(profile.chipsBalance);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onPurchase = async (product: ShopProduct) => {
    setPurchasing(product.id);
    try {
      const channel = Platform.OS === 'android' ? 'GOOGLE_PLAY' : 'APPLE_IAP';
      const receipt = sandboxMode ? sandboxReceipt(product.id) : '';
      if (!sandboxMode) {
        Alert.alert(t('shop.native_only_title'), t('shop.native_only_body'));
        return;
      }
      const res = await shopRecharge(channel, product.chips, `iap-${Date.now()}`, receipt, product.id);
      setBalance(res.chipsBalance);
      if (res.bonusChips > 0) {
        Alert.alert(t('shop.first_bonus_title'), t('shop.first_bonus_body', { bonus: res.bonusChips }));
      } else {
        Alert.alert(t('shop.success_title'), t('shop.success_body', { chips: res.amount }));
      }
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={designTokens.color.brand.secondary} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>{t('shop.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('shop.title')}</Text>
        <Text style={styles.balance}>
          {t('lobby.balance')}: {balance} {t('common.chips')}
        </Text>
        {bonusPct > 0 && (
          <Text style={styles.bonusHint}>{t('shop.first_bonus_hint', { pct: bonusPct })}</Text>
        )}
        {sandboxMode && <Text style={styles.sandbox}>{t('shop.sandbox_mode')}</Text>}
      </View>

      {products.map((product) => (
        <View key={product.id} style={styles.card}>
          <View style={styles.cardBody}>
            <Text style={styles.productLabel}>{product.label}</Text>
            <Text style={styles.productChips}>
              {product.chips} {t('common.chips')}
            </Text>
            <Text style={styles.productPrice}>
              ${(product.priceCents / 100).toFixed(2)}
            </Text>
          </View>
          <Pressable
            style={[styles.buyBtn, purchasing === product.id && styles.buyBtnDisabled]}
            onPress={() => onPurchase(product)}
            disabled={!!purchasing}
          >
            <Text style={styles.buyText}>
              {purchasing === product.id ? t('common.loading') : t('shop.buy')}
            </Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121418' },
  content: { padding: 24 },
  center: { flex: 1, backgroundColor: '#121418', alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#9E9E9E', marginTop: 12 },
  header: { marginBottom: 24 },
  back: { color: '#9E9E9E', marginBottom: 12 },
  title: { color: '#F5F5F5', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  balance: { color: '#C9A227', fontSize: 16 },
  bonusHint: { color: '#9E9E9E', marginTop: 8, fontSize: 14 },
  sandbox: { color: '#6B8E6B', marginTop: 8, fontSize: 12 },
  card: {
    backgroundColor: '#1E2128',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBody: { flex: 1 },
  productLabel: { color: '#F5F5F5', fontSize: 18, fontWeight: '600' },
  productChips: { color: '#C9A227', marginTop: 4 },
  productPrice: { color: '#9E9E9E', marginTop: 4 },
  buyBtn: {
    backgroundColor: '#C9A227',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 12,
  },
  buyBtnDisabled: { opacity: 0.6 },
  buyText: { color: '#1A1A1A', fontWeight: '700' },
});
