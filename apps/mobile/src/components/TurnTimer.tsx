import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ACTION_TIME_SEC, TIME_BANK_SEC } from '@texas-holdem/shared';
import { colors, spacing, typography } from '../theme';

interface Props {
  deadline: number | null;
  active?: boolean;
  compact?: boolean;
}

export function TurnTimer({ deadline, active = true, compact }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!deadline || !active) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [deadline, active]);

  if (!deadline || !active) return null;

  const total = ACTION_TIME_SEC + TIME_BANK_SEC;
  const ratio = Math.min(1, secondsLeft / total);
  const urgent = secondsLeft <= 5;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${ratio * 100}%` },
            urgent && styles.fillUrgent,
          ]}
        />
      </View>
      <Text style={[styles.label, urgent && styles.labelUrgent]}>{secondsLeft}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  wrapCompact: { marginBottom: 0, flex: 1 },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#1E88E5', borderRadius: 3 },
  fillUrgent: { backgroundColor: colors.semantic.danger },
  label: { ...typography.micro, color: '#90CAF9', fontWeight: '700', minWidth: 28 },
  labelUrgent: { color: colors.semantic.danger },
});
