import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loginWithEmail, guestLogin } from '../../src/api/client';
import { AuthField } from '../../src/components/auth/AuthField';
import { Screen } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { showAlert } from '../../src/utils/alert';
import { colors, spacing, typography } from '../../src/theme';

function authErrorMessage(t: (k: string) => string, err: Error & { code?: string }): string {
  const key = err.message;
  if (key.startsWith('errors.')) return t(key);
  return err.message;
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const onLogin = async () => {
    setFormError(null);
    if (!email.trim() || !password) {
      const msg = t('auth.fill_required');
      setFormError(msg);
      showAlert(t('auth.error_title'), msg);
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
      router.replace('/');
    } catch (e) {
      const msg = authErrorMessage(t, e as Error & { code?: string });
      setFormError(msg);
      showAlert(t('auth.error_title'), msg);
    } finally {
      setLoading(false);
    }
  };

  const onGuest = async () => {
    setFormError(null);
    setLoading(true);
    try {
      await guestLogin();
      router.replace('/');
    } catch (e) {
      const msg = (e as Error).message;
      setFormError(msg);
      showAlert(t('auth.error_title'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text style={styles.logo}>♠</Text>
      <Text style={styles.title}>{t('auth.login_title')}</Text>
      <Text style={styles.subtitle}>{t('auth.login_subtitle')}</Text>

      <Card style={styles.card}>
        <AuthField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <AuthField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Button label={t('auth.login_btn')} onPress={onLogin} loading={loading} fullWidth />
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.no_account')}</Text>
        <Pressable onPress={() => router.push('/auth/register')} hitSlop={8}>
          <Text style={styles.link}>{t('auth.register_link')}</Text>
        </Pressable>
      </View>

      <Pressable onPress={onGuest} disabled={loading} style={styles.guestWrap}>
        <Text style={styles.guest}>{t('auth.guest_continue')}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xxl },
  logo: {
    fontSize: 48,
    color: colors.brand.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.h1, color: colors.text.primary, textAlign: 'center' },
  subtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  card: { marginBottom: spacing.xl },
  error: {
    ...typography.caption,
    color: colors.semantic.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  footerText: { ...typography.body, color: colors.text.secondary },
  link: { ...typography.body, color: colors.brand.secondary, fontWeight: '700' },
  guestWrap: { marginTop: spacing.xl, alignItems: 'center', padding: spacing.sm },
  guest: { ...typography.caption, color: colors.text.disabled },
});
