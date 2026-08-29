import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { PlayingCard } from './ui/PlayingCard';
import { spacing } from '../theme';

interface Props {
  cards: string[];
}

export function CommunityCardsRow({ cards }: Props) {
  const prevCount = useRef(0);
  const scales = useRef<Animated.Value[]>([]).current;

  useEffect(() => {
    if (cards.length === 0) {
      prevCount.current = 0;
      return;
    }
    while (scales.length < cards.length) {
      scales.push(new Animated.Value(0));
    }
    for (let i = prevCount.current; i < cards.length; i += 1) {
      scales[i].setValue(0);
      Animated.spring(scales[i], {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();
    }
    prevCount.current = cards.length;
  }, [cards, scales]);

  if (cards.length === 0) {
    return (
      <View style={styles.row}>
        <PlayingCard code="**" faceDown size="sm" />
        <PlayingCard code="**" faceDown size="sm" />
        <PlayingCard code="**" faceDown size="sm" />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {cards.map((c, i) => (
        <Animated.View key={`${c}-${i}`} style={{ transform: [{ scale: scales[i] ?? 1 }] }}>
          <PlayingCard code={c} size="md" />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
    minHeight: 54,
    alignItems: 'center',
  },
});
