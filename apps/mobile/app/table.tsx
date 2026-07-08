import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { io, Socket } from 'socket.io-client';
import { getToken, submitReport } from '../src/api/client';
import { Table9Max, type SeatView } from '../src/components/Table9Max';
import {
  PrivateTablePanels,
  type DissolveVoteState,
  type RebuyApproval,
} from '../src/components/PrivateTablePanels';

const ROOM_URL = process.env.EXPO_PUBLIC_ROOM_URL ?? 'http://localhost:3001';

interface TableState {
  potTotal: number;
  communityCards: string[];
  currentTurnSeat: number | null;
  seats: SeatView[];
  roomType: 'OFFICIAL' | 'PRIVATE';
  hostUserId?: string;
  buyInCap: number;
  paused: boolean;
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
      isBot: seat.isBot,
    })),
    roomType: payload.roomType ?? 'OFFICIAL',
    hostUserId: payload.hostUserId,
    buyInCap: payload.buyInCap ?? 100,
    paused: payload.paused ?? false,
  });
  const me = payload.seats.find((x) => x.holeCards && x.holeCards[0] !== '**');
  if (me?.userId) setMyUserId(me.userId);
}

export default function TableScreen() {
  const { roomId, buyInCap: buyInCapParam } = useLocalSearchParams<{
    roomId: string;
    buyInCap?: string;
  }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [state, setState] = useState<TableState>({
    potTotal: 0,
    communityCards: [],
    currentTurnSeat: null,
    seats: [],
    roomType: 'OFFICIAL',
    buyInCap: 100,
    paused: false,
  });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [rebuyApproval, setRebuyApproval] = useState<RebuyApproval | null>(null);
  const [dissolveVote, setDissolveVote] = useState<DissolveVoteState | null>(null);
  const joinedRef = useRef(false);
  const myUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    myUserIdRef.current = myUserId;
  }, [myUserId]);

  const isPrivate = state.roomType === 'PRIVATE';
  const isHost = myUserId !== null && state.hostUserId === myUserId;
  const mySeat = state.seats.find((s) => s.userId === myUserId);
  const myChips = mySeat?.chips ?? 0;

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

    const buyIn = buyInCapParam ? Number(buyInCapParam) : 100;

    const join = (reconnect = false) => {
      const event = reconnect ? 'reconnect_room' : 'join_room';
      const payload = reconnect
        ? { roomId, requestId: `reconnect-${Date.now()}` }
        : { roomId, buyInAmount: buyIn, requestId: `join-${Date.now()}` };
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

    s.on(
      're_buy_approval_needed',
      (msg: {
        payload: {
          requestId: string;
          userId: string;
          nickname: string;
          amount: number;
          deadline: number;
        };
      }) => {
        setRebuyApproval(msg.payload);
      },
    );

    s.on(
      're_buy_result',
      (msg: {
        payload: { userId: string; approved: boolean; amount?: number };
      }) => {
        if (msg.payload.userId === myUserIdRef.current) {
          Alert.alert(
            msg.payload.approved ? t('table.rebuy_approved') : t('table.rebuy_rejected'),
          );
        }
        setRebuyApproval((cur) =>
          cur && cur.userId === msg.payload.userId ? null : cur,
        );
      },
    );

    s.on(
      'dissolve_vote_update',
      (msg: { payload: DissolveVoteState }) => {
        setDissolveVote(msg.payload);
      },
    );

    s.on('dissolve_vote_failed', () => {
      setDissolveVote(null);
      Alert.alert(t('table.dissolve_failed'));
    });

    s.on('room_dissolved', () => {
      setDissolveVote(null);
      Alert.alert(t('table.room_dissolved'), '', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    });

    return () => {
      s.emit('leave_room', { requestId: `leave-${Date.now()}` });
      s.disconnect();
    };
  }, [roomId, buyInCapParam, router, t]);

  const emitAdmin = (action: string, targetUserId?: string) => {
    socket?.emit('room_admin_action', {
      action,
      targetUserId,
      requestId: `admin-${Date.now()}`,
    });
  };

  const sendAction = (actionType: string, amount?: number) => {
    socket?.emit('player_action', { actionType, amount, requestId: `a-${Date.now()}` });
  };

  const requestRebuy = () => {
    const amount = Math.min(state.buyInCap, Math.max(10, state.buyInCap - myChips));
    socket?.emit(
      're_buy_request',
      { requestId: `rebuy-${Date.now()}`, amount },
      (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) {
          Alert.alert(t('table.rebuy_failed'), ack?.error ?? '');
        } else {
          Alert.alert(t('table.rebuy_pending'));
        }
      },
    );
  };

  const respondRebuy = (approved: boolean) => {
    if (!rebuyApproval) return;
    socket?.emit('re_buy_response', {
      requestId: rebuyApproval.requestId,
      targetUserId: rebuyApproval.userId,
      approved,
    });
    setRebuyApproval(null);
  };

  const respondDissolve = (approved: boolean) => {
    socket?.emit('dissolve_vote_response', { approved, requestId: `dv-${Date.now()}` });
    if (!approved) setDissolveVote(null);
  };

  const reportPlayer = async (userId: string) => {
    try {
      await submitReport({
        reportedUserId: Number(userId),
        roomId,
        category: 'suspicious_play',
      });
      Alert.alert(t('table.report_sent'));
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  const isMyTurn =
    myUserId !== null &&
    state.seats.some(
      (seat) => seat.seatIndex === state.currentTurnSeat && seat.userId === myUserId,
    );

  return (
    <View style={styles.container}>
      <Table9Max
        seats={state.seats}
        potTotal={state.potTotal}
        communityCards={state.communityCards}
        potLabel={t('game.pot')}
      />

      <PrivateTablePanels
        isPrivate={isPrivate}
        isHost={isHost}
        paused={state.paused}
        buyInCap={state.buyInCap}
        myChips={myChips}
        humanSeats={state.seats.filter((s) => s.userId && !s.isBot)}
        rebuyApproval={rebuyApproval}
        dissolveVote={dissolveVote}
        onRequestRebuy={requestRebuy}
        onApproveRebuy={() => respondRebuy(true)}
        onRejectRebuy={() => respondRebuy(false)}
        onDissolveApprove={() => respondDissolve(true)}
        onDissolveReject={() => respondDissolve(false)}
        onPause={() => emitAdmin('pause')}
        onResume={() => emitAdmin('resume')}
        onStartDissolve={() => emitAdmin('dissolve_vote')}
        onKick={(userId) => emitAdmin('kick', userId)}
        onReport={reportPlayer}
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
  back: { position: 'absolute', top: 16, left: 16, zIndex: 11 },
  backText: { color: '#C9A227' },
});
