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
function formatStack(chips: number): string {
  if (chips >= 10_000) return `${Math.round(chips / 1000)}k`;
  if (chips >= 1000) return `${(chips / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(chips);
}

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
  isSpectator?: boolean;
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
  compact,
}: {
  cards: string[];
  animate?: boolean;
  dealDelayMs?: number;
  faceDown?: boolean;
  compact?: boolean;
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
    <Animated.View
      style={[
        compact ? styles.holeCardsEmbedded : styles.holeCards,
        { opacity, transform: [{ translateY: slide }] },
      ]}
    >
      {cards.map((c, i) => (
        <View key={i} style={compact && i > 0 ? styles.rivalCardOverlap : undefined}>
          <PlayingCard
            code={compact ? '**' : c}
            size={compact ? 'xs' : 'sm'}
            faceDown={compact || faceDown || c === '**'}
          />
        </View>
      ))}
    </Animated.View>
  );
}

function SeatProfileCard({
  nickname,
  chips,
  isBot,
  avatarUrl,
}: {
  nickname: string;
  chips: number;
  isBot?: boolean;
  avatarUrl?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.profileCard}>
      <Avatar nickname={nickname} avatarUrl={avatarUrl} size="md" />
      <Text style={styles.profileName} numberOfLines={2}>
        {nickname}
      </Text>
      <Text style={styles.profileMeta}>
        {isBot ? t('table.profile_bot') : t('table.profile_human')}
      </Text>
      <Text style={styles.profileChips}>
        {t('table.profile_chips', { amount: chips.toLocaleString() })}
      </Text>
    </View>
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
  isSpectator = false,
}: Props) {
  const [profileSeat, setProfileSeat] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      <ChipFlyLayer events={chipFlyEvents} onDone={(id) => onChipFlyDone?.(id)} />
      <View style={styles.railOuter}>
        <View style={styles.railHighlight} />
        <View style={styles.rail}>
          <Pressable style={styles.felt} onPress={() => setProfileSeat(null)}>
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
              const realHoles =
                !!seat?.holeCards &&
                seat.holeCards.length >= 2 &&
                seat.holeCards[0] !== '**';
              const showFaceUp =
                realHoles &&
                (!!isHero ||
                  !!seat?.revealed ||
                  phase === 'SHOWDOWN' ||
                  phase === 'END_HAND');
              const holeCards = showFaceUp
                ? seat!.holeCards!
                : inHand
                  ? ['**', '**']
                  : null;
              const holeCompact = !showFaceUp;
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
              const showProfile = profileSeat === idx && !!seat;
              return (
                <Pressable
                  key={idx}
                  disabled={!canSit && !seat}
                  onPress={() => {
                    if (canSit) onSeatPress?.(idx);
                    else if (!seat) setProfileSeat(null);
                  }}
                  style={[
                    styles.seat,
                    { top: pos.top as `${number}%`, left: pos.left as `${number}%` },
                    seat?.isActive && styles.seatActive,
                    isHero && styles.seatHero,
                    isWinner && styles.seatWinner,
                    showProfile && styles.seatProfileOpen,
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
                  {!holeCompact && holeCards ? (
                    <HoleCardsRow
                      cards={holeCards}
                      animate={animateHoleDeal}
                      dealDelayMs={idx * 70}
                      faceDown={false}
                      compact={false}
                    />
                  ) : null}
                  {seatEmojis[idx] ? (
                    <View style={styles.emojiBubble}>
                      <Text style={styles.emojiBubbleText}>{seatEmojis[idx]}</Text>
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.seatBadge,
                      !seat && styles.seatBadgeEmpty,
                      canSit && styles.seatEmptyTappable,
                    ]}
                  >
                    {showProfile && seat ? (
                      <SeatProfileCard
                        nickname={seat.nickname}
                        chips={seat.chips}
                        isBot={seat.isBot}
                        avatarUrl={seat.avatarUrl}
                      />
                    ) : null}
                    {seat ? (
                      <View
                        style={[
                          styles.avatarWrap,
                          seat.isActive && styles.avatarWrapActive,
                          isHero && styles.avatarWrapHero,
                          isWinner && styles.avatarWrapWinner,
                        ]}
                      >
                        <Avatar
                          nickname={seat.nickname}
                          avatarUrl={seat.avatarUrl}
                          size="sm"
                          onPress={() =>
                            setProfileSeat((cur) => (cur === idx ? null : idx))
                          }
                        />
                        <View style={styles.chipBadge}>
                          <Text style={styles.chipBadgeText}>{formatStack(seat.chips)}</Text>
                        </View>
                        {holeCompact && holeCards ? (
                          <View style={styles.rivalHoles}>
                            <HoleCardsRow
                              cards={holeCards}
                              animate={animateHoleDeal}
                              dealDelayMs={idx * 70}
                              faceDown
                              compact
                            />
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <Text style={styles.seatName} numberOfLines={1}>
                        {canSit ? emptySeatLabel ?? '坐下' : '—'}
                      </Text>
                    )}
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
          </Pressable>
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
    overflow: 'visible',
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
  avatarWrap: {
    marginBottom: 2,
    position: 'relative',
    overflow: 'visible',
  },
  avatarWrapActive: {
    shadowColor: '#50c878',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarWrapHero: {
    shadowColor: '#d4af37',
    shadowOpacity: 0.55,
    shadowRadius: 8,
  },
  avatarWrapWinner: {
    shadowColor: '#d4af37',
    shadowOpacity: 0.95,
    shadowRadius: 12,
    elevation: 8,
  },
  chipBadge: {
    position: 'absolute',
    right: -8,
    bottom: -3,
    minWidth: 22,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: '#C9A227',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    alignItems: 'center',
  },
  chipBadgeText: {
    color: '#1A1A1A',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
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
  seatProfileOpen: { zIndex: 24 },
  profileCard: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    marginLeft: -70,
    width: 140,
    marginBottom: 8,
    backgroundColor: 'rgba(18,20,24,0.96)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 30,
  },
  profileName: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  profileMeta: {
    ...typography.micro,
    color: colors.text.secondary,
    marginTop: 2,
  },
  profileChips: {
    ...typography.micro,
    color: colors.brand.secondary,
    fontWeight: '700',
    marginTop: 4,
  },
  holeCards: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  holeCardsEmbedded: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rivalHoles: {
    position: 'absolute',
    left: 42,
    top: 10,
    zIndex: 4,
  },
  rivalCardOverlap: {
    marginLeft: -5,
  },
  seatBadge: {
    position: 'relative',
    alignItems: 'center',
    overflow: 'visible',
  },
  seatBadgeEmpty: {
    minWidth: 52,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: 'rgba(8,16,28,0.35)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(212,175,55,0.28)',
  },
  seatEmptyTappable: {
    borderColor: 'rgba(201,162,39,0.65)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(201,162,39,0.12)',
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
    backgroundColor: '#1E88E5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#BBDEFB',
  },
  countdownText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  countdownUrgent: { color: '#FFCDD2' },
});
