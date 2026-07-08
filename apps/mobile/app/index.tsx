import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { guestLogin, getProfile, mockRecharge, quickStart, type UserProfile } from '../src/api/client';
import { designTokens } from '@texas-holdem/shared';

export default function LobbyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  const init = useCallback(async () => {
    try {
      const login = await guestLogin();
      setUser(login.user);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const onRecharge = async () => {
    try {
      const res = await mockRecharge(100, `req-${Date.now()}`);
      const profile = await getProfile();
      setUser({ ...profile, chipsBalance: res.chipsBalance });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  const onQuickStart = async () => {
    if (!user || user.chipsBalance < 2) {
      Alert.alert(t('bankruptcy.title'), '', [
        { text: t('bankruptcy.cta_recharge'), onPress: onRecharge },
        { text: t('bankruptcy.cta_lobby') },
      ]);
      return;
    }
    try {
      const match = await quickStart();
      router.push({ pathname: '/table', params: { roomId: match.roomId } });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.nickname}>{user?.nickname}</Text>
        <Text style={styles.balance}>
          {t('lobby.balance')}: {user?.chipsBalance} {t('common.chips')}
        </Text>
      </View>

      <Pressable style={styles.primaryBtn} onPress={onQuickStart}>
        <Text style={styles.primaryText}>{t('lobby.quick_start')}</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={onRecharge}>
        <Text style={styles.secondaryText}>{t('lobby.recharge')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121418', padding: 24, justifyContent: 'center' },
  center: { flex: 1, backgroundColor: '#121418', alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#9E9E9E', marginTop: 12 },
  header: { marginBottom: 48, alignItems: 'center' },
  nickname: { color: '#F5F5F5', fontSize: 24, fontWeight: '600' },
  balance: { color: '#C9A227', fontSize: 18, marginTop: 8 },
  primaryBtn: {
    backgroundColor: '#C9A227',
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  primaryText: { color: '#1A1A1A', fontSize: 18, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#C9A227',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: '#C9A227', fontSize: 16 },
});
