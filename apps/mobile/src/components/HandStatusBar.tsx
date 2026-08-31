import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { LastAction } from '../types/table';
import { colors, palette, radius, shadows, spacing, typography } from '../theme';

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
  connectionStatus?: 'connected' | 'reconnecting' | 'disconnected';
}

export function HandStatusBar({
  phase,
  blinds,
  lastAction,
  handNotice,
  connectionStatus = 'connected',
}: Props) {
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
        <View
          style={[
            styles.notice,
            connectionStatus === 'reconnecting' && styles.noticeReconnect,
            connectionStatus === 'disconnected' && styles.noticeDisconnected,
          ]}
        >
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
    backgroundColor: palette.inverse,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    ...shadows.button,
  },
  phase: { ...typography.micro, color: colors.brand.primary, fontWeight: '700' },
  blinds: { ...typography.micro, color: colors.text.secondary },
  lastAction: { ...typography.micro, color: colors.text.secondary, maxWidth: '100%' },
  notice: {
    backgroundColor: palette.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(46,125,99,0.28)',
  },
  noticeText: { ...typography.micro, color: colors.brand.primary, fontWeight: '600' },
  noticeReconnect: {
    borderColor: 'rgba(74,144,217,0.6)',
    backgroundColor: 'rgba(74,144,217,0.2)',
  },
  noticeDisconnected: {
    borderColor: 'rgba(220,80,80,0.6)',
    backgroundColor: 'rgba(220,80,80,0.2)',
  },
});
