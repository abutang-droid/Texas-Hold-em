import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { joinPrivateRoom } from '../../src/api/client';
import { Screen } from '../../src/components/ui/Screen';

/** Deep link: texasholdem://room/{roomCode} */
export default function RoomDeepLinkScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const started = useRef(false);

  useEffect(() => {
    const roomCode = String(code ?? '').trim().toUpperCase();
    if (!roomCode || started.current) return;
    started.current = true;

    joinPrivateRoom(roomCode)
      .then((room) => {
        router.replace({
          pathname: '/table',
          params: { roomId: room.roomId, buyInCap: String(room.buyInCap) },
        });
      })
      .catch((e) => {
        Alert.alert(t('private.join_failed'), (e as Error).message, [
          { text: 'OK', onPress: () => router.replace('/private') },
        ]);
      });
  }, [code, router, t]);

  return <Screen loading loadingLabel={t('private.joining_room')} />;
}
