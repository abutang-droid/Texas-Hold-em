import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getProfile, getAvatarPresets, updateProfile } from '../src/api/client';
import { Avatar } from '../src/components/Avatar';
import { Screen, ScreenHeader } from '../src/components/ui/Screen';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { AuthField } from '../src/components/auth/AuthField';
import { showAlert } from '../src/utils/alert';
import { colors, palette, spacing, typography } from '../src/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [chips, setChips] = useState(0);
  const [level, setLevel] = useState(1);
  const [presets, setPresets] = useState<
    Array<{ id: string; emoji: string; color: string; label: string; avatarUrl: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [profile, presetList] = await Promise.all([getProfile(), getAvatarPresets()]);
    setNickname(profile.nickname);
    setAvatarUrl(profile.avatarUrl ?? null);
    setChips(profile.chipsBalance);
    setLevel(profile.level);
    setPresets(presetList.presets);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => showAlert(t('auth.error_title'), (e as Error).message))
      .finally(() => setLoading(false));
  }, [load, t]);

  const onSave = async () => {
    if (!nickname.trim()) {
      showAlert(t('auth.error_title'), t('profile.nickname_required'));
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ nickname: nickname.trim(), avatarUrl });
      showAlert(t('profile.saved_title'), t('profile.saved_body'));
      router.back();
    } catch (e) {
      const msg = (e as Error).message;
      showAlert(t('auth.error_title'), msg.startsWith('errors.') ? t(msg) : msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Screen loading loadingLabel={t('common.loading')} />;
  }

  return (
    <Screen scroll>
      <ScreenHeader title={t('profile.title')} onBack={() => router.back()} backLabel={t('profile.back')} />

      <Card style={styles.hero}>
        <Avatar nickname={nickname || '?'} avatarUrl={avatarUrl} size="lg" />
        <Text style={styles.meta}>
          {t('lobby.balance')}: {chips.toLocaleString()} · Lv.{level}
        </Text>
      </Card>

      <Card>
        <AuthField label={t('auth.nickname')} value={nickname} onChangeText={setNickname} autoCapitalize="words" />
        <Text style={styles.section}>{t('profile.avatar_pick')}</Text>
        <View style={styles.presetGrid}>
          {presets.map((p) => {
            const selected = avatarUrl === p.avatarUrl;
            return (
              <Pressable
                key={p.id}
                onPress={() => setAvatarUrl(p.avatarUrl)}
                style={[styles.presetItem, selected && styles.presetSelected]}
              >
                <View style={[styles.presetCircle, { backgroundColor: p.color }]}>
                  <Text style={styles.presetEmoji}>{p.emoji}</Text>
                </View>
                <Text style={styles.presetLabel}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Button label={t('profile.save')} onPress={onSave} loading={saving} fullWidth />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: spacing.lg, gap: spacing.sm },
  meta: { ...typography.caption, color: colors.text.secondary },
  section: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing.sm },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  presetItem: { width: '22%', alignItems: 'center', padding: spacing.xs, borderRadius: 8 },
  presetSelected: { backgroundColor: palette.accentSoft, borderWidth: 1, borderColor: colors.brand.primary },
  presetCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetEmoji: { fontSize: 22 },
  presetLabel: { ...typography.micro, color: colors.text.secondary, marginTop: 4, textAlign: 'center' },
});
