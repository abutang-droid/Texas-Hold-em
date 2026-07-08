import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { io, Socket } from 'socket.io-client';
import { getToken } from '../src/api/client';
import { Table9Max, type SeatView } from '../src/components/Table9Max';

const ROOM_URL = process.env.EXPO_PUBLIC_ROOM_URL ?? 'http://localhost:3001';

interface TableState {
  potTotal: number;
  communityCards: string[];
  currentTurnSeat: number | null;
  seats: SeatView[];
}

function applySnapshot(
  payload: TableState & { seats: SeatView[] },
  setState: (s: TableState) => void,
  setMyUserId: (id: string) => void,
) {
  setState({
    potTotal: payload.potTotal,
    communityCards: payload.communityCards,
    currentTurnSeat: payload.currentTurnSeat,
    seats: payload.seats.map((seat) => ({
      ...seat,
      isActive: seat.seatIndex === payload.currentTurnSeat,
    })),
  });
  const me = payload.seats.find((x) => x.holeCards && x.holeCards[0] !== '**');
  if (me?.userId) setMyUserId(me.userId);
}

export default function TableScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [state, setState] = useState<TableState>({
    potTotal: 0,
    communityCards: [],
    currentTurnSeat: null,
    seats: [],
  });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    const token = getToken();
    if (!token || !roomId) return;

    const s = io(ROOM_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    setSocket(s);

    const join = (reconnect = false) => {
      const event = reconnect ? 'reconnect_room' : 'join_room';
      const payload = reconnect
        ? { roomId, requestId: `reconnect-${Date.now()}` }
        : { roomId, buyInAmount: 100, requestId: `join-${Date.now()}` };
      s.emit(event, payload, (ack: { ok: boolean }) => {
        if (!ack?.ok && !reconnect) router.back();
      });
    };

    s.on('connect', () => {
      join(joinedRef.current);
      joinedRef.current = true;
    });

    s.on('room_state_sync', (msg: { payload: TableState & { seats: SeatView[] } }) => {
      applySnapshot(msg.payload, setState, setMyUserId);
    });

    return () => {
      s.emit('leave_room', { requestId: `leave-${Date.now()}` });
      s.disconnect();
    };
  }, [roomId, router]);

  const sendAction = (actionType: string, amount?: number) => {
    socket?.emit('player_action', { actionType, amount, requestId: `a-${Date.now()}` });
  };

  const isMyTurn =
    myUserId !== null &&
    state.seats.some(
      (s) => s.seatIndex === state.currentTurnSeat && s.userId === myUserId,
    );

  return (
    <View style={styles.container}>
      <Table9Max
        seats={state.seats}
        potTotal={state.potTotal}
        communityCards={state.communityCards}
        potLabel={t('game.pot')}
      />
      {isMyTurn && (
        <View style={styles.actions}>
          <ActionBtn label={t('game.action.fold')} onPress={() => sendAction('fold')} />
          <ActionBtn label={t('game.action.check')} onPress={() => sendAction('check')} />
          <ActionBtn label={t('game.action.call')} onPress={() => sendAction('call')} />
          <ActionBtn label={t('game.action.raise')} onPress={() => sendAction('raise', 4)} />
        </View>
      )}
      <Pressable
        style={styles.back}
        onPress={() => {
          socket?.emit('leave_room', { requestId: `leave-${Date.now()}` });
          router.back();
        }}
      >
        <Text style={styles.backText}>← Lobby</Text>
      </Pressable>
    </View>
  );
}

function ActionBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.actionBtn} onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121418' },
  actions: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtn: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  actionText: { color: '#fff', fontWeight: '600' },
  back: { position: 'absolute', top: 16, left: 16 },
  backText: { color: '#C9A227' },
});
