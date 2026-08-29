import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../theme';

interface Props {
  children?: React.ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}

export function Screen({ children, loading, loadingLabel, scroll, contentStyle }: Props) {
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand.secondary} size="large" />
          {loadingLabel ? <Text style={styles.loadingText}>{loadingLabel}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  if (scroll) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.flex, styles.pad, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Text style={styles.back} onPress={onBack}>
          ← {backLabel ?? 'Back'}
        </Text>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.lobby },
  flex: { flex: 1 },
  pad: { padding: spacing.xl },
  scrollContent: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...typography.caption, color: colors.text.secondary, marginTop: spacing.md },
  header: { marginBottom: spacing.xl },
  back: { ...typography.caption, color: colors.brand.secondary, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text.primary },
  subtitle: { ...typography.caption, color: colors.text.secondary, marginTop: spacing.sm },
});
