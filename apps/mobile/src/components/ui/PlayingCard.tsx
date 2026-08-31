import { View, Text, StyleSheet } from 'react-native';
import { radius } from '../../theme';

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

const SIZE = {
  xs: { w: 11, h: 15, rank: 7, suit: 8, pad: 0 },
  sm: { w: 34, h: 50, rank: 14, suit: 22, pad: 2 },
  md: { w: 48, h: 68, rank: 18, suit: 32, pad: 3 },
  lg: { w: 58, h: 82, rank: 22, suit: 40, pad: 4 },
} as const;

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
  size?: 'xs' | 'sm' | 'md' | 'lg';
  faceDown?: boolean;
}

function CardBack({ w, h }: { w: number; h: number }) {
  const tight = w < 16;
  if (tight) {
    return <View style={[styles.card, styles.back, styles.backTiny, { width: w, height: h }]} />;
  }
  const inset = Math.max(3, Math.round(w * 0.1));
  const diamond = Math.max(8, Math.round(w * 0.28));
  const inner = Math.max(4, Math.round(diamond * 0.42));
  return (
    <View style={[styles.card, styles.back, { width: w, height: h }]}>
      <View style={[styles.backInset, { top: inset, right: inset, bottom: inset, left: inset }]}>
        <View style={[styles.backLineH, { width: diamond + 6 }]} />
        <View style={[styles.backLineV, { height: diamond + 6 }]} />
        <View style={[styles.backDiamond, { width: diamond, height: diamond }]} />
        <View style={[styles.backDiamondInner, { width: inner, height: inner }]} />
      </View>
    </View>
  );
}

export function PlayingCard({ code, size = 'md', faceDown }: Props) {
  const dim = SIZE[size];
  const parsed = faceDown ? null : parseCard(code);

  if (!parsed) {
    return <CardBack w={dim.w} h={dim.h} />;
  }

  const ink = parsed.red ? '#C62828' : '#1A1A1A';
  const rankSize = parsed.rank === '10' ? Math.max(7, dim.rank - 5) : dim.rank;
  const pip = SUIT_SYMBOL[parsed.suit];

  return (
    <View
      style={[
        styles.card,
        styles.face,
        { width: dim.w, height: dim.h, padding: dim.pad },
      ]}
    >
      <Text
        style={[
          styles.rank,
          {
            color: ink,
            fontSize: rankSize,
            lineHeight: rankSize + 1,
            top: dim.pad,
            right: dim.pad,
          },
        ]}
        allowFontScaling={false}
      >
        {parsed.rank}
      </Text>
      <Text
        style={[styles.suit, { color: ink, fontSize: dim.suit, lineHeight: dim.suit + 2 }]}
        allowFontScaling={false}
      >
        {pip}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm + 1,
    overflow: 'hidden',
    marginHorizontal: 2,
  },
  backTiny: {
    marginHorizontal: 0,
    borderRadius: 2,
    borderWidth: 1,
  },
  face: {
    backgroundColor: '#F7F4EE',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    backgroundColor: '#1A2332',
    borderWidth: 1,
    borderColor: '#C9A227',
  },
  backInset: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLineH: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(201,162,39,0.45)',
  },
  backLineV: {
    position: 'absolute',
    width: 1,
    backgroundColor: 'rgba(201,162,39,0.45)',
  },
  backDiamond: {
    borderWidth: 1.5,
    borderColor: '#C9A227',
    backgroundColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  backDiamondInner: {
    position: 'absolute',
    backgroundColor: '#C9A227',
    transform: [{ rotate: '45deg' }],
  },
  rank: {
    position: 'absolute',
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'right',
    zIndex: 2,
  },
  suit: {
    fontWeight: '900',
    textAlign: 'center',
  },
});
