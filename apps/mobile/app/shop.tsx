import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  getShopProducts,
  shopRecharge,
  getProfile,
  type ShopProduct,
} from '../src/api/client';
import { Screen, ScreenHeader } from '../src/components/ui/Screen';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { colors, palette, spacing, typography } from '../src/theme';

function sandboxReceipt(productId: string): string {
  const platform = Platform.OS === 'android' ? 'google' : 'apple';
  return `sandbox:${platform}:${productId}`;
}

function ProductCard({
  product,
  purchasing,
  onPurchase,
  buyLabel,
}: {
  product: ShopProduct;
  purchasing: boolean;
  onPurchase: () => void;
  buyLabel: string;
}) {
  return (
    <Card style={styles.productCard}>
      <View style={styles.chipIcon}>
        <Text style={styles.chipIconText}>♠</Text>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productLabel}>{product.label}</Text>
        <Text style={styles.productChips}>
          {product.chips.toLocaleString()} chips
        </Text>
        <Text style={styles.productPrice}>${(product.priceCents / 100).toFixed(2)}</Text>
      </View>
      <Button
        label={buyLabel}
        onPress={onPurchase}
        loading={purchasing}
        style={styles.buyBtn}
      />
    </Card>
  );
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
    return <Screen loading loadingLabel={t('common.loading')} />;
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('shop.title')}
        subtitle={`${t('lobby.balance')}: ${balance.toLocaleString()} ${t('common.chips')}`}
        onBack={() => router.back()}
        backLabel={t('shop.back')}
      />

      {bonusPct > 0 && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{t('shop.first_bonus_hint', { pct: bonusPct })}</Text>
        </View>
      )}
      {sandboxMode && (
        <Text style={styles.sandbox}>{t('shop.sandbox_mode')}</Text>
      )}

      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          purchasing={purchasing === product.id}
          onPurchase={() => onPurchase(product)}
          buyLabel={t('shop.buy')}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: palette.accentSoft,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(46,125,99,0.28)',
  },
  bannerText: { ...typography.caption, color: colors.brand.secondary, textAlign: 'center' },
  sandbox: {
    ...typography.micro,
    color: colors.semantic.success,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  chipIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.primary,
    borderWidth: 2,
    borderColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  chipIconText: { fontSize: 20, color: palette.inverse },
  productInfo: { flex: 1 },
  productLabel: { ...typography.h2, color: colors.text.primary },
  productChips: { ...typography.caption, color: colors.brand.secondary, marginTop: 2 },
  productPrice: { ...typography.micro, color: colors.text.secondary, marginTop: 2 },
  buyBtn: { minWidth: 88, minHeight: 40, paddingHorizontal: spacing.md },
});
