import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HandWinner, SettlementPot, SettlementRefund } from '../types/table';
import { colors, palette, radius, shadows, spacing, typography } from '../theme';

const STEP_MS = 1600;

interface Props {
  visible: boolean;
  handId: string;
  winners: HandWinner[];
  potSize: number;
  boardCards: string;
  nextHandIn: number;
  refunds?: SettlementRefund[];
  pots?: SettlementPot[];
  onStep?: (info: {
    seatIndexes: number[];
    amounts: number[];
    kind: 'refund' | 'pot';
  }) => void;
}

type Step = {
  key: string;
  kind: 'refund' | 'pot';
  label: string;
  amount: number;
  seats: number[];
  payouts: number[];
  detail?: string;
};

export function ShowdownOverlay({
  visible,
  handId,
  winners,
  potSize,
  boardCards,
  nextHandIn,
  refunds = [],
  pots = [],
  onStep,
}: Props) {
  const { t } = useTranslation();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  const [stepIndex, setStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(nextHandIn / 1000));
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  const startedFor = useRef<string | null>(null);

  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [];
    for (const r of refunds) {
      out.push({
        key: `refund-${r.seatIndex}-${r.amount}`,
        kind: 'refund',
        label: t('showdown.refund_line', { name: r.nickname, amount: r.amount }),
        amount: r.amount,
        seats: [r.seatIndex],
        payouts: [r.amount],
      });
    }
    if (pots.length > 0) {
      pots.forEach((pot, i) => {
        const names = pot.winners.map((w) => w.nickname).join('、');
        const potName =
          pot.kind === 'side'
            ? t('showdown.side_pot', { n: pot.sideIndex ?? i })
            : t('showdown.main_pot');
        const split = pot.winners.length > 1;
        out.push({
          key: `pot-${pot.kind}-${i}`,
          kind: 'pot',
          label: split
            ? t('showdown.pot_split', { pot: potName, names, amount: pot.amount })
            : t('showdown.pot_win', {
                pot: potName,
                name: pot.winners[0]?.nickname ?? '',
                amount: pot.amount,
              }),
          amount: pot.amount,
          seats: pot.winners.map((w) => w.seatIndex),
          payouts: pot.winners.map((w) => w.amount),
          detail: pot.winners.map((w) => `${w.nickname} +${w.amount}`).join('  '),
        });
      });
    } else if (winners.length > 0) {
      const names = winners.map((w) => w.nickname).join('、');
      out.push({
        key: `fallback-${handId}`,
        kind: 'pot',
        label:
          winners.length > 1
            ? t('showdown.headline_split', { names })
            : t('showdown.headline_win', { name: winners[0].nickname }),
        amount: potSize,
        seats: winners.map((w) => w.seatIndex),
        payouts: winners.map((w) => w.winAmount),
        detail: winners.map((w) => `${w.nickname} +${w.winAmount}`).join('  '),
      });
    }
    return out;
  }, [refunds, pots, winners, potSize, handId, t]);

  const headline = useMemo(() => {
    if (winners.length === 1) return t('showdown.headline_win', { name: winners[0].nickname });
    if (winners.length > 1) {
      return t('showdown.headline_split', { names: winners.map((w) => w.nickname).join('、') });
    }
    return t('showdown.title');
  }, [winners, t]);

  useEffect(() => {
    if (!visible || !handId) return;
    fade.setValue(0);
    slide.setValue(16);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [visible, handId, fade, slide]);

  useEffect(() => {
    if (!visible || !handId) return;
    const endsAt = Date.now() + nextHandIn;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [visible, handId, nextHandIn]);

  useEffect(() => {
    if (!visible || !handId || steps.length === 0) return;
    if (startedFor.current !== handId) {
      startedFor.current = handId;
      setStepIndex(0);
      const first = steps[0];
      onStepRef.current?.({
        seatIndexes: first.seats,
        amounts: first.payouts,
        kind: first.kind,
      });
    }
    if (steps.length <= 1) return;
    const id = setInterval(() => {
      setStepIndex((cur) => {
        const next = Math.min(steps.length - 1, cur + 1);
        if (next !== cur) {
          const step = steps[next];
          onStepRef.current?.({
            seatIndexes: step.seats,
            amounts: step.payouts,
            kind: step.kind,
          });
        }
        return next;
      });
    }, STEP_MS);
    return () => clearInterval(id);
  }, [visible, handId, steps]);

  if (!visible) return null;

  const board = boardCards.trim() ? boardCards.split(/\s+/) : [];
  const current = steps[stepIndex];

  return (
    <View style={styles.bannerWrap} pointerEvents="none">
      <Animated.View
        style={[styles.banner, { opacity: fade, transform: [{ translateY: slide }] }]}
      >
        <View style={styles.topRow}>
          <Text style={styles.title}>{headline}</Text>
          <View style={styles.timerChip}>
            <Text style={styles.timerText}>{secondsLeft}s</Text>
          </View>
        </View>
        {board.length > 0 ? (
          <Text style={styles.board} numberOfLines={1}>
            {t('showdown.board')}: {board.join(' ')}
          </Text>
        ) : null}
        <Text style={styles.pot}>
          {t('showdown.pot')}: {potSize.toLocaleString()}
        </Text>
        {current ? (
          <View style={styles.currentBox}>
            <Text style={styles.currentLabel}>{current.label}</Text>
            {current.kind === 'pot' && current.detail ? (
              <Text style={styles.currentDetail}>{current.detail}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.noWinner}>{t('showdown.no_winner')}</Text>
        )}
        {steps.length > 1
          ? steps.map((step, i) => (
              <Text
                key={step.key}
                style={[styles.stepLine, i === stepIndex && styles.stepLineActive]}
                numberOfLines={2}
              >
                {i <= stepIndex ? '●' : '○'} {step.label}
              </Text>
            ))
          : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    position: 'absolute',
    top: '32%',
    left: 16,
    right: 16,
    zIndex: 40,
    alignItems: 'center',
  },
  banner: {
    maxWidth: 380,
    width: '100%',
    backgroundColor: palette.inverse,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: palette.line,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '800',
    flex: 1,
  },
  timerChip: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 36,
    alignItems: 'center',
  },
  timerText: {
    color: palette.inverse,
    fontSize: 12,
    fontWeight: '800',
  },
  board: {
    ...typography.micro,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  pot: {
    ...typography.micro,
    color: colors.brand.primary,
    fontWeight: '700',
    marginBottom: 6,
  },
  currentBox: {
    backgroundColor: palette.accentSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  currentLabel: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '800',
    textAlign: 'center',
  },
  currentDetail: {
    ...typography.micro,
    color: colors.semantic.success,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '700',
  },
  noWinner: { ...typography.micro, color: colors.text.secondary, textAlign: 'center' },
  stepLine: {
    ...typography.micro,
    color: colors.text.secondary,
    marginTop: 2,
  },
  stepLineActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
});
