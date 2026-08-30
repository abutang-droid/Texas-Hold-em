import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, typography } from '../theme';

/** Seat positions (%), must match Table9Max SEAT_POSITIONS. */
const SEAT_POSITIONS: Array<{ top: number; left: number }> = [
  { top: 72, left: 50 },
  { top: 62, left: 82 },
  { top: 22, left: 78 },
  { top: 12, left: 50 },
  { top: 22, left: 22 },
  { top: 62, left: 18 },
];

const POT = { top: 38, left: 50 };

export interface ChipFlyEvent {
  id: string;
  seatIndex: number;
  amount: number;
}

interface Props {
  events: ChipFlyEvent[];
  onDone: (id: string) => void;
}

function FlyingChip({ event, onDone }: { event: ChipFlyEvent; onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const from = SEAT_POSITIONS[event.seatIndex] ?? POT;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progress, { toValue: 1, duration: 420, useNativeDriver: false }),
      Animated.sequence([
        Animated.delay(320),
        Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: false }),
      ]),
    ]).start(() => onDone());
  }, [progress, opacity, onDone]);

  const top = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${from.top}%`, `${POT.top}%`],
  });
  const left = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${from.left}%`, `${POT.left}%`],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 1.1, 0.85],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.chip,
        {
          top,
          left,
          opacity,
          transform: [{ translateX: -20 }, { translateY: -12 }, { scale }],
        },
      ]}
    >
      <Text style={styles.chipText}>{event.amount}</Text>
    </Animated.View>
  );
}

export function ChipFlyLayer({ events, onDone }: Props) {
  if (events.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {events.map((event) => (
        <FlyingChip key={event.id} event={event} onDone={() => onDone(event.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    backgroundColor: colors.brand.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 50,
  },
  chipText: { ...typography.micro, color: '#1A1A1A', fontWeight: '800', fontSize: 10 },
});
