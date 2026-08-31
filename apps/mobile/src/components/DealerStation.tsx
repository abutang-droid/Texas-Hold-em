import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, palette, shadows } from '../theme';
import { DEALER_LAYOUT } from './table-layout';

interface Props {
  dealing?: boolean;
  phase?: string;
}

function dealerStatusKey(dealing: boolean, phase: string): string {
  if (dealing) return 'table.dealer_dealing';
  if (phase === 'SHOWDOWN' || phase === 'END_HAND') return 'table.dealer_showing';
  return 'table.dealer_waiting';
}

export function DealerStation({ dealing = false, phase = 'WAITING' }: Props) {
  const { t } = useTranslation();

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        { top: `${DEALER_LAYOUT.top}%`, left: `${DEALER_LAYOUT.left}%` },
      ]}
    >
      <View style={[styles.avatar, dealing && styles.avatarDealing, shadows.button]}>
        <Text style={styles.avatarText}>{t('table.dealer_mark')}</Text>
      </View>
      <View style={[styles.pill, dealing && styles.pillDealing]}>
        <Text style={[styles.pillText, dealing && styles.pillTextDealing]}>
          {t(dealerStatusKey(dealing, phase))}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: 72,
    marginLeft: -36,
    marginTop: -6,
    alignItems: 'center',
    zIndex: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.inverse,
    borderWidth: 1.5,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDealing: {
    borderColor: colors.brand.primary,
    borderWidth: 2,
  },
  avatarText: {
    color: colors.brand.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  pill: {
    marginTop: 6,
    backgroundColor: palette.inverse,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
  },
  pillDealing: {
    backgroundColor: palette.accentSoft,
    borderColor: colors.brand.primary,
  },
  pillText: {
    color: colors.text.secondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pillTextDealing: {
    color: colors.brand.primary,
  },
});
