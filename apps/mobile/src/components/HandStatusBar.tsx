import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { LastAction } from '../types/table';
import { colors, radius, spacing, typography } from '../theme';

function formatAction(action: LastAction, t: TFunction): string {
  const keyMap: Record<string, string> = {
    fold: 'game.action.fold',
    check: 'game.action.check',
    call: 'game.action.call',
    raise: 'game.action.raise',
    all_in: 'game.action.allIn',
  };
  const label = t(keyMap[action.actionType] ?? 'game.action.check');
  const amt = action.amount != null ? ` ${action.amount}` : '';
  const auto = action.autoAction ? ` (${t('game.auto')})` : '';
  return `${action.nickname} ${label}${amt}${auto}`;
}

const PHASE_KEYS: Record<string, string> = {
  WAITING: 'game.phase.waiting',
  PRE_FLOP: 'game.phase.preflop',
  FLOP: 'game.phase.flop',
  TURN: 'game.phase.turn',
  RIVER: 'game.phase.river',
  SHOWDOWN: 'game.phase.showdown',
  END_HAND: 'game.phase.end',
};

interface Props {
  phase: string;
  blinds: { sb: number; bb: number };
  lastAction?: LastAction | null;
  handNotice?: string | null;
}

export function HandStatusBar({ phase, blinds, lastAction, handNotice }: Props) {
  const { t } = useTranslation();
  const phaseKey = PHASE_KEYS[phase] ?? 'game.phase.waiting';

  return (
    <View style={styles.bar}>
      <View style={styles.phasePill}>
        <Text style={styles.phase}>{t(phaseKey)}</Text>
        <Text style={styles.blinds}>
          {t('game.blinds')}: {blinds.sb}/{blinds.bb}
        </Text>
      </View>
      {handNotice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{handNotice}</Text>
        </View>
      ) : lastAction ? (
        <Text style={styles.lastAction} numberOfLines={1}>
          {formatAction(lastAction, t)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 12,
    left: 100,
    right: 16,
    zIndex: 10,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  phase: { ...typography.micro, color: colors.brand.secondary, fontWeight: '700' },
  blinds: { ...typography.micro, color: colors.text.secondary },
  lastAction: { ...typography.micro, color: colors.text.secondary, maxWidth: '100%' },
  notice: {
    backgroundColor: 'rgba(201,162,39,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.4)',
  },
  noticeText: { ...typography.micro, color: colors.brand.secondary, fontWeight: '600' },
});
