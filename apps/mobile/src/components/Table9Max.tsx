import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { PlayingCard } from './ui/PlayingCard';
import { CommunityCardsRow } from './CommunityCardsRow';
import { PotDisplay } from './PotDisplay';
import { ChipFlyLayer, type ChipFlyEvent } from './ChipFlyLayer';
import { Avatar } from './Avatar';

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
  onChipFlyDone?: (id: string) => void;
}

function HoleCardsRow({ cards, animate }: { cards: string[]; animate?: boolean }) {
  const scale = useRef(new Animated.Value(animate ? 0.5 : 1)).current;
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    scale.setValue(0.5);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }, [animate, scale, opacity]);

  return (
    <Animated.View style={[styles.holeCards, { opacity, transform: [{ scale }] }]}>
      {cards.map((c, i) => (
        <PlayingCard key={i} code={c} size="sm" />
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
  onChipFlyDone,
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
              const hasVisibleCards =
                seat?.holeCards &&
                seat.holeCards[0] !== '**' &&
                (isHero || seat.revealed);
              const isWinner = winnerSeats.includes(idx);
              const isDealer = buttonSeat === idx;
              const isSb = sbSeat === idx;
              const isBb = bbSeat === idx;
              return (
                <View
                  key={idx}
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
                  {hasVisibleCards && (
                    <HoleCardsRow
                      cards={seat.holeCards!}
                      animate={animateHoleDeal && !!isHero}
                    />
                  )}
                  {seatEmojis[idx] ? (
                    <View style={styles.emojiBubble}>
                      <Text style={styles.emojiBubbleText}>{seatEmojis[idx]}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.seatBadge, seat?.isActive && styles.seatBadgeActive, isHero && styles.seatHeroBadge, isWinner && styles.seatWinnerBadge]}>
                    {seat ? (
                      <View style={styles.avatarWrap}>
                        <Avatar nickname={seat.nickname} avatarUrl={seat.avatarUrl} size="sm" />
                      </View>
                    ) : null}
                    <Text style={styles.seatName} numberOfLines={1}>
                      {seat?.nickname ?? '—'}
                      {seat?.isBot ? ' 🤖' : ''}
                    </Text>
                    {seat ? (
                      <Text style={styles.seatChips}>{seat.chips.toLocaleString()}</Text>
                    ) : null}
                    {seat && (seat.betThisRound ?? 0) > 0 ? (
                      <View style={styles.betChip}>
                        <Text style={styles.betChipText}>{seat.betThisRound}</Text>
                      </View>
                    ) : null}
                    {seat?.isActive && turnDeadline ? (
                      <SeatCountdown deadline={turnDeadline} />
                    ) : null}
                  </View>
                </View>
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
