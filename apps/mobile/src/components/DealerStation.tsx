import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DEALER_LAYOUT } from './table-layout';

interface Props {
  dealing?: boolean;
}

export function DealerStation({ dealing = false }: Props) {
  const { t } = useTranslation();
  const toss = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const idle = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    idle.start();
    return () => idle.stop();
  }, [bob]);

  useEffect(() => {
    loopRef.current?.stop();
    if (!dealing) {
      toss.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(toss, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(toss, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.delay(80),
      ]),
    );
    loopRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, [dealing, toss]);

  const deckRotate = toss.interpolate({
    inputRange: [0, 1],
    outputRange: ['-8deg', '22deg'],
  });
  const deckLift = toss.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const bodyShift = toss.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 3],
  });
  const idleY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        { top: `${DEALER_LAYOUT.top}%`, left: `${DEALER_LAYOUT.left}%` },
      ]}
    >
      <Animated.View style={{ transform: [{ translateY: idleY }] }}>
        <Animated.View style={[styles.figure, { transform: [{ translateX: bodyShift }] }]}>
          <View style={styles.head} />
          <View style={styles.torso}>
            <View style={styles.lapel} />
            <View style={styles.bow} />
          </View>
        </Animated.View>
        <Animated.View
          style={[
            styles.deck,
            { transform: [{ rotate: deckRotate }, { translateY: deckLift }] },
          ]}
        >
          <View style={[styles.deckCard, styles.deckBack]} />
          <View style={[styles.deckCard, styles.deckMid]} />
          <View style={[styles.deckCard, styles.deckTop]} />
        </Animated.View>
        <View style={styles.plate}>
          <Text style={styles.plateText}>{t('table.dealer')}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: 72,
    marginLeft: -36,
    marginTop: -6,
    alignItems: 'center',
    zIndex: 8,
  },
  figure: { alignItems: 'center' },
  head: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E8C4A8',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  torso: {
    width: 28,
    height: 22,
    marginTop: -2,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  lapel: {
    position: 'absolute',
    top: 4,
    width: 10,
    height: 12,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderLeftColor: '#C9A227',
    borderRightColor: '#C9A227',
    borderBottomWidth: 6,
    borderBottomColor: 'transparent',
  },
  bow: {
    width: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8B0000',
    zIndex: 1,
  },
  deck: {
    width: 22,
    height: 16,
    marginTop: 3,
  },
  deckCard: {
    position: 'absolute',
    width: 16,
    height: 22,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#C9A227',
    backgroundColor: '#1A2332',
  },
  deckBack: { left: 0, top: 2, transform: [{ rotate: '-12deg' }] },
  deckMid: { left: 3, top: 1, transform: [{ rotate: '-4deg' }] },
  deckTop: { left: 6, top: 0 },
  plate: {
    marginTop: 14,
    backgroundColor: '#C9A227',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  plateText: {
    color: '#1A1A1A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
