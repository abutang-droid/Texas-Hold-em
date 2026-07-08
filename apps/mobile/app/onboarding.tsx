import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { designTokens } from '@texas-holdem/shared';
import { completeOnboarding } from '../src/storage/onboarding';
import { declareAge } from '../src/api/client';

const STEPS = ['onboarding.step1', 'onboarding.step2', 'onboarding.step3'] as const;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState(0);

  const finish = async () => {
    completeOnboarding();
    try {
      await declareAge();
    } catch {
      /* guest may not be logged in yet; lobby will prompt */
    }
    router.replace('/');
  };

  const onNext = () => {
    if (step >= STEPS.length - 1) finish();
    else setStep((s) => s + 1);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('onboarding.title')}</Text>
      <Text style={styles.body}>{t(STEPS[step])}</Text>
      {step >= STEPS.length - 1 && (
        <Text style={styles.age}>{t('compliance.age_confirm')}</Text>
      )}
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>
      <Pressable style={styles.primaryBtn} onPress={onNext}>
        <Text style={styles.primaryText}>
          {step >= STEPS.length - 1 ? t('onboarding.start') : t('onboarding.next')}
        </Text>
      </Pressable>
      <Pressable onPress={finish}>
        <Text style={styles.skip}>{t('onboarding.skip')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: designTokens.color.bg.lobby,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { color: '#F5F5F5', fontSize: 28, fontWeight: '700', marginBottom: 24 },
  body: { color: '#9E9E9E', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  age: { color: '#C9A227', fontSize: 13, textAlign: 'center', marginBottom: 16, paddingHorizontal: 16 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 40 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#333' },
  dotActive: { backgroundColor: designTokens.color.brand.secondary },
  primaryBtn: {
    backgroundColor: designTokens.color.brand.secondary,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  primaryText: { color: '#1A1A1A', fontSize: 16, fontWeight: '700' },
  skip: { color: designTokens.color.brand.secondary, fontSize: 14 },
});
