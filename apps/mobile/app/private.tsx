import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  createPrivateRoom,
  getPrivatePermission,
  grantPrivatePermission,
  joinPrivateRoom,
} from '../src/api/client';
import { designTokens } from '@texas-holdem/shared';

export default function PrivateRoomScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, setPermission] = useState<{
    hasPermission: boolean;
    officialHandsPlayed: number;
    canCreateTwoPlayer: boolean;
    fee: number;
  } | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [maxSeats, setMaxSeats] = useState('6');
  const [buyInCap, setBuyInCap] = useState('500');
  const [created, setCreated] = useState<{
    roomCode: string;
    roomId: string;
    inviteText: string;
    buyInCap: number;
  } | null>(null);

  useEffect(() => {
    getPrivatePermission()
      .then(setPermission)
      .catch((e) => Alert.alert('Error', (e as Error).message));
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
        buyInCap: room.buyInCap,
      });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  const onJoin = async () => {
    if (!roomCode.trim()) return;
    try {
      const room = await joinPrivateRoom(roomCode.trim());
      router.push({
        pathname: '/table',
        params: { roomId: room.roomId, buyInCap: String(room.buyInCap) },
      });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  const onShare = async () => {
    if (!created) return;
    await Share.share({ message: created.inviteText });
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← {t('private.back')}</Text>
      </Pressable>

      <Text style={styles.title}>{t('private.title')}</Text>

      {!permission.hasPermission ? (
        <View style={styles.card}>
          <Text style={styles.body}>{t('private.permission_desc', { fee: permission.fee })}</Text>
          <Pressable style={styles.primaryBtn} onPress={onGrant}>
            <Text style={styles.primaryText}>{t('private.grant_permission')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.section}>{t('private.create')}</Text>
            <TextInput
              style={styles.input}
              value={maxSeats}
              onChangeText={setMaxSeats}
              keyboardType="number-pad"
              placeholder={t('private.max_seats')}
            />
            <TextInput
              style={styles.input}
              value={buyInCap}
              onChangeText={setBuyInCap}
              keyboardType="number-pad"
              placeholder={t('private.buy_in_cap')}
            />
            <Pressable style={styles.primaryBtn} onPress={onCreate}>
              <Text style={styles.primaryText}>{t('private.create_btn')}</Text>
            </Pressable>
          </View>

          {created && (
            <View style={styles.card}>
              <Text style={styles.section}>{t('private.room_created')}</Text>
              <Text style={styles.code}>{created.roomCode}</Text>
              <Text style={styles.muted}>{created.inviteText}</Text>
              <Pressable style={styles.secondaryBtn} onPress={onShare}>
                <Text style={styles.secondaryText}>{t('private.share')}</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={() =>
                  router.push({
                    pathname: '/table',
                    params: {
                      roomId: created.roomId,
                      buyInCap: String(created.buyInCap),
                    },
                  })
                }
              >
                <Text style={styles.primaryText}>{t('private.enter_room')}</Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      <View style={styles.card}>
        <Text style={styles.section}>{t('private.join')}</Text>
        <TextInput
          style={styles.input}
          value={roomCode}
          onChangeText={setRoomCode}
          keyboardType="number-pad"
          placeholder={t('private.room_code')}
        />
        <Pressable style={styles.secondaryBtn} onPress={onJoin}>
          <Text style={styles.secondaryText}>{t('private.join_btn')}</Text>
        </Pressable>
      </View>

      <Text style={styles.muted}>
        {t('private.official_hands', { count: permission.officialHandsPlayed })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: designTokens.color.bg.lobby, padding: 24 },
  back: { color: designTokens.color.brand.secondary, marginBottom: 16 },
  title: { color: '#F5F5F5', fontSize: 24, fontWeight: '700', marginBottom: 20 },
  card: {
    backgroundColor: designTokens.color.bg.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  section: { color: '#F5F5F5', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  body: { color: '#9E9E9E', marginBottom: 16, lineHeight: 22 },
  input: {
    backgroundColor: '#121418',
    borderRadius: 8,
    padding: 12,
    color: '#F5F5F5',
    marginBottom: 12,
  },
  code: { color: designTokens.color.brand.secondary, fontSize: 32, fontWeight: '700', marginVertical: 8 },
  muted: { color: '#9E9E9E', marginTop: 8 },
  primaryBtn: {
    backgroundColor: designTokens.color.brand.secondary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#1A1A1A', fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: designTokens.color.brand.secondary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryText: { color: designTokens.color.brand.secondary, fontWeight: '600' },
});
