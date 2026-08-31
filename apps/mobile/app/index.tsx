import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  quickStart,
  getLeaderboard,
  getCompliance,
  declareAge,
  acknowledgeMigration,
  getProfile,
  formatApiError,
  getToken,
  type UserProfile,
} from '../src/api/client';
import { Screen } from '../src/components/ui/Screen';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { GameModal } from '../src/components/ui/GameModal';
import { Avatar } from '../src/components/Avatar';
import { colors, palette, spacing, typography } from '../src/theme';

function showUserMessage(title: string, body: string) {
  if (Platform.OS === 'web') {
    // Alert.alert is unreliable on some web targets
    window.alert(`${title}\n\n${body}`);
    return;
  }
  Alert.alert(title, body);
}

function ProfileBadge({
  user,
  onPress,
}: {
  user: UserProfile;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.avatarRow} onPress={onPress}>
      <Avatar nickname={user.nickname} avatarUrl={user.avatarUrl} size="md" />
      <View>
        <Text style={styles.nickname}>{user.nickname}</Text>
        <View style={styles.levelPill}>
          <Text style={styles.levelText}>Lv.{user.level}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function MenuTile({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]} onPress={onPress}>
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

export default function LobbyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profitTop, setProfitTop] = useState<Array<{ nickname: string; score: number }>>([]);
  const [migrationMsg, setMigrationMsg] = useState<string | null>(null);
  const [ageRequired, setAgeRequired] = useState(false);
  const [complianceBusy, setComplianceBusy] = useState(false);
  const [errorModal, setErrorModal] = useState<{ title: string; body: string } | null>(null);

  const compliancePending = ageRequired || !!migrationMsg;

  const init = useCallback(async () => {
    if (!getToken()) return;
    try {
      const profile = await getProfile();
      setUser(profile);
      const [board, compliance] = await Promise.all([getLeaderboard(), getCompliance()]);
      setProfitTop(board.profit.slice(0, 3));
      if (compliance.migrationRequired) setMigrationMsg(compliance.migrationMessage);
      if (!compliance.ageVerified) setAgeRequired(true);
    } catch (e) {
      const msg = formatApiError((e as Error).message, t);
      if ((e as Error).message !== 'errors.unauthorized' && getToken()) {
        showUserMessage(t('common.error'), msg);
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      router.replace('/auth/login');
      return;
    }
    void init();
  }, [init, router]);

  const onQuickStart = async () => {
    if (starting) return;

    // Compliance modals are already on screen — avoid silent web alerts behind them.
    if (compliancePending) return;
    if (!user) {
      showUserMessage(t('common.error'), t('errors.unauthorized'));
      return;
    }
    if (user.chipsBalance < 2) {
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

  const confirmAge = async () => {
    if (complianceBusy) return;
    setComplianceBusy(true);
    try {
      await declareAge();
      setAgeRequired(false);
    } catch (e) {
      const msg = formatApiError((e as Error).message, t);
      setErrorModal({ title: t('common.error'), body: msg });
    } finally {
      setComplianceBusy(false);
    }
  };

  const confirmMigration = async () => {
    if (complianceBusy) return;
    setComplianceBusy(true);
    try {
      await acknowledgeMigration();
      setMigrationMsg(null);
    } catch (e) {
      const msg = formatApiError((e as Error).message, t);
      setErrorModal({ title: t('common.error'), body: msg });
    } finally {
      setComplianceBusy(false);
    }
  };

  if (!getToken()) {
    return (
      <Screen>
        <Button
          label={t('auth.login_btn')}
          onPress={() => router.replace('/auth/login')}
          fullWidth
        />
      </Screen>
    );
  }

  if (loading) {
    return <Screen loading loadingLabel={t('common.loading')} />;
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.topBar}>
        {user ? <ProfileBadge user={user} onPress={() => router.push('/profile')} /> : null}
        <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
          <Text style={styles.gear}>⚙</Text>
        </Pressable>
      </View>

      <Card elevated style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t('lobby.balance')}</Text>
        <Text style={styles.balanceValue}>
          {user?.chipsBalance.toLocaleString()}
          <Text style={styles.balanceUnit}> {t('common.chips')}</Text>
        </Text>
        {user ? (
          <Text style={styles.expText}>
            {t('lobby.exp')}: {user.totalExp} · {t('lobby.level')} {user.level}
          </Text>
        ) : null}
      </Card>

      <Button
        label={starting ? t('lobby.quick_start_loading') : t('lobby.quick_start')}
        onPress={onQuickStart}
        loading={starting}
        disabled={starting || compliancePending}
        fullWidth
        style={styles.heroBtn}
      />
      {compliancePending ? (
        <Text style={styles.complianceHint}>
          {ageRequired ? t('errors.age_required') : t('errors.migration_required')}
        </Text>
      ) : null}

      <View style={styles.menuGrid}>
        <MenuTile icon="🛒" label={t('lobby.recharge')} onPress={() => router.push('/shop')} />
        <MenuTile icon="🔒" label={t('lobby.private')} onPress={() => router.push('/private')} />
        <MenuTile
          icon="🏆"
          label={t('lobby.leaderboard')}
          onPress={() => router.push('/leaderboard')}
        />
        <MenuTile icon="⚙" label={t('settings.title')} onPress={() => router.push('/settings')} />
      </View>

      {profitTop.length > 0 && (
        <Card style={styles.lbCard}>
          <View style={styles.lbHeader}>
            <Text style={styles.lbTitle}>{t('lobby.weekly_top')}</Text>
            <Pressable onPress={() => router.push('/leaderboard')}>
              <Text style={styles.lbMore}>{t('lobby.view_all')}</Text>
            </Pressable>
          </View>
          {profitTop.map((row, i) => (
            <View key={i} style={styles.lbRow}>
              <Text style={[styles.lbRank, i === 0 && styles.lbRankGold]}>{i + 1}</Text>
              <Text style={styles.lbName} numberOfLines={1}>
                {row.nickname}
              </Text>
              <Text style={styles.lbScore}>+{row.score.toLocaleString()}</Text>
            </View>
          ))}
        </Card>
      )}

      <GameModal
        visible={ageRequired}
        title={t('compliance.age_title')}
        body={t('compliance.age_confirm')}
        confirmLabel={complianceBusy ? t('common.loading') : t('compliance.age_agree')}
        onConfirm={confirmAge}
        confirmDisabled={complianceBusy}
      />

      <GameModal
        visible={!!migrationMsg && !ageRequired}
        title={t('compliance.migration_title')}
        body={migrationMsg ?? ''}
        confirmLabel={complianceBusy ? t('common.loading') : t('compliance.migration_agree')}
        onConfirm={confirmMigration}
        confirmDisabled={complianceBusy}
      />

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
  content: { paddingTop: spacing.md },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.primary,
    borderWidth: 2,
    borderColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.h2, color: palette.inverse },
  nickname: { ...typography.h2, color: colors.text.primary },
  levelPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: palette.accentSoft,
  },
  levelText: { ...typography.micro, color: colors.brand.secondary },
  gear: { fontSize: 22, color: colors.text.secondary },
  balanceCard: { marginBottom: spacing.xl, alignItems: 'center' },
  balanceLabel: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing.sm },
  balanceValue: { ...typography.display, color: colors.brand.secondary },
  balanceUnit: { ...typography.h2, color: colors.text.secondary },
  expText: { ...typography.micro, color: colors.text.secondary, marginTop: spacing.sm },
  heroBtn: { minHeight: 56, marginBottom: spacing.sm },
  complianceHint: {
    ...typography.micro,
    color: colors.brand.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  tile: {
    width: '47%',
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
  },
  tilePressed: { opacity: 0.85 },
  tileIcon: { fontSize: 28, marginBottom: spacing.sm },
  tileLabel: { ...typography.caption, color: colors.text.primary, fontWeight: '600' },
  lbCard: { marginBottom: spacing.xl },
  lbHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  lbTitle: { ...typography.h2, color: colors.brand.secondary },
  lbMore: { ...typography.micro, color: colors.text.secondary },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  lbRank: {
    width: 24,
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  lbRankGold: { color: colors.brand.secondary },
  lbName: { flex: 1, ...typography.body, color: colors.text.primary },
  lbScore: { ...typography.caption, color: colors.semantic.success, fontWeight: '600' },
});
