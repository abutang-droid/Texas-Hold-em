import { View, Text, Image, StyleSheet } from 'react-native';
import { CARD_BACK_URI } from '../../assets/card-back-uri';
import { palette } from '../../theme';

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

/** xs opponent backs · sm board / revealed rivals · lg hero holes */
const SIZE = {
  xs: { w: 26, h: 36, rank: 9, suit: 14, pad: 2 },
  sm: { w: 46, h: 64, rank: 13, suit: 22, pad: 3 },
  md: { w: 46, h: 64, rank: 13, suit: 22, pad: 3 },
  lg: { w: 62, h: 88, rank: 18, suit: 32, pad: 4 },
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
  return (
    <View style={[styles.card, styles.back, w < 20 && styles.backTiny, { width: w, height: h }]}>
      <Image source={{ uri: CARD_BACK_URI }} style={styles.backImage} resizeMode="cover" />
    </View>
  );
}

export function PlayingCard({ code, size = 'md', faceDown }: Props) {
  const dim = SIZE[size];
  const parsed = faceDown ? null : parseCard(code);

  if (!parsed) {
    return <CardBack w={dim.w} h={dim.h} />;
  }

  const ink = parsed.red ? palette.redSuit : palette.ink;
  const rankSize = parsed.rank === '10' ? Math.max(8, dim.rank - 3) : dim.rank;
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
            left: dim.pad,
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
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 2,
  },
  backTiny: {
    marginHorizontal: 0,
    borderRadius: 4,
    borderWidth: 1,
  },
  face: {
    backgroundColor: palette.cardFace,
    borderWidth: 1,
    borderColor: palette.faceLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    backgroundColor: palette.cardBack,
    borderWidth: 1,
    borderColor: palette.cardBackBorder,
  },
  backImage: {
    width: '100%',
    height: '100%',
  },
  rank: {
    position: 'absolute',
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'left',
    zIndex: 2,
  },
  suit: {
    fontWeight: '800',
    textAlign: 'center',
  },
});
