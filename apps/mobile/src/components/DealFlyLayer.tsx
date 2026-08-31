import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { PlayingCard } from './ui/PlayingCard';
import { BOARD_SLOT_LAYOUT, DEALER_LAYOUT, SEAT_LAYOUT } from './table-layout';

export interface DealFlyEvent {
  id: string;
  destTop: number;
  destLeft: number;
  delayMs: number;
}

interface Props {
  events: DealFlyEvent[];
  onDone: (id: string) => void;
}

function FlyingDealCard({ event, onDone }: { event: DealFlyEvent; onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    progress.setValue(0);
    opacity.setValue(0);
    Animated.sequence([
      Animated.delay(event.delayMs),
      Animated.timing(opacity, { toValue: 1, duration: 60, useNativeDriver: false }),
      Animated.parallel([
        Animated.timing(progress, { toValue: 1, duration: 360, useNativeDriver: false }),
        Animated.sequence([
          Animated.delay(260),
          Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: false }),
        ]),
      ]),
    ]).start(({ finished }) => {
      if (finished) onDoneRef.current();
    });
  }, [event.delayMs, event.id, opacity, progress]);

  const top = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${DEALER_LAYOUT.top + 4}%`, `${event.destTop}%`],
  });
  const left = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${DEALER_LAYOUT.left}%`, `${event.destLeft}%`],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['-18deg', '8deg'],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.7, 1.05, 0.9],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.card,
        {
          top,
          left,
          opacity,
          transform: [{ translateX: -8 }, { translateY: -10 }, { rotate }, { scale }],
        },
      ]}
    >
      <PlayingCard code="**" size="xs" faceDown />
    </Animated.View>
  );
}

export function DealFlyLayer({ events, onDone }: Props) {
  if (events.length === 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {events.map((event) => (
        <FlyingDealCard key={event.id} event={event} onDone={() => onDone(event.id)} />
      ))}
    </View>
  );
}

export function holeDealEvents(opts: {
  handId: string;
  dealOrder: number[];
}): DealFlyEvent[] {
  const events: DealFlyEvent[] = [];
  let delay = 40;
  for (let round = 0; round < 2; round += 1) {
    for (const seat of opts.dealOrder) {
      const dest = SEAT_LAYOUT[seat];
      if (!dest) continue;
      events.push({
        id: `hole-${opts.handId}-${round}-${seat}`,
        destTop: dest.top - 4,
        destLeft: dest.left,
        delayMs: delay,
      });
      delay += 90;
    }
  }
  return events;
}

export function boardDealEvents(opts: {
  handId: string;
  fromCount: number;
  toCount: number;
}): DealFlyEvent[] {
  const events: DealFlyEvent[] = [];
  let delay = 40;
  for (let i = opts.fromCount; i < opts.toCount && i < BOARD_SLOT_LAYOUT.length; i += 1) {
    const dest = BOARD_SLOT_LAYOUT[i];
    events.push({
      id: `board-${opts.handId}-${i}`,
      destTop: dest.top,
      destLeft: dest.left,
      delayMs: delay,
    });
    delay += 150;
  }
  return events;
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    zIndex: 55,
  },
});
