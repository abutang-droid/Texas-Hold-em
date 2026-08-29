import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TABLE_EMOJI_PRESETS } from '@texas-holdem/shared';
import { colors, radius, spacing } from '../theme';

interface Props {
  onSend: (emojiId: string) => void;
  disabled?: boolean;
}

export function EmojiBar({ onSend, disabled }: Props) {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';

  return (
    <View style={styles.wrap}>
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
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  btnPressed: { backgroundColor: 'rgba(201,162,39,0.25)' },
  btnDisabled: { opacity: 0.4 },
  emoji: { fontSize: 22 },
});
