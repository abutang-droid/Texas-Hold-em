import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  getProfile,
  selfExclude,
  setLeaderboardStealth,
  logout,
} from '../src/api/client';
import { Screen, ScreenHeader } from '../src/components/ui/Screen';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { colors, spacing, typography } from '../src/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stealth, setStealth] = useState(false);

  useEffect(() => {
    getProfile()
      .then((p) => setStealth(!!(p as { settings?: { leaderboardStealth?: boolean } }).settings?.leaderboardStealth))
      .catch(() => undefined);
  }, []);

  const onStealthToggle = async (enabled: boolean) => {
    setStealth(enabled);
    try {
      await setLeaderboardStealth(enabled);
    } catch (e) {
      setStealth(!enabled);
      Alert.alert('Error', (e as Error).message);
    }
  };

  const onSelfExclude = () => {
    Alert.alert(t('settings.self_exclude_title'), t('settings.self_exclude_confirm'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.confirm'),
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await selfExclude(30);
            Alert.alert(t('settings.self_exclude_done'));
            router.replace('/');
          } catch (e) {
            Alert.alert('Error', (e as Error).message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('settings.title')}
        onBack={() => router.back()}
        backLabel={t('settings.back')}
      />

      <Card style={styles.disclaimerCard}>
        <Text style={styles.disclaimerIcon}>ℹ️</Text>
        <Text style={styles.disclaimer}>{t('settings.disclaimer')}</Text>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.leaderboard')}</Text>
        <View style={styles.row}>
          <Text style={styles.body}>{t('settings.stealth_desc')}</Text>
          <Switch
            value={stealth}
            onValueChange={onStealthToggle}
            trackColor={{ false: '#333', true: colors.brand.primary }}
            thumbColor={stealth ? colors.brand.secondary : '#888'}
          />
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.responsible_gaming')}</Text>
        <Text style={styles.bodyBlock}>{t('settings.self_exclude_desc')}</Text>
        <Button
          label={t('settings.self_exclude_btn')}
          onPress={onSelfExclude}
          variant="danger"
          loading={loading}
          fullWidth
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
        <Button
          label={t('settings.logout')}
          onPress={async () => {
            await logout();
            router.replace('/auth/login');
          }}
          variant="secondary"
          fullWidth
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(21,101,192,0.12)',
    borderColor: 'rgba(21,101,192,0.25)',
  },
  disclaimerIcon: { fontSize: 18, marginRight: spacing.md },
  disclaimer: { ...typography.caption, color: colors.text.secondary, flex: 1, lineHeight: 22 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { ...typography.body, color: colors.text.secondary, flex: 1, marginRight: spacing.md },
  bodyBlock: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.lg, lineHeight: 22 },
});
