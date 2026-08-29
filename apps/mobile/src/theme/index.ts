import { designTokens } from '@texas-holdem/shared';
import type { TextStyle, ViewStyle } from 'react-native';

export const colors = designTokens.color;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = designTokens.radius;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  pot: { fontSize: 28, lineHeight: 32, fontWeight: '700' as const },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  } satisfies ViewStyle,
  button: {
    shadowColor: '#C9A227',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  } satisfies ViewStyle,
};

export const text = {
  primary: { color: colors.text.primary } satisfies TextStyle,
  secondary: { color: colors.text.secondary } satisfies TextStyle,
  gold: { color: colors.brand.secondary } satisfies TextStyle,
  onGold: { color: '#1A1A1A' } satisfies TextStyle,
};
