import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, palette, typography } from '../theme';
import { POT_LAYOUT, SEAT_LAYOUT } from './table-layout';

export interface ChipFlyEvent {
  id: string;
  seatIndex: number;
  amount: number;
  direction?: 'in' | 'out';
}

interface Props {
  events: ChipFlyEvent[];
  onDone: (id: string) => void;
}

function FlyingChip({ event, onDone }: { event: ChipFlyEvent; onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const seat = SEAT_LAYOUT[event.seatIndex] ?? POT_LAYOUT;
  const from = event.direction === 'out' ? POT_LAYOUT : seat;
  const to = event.direction === 'out' ? seat : POT_LAYOUT;

  useEffect(() => {
    progress.setValue(0);
    opacity.setValue(1);
    Animated.parallel([
      Animated.timing(progress, { toValue: 1, duration: 420, useNativeDriver: false }),
      Animated.sequence([
        Animated.delay(320),
        Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: false }),
      ]),
    ]).start(({ finished }) => {
      if (finished) onDoneRef.current();
    });
  }, [progress, opacity, event.id]);

  const top = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${from.top}%`, `${to.top}%`],
  });
  const left = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${from.left}%`, `${to.left}%`],
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
    backgroundColor: palette.chipStack,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: palette.line,
    zIndex: 50,
  },
  chipText: { ...typography.micro, color: colors.text.primary, fontWeight: '800', fontSize: 10 },
});
