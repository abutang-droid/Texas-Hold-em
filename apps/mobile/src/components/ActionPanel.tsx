import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PokerAction, TurnContext } from '../types/table';
import { TurnTimer } from './TurnTimer';
import { colors, palette, radius, shadows, spacing, typography } from '../theme';

interface Props {
  turn: TurnContext;
  onAction: (action: PokerAction, amount?: number) => void;
}

function snapRaise(value: number, min: number, max: number, step: number): number {
  const clamped = Math.max(min, Math.min(max, value));
  if (max <= min) return min;
  const snapped = Math.round(clamped / step) * step;
  return Math.max(min, Math.min(max, snapped));
}

export function ActionPanel({ turn, onAction }: Props) {
  const { t } = useTranslation();
  const [raiseMode, setRaiseMode] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  const step = useMemo(() => {
    const range = turn.maxRaise - turn.minRaise;
    if (range <= 20) return 1;
    if (range <= 100) return 2;
    return 5;
  }, [turn.minRaise, turn.maxRaise]);

  const [raiseTotal, setRaiseTotal] = useState(turn.minRaise);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBusy(false);
  }, [turn.seatIndex, turn.deadline, turn.callAmount]);

  const fire = (action: PokerAction, amount?: number) => {
    if (busy) return;
    setBusy(true);
    onAction(action, amount);
  };

  const can = (a: PokerAction) => turn.validActions.includes(a);
  const canRaise = can('raise') && turn.maxRaise > turn.minRaise;
  const canCheck = can('check');
  const canCall = can('call') && turn.callAmount > 0;
  const canFold = can('fold');
  const canAllIn = can('all_in');

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const setRaiseFromX = useCallback(
    (x: number) => {
      if (trackWidth <= 0 || turn.maxRaise <= turn.minRaise) return;
      const ratio = Math.max(0, Math.min(1, x / trackWidth));
      const raw = turn.minRaise + ratio * (turn.maxRaise - turn.minRaise);
      setRaiseTotal(snapRaise(raw, turn.minRaise, turn.maxRaise, step));
    },
    [trackWidth, turn.minRaise, turn.maxRaise, step],
  );

  const confirmRaise = () => {
    fire('raise', raiseTotal);
    setRaiseMode(false);
  };

  const callLabel = canCall
    ? `${t('game.action.call')} ${turn.callAmount}`
    : t('game.action.call');

  if (raiseMode && canRaise) {
    const ratio =
      turn.maxRaise > turn.minRaise
        ? (raiseTotal - turn.minRaise) / (turn.maxRaise - turn.minRaise)
        : 0;

    return (
      <View style={styles.panel}>
        <TurnTimer deadline={turn.deadline} />
        <Text style={styles.raiseHint}>
          {t('game.raise_to')}: <Text style={styles.raiseValue}>{raiseTotal}</Text>
        </Text>
        <Pressable
          style={styles.track}
          onLayout={onTrackLayout}
          onPress={(e) => setRaiseFromX(e.nativeEvent.locationX)}
        >
          <View style={[styles.trackFill, { width: `${ratio * 100}%` }]} />
          <View style={[styles.thumb, { left: `${ratio * 100}%` }]} />
        </Pressable>
        <View style={styles.presetRow}>
          <PresetChip
            label={t('game.preset.min')}
            onPress={() => setRaiseTotal(turn.minRaise)}
          />
          <PresetChip
            label="½"
            onPress={() =>
              setRaiseTotal(
                snapRaise(
                  (turn.minRaise + turn.maxRaise) / 2,
                  turn.minRaise,
                  turn.maxRaise,
                  step,
                ),
              )
            }
          />
          <PresetChip
            label={t('game.preset.max')}
            onPress={() => setRaiseTotal(turn.maxRaise)}
          />
        </View>
        <View style={styles.row}>
          <ActionBtn label={t('game.action.cancel')} variant="ghost" onPress={() => setRaiseMode(false)} />
          {canAllIn && (
            <ActionBtn
              label={t('game.action.allIn')}
              variant="allin"
              onPress={() => fire('all_in')}
            />
          )}
          <ActionBtn label={t('game.action.raise')} variant="raise" onPress={confirmRaise} flex />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <TurnTimer deadline={turn.deadline} />
      <View style={styles.row}>
        {canFold && (
          <ActionBtn label={t('game.action.fold')} variant="fold" onPress={() => fire('fold')} flex />
        )}
        {canCheck && (
          <ActionBtn
            label={t('game.action.check')}
            variant="check"
            onPress={() => fire('check')}
            flex
          />
        )}
        {canCall && (
          <ActionBtn label={callLabel} variant="call" onPress={() => fire('call')} flex />
        )}
        {canRaise && (
          <ActionBtn
            label={t('game.action.raise')}
            variant="raise"
            onPress={() => {
              setRaiseTotal(turn.minRaise);
              setRaiseMode(true);
            }}
            flex
          />
        )}
        {!canRaise && canAllIn && (
          <ActionBtn
            label={t('game.action.allIn')}
            variant="allin"
            onPress={() => fire('all_in')}
            flex
          />
        )}
      </View>
    </View>
  );
}

function PresetChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.preset} onPress={onPress}>
      <Text style={styles.presetText}>{label}</Text>
    </Pressable>
  );
}

function ActionBtn({
  label,
  onPress,
  variant,
  flex,
}: {
  label: string;
  onPress: () => void;
  variant: 'fold' | 'check' | 'call' | 'raise' | 'allin' | 'ghost';
  flex?: boolean;
}) {
  const lightLabel = variant === 'fold' || variant === 'check' || variant === 'ghost';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        flex && styles.btnFlex,
        styles[`btn_${variant}`],
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text
        style={[styles.btnText, lightLabel && styles.btnTextInk, variant === 'fold' && styles.btnTextFold]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: palette.inverse,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.line,
    ...shadows.card,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  btnFlex: { flex: 1, minWidth: 0 },
  btn_fold: {
    backgroundColor: palette.inverse,
    borderWidth: 1.5,
    borderColor: colors.semantic.danger,
  },
  btn_check: {
    backgroundColor: palette.inverse,
    borderWidth: 1.5,
    borderColor: palette.line,
  },
  btn_call: { backgroundColor: colors.brand.primary },
  btn_raise: { backgroundColor: colors.brand.primary },
  btn_allin: { backgroundColor: colors.semantic.danger },
  btn_ghost: {
    backgroundColor: palette.inverse,
    borderWidth: 1.5,
    borderColor: palette.line,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  btnText: { color: palette.inverse, fontWeight: '800', fontSize: 14 },
  btnTextInk: { color: colors.text.primary },
  btnTextFold: { color: colors.semantic.danger },
  raiseHint: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing.sm },
  raiseValue: { color: colors.brand.primary, fontWeight: '800' },
  track: {
    height: 36,
    backgroundColor: palette.accentSoft,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    justifyContent: 'center',
    overflow: 'visible',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(46,125,99,0.28)',
    borderRadius: radius.md,
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    backgroundColor: colors.brand.primary,
    borderWidth: 2,
    borderColor: palette.inverse,
    top: 8,
  },
  presetRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  preset: {
    flex: 1,
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: { ...typography.micro, color: colors.brand.primary, fontWeight: '700' },
});
