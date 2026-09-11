import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { parseAvatarPreset } from '@texas-holdem/shared';
import { colors, palette } from '../theme';

interface Props {
  nickname: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
  glow?: boolean;
}

const SIZES = { sm: 36, md: 48, lg: 64 } as const;

export function Avatar({ nickname, avatarUrl, size = 'md', onPress, glow }: Props) {
  const dim = SIZES[size];
  const preset = parseAvatarPreset(avatarUrl);
  const initial = (nickname[0] ?? '?').toUpperCase();
  const pulse = useRef(new Animated.Value(0.25)).current;
  const radius = Math.round(dim * 0.28);

  useEffect(() => {
    if (!glow) {
      pulse.setValue(0.25);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.2, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, pulse]);

  const content = (
    <View style={{ width: dim + 10, height: dim + 10, alignItems: 'center', justifyContent: 'center' }}>
      {glow ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              width: dim + 10,
              height: dim + 10,
              borderRadius: radius + 6,
              opacity: pulse,
            },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.frame,
          {
            width: dim,
            height: dim,
            borderRadius: radius,
            borderColor: glow ? colors.brand.secondary : 'rgba(163,230,53,0.35)',
          },
          preset ? { backgroundColor: preset.color } : null,
        ]}
      >
        <Text style={[styles.glyph, { fontSize: dim * 0.42 }]}>
          {preset?.emoji ?? initial}
        </Text>
      </View>
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
  halo: {
    position: 'absolute',
    backgroundColor: 'rgba(163,230,53,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(163,230,53,0.55)',
  },
  frame: {
    backgroundColor: colors.brand.primary,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { color: palette.inverse, fontWeight: '800' },
});
