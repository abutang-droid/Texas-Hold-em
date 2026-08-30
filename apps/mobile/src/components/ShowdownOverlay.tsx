import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HandWinner } from '../types/table';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  visible: boolean;
  handId: string;
  winners: HandWinner[];
  potSize: number;
  boardCards: string;
  nextHandIn: number;
}

/** Tracks hands already animated (survives visible toggles). */
const animatedHands = new Set<string>();

export function ShowdownOverlay({
  visible,
  handId,
  winners,
  potSize,
  boardCards,
  nextHandIn,
}: Props) {
  const { t } = useTranslation();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (!visible || !handId) return;
    if (animatedHands.has(handId)) {
      fade.setValue(1);
      slide.setValue(0);
      return;
    }
    animatedHands.add(handId);
    if (animatedHands.size > 30) animatedHands.clear();

    fade.setValue(0);
    slide.setValue(-12);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [visible, handId, fade, slide]);

  if (!visible) return null;

  const board = boardCards.trim() ? boardCards.split(/\s+/) : [];

  return (
    <View style={styles.bannerWrap} pointerEvents="none">
      <Animated.View
        style={[styles.banner, { opacity: fade, transform: [{ translateY: slide }] }]}
      >
        <Text style={styles.title}>{t('showdown.title')}</Text>
        {board.length > 0 ? (
          <Text style={styles.board} numberOfLines={1}>
            {t('showdown.board')}: {board.join(' ')}
          </Text>
        ) : null}
        <Text style={styles.pot}>
          {t('showdown.pot')}: {potSize.toLocaleString()}
        </Text>
        {winners.length === 0 ? (
          <Text style={styles.noWinner}>{t('showdown.no_winner')}</Text>
        ) : (
          winners.map((w, i) => (
            <Text key={`${w.userId}-${i}`} style={styles.winnerLine} numberOfLines={1}>
              🏆 {w.nickname} +{w.winAmount.toLocaleString()}
            </Text>
          ))
        )}
        <Text style={styles.hint}>
          {t('game.next_hand', { seconds: Math.ceil(nextHandIn / 1000) })}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 16,
    zIndex: 40,
    alignItems: 'center',
  },
  banner: {
    maxWidth: 360,
    width: '100%',
    backgroundColor: 'rgba(18,20,24,0.92)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.55)',
  },
  title: {
    ...typography.caption,
    color: colors.brand.secondary,
    textAlign: 'center',
    fontWeight: '800',
    marginBottom: 4,
  },
  board: {
    ...typography.micro,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  pot: {
    ...typography.micro,
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 4,
  },
  winnerLine: {
    ...typography.caption,
    color: colors.semantic.success,
    textAlign: 'center',
    fontWeight: '700',
  },
  noWinner: { ...typography.micro, color: colors.text.secondary, textAlign: 'center' },
  hint: {
    ...typography.micro,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
