import { Modal, View, Text, StyleSheet } from 'react-native';
import { colors, palette, radius, shadows, spacing, typography } from '../../theme';
import { Button } from './Button';

interface Props {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  confirmDisabled?: boolean;
}

export function GameModal({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  confirmDisabled,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.accent} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Button label={confirmLabel} onPress={onConfirm} fullWidth disabled={confirmDisabled} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23,25,28,0.35)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: 'hidden',
    ...shadows.card,
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.brand.secondary,
  },
  title: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.md },
  body: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
});
