import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { colors, palette, radius, shadows, spacing, typography } from '../theme';

interface Props {
  potTotal: number;
  potLabel: string;
}

export function PotDisplay({ potTotal, potLabel }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const prevPot = useRef(potTotal);

  useEffect(() => {
    const increased = potTotal > prevPot.current;
    const isReset = potTotal === 0 && prevPot.current > 0;
    if (increased && !isReset && potTotal > 0) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 120, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start();
    }
    if (isReset) {
      scale.setValue(1);
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
    backgroundColor: palette.inverse,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    ...shadows.button,
  },
  potLabel: { ...typography.micro, color: colors.text.secondary },
  pot: { ...typography.pot, color: colors.brand.primary },
});
