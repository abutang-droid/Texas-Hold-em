import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TABLE_EMOJI_PRESETS } from '@texas-holdem/shared';
import { colors, palette, radius, shadows, spacing } from '../theme';

interface Props {
  onSend: (emojiId: string) => void;
  onClose: () => void;
  disabled?: boolean;
}

export function EmojiBar({ onSend, onClose, disabled }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.close}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('table.emoji_close')}
      >
        <Text style={styles.closeText}>{t('table.emoji_close')}</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {TABLE_EMOJI_PRESETS.map((preset) => (
          <Pressable
            key={preset.id}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, disabled && styles.btnDisabled]}
            onPress={() => onSend(preset.id)}
            disabled={disabled}
            accessibilityLabel={preset.label[locale]}
          >
            <Text style={styles.emoji}>{preset.emoji}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 360,
    backgroundColor: palette.inverse,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: palette.line,
    ...shadows.card,
  },
  close: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  closeText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.felt.base,
  },
  btnPressed: { backgroundColor: palette.accentSoft },
  btnDisabled: { opacity: 0.4 },
  emoji: { fontSize: 22 },
});
