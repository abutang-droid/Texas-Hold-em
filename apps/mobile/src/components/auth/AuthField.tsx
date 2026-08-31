import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, palette, spacing, typography } from '../../theme';

export function AuthField({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={colors.text.disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { ...typography.micro, color: colors.text.secondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: palette.inverse,
    borderRadius: 10,
    minHeight: 44,
    padding: spacing.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: palette.line,
    ...typography.body,
  },
});
