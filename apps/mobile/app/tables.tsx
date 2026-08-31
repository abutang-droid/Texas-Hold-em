import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  formatApiError,
  joinPublicTable,
  listPublicTables,
  type PublicTableInfo,
} from '../src/api/client';
import { Screen, ScreenHeader } from '../src/components/ui/Screen';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { colors, spacing, typography } from '../src/theme';

export default function PublicTablesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tables, setTables] = useState<PublicTableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listPublicTables();
      setTables(data.tables);
      setError(null);
    } catch (e) {
      setError(formatApiError((e as Error).message, t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onJoin = async (table: PublicTableInfo) => {
    if (!table.joinable || joining) return;
    setJoining(table.roomId);
    try {
      const match = await joinPublicTable(table.roomId);
      router.replace({
        pathname: '/table',
        params: { roomId: match.roomId, buyInCap: String(match.buyInCap ?? 100) },
      });
    } catch (e) {
      setError(formatApiError((e as Error).message, t));
      setJoining(null);
    }
  };

  return (
    <Screen scroll loading={loading} loadingLabel={t('common.loading')}>
      <ScreenHeader
        title={t('table.tables_title')}
        subtitle={t('table.tables_subtitle')}
        onBack={() => router.back()}
        backLabel={t('table.back_lobby')}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {tables.length === 0 && !error ? <Text style={styles.empty}>{t('table.tables_empty')}</Text> : null}
      {tables.map((table) => (
        <Card key={table.roomId} style={styles.row}>
          <View style={styles.meta}>
            <Text style={styles.name}>{table.label}</Text>
            <Text style={styles.seats}>
              {t('table.tables_seats', {
                humans: table.seatedHumans,
                bots: table.bots,
                empty: table.emptySeats,
              })}
            </Text>
          </View>
          {table.joinable ? (
            <Button
              label={joining === table.roomId ? t('lobby.quick_start_loading') : t('table.tables_join')}
              onPress={() => void onJoin(table)}
              disabled={!!joining}
              style={styles.join}
            />
          ) : (
            <Text style={styles.full}>{t('table.tables_full')}</Text>
          )}
        </Card>
      ))}
      <Pressable onPress={() => void load()} style={styles.refresh}>
        <Text style={styles.refreshText}>{t('table.tables_refresh')}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  meta: { flex: 1 },
  name: { ...typography.h2, color: colors.text.primary },
  seats: { ...typography.micro, color: colors.text.secondary, marginTop: 4 },
  join: { minWidth: 88, minHeight: 44, paddingHorizontal: spacing.md },
  full: { ...typography.caption, color: colors.text.disabled, fontWeight: '700' },
  empty: { ...typography.body, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xl },
  error: { ...typography.caption, color: colors.semantic.danger, marginBottom: spacing.md },
  refresh: { alignItems: 'center', padding: spacing.md },
  refreshText: { ...typography.micro, color: colors.brand.primary },
});
