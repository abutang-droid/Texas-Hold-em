import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing, typography } from '../theme';
import { PlayingCard } from './ui/PlayingCard';
import { CommunityCardsRow } from './CommunityCardsRow';
import { PotDisplay } from './PotDisplay';
import { ChipFlyLayer, type ChipFlyEvent } from './ChipFlyLayer';
import { Avatar } from './Avatar';
import type { SeatAction } from '../types/table';

function SeatCountdown({ deadline }: { deadline: number }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const tick = () => setSec(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (sec <= 0) return null;
  return (
    <View style={styles.countdown}>
      <Text style={[styles.countdownText, sec <= 5 && styles.countdownUrgent]}>{sec}</Text>
    </View>
  );
}

/** 6-max elliptical seat positions (%, %) */
const SEAT_POSITIONS: Array<{ top: string; left: string }> = [
  { top: '72%', left: '50%' },
  { top: '62%', left: '82%' },
  { top: '22%', left: '78%' },
  { top: '12%', left: '50%' },
  { top: '22%', left: '22%' },
  { top: '62%', left: '18%' },
];

export interface SeatView {
  seatIndex: number;
  userId?: string;
  nickname: string;
  chips: number;
  betThisRound?: number;
  status?: string;
  isActive?: boolean;
  isBot?: boolean;
  avatarUrl?: string | null;
  revealed?: boolean;
  holeCards?: string[];
}

interface Props {
  seats: SeatView[];
  potTotal: number;
  communityCards: string[];
  potLabel: string;
  heroUserId?: string | null;
  buttonSeat?: number;
  sbSeat?: number | null;
  bbSeat?: number | null;
  turnDeadline?: number | null;
  winnerSeats?: number[];
  chipFlyEvents?: ChipFlyEvent[];
  animateHoleDeal?: boolean;
  seatEmojis?: Record<number, string>;
  phase?: string;
  onChipFlyDone?: (id: string) => void;
  onSeatPress?: (seatIndex: number) => void;
  emptySeatLabel?: string;
  seatActions?: Record<number, SeatAction>;
}

const ACTION_I18N: Record<string, string> = {
  fold: 'game.action.fold',
  check: 'game.action.check',
  call: 'game.action.call',
  raise: 'game.action.raise',
  bet: 'game.action.bet',
  all_in: 'game.action.allIn',
  sb: 'game.action.sb',
  bb: 'game.action.bb',
  thinking: 'game.action.thinking',
};

function actionTone(type: string): 'fold' | 'check' | 'call' | 'raise' | 'allin' | 'blind' | 'turn' {
  if (type === 'fold') return 'fold';
  if (type === 'check') return 'check';
  if (type === 'call') return 'call';
  if (type === 'raise' || type === 'bet') return 'raise';
  if (type === 'all_in') return 'allin';
  if (type === 'sb' || type === 'bb') return 'blind';
  if (type === 'thinking') return 'turn';
  return 'check';
}

function SeatActionBadge({ action }: { action: SeatAction }) {
  const { t } = useTranslation();
  const key = ACTION_I18N[action.type] ?? 'game.action.check';
  const showAmt =
    action.amount != null &&
    action.amount > 0 &&
    ['call', 'raise', 'bet', 'all_in', 'sb', 'bb'].includes(action.type);
  const tone = actionTone(action.type);
  return (
    <View style={[styles.actionBadge, ACTION_BG[tone]]}>
      <Text style={[styles.actionBadgeText, ACTION_FG[tone]]} numberOfLines={1}>
        {t(key)}
        {showAmt ? ` ${action.amount}` : ''}
      </Text>
    </View>
  );
}

const ACTION_BG = {
  fold: { backgroundColor: 'rgba(80,80,80,0.92)' },
  check: { backgroundColor: 'rgba(70,120,180,0.92)' },
  call: { backgroundColor: 'rgba(46,125,50,0.92)' },
  raise: { backgroundColor: 'rgba(201,162,39,0.95)' },
  allin: { backgroundColor: 'rgba(180,40,40,0.95)' },
  blind: { backgroundColor: 'rgba(40,40,40,0.88)' },
  turn: { backgroundColor: 'rgba(201,162,39,0.95)' },
} as const;

const ACTION_FG = {
  fold: { color: '#E0E0E0' },
  check: { color: '#fff' },
  call: { color: '#fff' },
  raise: { color: '#1A1A1A' },
  allin: { color: '#fff' },
  blind: { color: '#F3E6B8' },
  turn: { color: '#1A1A1A' },
} as const;

function HoleCardsRow({
  cards,
  animate,
  dealDelayMs = 0,
  faceDown,
}: {
  cards: string[];
  animate?: boolean;
  dealDelayMs?: number;
  faceDown?: boolean;
}) {
  const slide = useRef(new Animated.Value(animate ? -14 : 0)).current;
  const opacity = useRef(new Animated.Value(animate ? 0.25 : 1)).current;

  useEffect(() => {
    if (!animate) {
      slide.setValue(0);
      opacity.setValue(1);
      return;
    }
    slide.setValue(-16);
    opacity.setValue(0.25);
    Animated.sequence([
      Animated.delay(dealDelayMs),
      Animated.parallel([
        Animated.spring(slide, { toValue: 0, friction: 7, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();
  }, [animate, dealDelayMs, opacity, slide]);

  return (
    <Animated.View style={[styles.holeCards, { opacity, transform: [{ translateY: slide }] }]}>
      {cards.map((c, i) => (
        <PlayingCard key={i} code={c} size="sm" faceDown={faceDown || c === '**'} />
      ))}
    </Animated.View>
  );
}

export function Table9Max({
  seats,
  potTotal,
  communityCards,
  potLabel,
  heroUserId,
  buttonSeat = 0,
  sbSeat = null,
  bbSeat = null,
  turnDeadline,
  winnerSeats = [],
  chipFlyEvents = [],
  animateHoleDeal = false,
  seatEmojis = {},
  phase = 'WAITING',
  onChipFlyDone,
  onSeatPress,
  emptySeatLabel,
  seatActions = {},
}: Props) {
  return (
    <View style={styles.container}>
      <ChipFlyLayer events={chipFlyEvents} onDone={(id) => onChipFlyDone?.(id)} />
      <View style={styles.railOuter}>
        <View style={styles.railHighlight} />
        <View style={styles.rail}>
          <View style={styles.felt}>
            <View style={styles.feltPattern} />
            <View style={styles.center}>
              <CommunityCardsRow cards={communityCards} />
              <PotDisplay potTotal={potTotal} potLabel={potLabel} />
            </View>
            {SEAT_POSITIONS.map((pos, idx) => {
              const seat = seats.find((s) => s.seatIndex === idx);
              const isHero = heroUserId && seat?.userId === heroUserId;
              const inHand =
                !!seat &&
                phase !== 'WAITING' &&
                seat.status !== 'SIT_OUT' &&
                seat.status !== 'FOLDED';
              const heroOrRevealed =
                seat?.holeCards &&
                seat.holeCards[0] !== '**' &&
                (isHero || seat.revealed);
              const holeCards = heroOrRevealed
                ? seat!.holeCards!
                : inHand
                  ? ['**', '**']
                  : null;
              const isWinner = winnerSeats.includes(idx);
              const isDealer = buttonSeat === idx;
              const isSb = sbSeat === idx;
              const isBb = bbSeat === idx;
              const canSit = !seat && !!onSeatPress;
              const streetAction =
                seatActions[idx] ??
                (seat?.status === 'FOLDED'
                  ? { type: 'fold' }
                  : seat?.status === 'ALL_IN'
                    ? { type: 'all_in' }
                    : undefined);
              const badgeAction = seat?.isActive
                ? { type: 'thinking' }
                : streetAction;
              return (
                <Pressable
                  key={idx}
                  disabled={!canSit}
                  onPress={() => onSeatPress?.(idx)}
                  style={[
                    styles.seat,
                    { top: pos.top as `${number}%`, left: pos.left as `${number}%` },
                    seat?.isActive && styles.seatActive,
                    isHero && styles.seatHero,
                    isWinner && styles.seatWinner,
                  ]}
                >
                  {isDealer && seat ? (
                    <View style={styles.dealerBtn}>
                      <Text style={styles.dealerBtnText}>D</Text>
                    </View>
                  ) : null}
                  {isSb && seat ? (
                    <View style={[styles.blindBadge, styles.sbBadge]}>
                      <Text style={styles.blindBadgeText}>SB</Text>
                    </View>
                  ) : null}
                  {isBb && seat ? (
                    <View style={[styles.blindBadge, styles.bbBadge]}>
                      <Text style={styles.blindBadgeText}>BB</Text>
                    </View>
                  ) : null}
                  {holeCards && (
                    <HoleCardsRow
                      cards={holeCards}
                      animate={animateHoleDeal}
                      dealDelayMs={idx * 70}
                      faceDown={!heroOrRevealed}
                    />
                  )}
                  {seatEmojis[idx] ? (
                    <View style={styles.emojiBubble}>
                      <Text style={styles.emojiBubbleText}>{seatEmojis[idx]}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.seatBadge, seat?.isActive && styles.seatBadgeActive, isHero && styles.seatHeroBadge, isWinner && styles.seatWinnerBadge, canSit && styles.seatEmptyTappable]}>
                    {seat ? (
                      <View style={styles.avatarWrap}>
                        <Avatar nickname={seat.nickname} avatarUrl={seat.avatarUrl} size="sm" />
                      </View>
                    ) : null}
                    <Text style={styles.seatName} numberOfLines={1}>
                      {seat?.nickname ?? (canSit ? emptySeatLabel ?? '坐下' : '—')}
                      {seat?.isBot ? ' 🤖' : ''}
                    </Text>
                    {seat ? (
                      <Text style={styles.seatChips}>{seat.chips.toLocaleString()}</Text>
                    ) : null}
                    {seat && badgeAction ? <SeatActionBadge action={badgeAction} /> : null}
                    {seat && (seat.betThisRound ?? 0) > 0 && (!streetAction || seat.isActive) ? (
                      <View style={styles.betChip}>
                        <Text style={styles.betChipText}>{seat.betThisRound}</Text>
                      </View>
                    ) : null}
                    {seat?.isActive && turnDeadline ? (
                      <SeatCountdown deadline={turnDeadline} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.lobby },
  railOuter: {
    flex: 1,
    margin: spacing.lg,
    borderRadius: 999,
    padding: 6,
    backgroundColor: colors.felt.rail,
  },
  railHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.felt.railHighlight,
    opacity: 0.5,
  },
  rail: {
    flex: 1,
    borderRadius: 999,
    padding: 10,
    backgroundColor: colors.felt.rail,
  },
  felt: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: colors.felt.base,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  feltPattern: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    margin: 24,
  },
  center: {
    position: 'absolute',
    top: '38%',
    left: '28%',
    width: '44%',
    alignItems: 'center',
  },
  communityRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  potChip: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.4)',
    alignItems: 'center',
  },
  potLabel: { ...typography.micro, color: colors.text.secondary },
  pot: { ...typography.pot, color: colors.brand.secondary },
  seat: {
    position: 'absolute',
    width: 88,
    marginLeft: -44,
    marginTop: -20,
    alignItems: 'center',
  },
  dealerBtn: {
    position: 'absolute',
    top: -8,
    left: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  dealerBtnText: { fontSize: 10, fontWeight: '800', color: '#1A1A1A' },
  blindBadge: {
    position: 'absolute',
    top: -8,
    right: -4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    zIndex: 5,
  },
  sbBadge: { backgroundColor: '#4A90D9' },
  bbBadge: { backgroundColor: '#C94A4A' },
  blindBadgeText: { fontSize: 8, fontWeight: '800', color: '#fff' },
  avatarWrap: { marginBottom: 4 },
  emojiBubble: {
    position: 'absolute',
    top: -36,
    zIndex: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.5)',
  },
  emojiBubbleText: { fontSize: 22 },
  seatActive: {},
  seatHero: { zIndex: 2 },
  seatWinner: { zIndex: 3 },
  holeCards: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  seatBadge: {
    position: 'relative',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 72,
  },
  seatBadgeActive: {
    borderColor: colors.brand.secondary,
    borderWidth: 2,
    backgroundColor: 'rgba(201,162,39,0.15)',
  },
  seatHeroBadge: {
    borderColor: colors.semantic.info,
  },
  seatEmptyTappable: {
    borderColor: 'rgba(201,162,39,0.65)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(201,162,39,0.12)',
  },
  seatWinnerBadge: {
    borderColor: colors.brand.secondary,
    borderWidth: 2,
    backgroundColor: 'rgba(201,162,39,0.35)',
    shadowColor: colors.brand.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  seatName: { ...typography.micro, color: colors.text.primary, maxWidth: 80 },
  seatChips: { ...typography.micro, color: colors.brand.secondary, fontWeight: '700', marginTop: 2 },
  betChip: {
    marginTop: 4,
    backgroundColor: 'rgba(201,162,39,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  betChipText: { ...typography.micro, color: '#1A1A1A', fontWeight: '700', fontSize: 10 },
  actionBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 36,
    alignItems: 'center',
  },
  actionBadgeText: {
    ...typography.micro,
    fontWeight: '800',
    fontSize: 10,
  },
  countdown: {
    position: 'absolute',
    top: -10,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  countdownText: { fontSize: 11, fontWeight: '800', color: '#1A1A1A' },
  countdownUrgent: { color: colors.semantic.danger },
});
