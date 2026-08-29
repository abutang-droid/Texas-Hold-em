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
import { EmojiBar } from '../src/components/EmojiBar';
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
  buttonSeat: number;
  sbSeat: number | null;
  bbSeat: number | null;
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
    buttonSeat: payload.buttonSeat ?? 0,
    sbSeat: payload.sbSeat ?? null,
    bbSeat: payload.bbSeat ?? null,
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
    buttonSeat: 0,
    sbSeat: null,
    bbSeat: null,
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
  const [chipFlyEvents, setChipFlyEvents] = useState<
    Array<{ id: string; seatIndex: number; amount: number }>
  >([]);
  const [animateHoleDeal, setAnimateHoleDeal] = useState(false);
  const [seatEmojis, setSeatEmojis] = useState<Record<number, string>>({});
  const joinedRef = useRef(false);
  const myUserIdRef = useRef<string | null>(null);
  const seatsRef = useRef<SeatView[]>([]);
  const handNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emojiTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const shownHandsRef = useRef(new Set<string>());

  const dismissShowdown = useCallback(() => {
    setShowdown(null);
    setWinnerSeats([]);
  }, []);

  const dismissShowdownRef = useRef(dismissShowdown);
  useEffect(() => {
    dismissShowdownRef.current = dismissShowdown;
  }, [dismissShowdown]);

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

    const onConnect = () => {
      join(joinedRef.current);
      joinedRef.current = true;
    };

    const onRoomState = (msg: { payload: SnapshotPayload }) => {
      applySnapshot(msg.payload);
    };

    const onActionTurn = (msg: {
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
    };

    const onActionResult = (msg: {
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
      const betAmount = msg.payload.amount ?? 0;
      if (
        betAmount > 0 &&
        ['call', 'raise', 'all_in'].includes(msg.payload.actionType)
      ) {
        setChipFlyEvents((prev) => [
          ...prev,
          {
            id: `chip-${Date.now()}-${msg.payload.seatIndex}`,
            seatIndex: msg.payload.seatIndex,
            amount: betAmount,
          },
        ]);
      }
      if (msg.payload.userId === myUserIdRef.current) {
        setTurnContext(null);
      }
    };

    const onHandEnded = (msg: {
      payload: Partial<HandEndPayload> & { handId: string; nextHandIn: number };
    }) => {
      const handId = msg.payload.handId;
      if (!handId || shownHandsRef.current.has(handId)) return;
      shownHandsRef.current.add(handId);
      if (shownHandsRef.current.size > 50) {
        const oldest = shownHandsRef.current.values().next().value;
        if (oldest) shownHandsRef.current.delete(oldest);
      }

      setTurnContext(null);
      const p = msg.payload;
      const payload: HandEndPayload = {
        handId,
        nextHandIn: p.nextHandIn ?? 3000,
        potSize: p.potSize ?? 0,
        boardCards: p.boardCards ?? '',
        winners: p.winners ?? [],
      };
      setShowdown((prev) => (prev?.handId === handId ? prev : payload));
      setWinnerSeats(payload.winners.map((w) => w.seatIndex));
      setHandNotice(null);
      if (handNoticeTimer.current) clearTimeout(handNoticeTimer.current);
      handNoticeTimer.current = setTimeout(
        () => dismissShowdownRef.current(),
        payload.nextHandIn,
      );
    };

    const onGameStarted = (msg: {
      payload: {
        handId: string;
        buttonSeat: number;
        sbSeat: number;
        bbSeat: number;
        blindsPosted?: { sb: number; bb: number };
      };
    }) => {
      if (handNoticeTimer.current) {
        clearTimeout(handNoticeTimer.current);
        handNoticeTimer.current = null;
      }
      setShowdown(null);
      setWinnerSeats([]);
      const p = msg.payload;
      setState((prev) => ({
        ...prev,
        buttonSeat: p.buttonSeat,
        sbSeat: p.sbSeat,
        bbSeat: p.bbSeat,
        seats: prev.seats.map((s) => ({ ...s, revealed: false })),
      }));
      setHandNotice(
        t('game.hand_start', {
          hand: p.handId.slice(-4),
          sb: p.sbSeat + 1,
          bb: p.bbSeat + 1,
        }),
      );
      handNoticeTimer.current = setTimeout(() => setHandNotice(null), 2500);
    };

    const onHoleCardsDealt = () => {
      setAnimateHoleDeal(true);
      setHandNotice(t('game.dealing_hole'));
      if (handNoticeTimer.current) clearTimeout(handNoticeTimer.current);
      handNoticeTimer.current = setTimeout(() => {
        setHandNotice(null);
        setAnimateHoleDeal(false);
      }, 1500);
    };

    const onCommunityDealt = (msg: {
      payload: { phase: string; cards: string[] };
    }) => {
      const phaseKey =
        msg.payload.phase === 'FLOP'
          ? 'game.phase.flop'
          : msg.payload.phase === 'TURN'
            ? 'game.phase.turn'
            : 'game.phase.river';
      setHandNotice(t('game.community_dealt', { phase: t(phaseKey) }));
      if (handNoticeTimer.current) clearTimeout(handNoticeTimer.current);
      handNoticeTimer.current = setTimeout(() => setHandNotice(null), 1500);
    };

    const onShowdownResult = (msg: {
      payload: {
        handId: string;
        boardCards: string[];
        players: Array<{ seatIndex: number; userId: string; holeCards: string[] }>;
      };
    }) => {
      const reveals = new Map(
        msg.payload.players.map((p) => [p.seatIndex, p.holeCards] as const),
      );
      setState((prev) => ({
        ...prev,
        seats: prev.seats.map((seat) => {
          const cards = reveals.get(seat.seatIndex);
          if (!cards) return seat;
          return { ...seat, holeCards: cards, revealed: true };
        }),
      }));
    };

    const showSeatEmoji = (seatIndex: number, emoji: string) => {
      const prev = emojiTimers.current.get(seatIndex);
      if (prev) clearTimeout(prev);
      setSeatEmojis((cur) => ({ ...cur, [seatIndex]: emoji }));
      const timer = setTimeout(() => {
        setSeatEmojis((cur) => {
          const next = { ...cur };
          delete next[seatIndex];
          return next;
        });
        emojiTimers.current.delete(seatIndex);
      }, 2500);
      emojiTimers.current.set(seatIndex, timer);
    };

    const onEmojiSent = (msg: {
      payload: { seatIndex: number; emoji: string };
    }) => {
      showSeatEmoji(msg.payload.seatIndex, msg.payload.emoji);
    };

    const onPlayerJoined = (msg: {
      payload: { nickname: string; seatIndex: number; avatarUrl?: string | null };
    }) => {
      setHandNotice(t('game.player_joined', { name: msg.payload.nickname }));
      if (handNoticeTimer.current) clearTimeout(handNoticeTimer.current);
      handNoticeTimer.current = setTimeout(() => setHandNotice(null), 2500);
    };

    const onPlayerLeft = (msg: { payload: { userId: string } }) => {
      const seat = seatsRef.current.find((s) => s.userId === msg.payload.userId);
      const name = seat?.nickname ?? msg.payload.userId;
      setHandNotice(t('game.player_left', { name }));
      if (handNoticeTimer.current) clearTimeout(handNoticeTimer.current);
      handNoticeTimer.current = setTimeout(() => setHandNotice(null), 2500);
    };

    const onError = (msg: { payload?: { code?: string; messageKey?: string } }) => {
      const key = msg.payload?.messageKey;
      Alert.alert(t('common.error'), key?.startsWith('errors.') ? t(key) : key ?? t('common.error'));
    };

    const onRebuyNeeded = (msg: {
      payload: {
        requestId: string;
        userId: string;
        nickname: string;
        amount: number;
        deadline: number;
      };
    }) => {
      setRebuyApproval(msg.payload);
    };

    const onRebuyResult = (msg: {
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
    };

    const onDissolveUpdate = (msg: { payload: DissolveVoteState }) => {
      setDissolveVote(msg.payload);
    };

    const onDissolveFailed = () => {
      setDissolveVote(null);
      Alert.alert(t('table.dissolve_failed'));
    };

    const onRoomDissolved = () => {
      setDissolveVote(null);
      Alert.alert(t('table.room_dissolved'), '', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    };

    s.on('connect', onConnect);
    s.on('room_state_sync', onRoomState);
    s.on('action_turn', onActionTurn);
    s.on('action_result', onActionResult);
    s.on('hand_ended', onHandEnded);
    s.on('game_started', onGameStarted);
    s.on('hole_cards_dealt', onHoleCardsDealt);
    s.on('community_cards_dealt', onCommunityDealt);
    s.on('showdown_result', onShowdownResult);
    s.on('emoji_sent', onEmojiSent);
    s.on('player_joined', onPlayerJoined);
    s.on('player_left', onPlayerLeft);
    s.on('error', onError);
    s.on('re_buy_approval_needed', onRebuyNeeded);
    s.on('re_buy_result', onRebuyResult);
    s.on('dissolve_vote_update', onDissolveUpdate);
    s.on('dissolve_vote_failed', onDissolveFailed);
    s.on('room_dissolved', onRoomDissolved);

    return () => {
      if (handNoticeTimer.current) clearTimeout(handNoticeTimer.current);
      for (const timer of emojiTimers.current.values()) clearTimeout(timer);
      emojiTimers.current.clear();
      s.off('connect', onConnect);
      s.off('room_state_sync', onRoomState);
      s.off('action_turn', onActionTurn);
      s.off('action_result', onActionResult);
      s.off('hand_ended', onHandEnded);
      s.off('game_started', onGameStarted);
      s.off('hole_cards_dealt', onHoleCardsDealt);
      s.off('community_cards_dealt', onCommunityDealt);
      s.off('showdown_result', onShowdownResult);
      s.off('emoji_sent', onEmojiSent);
      s.off('player_joined', onPlayerJoined);
      s.off('player_left', onPlayerLeft);
      s.off('error', onError);
      s.off('re_buy_approval_needed', onRebuyNeeded);
      s.off('re_buy_result', onRebuyResult);
      s.off('dissolve_vote_update', onDissolveUpdate);
      s.off('dissolve_vote_failed', onDissolveFailed);
      s.off('room_dissolved', onRoomDissolved);
      s.emit('leave_room', { requestId: `leave-${Date.now()}` });
      s.disconnect();
    };
  }, [roomId, buyInCapParam, router, applySnapshot, t]);

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

  const sendEmoji = (emojiId: string) => {
    socket?.emit('send_emoji', { emojiId, requestId: `emoji-${Date.now()}` });
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
        buttonSeat={state.buttonSeat}
        sbSeat={state.sbSeat}
        bbSeat={state.bbSeat}
        turnDeadline={state.actionDeadline}
        winnerSeats={winnerSeats}
        chipFlyEvents={chipFlyEvents}
        animateHoleDeal={animateHoleDeal}
        seatEmojis={seatEmojis}
        onChipFlyDone={(id) =>
          setChipFlyEvents((prev) => prev.filter((e) => e.id !== id))
        }
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

      {!isPrivate && (
        <View style={[styles.emojiWrap, isMyTurn && turnContext && styles.emojiWrapAboveActions]}>
          <EmojiBar onSend={sendEmoji} />
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
  emojiWrap: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 19,
  },
  emojiWrapAboveActions: {
    bottom: 120,
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
