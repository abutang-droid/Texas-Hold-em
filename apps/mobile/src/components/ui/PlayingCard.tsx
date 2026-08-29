import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, typography } from '../../theme';

const SUIT_SYMBOL: Record<string, string> = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

const RANK_LABEL: Record<string, string> = {
  T: '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};

function parseCard(code: string): { rank: string; suit: string; red: boolean } | null {
  if (!code || code === '**' || code.length < 2) return null;
  const suit = code.slice(-1).toLowerCase();
  const rankKey = code.slice(0, -1).toUpperCase();
  if (!SUIT_SYMBOL[suit]) return null;
  const rank = RANK_LABEL[rankKey] ?? rankKey;
  return { rank, suit, red: suit === 'h' || suit === 'd' };
}

interface Props {
  code: string;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
}

export function PlayingCard({ code, size = 'md', faceDown }: Props) {
  const dims = size === 'sm' ? styles.sm : size === 'lg' ? styles.lg : styles.md;
  const parsed = faceDown ? null : parseCard(code);

  if (!parsed) {
    return (
      <View style={[styles.card, dims, styles.back]}>
        <View style={styles.backInner} />
      </View>
    );
  }

  const suitColor = parsed.red ? '#C62828' : colors.text.primary;

  return (
    <View style={[styles.card, dims, styles.face]}>
      <Text style={[styles.rank, { color: suitColor, fontSize: dims.fontSize }]}>
        {parsed.rank}
      </Text>
      <Text style={[styles.suit, { color: suitColor, fontSize: (dims.fontSize ?? 14) + 4 }]}>
        {SUIT_SYMBOL[parsed.suit]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  sm: { width: 28, height: 40, fontSize: 10 },
  md: { width: 36, height: 50, fontSize: 12 },
  lg: { width: 44, height: 62, fontSize: 14 },
  face: {
    backgroundColor: '#FAFAFA',
  },
  back: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.secondary,
  },
  backInner: {
    width: '70%',
    height: '70%',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.5)',
    backgroundColor: 'rgba(15,74,47,0.6)',
  },
  rank: {
    fontSize: 12,
    fontWeight: '700',
  },
  suit: {
    marginTop: -2,
    fontWeight: '600',
  },
});
