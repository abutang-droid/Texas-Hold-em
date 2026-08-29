import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Share } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  createPrivateRoom,
  getPrivatePermission,
  grantPrivatePermission,
  joinPrivateRoom,
} from '../src/api/client';
import { Screen, ScreenHeader } from '../src/components/ui/Screen';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { colors, spacing, typography } from '../src/theme';

function LabeledInput({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={colors.text.disabled}
      />
    </View>
  );
}

export default function PrivateRoomScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<{
    hasPermission: boolean;
    officialHandsPlayed: number;
    canCreateTwoPlayer: boolean;
    fee: number;
  } | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [maxSeats, setMaxSeats] = useState('6');
  const [buyInCap, setBuyInCap] = useState('500');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [created, setCreated] = useState<{
    roomCode: string;
    roomId: string;
    inviteText: string;
    deepLink: string;
    buyInCap: number;
  } | null>(null);

  useEffect(() => {
    if (codeParam) setRoomCode(String(codeParam).trim().toUpperCase());
  }, [codeParam]);

  useEffect(() => {
    getPrivatePermission()
      .then(setPermission)
      .catch((e) => Alert.alert('Error', (e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const onGrant = async () => {
    try {
      await grantPrivatePermission();
      const p = await getPrivatePermission();
      setPermission(p);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  const onCreate = async () => {
    const seats = Number(maxSeats);
    const cap = Number(buyInCap);
    if (seats === 2 && !permission?.canCreateTwoPlayer) {
      Alert.alert(t('private.two_player_blocked'));
      return;
    }
    setCreating(true);
    try {
      const room = await createPrivateRoom({
        maxSeats: seats,
        smallBlind: 5,
        bigBlind: 10,
        buyInCap: cap,
      });
      setCreated({
        roomCode: room.roomCode,
        roomId: room.roomId,
        inviteText: room.inviteText,
        deepLink: room.deepLink,
        buyInCap: room.buyInCap,
      });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const onJoin = async () => {
    if (!roomCode.trim()) return;
    setJoining(true);
    try {
      const room = await joinPrivateRoom(roomCode.trim());
      router.push({
        pathname: '/table',
        params: { roomId: room.roomId, buyInCap: String(room.buyInCap) },
      });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setJoining(false);
    }
  };

  const onShare = async () => {
    if (!created) return;
    const message = `${created.inviteText}\n${created.deepLink}`;
    await Share.share({ message, url: created.deepLink });
  };

  if (loading) {
    return <Screen loading loadingLabel={t('common.loading')} />;
  }

  if (!permission) {
    return (
      <Screen>
        <Text style={styles.error}>{t('common.error')}</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('private.title')}
        subtitle={t('private.official_hands', { count: permission.officialHandsPlayed })}
        onBack={() => router.back()}
        backLabel={t('private.back')}
      />

      {!permission.hasPermission ? (
        <Card elevated style={styles.unlockCard}>
          <Text style={styles.unlockIcon}>🔒</Text>
          <Text style={styles.unlockTitle}>{t('private.unlock_title')}</Text>
          <Text style={styles.body}>{t('private.permission_desc', { fee: permission.fee })}</Text>
          <Button label={t('private.grant_permission')} onPress={onGrant} fullWidth />
        </Card>
      ) : (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('private.create')}</Text>
          <LabeledInput
            label={t('private.max_seats')}
            value={maxSeats}
            onChangeText={setMaxSeats}
            keyboardType="number-pad"
          />
          <LabeledInput
            label={t('private.buy_in_cap')}
            value={buyInCap}
            onChangeText={setBuyInCap}
            keyboardType="number-pad"
          />
          <Button
            label={t('private.create_btn')}
            onPress={onCreate}
            loading={creating}
            fullWidth
          />
        </Card>
      )}

      {created && (
        <Card elevated style={styles.inviteCard}>
          <Text style={styles.sectionTitle}>{t('private.room_created')}</Text>
          <Text style={styles.code}>{created.roomCode}</Text>
          <Text style={styles.inviteText}>{created.inviteText}</Text>
          <Text style={styles.deepLink}>{created.deepLink}</Text>
          <View style={styles.row}>
            <Button label={t('private.share')} onPress={onShare} variant="secondary" style={styles.half} />
            <Button
              label={t('private.enter_room')}
              onPress={() =>
                router.push({
                  pathname: '/table',
                  params: {
                    roomId: created.roomId,
                    buyInCap: String(created.buyInCap),
                  },
                })
              }
              style={styles.half}
            />
          </View>
        </Card>
      )}

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('private.join')}</Text>
        <LabeledInput
          label={t('private.room_code')}
          value={roomCode}
          onChangeText={setRoomCode}
          keyboardType="number-pad"
        />
        <Button
          label={t('private.join_btn')}
          onPress={onJoin}
          variant="secondary"
          loading={joining}
          fullWidth
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  unlockCard: { alignItems: 'center', marginBottom: spacing.lg },
  unlockIcon: { fontSize: 40, marginBottom: spacing.md },
  unlockTitle: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 24 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.h2, color: colors.brand.secondary, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  label: { ...typography.micro, color: colors.text.secondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.bg.lobby,
    borderRadius: 8,
    padding: spacing.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...typography.body,
  },
  inviteCard: { marginBottom: spacing.lg },
  code: {
    ...typography.display,
    color: colors.brand.secondary,
    textAlign: 'center',
    letterSpacing: 8,
    marginVertical: spacing.md,
  },
  inviteText: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing.sm, lineHeight: 20 },
  deepLink: { ...typography.micro, color: colors.semantic.info, marginBottom: spacing.lg, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  error: { ...typography.body, color: colors.semantic.danger, textAlign: 'center' },
});
