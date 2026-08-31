import { designTokens } from '@texas-holdem/shared';
import type { TextStyle, ViewStyle } from 'react-native';

export const colors = designTokens.color;

/** Spec extras that are not in the shared JSON shape. */
export const palette = {
  accentSoft: 'rgba(46,125,99,0.10)',
  inverse: '#FFFFFF',
  line: '#E6E8EB',
  redSuit: '#C23B3B',
  cardBack: '#E9ECF0',
  chipStack: '#D7DBE0',
} as const;

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
  display: { fontSize: 32, lineHeight: 40, fontWeight: '800' as const },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '800' as const },
  h2: { fontSize: 16, lineHeight: 22, fontWeight: '800' as const },
  body: { fontSize: 14, lineHeight: 22, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const },
  pot: { fontSize: 20, lineHeight: 24, fontWeight: '800' as const },
} as const;

export const shadows = {
  card: {
    shadowColor: 'rgb(20,25,30)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 3,
  } satisfies ViewStyle,
  button: {
    shadowColor: 'rgb(20,25,30)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  } satisfies ViewStyle,
};

export const text = {
  primary: { color: colors.text.primary } satisfies TextStyle,
  secondary: { color: colors.text.secondary } satisfies TextStyle,
  gold: { color: colors.brand.secondary } satisfies TextStyle,
  onGold: { color: palette.inverse } satisfies TextStyle,
};
