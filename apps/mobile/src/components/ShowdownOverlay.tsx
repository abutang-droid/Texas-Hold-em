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
  const slide = useRef(new Animated.Value(40)).current;

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
    slide.setValue(40);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [visible, handId, fade, slide]);

  if (!visible && !handId) return null;

  const board = boardCards.trim() ? boardCards.split(/\s+/) : [];

  return (
    <View
      style={styles.overlay}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <Animated.View style={[styles.backdrop, { opacity: visible ? fade : 0 }]}>
        <Animated.View style={[styles.card, { transform: [{ translateY: slide }] }]}>
          <Text style={styles.title}>{t('showdown.title')}</Text>
          {board.length > 0 && (
            <Text style={styles.board}>
              {t('showdown.board')}: {board.join(' ')}
            </Text>
          )}
          <Text style={styles.pot}>
            {t('showdown.pot')}: {potSize.toLocaleString()}
          </Text>
          <View style={styles.winners}>
            {winners.length === 0 ? (
              <Text style={styles.noWinner}>{t('showdown.no_winner')}</Text>
            ) : (
              winners.map((w, i) => (
                <View key={`${w.userId}-${i}`} style={styles.winnerRow}>
                  <Text style={styles.trophy}>🏆</Text>
                  <View style={styles.winnerInfo}>
                    <Text style={styles.winnerName}>{w.nickname}</Text>
                    <Text style={styles.winAmount}>
                      +{w.winAmount.toLocaleString()} {t('common.chips')}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
          <Text style={styles.hint}>
            {t('game.next_hand', { seconds: Math.ceil(nextHandIn / 1000) })}
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 2,
    borderColor: colors.brand.secondary,
  },
  title: {
    ...typography.h1,
    color: colors.brand.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  board: { ...typography.caption, color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.sm },
  pot: { ...typography.body, color: colors.text.primary, textAlign: 'center', marginBottom: spacing.lg },
  winners: { marginBottom: spacing.lg },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  trophy: { fontSize: 28, marginRight: spacing.md },
  winnerInfo: { flex: 1 },
  winnerName: { ...typography.h2, color: colors.text.primary },
  winAmount: { ...typography.caption, color: colors.semantic.success, fontWeight: '700', marginTop: 2 },
  noWinner: { ...typography.body, color: colors.text.secondary, textAlign: 'center' },
  hint: { ...typography.micro, color: colors.text.secondary, textAlign: 'center' },
});
