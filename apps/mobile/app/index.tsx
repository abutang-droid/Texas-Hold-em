import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  getCompliance,
  declareAge,
  acknowledgeMigration,
  getProfile,
  formatApiError,
  getToken,
  subscribeAuthChange,
  type UserProfile,
} from '../src/api/client';
import { loadSession } from '../src/storage/session';
import { Screen } from '../src/components/ui/Screen';
import { Button } from '../src/components/ui/Button';
import { GameModal } from '../src/components/ui/GameModal';
import { Avatar } from '../src/components/Avatar';
import { colors, palette, spacing, typography } from '../src/theme';

const PLAY_SELECT_REV = '2026-09-16-modes';

function showUserMessage(title: string, body: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${body}`);
    return;
  }
  Alert.alert(title, body);
}

function ProfileBadge({
  user,
  chipsLabel,
  onPress,
}: {
  user: UserProfile;
  chipsLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.avatarRow} onPress={onPress}>
      <Avatar nickname={user.nickname} avatarUrl={user.avatarUrl} size="md" />
      <View>
        <Text style={styles.nickname}>{user.nickname}</Text>
        <Text style={styles.balanceLine}>
          {user.chipsBalance.toLocaleString()} {chipsLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function ModeCard({
  kicker,
  title,
  hint,
  enterLabel,
  onPress,
  disabled,
  accent,
}: {
  kicker: string;
  title: string;
  hint: string;
  enterLabel: string;
  onPress: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeCard,
        accent && styles.modeCardAccent,
        disabled && styles.modeCardDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.modeKicker, accent && styles.modeKickerAccent]}>{kicker}</Text>
      <Text style={styles.modeTitle}>{title}</Text>
      <Text style={styles.modeHint}>{hint}</Text>
      <Text style={[styles.modeEnter, accent && styles.modeKickerAccent]}>{enterLabel}</Text>
    </Pressable>
  );
}

export default function PlaySelectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [migrationMsg, setMigrationMsg] = useState<string | null>(null);
  const [ageRequired, setAgeRequired] = useState(false);
  const [complianceBusy, setComplianceBusy] = useState(false);
  const [errorModal, setErrorModal] = useState<{ title: string; body: string } | null>(null);

  const compliancePending = ageRequired || !!migrationMsg;
  const isGuest = user?.accountType === 'GUEST';
  const playLocked = compliancePending || isGuest;

  const init = useCallback(async () => {
    if (!getToken()) return;
    try {
      const profile = await getProfile();
      setUser(profile);
      const compliance = await getCompliance();
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

  useFocusEffect(
    useCallback(() => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      void init();
    }, [init]),
  );

  useEffect(() => {
    if (__DEV__) console.log(`[mobile] play select ${PLAY_SELECT_REV}`);
    return subscribeAuthChange(() => {
      void loadSession().then((session) => {
        if (session?.user) setUser(session.user);
      });
    });
  }, []);

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

  const enterMode = (path: '/holdem' | '/stud') => {
    if (compliancePending) return;
    if (!requireRegistered()) return;
    router.push(path);
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
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.topBar}>
        {user ? (
          <ProfileBadge
            user={user}
            chipsLabel={t('common.chips')}
            onPress={() => router.push('/profile')}
          />
        ) : null}
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityRole="button">
          <Text style={styles.gear}>{t('settings.title')}</Text>
        </Pressable>
      </View>

      <Text style={styles.pageTitle}>{t('lobby.choose_mode')}</Text>
      <Text style={styles.pageHint}>{t('lobby.choose_mode_hint')}</Text>

      <ModeCard
        accent
        kicker={t('lobby.holdem_kicker')}
        title={t('lobby.holdem')}
        hint={t('lobby.holdem_hint')}
        enterLabel={t('lobby.enter_mode')}
        disabled={playLocked}
        onPress={() => enterMode('/holdem')}
      />
      <ModeCard
        kicker={t('lobby.stud_kicker')}
        title={t('lobby.caribbean_stud')}
        hint={t('lobby.caribbean_stud_hint')}
        enterLabel={t('lobby.enter_mode')}
        disabled={playLocked}
        onPress={() => enterMode('/stud')}
      />

      {isGuest ? (
        <Button
          label={t('lobby.register_to_play')}
          variant="ghost"
          onPress={() => router.push('/auth/register')}
          fullWidth
          style={styles.guestBtn}
        />
      ) : null}
      {isGuest ? <Text style={styles.hint}>{t('lobby.guest_play_blocked')}</Text> : null}
      {compliancePending ? (
        <Text style={styles.hint}>
          {ageRequired ? t('errors.age_required') : t('errors.migration_required')}
        </Text>
      ) : null}

      <View style={styles.utils}>
        <Pressable onPress={() => router.push('/shop')} hitSlop={8} style={styles.utilBtn}>
          <Text style={styles.utilText}>{t('lobby.recharge')}</Text>
        </Pressable>
        <Text style={styles.utilDot}>·</Text>
        <Pressable onPress={() => router.push('/leaderboard')} hitSlop={8} style={styles.utilBtn}>
          <Text style={styles.utilText}>{t('lobby.leaderboard')}</Text>
        </Pressable>
      </View>

      <Text style={styles.stamp}>
        {t('lobby.choose_mode')} · {PLAY_SELECT_REV}
      </Text>

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
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  nickname: { ...typography.h2, color: colors.text.primary },
  balanceLine: { ...typography.micro, color: colors.brand.secondary, marginTop: 4 },
  gear: { ...typography.caption, color: colors.text.secondary, fontWeight: '700' },
  pageTitle: { ...typography.h1, color: colors.text.primary },
  pageHint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  modeCard: {
    minHeight: 112,
    marginBottom: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: colors.bg.card,
    justifyContent: 'center',
  },
  modeCardAccent: {
    borderColor: colors.brand.primary,
    backgroundColor: palette.accentSoft,
  },
  modeCardDisabled: { opacity: 0.45 },
  modeKicker: {
    ...typography.micro,
    color: colors.text.secondary,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  modeKickerAccent: { color: colors.brand.secondary },
  modeTitle: { ...typography.h1, color: colors.text.primary },
  modeHint: { ...typography.caption, color: colors.text.secondary, marginTop: 6 },
  modeEnter: { ...typography.micro, color: colors.text.secondary, marginTop: spacing.md, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  guestBtn: { marginTop: spacing.md },
  hint: {
    ...typography.micro,
    color: colors.brand.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  utils: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  utilBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  utilText: { ...typography.caption, color: colors.text.secondary, fontWeight: '700' },
  utilDot: { ...typography.caption, color: colors.text.disabled },
  stamp: {
    ...typography.micro,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
