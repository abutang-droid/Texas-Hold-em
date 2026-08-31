import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { PlayingCard } from './ui/PlayingCard';
import { spacing } from '../theme';

const SLOTS = 5;

function boardKey(cards: string[]): string {
  return cards.join('|');
}

interface Props {
  cards: string[];
}

/** Always 5 slots. New cards fade/slide in; never scale to 0 (that looked like a blank board). */
export function CommunityCardsRow({ cards }: Props) {
  const seen = useRef<string[]>(['', '', '', '', '']);
  const opacities = useRef(Array.from({ length: SLOTS }, () => new Animated.Value(1))).current;
  const slides = useRef(Array.from({ length: SLOTS }, () => new Animated.Value(0))).current;

  useEffect(() => {
    if (cards.length === 0) {
      seen.current = ['', '', '', '', ''];
      for (let i = 0; i < SLOTS; i += 1) {
        opacities[i].setValue(1);
        slides[i].setValue(0);
      }
      return;
    }

    const isFlopDeal = cards.length === 3 && seen.current.every((c) => !c);
    for (let i = 0; i < SLOTS; i += 1) {
      const code = cards[i] ?? '';
      if (!code) {
        seen.current[i] = '';
        continue;
      }
      if (seen.current[i] === code) continue;
      seen.current[i] = code;
      opacities[i].setValue(0.35);
      slides[i].setValue(-32);
      Animated.sequence([
        Animated.delay(isFlopDeal ? i * 160 : 40),
        Animated.parallel([
          Animated.timing(opacities[i], { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.spring(slides[i], { toValue: 0, friction: 7, tension: 110, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [boardKey(cards), opacities, slides]);

  return (
    <View style={styles.row}>
      {Array.from({ length: SLOTS }, (_, i) => {
        const code = cards[i];
        const faceUp = !!code;
        return (
          <Animated.View
            key={`slot-${i}`}
            style={{
              opacity: faceUp ? opacities[i] : 1,
              transform: [{ translateY: faceUp ? slides[i] : 0 }],
            }}
          >
            <PlayingCard code={code || '**'} faceDown={!faceUp} size="md" />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
    minHeight: 72,
    alignItems: 'center',
  },
});
