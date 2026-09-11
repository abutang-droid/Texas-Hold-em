import { designTokens } from '@texas-holdem/shared';
import type { TextStyle, ViewStyle } from 'react-native';

export const colors = designTokens.color;

/** Spec extras that are not in the shared JSON shape. */
export const palette = {
  accentSoft: 'rgba(52,211,153,0.16)',
  inverse: '#F4F7F5',
  line: 'rgba(232,245,238,0.14)',
  redSuit: '#E11D48',
  cardBack: '#0A2A1E',
  cardBackBorder: '#145c43',
  cardFace: '#FFFFFF',
  faceLine: '#E6E8EB',
  ink: '#17191C',
  chipStack: '#1A3D30',
  glow: 'rgba(163,230,53,0.45)',
  backdrop: 'rgba(5,8,7,0.72)',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 8,
  } satisfies ViewStyle,
  button: {
    shadowColor: '#145c43',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 4,
  } satisfies ViewStyle,
  glow: {
    shadowColor: '#A3E635',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
  } satisfies ViewStyle,
};

export const text = {
  primary: { color: colors.text.primary } satisfies TextStyle,
  secondary: { color: colors.text.secondary } satisfies TextStyle,
  gold: { color: colors.brand.secondary } satisfies TextStyle,
  onGold: { color: palette.inverse } satisfies TextStyle,
};
