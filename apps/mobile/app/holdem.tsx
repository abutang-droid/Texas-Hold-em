import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useRouter } from 'expo-router';
import { quickStart, getProfile, formatApiError, getToken, type UserProfile } from '../src/api/client';
import { Screen, ScreenHeader } from '../src/components/ui/Screen';
import { Button } from '../src/components/ui/Button';
import { GameModal } from '../src/components/ui/GameModal';
import { colors, spacing, typography } from '../src/theme';

function showUserMessage(title: string, body: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${body}`);
    return;
  }
  Alert.alert(title, body);
}

export default function HoldemHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [errorModal, setErrorModal] = useState<{ title: string; body: string } | null>(null);

  const isGuest = user?.accountType === 'GUEST';

  const init = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      setUser(await getProfile());
    } catch (e) {
      const msg = formatApiError((e as Error).message, t);
      if ((e as Error).message !== 'errors.unauthorized' && getToken()) {
        showUserMessage(t('common.error'), msg);
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void init();
    }, [init]),
  );

  const requireRegistered = (): boolean => {
    if (!user) {
      showUserMessage(t('common.error'), t('errors.unauthorized'));
      return false;
    }
    if (isGuest) {
      setErrorModal({ title: t('common.error'), body: t('lobby.guest_play_blocked') });
      return false;
    }
    return true;
  };

  const onQuickStart = async () => {
    if (starting) return;
    if (!requireRegistered()) return;
    if (user && user.chipsBalance < 2) {
      showUserMessage(t('bankruptcy.title'), t('errors.insufficient_chips'));
      return;
    }

    setStarting(true);
    try {
      const match = await quickStart();
      router.push({
        pathname: '/table',
        params: { roomId: match.roomId, buyInCap: String(match.buyInCap ?? 100) },
      });
    } catch (e) {
      const msg = formatApiError((e as Error).message, t);
      setErrorModal({ title: t('common.error'), body: msg });
    } finally {
      setStarting(false);
    }
  };

  if (!getToken()) {
    return (
      <Screen>
        <Button
          label={t('auth.login_btn')}
          onPress={() => router.push('/auth/login')}
          fullWidth
        />
      </Screen>
    );
  }

  if (loading) {
    return <Screen loading loadingLabel={t('common.loading')} />;
  }

  return (
    <Screen contentStyle={styles.body}>
      <ScreenHeader
        title={t('lobby.holdem')}
        subtitle={t('lobby.holdem_hub_hint')}
        onBack={() => router.replace('/')}
        backLabel={t('lobby.back_modes')}
      />

      {user ? (
        <Text style={styles.balance}>
          {t('lobby.balance')} {user.chipsBalance.toLocaleString()} {t('common.chips')}
        </Text>
      ) : null}

      <Button
        label={starting ? t('lobby.quick_start_loading') : t('lobby.quick_start')}
        onPress={() => void onQuickStart()}
        loading={starting}
        disabled={starting || isGuest}
        fullWidth
        style={styles.heroBtn}
      />
      <Button
        label={t('lobby.browse_tables')}
        variant="secondary"
        onPress={() => {
          if (!requireRegistered()) return;
          router.push('/tables');
        }}
        disabled={starting || isGuest}
        fullWidth
        style={styles.btn}
      />
      <Button
        label={t('lobby.private')}
        variant="secondary"
        onPress={() => {
          if (!requireRegistered()) return;
          router.push('/private');
        }}
        disabled={starting || isGuest}
        fullWidth
        style={styles.btn}
      />

      {isGuest ? (
        <Button
          label={t('lobby.register_to_play')}
          variant="ghost"
          onPress={() => router.push('/auth/register')}
          fullWidth
          style={styles.btn}
        />
      ) : null}

      <View style={styles.spacer} />

      <GameModal
        visible={!!errorModal}
        title={errorModal?.title ?? ''}
        body={errorModal?.body ?? ''}
        confirmLabel={t('common.ok')}
        onConfirm={() => setErrorModal(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: spacing.sm },
  balance: {
    ...typography.caption,
    color: colors.brand.secondary,
    marginBottom: spacing.xl,
  },
  heroBtn: { minHeight: 56, marginBottom: spacing.sm },
  btn: { minHeight: 52, marginBottom: spacing.sm },
  spacer: { flex: 1 },
});
