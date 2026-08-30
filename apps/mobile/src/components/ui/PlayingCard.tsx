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
  xs: { w: 16, h: 22, rank: 8, suit: 6, pip: 8, pad: 1 },
  sm: { w: 34, h: 50, rank: 17, suit: 12, pip: 18, pad: 3 },
  md: { w: 48, h: 68, rank: 24, suit: 15, pip: 26, pad: 4 },
  lg: { w: 58, h: 82, rank: 28, suit: 18, pip: 32, pad: 5 },
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
  const rankSize = parsed.rank === '10' ? dim.rank - 3 : dim.rank;
  const pip = SUIT_SYMBOL[parsed.suit];

  return (
    <View style={[styles.card, styles.face, { width: dim.w, height: dim.h, padding: dim.pad }]}>
      <View style={styles.corner}>
        <Text
          style={[styles.rank, { color: ink, fontSize: rankSize, lineHeight: rankSize + 1 }]}
          allowFontScaling={false}
        >
          {parsed.rank}
        </Text>
        <Text
          style={[styles.suit, { color: ink, fontSize: dim.suit, lineHeight: dim.suit + 1 }]}
          allowFontScaling={false}
        >
          {pip}
        </Text>
      </View>
      <Text
        style={[
          styles.centerPip,
          { color: ink, fontSize: dim.pip, lineHeight: dim.pip + 2, opacity: 0.22 },
        ]}
        allowFontScaling={false}
      >
        {pip}
      </Text>
      <View style={[styles.corner, styles.cornerFlip]}>
        <Text
          style={[styles.rank, { color: ink, fontSize: Math.max(9, rankSize - 6), lineHeight: Math.max(10, rankSize - 5) }]}
          allowFontScaling={false}
        >
          {parsed.rank}
        </Text>
        <Text
          style={[styles.suit, { color: ink, fontSize: Math.max(8, dim.suit - 3), lineHeight: Math.max(9, dim.suit - 2) }]}
          allowFontScaling={false}
        >
          {pip}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm + 1,
    overflow: 'hidden',
    marginHorizontal: 2,
  },
  face: {
    backgroundColor: '#F7F4EE',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
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
  corner: {
    alignItems: 'flex-start',
    zIndex: 2,
  },
  cornerFlip: {
    position: 'absolute',
    right: 3,
    bottom: 2,
    alignItems: 'flex-end',
    transform: [{ rotate: '180deg' }],
    opacity: 0.9,
  },
  rank: {
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  suit: {
    fontWeight: '700',
    marginTop: -2,
  },
  centerPip: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    fontWeight: '700',
  },
});
