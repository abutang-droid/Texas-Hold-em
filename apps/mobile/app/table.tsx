import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { io, Socket } from 'socket.io-client';
import { getToken, submitReport } from '../src/api/client';
import { Table9Max, type SeatView } from '../src/components/Table9Max';
import { ActionPanel } from '../src/components/ActionPanel';
import { HandStatusBar } from '../src/components/HandStatusBar';
import { ShowdownOverlay } from '../src/components/ShowdownOverlay';
import {
  PrivateTablePanels,
  type DissolveVoteState,
  type RebuyApproval,
} from '../src/components/PrivateTablePanels';
import type { HandEndPayload, LastAction, PokerAction, TurnContext } from '../src/types/table';

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
  phase: string;
  handId: string | null;
  blinds: { sb: number; bb: number };
  actionDeadline: number | null;
}

type SnapshotPayload = TableState & { seats: SeatView[] };

function mapSnapshot(payload: SnapshotPayload, currentTurnSeat: number | null): TableState {
  return {
    potTotal: payload.potTotal,
    communityCards: payload.communityCards,
    currentTurnSeat: payload.currentTurnSeat ?? currentTurnSeat,
    seats: (payload.seats ?? []).map((seat) => ({
      ...seat,
      isActive: seat.seatIndex === (payload.currentTurnSeat ?? currentTurnSeat),
      isBot: seat.isBot,
    })),
    roomType: payload.roomType ?? 'OFFICIAL',
    hostUserId: payload.hostUserId,
    buyInCap: payload.buyInCap ?? 100,
    paused: payload.paused ?? false,
    phase: payload.phase ?? 'WAITING',
    handId: payload.handId ?? null,
    blinds: payload.blinds ?? { sb: 1, bb: 2 },
    actionDeadline: payload.actionDeadline ?? null,
  };
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
    phase: 'WAITING',
    handId: null,
    blinds: { sb: 1, bb: 2 },
    actionDeadline: null,
  });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [turnContext, setTurnContext] = useState<TurnContext | null>(null);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [handNotice, setHandNotice] = useState<string | null>(null);
  const [showdown, setShowdown] = useState<HandEndPayload | null>(null);
  const [winnerSeats, setWinnerSeats] = useState<number[]>([]);
  const [rebuyApproval, setRebuyApproval] = useState<RebuyApproval | null>(null);
  const [dissolveVote, setDissolveVote] = useState<DissolveVoteState | null>(null);
  const joinedRef = useRef(false);
  const myUserIdRef = useRef<string | null>(null);
  const seatsRef = useRef<SeatView[]>([]);
  const handNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandEndedRef = useRef<string | null>(null);

  const dismissShowdown = useCallback(() => {
    setShowdown(null);
    setWinnerSeats([]);
  }, []);

  useEffect(() => {
    seatsRef.current = state.seats;
  }, [state.seats]);

  useEffect(() => {
    myUserIdRef.current = myUserId;
  }, [myUserId]);

  const applySnapshot = useCallback((payload: SnapshotPayload) => {
    setState((prev) => mapSnapshot(payload, payload.currentTurnSeat ?? prev.currentTurnSeat));
    const me = payload.seats?.find((x) => x.holeCards && x.holeCards[0] !== '**');
    if (me?.userId) setMyUserId(me.userId);
    const turnSeat = payload.currentTurnSeat;
    if (turnSeat === null || turnSeat === undefined) {
      setTurnContext(null);
    } else if (me?.userId) {
      const actor = payload.seats?.find((s) => s.seatIndex === turnSeat);
      if (actor?.userId !== me.userId) setTurnContext(null);
    }
  }, []);

  const isPrivate = state.roomType === 'PRIVATE';
  const isHost = myUserId !== null && state.hostUserId === myUserId;
  const mySeat = state.seats.find((s) => s.userId === myUserId);
  const myChips = mySeat?.chips ?? 0;

  const isMyTurn =
    turnContext !== null &&
    myUserId !== null &&
    state.seats.some(
      (seat) => seat.seatIndex === state.currentTurnSeat && seat.userId === myUserId,
    );

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

    s.on('room_state_sync', (msg: { payload: SnapshotPayload }) => {
      applySnapshot(msg.payload);
    });

    s.on(
      'action_turn',
      (msg: {
        payload: {
          seatIndex: number;
          deadline: number;
          validActions: PokerAction[];
          callAmount: number;
          minRaise: number;
          maxRaise: number;
        };
      }) => {
        const p = msg.payload;
        setTurnContext({
          seatIndex: p.seatIndex,
          deadline: p.deadline,
          validActions: p.validActions,
          callAmount: p.callAmount,
          minRaise: p.minRaise,
          maxRaise: p.maxRaise,
        });
        setState((prev) => ({
          ...prev,
          currentTurnSeat: p.seatIndex,
          actionDeadline: p.deadline,
          seats: prev.seats.map((seat) => ({
            ...seat,
            isActive: seat.seatIndex === p.seatIndex,
          })),
        }));
      },
    );

    s.on(
      'action_result',
      (msg: {
        payload: {
          seatIndex: number;
          userId: string;
          actionType: string;
          amount?: number;
          autoAction?: boolean;
        };
      }) => {
        const seat = seatsRef.current.find((x) => x.seatIndex === msg.payload.seatIndex);
        setLastAction({
          nickname: seat?.nickname ?? msg.payload.userId,
          actionType: msg.payload.actionType,
          amount: msg.payload.amount,
          autoAction: msg.payload.autoAction,
        });
        if (msg.payload.userId === myUserIdRef.current) {
          setTurnContext(null);
        }
      },
    );

    s.on('hand_ended', (msg: { payload: Partial<HandEndPayload> & { handId: string; nextHandIn: number } }) => {
      const handId = msg.payload.handId;
      if (!handId || lastHandEndedRef.current === handId) return;
      lastHandEndedRef.current = handId;

      setTurnContext(null);
      const p = msg.payload;
      const payload: HandEndPayload = {
        handId,
        nextHandIn: p.nextHandIn ?? 3000,
        potSize: p.potSize ?? 0,
        boardCards: p.boardCards ?? '',
        winners: p.winners ?? [],
      };
      setShowdown(payload);
      setWinnerSeats(payload.winners.map((w) => w.seatIndex));
      setHandNotice(null);
      if (handNoticeTimer.current) clearTimeout(handNoticeTimer.current);
      handNoticeTimer.current = setTimeout(dismissShowdown, payload.nextHandIn);
    });

    s.on('game_started', () => {
      lastHandEndedRef.current = null;
      dismissShowdown();
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

    s.on('dissolve_vote_update', (msg: { payload: DissolveVoteState }) => {
      setDissolveVote(msg.payload);
    });

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
      if (handNoticeTimer.current) clearTimeout(handNoticeTimer.current);
      s.emit('leave_room', { requestId: `leave-${Date.now()}` });
      s.disconnect();
    };
  }, [roomId, buyInCapParam, router, applySnapshot, dismissShowdown]);

  const emitAdmin = (action: string, targetUserId?: string) => {
    socket?.emit('room_admin_action', {
      action,
      targetUserId,
      requestId: `admin-${Date.now()}`,
    });
  };

  const sendAction = (actionType: PokerAction, amount?: number) => {
    setTurnContext(null);
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

  return (
    <View style={styles.container}>
      <Table9Max
        seats={state.seats}
        potTotal={state.potTotal}
        communityCards={state.communityCards}
        potLabel={t('game.pot')}
        heroUserId={myUserId}
        turnDeadline={state.actionDeadline}
        winnerSeats={winnerSeats}
      />

      <HandStatusBar
        phase={state.phase}
        blinds={state.blinds}
        lastAction={lastAction}
        handNotice={handNotice}
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

      {isMyTurn && turnContext && (
        <View style={styles.actionWrap}>
          <ActionPanel turn={turnContext} onAction={sendAction} />
        </View>
      )}

      <ShowdownOverlay
        visible={!!showdown}
        handId={showdown?.handId ?? ''}
        winners={showdown?.winners ?? []}
        potSize={showdown?.potSize ?? 0}
        boardCards={showdown?.boardCards ?? ''}
        nextHandIn={showdown?.nextHandIn ?? 3000}
      />

      <Pressable
        style={styles.back}
        onPress={() => {
          socket?.emit('leave_room', { requestId: `leave-${Date.now()}` });
          router.back();
        }}
      >
        <Text style={styles.backText}>← {t('table.back_lobby')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121418' },
  actionWrap: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  back: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backText: { color: '#C9A227', fontWeight: '600' },
});
