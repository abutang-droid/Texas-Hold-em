import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { PlayingCard } from './ui/PlayingCard';

/** 9-max elliptical seat positions (%, %) */
const SEAT_POSITIONS: Array<{ top: string; left: string }> = [
  { top: '72%', left: '50%' },
  { top: '62%', left: '82%' },
  { top: '38%', left: '90%' },
  { top: '18%', left: '72%' },
  { top: '12%', left: '50%' },
  { top: '18%', left: '28%' },
  { top: '38%', left: '10%' },
  { top: '62%', left: '18%' },
  { top: '72%', left: '35%' },
];

export interface SeatView {
  seatIndex: number;
  userId?: string;
  nickname: string;
  chips: number;
  isActive?: boolean;
  isBot?: boolean;
  holeCards?: string[];
}

interface Props {
  seats: SeatView[];
  potTotal: number;
  communityCards: string[];
  potLabel: string;
  heroUserId?: string | null;
}

export function Table9Max({
  seats,
  potTotal,
  communityCards,
  potLabel,
  heroUserId,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.railOuter}>
        <View style={styles.railHighlight} />
        <View style={styles.rail}>
          <View style={styles.felt}>
            <View style={styles.feltPattern} />
            <View style={styles.center}>
              <View style={styles.communityRow}>
                {communityCards.length > 0 ? (
                  communityCards.map((c, i) => <PlayingCard key={i} code={c} size="md" />)
                ) : (
                  <>
                    <PlayingCard code="**" faceDown size="sm" />
                    <PlayingCard code="**" faceDown size="sm" />
                    <PlayingCard code="**" faceDown size="sm" />
                  </>
                )}
              </View>
              <View style={styles.potChip}>
                <Text style={styles.potLabel}>{potLabel}</Text>
                <Text style={styles.pot}>{potTotal.toLocaleString()}</Text>
              </View>
            </View>
            {SEAT_POSITIONS.map((pos, idx) => {
              const seat = seats.find((s) => s.seatIndex === idx);
              const isHero = heroUserId && seat?.userId === heroUserId;
              const showCards =
                isHero && seat?.holeCards && seat.holeCards[0] !== '**';
              return (
                <View
                  key={idx}
                  style={[
                    styles.seat,
                    { top: pos.top as `${number}%`, left: pos.left as `${number}%` },
                    seat?.isActive && styles.seatActive,
                    isHero && styles.seatHero,
                  ]}
                >
                  {showCards && (
                    <View style={styles.holeCards}>
                      {seat.holeCards!.map((c, i) => (
                        <PlayingCard key={i} code={c} size="sm" />
                      ))}
                    </View>
                  )}
                  <View style={[styles.seatBadge, seat?.isActive && styles.seatBadgeActive]}>
                    <Text style={styles.seatName} numberOfLines={1}>
                      {seat?.nickname ?? '—'}
                      {seat?.isBot ? ' 🤖' : ''}
                    </Text>
                    {seat ? (
                      <Text style={styles.seatChips}>{seat.chips.toLocaleString()}</Text>
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
  seatActive: {},
  seatHero: { zIndex: 2 },
  holeCards: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  seatBadge: {
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
  seatName: { ...typography.micro, color: colors.text.primary, maxWidth: 80 },
  seatChips: { ...typography.micro, color: colors.brand.secondary, fontWeight: '700', marginTop: 2 },
});
