import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { designTokens } from '@texas-holdem/shared';
import { selfExclude } from '../src/api/client';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onSelfExclude = () => {
    Alert.alert(t('settings.self_exclude_title'), t('settings.self_exclude_confirm'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.confirm'),
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await selfExclude(30);
            Alert.alert(t('settings.self_exclude_done'));
            router.replace('/');
          } catch (e) {
            Alert.alert('Error', (e as Error).message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← {t('settings.back')}</Text>
      </Pressable>
      <Text style={styles.title}>{t('settings.title')}</Text>
      <Text style={styles.disclaimer}>{t('settings.disclaimer')}</Text>

      <View style={styles.card}>
        <Text style={styles.section}>{t('settings.responsible_gaming')}</Text>
        <Text style={styles.body}>{t('settings.self_exclude_desc')}</Text>
        <Pressable style={styles.dangerBtn} onPress={onSelfExclude} disabled={loading}>
          <Text style={styles.dangerText}>{t('settings.self_exclude_btn')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: designTokens.color.bg.lobby, padding: 24 },
  back: { color: designTokens.color.brand.secondary, marginBottom: 16 },
  title: { color: '#F5F5F5', fontSize: 24, fontWeight: '700', marginBottom: 12 },
  disclaimer: { color: '#9E9E9E', lineHeight: 20, marginBottom: 20 },
  card: {
    backgroundColor: designTokens.color.bg.card,
    borderRadius: 12,
    padding: 16,
  },
  section: { color: '#F5F5F5', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  body: { color: '#9E9E9E', lineHeight: 22, marginBottom: 16 },
  dangerBtn: {
    backgroundColor: '#B71C1C',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  dangerText: { color: '#fff', fontWeight: '700' },
});
