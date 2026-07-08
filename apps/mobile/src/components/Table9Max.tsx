import { View, Text, StyleSheet } from 'react-native';
import { designTokens } from '@texas-holdem/shared';

/** 9-max elliptical seat positions (%, %) */
const SEAT_POSITIONS: Array<{ top: string; left: string }> = [
  { top: '72%', left: '50%' },  // 0 bottom
  { top: '62%', left: '82%' },  // 1
  { top: '38%', left: '90%' },  // 2
  { top: '18%', left: '72%' },  // 3
  { top: '12%', left: '50%' },  // 4 top
  { top: '18%', left: '28%' },  // 5
  { top: '38%', left: '10%' },  // 6
  { top: '62%', left: '18%' },  // 7
  { top: '72%', left: '35%' },  // 8
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
}

export function Table9Max({ seats, potTotal, communityCards, potLabel }: Props) {
  const felt = designTokens.color.felt.base;
  const rail = designTokens.color.felt.rail;

  return (
    <View style={[styles.container, { backgroundColor: designTokens.color.bg.lobby }]}>
      <View style={[styles.rail, { backgroundColor: rail }]}>
        <View style={[styles.felt, { backgroundColor: felt }]}>
          <View style={styles.center}>
            <Text style={styles.community}>{communityCards.join(' ') || '—'}</Text>
            <Text style={styles.pot}>{potLabel}: {potTotal}</Text>
          </View>
          {SEAT_POSITIONS.map((pos, idx) => {
            const seat = seats.find((s) => s.seatIndex === idx);
            return (
              <View
                key={idx}
                style={[
                  styles.seat,
                  { top: pos.top as `${number}%`, left: pos.left as `${number}%` },
                  seat?.isActive && styles.seatActive,
                ]}
              >
                <Text style={styles.seatName} numberOfLines={1}>
                  {seat?.nickname ?? ''}
                </Text>
                <Text style={styles.seatChips}>{seat?.chips ?? ''}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  rail: {
    flex: 1,
    margin: 16,
    borderRadius: 999,
    padding: 12,
  },
  felt: {
    flex: 1,
    borderRadius: 999,
    position: 'relative',
  },
  center: {
    position: 'absolute',
    top: '42%',
    left: '35%',
    width: '30%',
    alignItems: 'center',
  },
  community: { color: '#F5F5F5', fontSize: 18, marginBottom: 8 },
  pot: { color: '#C9A227', fontSize: 22, fontWeight: '700' },
  seat: {
    position: 'absolute',
    width: 72,
    marginLeft: -36,
    marginTop: -24,
    alignItems: 'center',
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  seatActive: {
    borderWidth: 2,
    borderColor: '#C9A227',
  },
  seatName: { color: '#F5F5F5', fontSize: 11 },
  seatChips: { color: '#C9A227', fontSize: 12, fontWeight: '600' },
});
