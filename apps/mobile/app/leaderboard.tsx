import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { getLeaderboard } from '../src/api/client';
import { Screen, ScreenHeader } from '../src/components/ui/Screen';
import { Card } from '../src/components/ui/Card';
import { colors, palette, spacing, typography } from '../src/theme';

type Tab = 'profit' | 'pot';

interface Row {
  userId: number;
  nickname: string;
  score: number;
}

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('profit');
  const [profit, setProfit] = useState<Row[]>([]);
  const [pot, setPot] = useState<Row[]>([]);
  const [refreshedAt, setRefreshedAt] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const board = await getLeaderboard();
      setProfit(board.profit);
      setPot(board.biggestPot);
      setRefreshedAt(board.refreshedAt);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = tab === 'profit' ? profit : pot;

  return (
    <Screen scroll loading={loading} loadingLabel={t('common.loading')}>
      <ScreenHeader
        title={t('leaderboard.title')}
        subtitle={refreshedAt ? t('leaderboard.updated', { time: new Date(refreshedAt).toLocaleString() }) : undefined}
        onBack={() => router.back()}
        backLabel={t('leaderboard.back')}
      />

      <View style={styles.tabs}>
        <TabBtn
          label={t('leaderboard.profit')}
          active={tab === 'profit'}
          onPress={() => setTab('profit')}
        />
        <TabBtn
          label={t('leaderboard.biggest_pot')}
          active={tab === 'pot'}
          onPress={() => setTab('pot')}
        />
      </View>

      <Card>
        {rows.length === 0 ? (
          <Text style={styles.empty}>{t('leaderboard.empty')}</Text>
        ) : (
          rows.map((row, i) => (
            <View key={`${row.userId}-${i}`} style={styles.row}>
              <View
                style={[
                  styles.medal,
                  i === 0 && styles.medalGold,
                  i === 1 && styles.medalSilver,
                  i === 2 && styles.medalBronze,
                ]}
              >
                <Text style={[styles.medalText, i === 0 && styles.medalTextDark]}>{i + 1}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {row.nickname}
              </Text>
              <Text style={styles.score}>
                {tab === 'profit' ? '+' : ''}
                {row.score.toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

function TabBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Text style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    backgroundColor: colors.bg.card,
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: spacing.md,
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.brand.secondary,
    color: palette.inverse,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  medal: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.felt.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  medal0: { backgroundColor: colors.brand.secondary },
  medalGold: { backgroundColor: colors.brand.secondary },
  medalSilver: { backgroundColor: '#9E9E9E' },
  medalBronze: { backgroundColor: '#8D6E63' },
  medalText: { ...typography.micro, color: colors.text.primary, fontWeight: '700' },
  medalTextDark: { color: palette.inverse },
  name: { flex: 1, ...typography.body, color: colors.text.primary },
  score: { ...typography.caption, color: colors.semantic.success, fontWeight: '700' },
  empty: { ...typography.body, color: colors.text.secondary, textAlign: 'center', padding: spacing.xl },
});
