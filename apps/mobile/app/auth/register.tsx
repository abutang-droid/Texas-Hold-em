import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { registerWithEmail } from '../../src/api/client';
import { postAuthRoute } from '../../src/auth/routes';
import { AuthField } from '../../src/components/auth/AuthField';
import { Screen } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { showAlert } from '../../src/utils/alert';
import { colors, spacing, typography } from '../../src/theme';

function authErrorMessage(t: (k: string) => string, err: Error & { code?: string }): string {
  const key = err.message;
  if (key.startsWith('errors.')) return t(key);
  if (err.message.includes('Failed to fetch') || err.message.includes('Network')) {
    return t('auth.network_error');
  }
  return err.message;
}

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const onRegister = async () => {
    setFormError(null);
    if (!email.trim() || !password) {
      const msg = t('auth.fill_required');
      setFormError(msg);
      showAlert(t('auth.error_title'), msg);
      return;
    }
    if (password.length < 8) {
      const msg = t('errors.weak_password');
      setFormError(msg);
      showAlert(t('auth.error_title'), msg);
      return;
    }
    if (password !== confirm) {
      const msg = t('auth.password_mismatch');
      setFormError(msg);
      showAlert(t('auth.error_title'), msg);
      return;
    }
    setLoading(true);
    try {
      await registerWithEmail(email.trim(), password, nickname.trim() || undefined);
      router.replace(postAuthRoute());
    } catch (e) {
      const msg = authErrorMessage(t, e as Error & { code?: string });
      setFormError(msg);
      showAlert(t('auth.error_title'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← {t('auth.login_link')}</Text>
      </Pressable>

      <Text style={styles.title}>{t('auth.register_title')}</Text>
      <Text style={styles.subtitle}>{t('auth.register_subtitle')}</Text>

      <Card style={styles.card}>
        <AuthField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <AuthField
          label={t('auth.nickname')}
          value={nickname}
          onChangeText={setNickname}
          autoCapitalize="words"
          placeholder={t('auth.nickname_optional')}
        />
        <AuthField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder={t('auth.password_hint')}
        />
        <AuthField
          label={t('auth.confirm_password')}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="••••••••"
        />
        <Text style={styles.bonus}>{t('auth.register_bonus')}</Text>
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Button label={t('auth.register_btn')} onPress={onRegister} loading={loading} fullWidth />
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.has_account')}</Text>
        <Pressable onPress={() => router.replace('/auth/login')} hitSlop={8}>
          <Text style={styles.link}>{t('auth.login_link')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg },
  back: { marginBottom: spacing.md },
  backText: { ...typography.caption, color: colors.brand.secondary },
  title: { ...typography.h1, color: colors.text.primary, textAlign: 'center' },
  subtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  card: { marginBottom: spacing.xl },
  bonus: {
    ...typography.micro,
    color: colors.brand.secondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  error: {
    ...typography.caption,
    color: colors.semantic.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  footerText: { ...typography.body, color: colors.text.secondary },
  link: { ...typography.body, color: colors.brand.secondary, fontWeight: '700' },
});
