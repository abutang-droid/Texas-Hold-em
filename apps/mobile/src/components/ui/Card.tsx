import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors, palette, radius, shadows, spacing } from '../../theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}

export function Card({ children, style, elevated }: Props) {
  return (
    <View style={[styles.card, elevated && shadows.card, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.line,
  },
});
