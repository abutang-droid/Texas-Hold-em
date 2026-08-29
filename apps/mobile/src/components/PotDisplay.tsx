import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  potTotal: number;
  potLabel: string;
}

export function PotDisplay({ potTotal, potLabel }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const prevPot = useRef(potTotal);

  useEffect(() => {
    if (potTotal !== prevPot.current && potTotal > prevPot.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 120, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start();
    }
    prevPot.current = potTotal;
  }, [potTotal, scale]);

  return (
    <Animated.View style={[styles.potChip, { transform: [{ scale }] }]}>
      <Text style={styles.potLabel}>{potLabel}</Text>
      <Text style={styles.pot}>{potTotal.toLocaleString()}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  potChip: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.4)',
    alignItems: 'center',
  },
  potLabel: { ...typography.micro, color: colors.text.secondary },
  pot: { ...typography.pot, color: colors.brand.secondary },
});
