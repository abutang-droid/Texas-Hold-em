import { View, Text, StyleSheet, Pressable } from 'react-native';
import { parseAvatarPreset } from '@texas-holdem/shared';
import { colors, palette } from '../theme';

interface Props {
  nickname: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
}

const SIZES = { sm: 36, md: 48, lg: 64 } as const;

export function Avatar({ nickname, avatarUrl, size = 'md', onPress }: Props) {
  const dim = SIZES[size];
  const preset = parseAvatarPreset(avatarUrl);
  const initial = (nickname[0] ?? '?').toUpperCase();

  const content = (
    <View
      style={[
        styles.circle,
        { width: dim, height: dim, borderRadius: dim / 2 },
        preset ? { backgroundColor: preset.color } : null,
      ]}
    >
      <Text style={[styles.glyph, { fontSize: dim * 0.42 }]}>
        {preset?.emoji ?? initial}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={8}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.brand.primary,
    borderWidth: 2,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { color: '#fff', fontWeight: '800' },
});
