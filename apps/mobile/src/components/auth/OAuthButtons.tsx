import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Button } from '../ui/Button';
import {
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  signInWithApple,
  signInWithGoogleIdToken,
  useGoogleAuthRequest,
} from '../../auth/oauth';
import { colors, spacing, typography } from '../../theme';

WebBrowser.maybeCompleteAuthSession();

interface OAuthButtonsProps {
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function OAuthButtons({ loading, onLoadingChange, onSuccess, onError }: OAuthButtonsProps) {
  const { t } = useTranslation();
  const googleConfigured = isGoogleSignInConfigured();
  const [googleRequest, , promptGoogle] = useGoogleAuthRequest();

  const onGoogle = async () => {
    if (!googleConfigured || !googleRequest) {
      onError(t('auth.oauth_not_configured'));
      return;
    }
    onLoadingChange(true);
    try {
      const result = await promptGoogle();
      if (result.type !== 'success') {
        if (result.type === 'error') onError(result.error?.message ?? t('auth.oauth_failed'));
        return;
      }
      const idToken = result.authentication?.idToken ?? result.params?.id_token;
      if (!idToken) {
        onError(t('auth.oauth_failed'));
        return;
      }
      await signInWithGoogleIdToken(idToken);
      onSuccess();
    } catch (e) {
      onError((e as Error).message.startsWith('errors.') ? t((e as Error).message) : (e as Error).message);
    } finally {
      onLoadingChange(false);
    }
  };

  const onApple = async () => {
    onLoadingChange(true);
    try {
      await signInWithApple();
      onSuccess();
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === 'ERR_REQUEST_CANCELED') return;
      const msg = err.message.startsWith('errors.') ? t(err.message) : err.message;
      onError(msg || t('auth.oauth_failed'));
    } finally {
      onLoadingChange(false);
    }
  };

  if (!googleConfigured && !isAppleSignInAvailable()) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.divider}>{t('auth.oauth_divider')}</Text>
      {googleConfigured ? (
        <Button
          label={t('auth.google_sign_in')}
          onPress={onGoogle}
          loading={loading}
          disabled={!googleRequest}
          fullWidth
          variant="secondary"
        />
      ) : null}
      {isAppleSignInAvailable() ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={8}
          style={styles.appleBtn}
          onPress={onApple}
        />
      ) : null}
      {Platform.OS === 'web' && !googleConfigured ? (
        <Text style={styles.hint}>{t('auth.oauth_web_hint')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg, gap: spacing.md },
  divider: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  appleBtn: { width: '100%', height: 48 },
  hint: {
    ...typography.micro,
    color: colors.text.disabled,
    textAlign: 'center',
  },
});
