import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { completeOnboarding } from '../src/storage/onboarding';
import { Screen } from '../src/components/ui/Screen';
import { Button } from '../src/components/ui/Button';
import { colors, palette, spacing, typography } from '../src/theme';

const STEPS = ['onboarding.step1', 'onboarding.step2', 'onboarding.step3'] as const;
const STEP_ICONS = ['🎴', '💰', '♠️'];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await completeOnboarding();
      router.replace('/');
    } finally {
      setFinishing(false);
    }
  };

  const onNext = () => {
    if (step >= STEPS.length - 1) void finish();
    else setStep((s) => s + 1);
  };

  return (
    <Screen contentStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.icon}>{STEP_ICONS[step]}</Text>
        <Text style={styles.title}>{t('onboarding.title')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.body}>{t(STEPS[step])}</Text>
        {step >= STEPS.length - 1 && (
          <Text style={styles.age}>{t('compliance.age_confirm')}</Text>
        )}
      </View>

      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]} />
        ))}
      </View>

      <Button
        label={step >= STEPS.length - 1 ? t('onboarding.start') : t('onboarding.next')}
        onPress={onNext}
        loading={finishing}
        disabled={finishing}
        fullWidth
        style={styles.cta}
      />
      <Button
        label={t('onboarding.skip')}
        onPress={() => void finish()}
        variant="ghost"
        disabled={finishing}
        fullWidth
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: spacing.xxl },
  icon: { fontSize: 56, marginBottom: spacing.lg },
  title: { ...typography.h1, color: colors.text.primary, textAlign: 'center' },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: palette.line,
  },
  body: { ...typography.body, color: colors.text.secondary, textAlign: 'center', lineHeight: 26 },
  age: {
    ...typography.micro,
    color: colors.brand.secondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 20,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.xxl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.chipStack },
  dotActive: { width: 24, backgroundColor: colors.brand.secondary },
  dotDone: { backgroundColor: colors.brand.primary },
  cta: { marginBottom: spacing.md, minHeight: 52 },
});
