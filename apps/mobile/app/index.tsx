import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  guestLogin,
  getProfile,
  mockRecharge,
  quickStart,
  getLeaderboard,
  getCompliance,
  declareAge,
  acknowledgeMigration,
  type UserProfile,
} from '../src/api/client';
import { designTokens } from '@texas-holdem/shared';

export default function LobbyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profitTop, setProfitTop] = useState<Array<{ nickname: string; score: number }>>([]);
  const [migrationMsg, setMigrationMsg] = useState<string | null>(null);
  const [ageRequired, setAgeRequired] = useState(false);

  const init = useCallback(async () => {
    try {
      const login = await guestLogin();
      setUser(login.user);
      const [board, compliance] = await Promise.all([getLeaderboard(), getCompliance()]);
      setProfitTop(board.profit.slice(0, 3));
      if (compliance.migrationRequired) setMigrationMsg(compliance.migrationMessage);
      if (!compliance.ageVerified) setAgeRequired(true);
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
      if (res.bonusChips > 0) {
        Alert.alert(t('shop.first_bonus_title'), t('shop.first_bonus_body', { bonus: res.bonusChips }));
      }
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

  const confirmAge = async () => {
    await declareAge();
    setAgeRequired(false);
  };

  const confirmMigration = async () => {
    await acknowledgeMigration();
    setMigrationMsg(null);
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
        <Pressable onPress={() => router.push('/settings')}>
          <Text style={styles.settingsLink}>{t('settings.title')}</Text>
        </Pressable>
      </View>

      {profitTop.length > 0 && (
        <View style={styles.lbCard}>
          <Text style={styles.lbTitle}>{t('lobby.weekly_top')}</Text>
          {profitTop.map((row, i) => (
            <Text key={i} style={styles.lbRow}>
              {i + 1}. {row.nickname} +{row.score}
            </Text>
          ))}
        </View>
      )}

      <Pressable style={styles.primaryBtn} onPress={onQuickStart}>
        <Text style={styles.primaryText}>{t('lobby.quick_start')}</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={onRecharge}>
        <Text style={styles.secondaryText}>{t('lobby.recharge')}</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => router.push('/private')}>
        <Text style={styles.secondaryText}>{t('lobby.private')}</Text>
      </Pressable>

      <Modal visible={ageRequired} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('compliance.age_title')}</Text>
            <Text style={styles.modalBody}>{t('compliance.age_confirm')}</Text>
            <Pressable style={styles.primaryBtn} onPress={confirmAge}>
              <Text style={styles.primaryText}>{t('compliance.age_agree')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!migrationMsg} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('compliance.migration_title')}</Text>
            <Text style={styles.modalBody}>{migrationMsg}</Text>
            <Pressable style={styles.primaryBtn} onPress={confirmMigration}>
              <Text style={styles.primaryText}>{t('compliance.migration_agree')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121418', padding: 24, justifyContent: 'center' },
  center: { flex: 1, backgroundColor: '#121418', alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#9E9E9E', marginTop: 12 },
  header: { marginBottom: 24, alignItems: 'center' },
  nickname: { color: '#F5F5F5', fontSize: 24, fontWeight: '600' },
  balance: { color: '#C9A227', fontSize: 18, marginTop: 8 },
  settingsLink: { color: '#9E9E9E', marginTop: 8, fontSize: 14 },
  lbCard: {
    backgroundColor: '#1E2128',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  lbTitle: { color: '#C9A227', fontWeight: '700', marginBottom: 8 },
  lbRow: { color: '#F5F5F5', marginBottom: 4 },
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
    marginBottom: 12,
  },
  secondaryText: { color: '#C9A227', fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: '#1E2128', borderRadius: 12, padding: 20 },
  modalTitle: { color: '#F5F5F5', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalBody: { color: '#9E9E9E', lineHeight: 22, marginBottom: 20 },
});
