import { useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { registerWithEmail } from '../../src/api/client';
import { AuthField } from '../../src/components/auth/AuthField';
import { Screen } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { colors, spacing, typography } from '../../src/theme';

function authErrorMessage(t: (k: string) => string, err: Error & { code?: string }): string {
  const key = err.message;
  if (key.startsWith('errors.')) return t(key);
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

  const onRegister = async () => {
    if (!email.trim() || !password) {
      Alert.alert(t('auth.error_title'), t('auth.fill_required'));
      return;
    }
    if (password !== confirm) {
      Alert.alert(t('auth.error_title'), t('auth.password_mismatch'));
      return;
    }
    setLoading(true);
    try {
      await registerWithEmail(email.trim(), password, nickname.trim() || undefined);
      router.replace('/');
    } catch (e) {
      Alert.alert(t('auth.error_title'), authErrorMessage(t, e as Error & { code?: string }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
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
        <Button label={t('auth.register_btn')} onPress={onRegister} loading={loading} fullWidth />
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.has_account')}</Text>
        <Link href="/auth/login" asChild>
          <Pressable>
            <Text style={styles.link}>{t('auth.login_link')}</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xl },
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
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  footerText: { ...typography.body, color: colors.text.secondary },
  link: { ...typography.body, color: colors.brand.secondary, fontWeight: '700' },
});
