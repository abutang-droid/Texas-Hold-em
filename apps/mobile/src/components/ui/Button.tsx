import { Pressable, Text, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native';
import { colors, palette, radius, shadows, spacing, typography } from '../../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  fullWidth,
}: Props) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        variant === 'ghost' && styles.ghost,
        isPrimary && shadows.button,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? palette.inverse : colors.brand.primary} />
      ) : (
        <Text
          style={[
            styles.label,
            isPrimary && styles.labelPrimary,
            variant === 'secondary' && styles.labelSecondary,
            variant === 'danger' && styles.labelDanger,
            variant === 'ghost' && styles.labelGhost,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },
  primary: { backgroundColor: colors.brand.primary },
  secondary: {
    backgroundColor: palette.inverse,
    borderWidth: 1.5,
    borderColor: palette.line,
  },
  danger: {
    backgroundColor: palette.inverse,
    borderWidth: 1.5,
    borderColor: colors.semantic.danger,
  },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  label: { ...typography.body, fontWeight: '800', fontSize: 14 },
  labelPrimary: { color: palette.inverse },
  labelSecondary: { color: colors.text.primary },
  labelDanger: { color: colors.semantic.danger },
  labelGhost: { color: colors.text.secondary },
});
