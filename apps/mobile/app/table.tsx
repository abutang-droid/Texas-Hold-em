import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { showAlert, showConfirm } from '../src/utils/alert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { io, Socket } from 'socket.io-client';
import { getToken, restoreSession, submitReport, switchPublicTable, formatApiError } from '../src/api/client';
import { Table9Max, type SeatView } from '../src/components/Table9Max';
import type { ChipFlyEvent } from '../src/components/ChipFlyLayer';
import { ActionPanel } from '../src/components/ActionPanel';
import { HandStatusBar } from '../src/components/HandStatusBar';
import { ShowdownOverlay } from '../src/components/ShowdownOverlay';
import { EmojiBar } from '../src/components/EmojiBar';
import {
  PrivateTablePanels,
  type DissolveVoteState,
  type RebuyApproval,
} from '../src/components/PrivateTablePanels';
import type { HandEndPayload, LastAction, PokerAction, SeatAction, TurnContext } from '../src/types/table';
import { colors, palette, radius } from '../src/theme';

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
  maxSeats: number;
  role: 'spectator' | 'player' | null;
  pendingSitIn: boolean;
  emptySeats: number[];
  mySeatIndex: number | null;
}

type SnapshotPayload = TableState & { seats: SeatView[] };

function normalizeCardCode(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const code = raw.trim();
    if (code.length >= 2 && code !== '**') return code;
    return null;
  }
  if (raw && typeof raw === 'object' && 'rank' in raw && 'suit' in raw) {
    const card = raw as { rank?: string; suit?: string };
    if (card.rank && card.suit) return `${card.rank}${card.suit}`;
  }
  return null;
}

function normalizeBoard(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCardCode).filter((c): c is string => c !== null);
}

/** Don't let a stale/empty snapshot wipe a live board (blank community cards). */
function mergeCommunity(
  prev: string[],
  incoming: string[],
  prevHandId: string | null,
  nextHandId: string | null,
  phase: string,
): string[] {
  if (nextHandId && prevHandId && nextHandId !== prevHandId) return incoming;
  if (phase === 'WAITING') return incoming;
  if (incoming.length === 0 && prev.length > 0) return prev;
  if (incoming.length < prev.length) return prev;
  return incoming;
}

function hasFaceUpHoles(cards?: string[]): boolean {
  return !!cards && cards.length >= 2 && cards[0] !== '**';
}

function mergeRevealedHoles(
  prev: SeatView[],
  incoming: SeatView[],
  phase: string,
  prevHandId: string | null,
  nextHandId: string | null,
): SeatView[] {
  const sameHand = !!nextHandId && nextHandId === prevHandId;
  const keepPhase = phase === 'SHOWDOWN' || phase === 'END_HAND';
  const prevBySeat = new Map(prev.map((s) => [s.seatIndex, s]));
  return incoming.map((seat) => {
    if (hasFaceUpHoles(seat.holeCards)) {
      return { ...seat, revealed: true };
    }
    const before = prevBySeat.get(seat.seatIndex);
    if (sameHand && keepPhase && before?.revealed && hasFaceUpHoles(before.holeCards)) {
      return { ...seat, holeCards: before.holeCards, revealed: true };
    }
    return { ...seat, revealed: false };
  });
}

function mapSnapshot(payload: SnapshotPayload, currentTurnSeat: number | null): TableState {
  return {
    potTotal: payload.potTotal,
    communityCards: normalizeBoard(payload.communityCards),
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
    maxSeats: payload.maxSeats ?? 6,
    role: payload.role ?? null,
    pendingSitIn: payload.pendingSitIn ?? false,
    emptySeats: payload.emptySeats ?? [],
    mySeatIndex: payload.mySeatIndex ?? null,
  };
}

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

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
    maxSeats: 6,
    role: null,
    pendingSitIn: false,
    emptySeats: [],
    mySeatIndex: null,
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
  const [chipFlyEvents, setChipFlyEvents] = useState<ChipFlyEvent[]>([]);
  const [animateHoleDeal, setAnimateHoleDeal] = useState(false);
  const [seatEmojis, setSeatEmojis] = useState<Record<number, string>>({});
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [changingTable, setChangingTable] = useState(false);
  const [seatActions, setSeatActions] = useState<Record<number, SeatAction>>({});
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connected');
  const joinedRef = useRef(false);
  const myUserIdRef = useRef<string | null>(null);
  const seatsRef = useRef<SeatView[]>([]);
  const handNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emojiTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const shownHandsRef = useRef(new Set<string>());
  const actionInFlightRef = useRef(false);
  const actionLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreTurnUntilRef = useRef(0);
  const lastSeqRef = useRef(0);

  const clearActionLock = useCallback(() => {
    actionInFlightRef.current = false;
    if (actionLockTimer.current) {
      clearTimeout(actionLockTimer.current);
      actionLockTimer.current = null;
    }
  }, []);

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
    setState((prev) => {
      const mapped = mapSnapshot(payload, payload.currentTurnSeat ?? prev.currentTurnSeat);
      mapped.communityCards = mergeCommunity(
        prev.communityCards,
        mapped.communityCards,
        prev.handId,
        mapped.handId,
        mapped.phase,
      );
      mapped.seats = mergeRevealedHoles(
        prev.seats,
        mapped.seats,
        mapped.phase,
        prev.handId,
        mapped.handId,
      );
      return mapped;
    });
    // applySnapshotMeFix: 2026-08-30 — `me` must be declared before any turn check
    const viewer =
      payload.mySeatIndex != null
        ? payload.seats?.find((s) => s.seatIndex === payload.mySeatIndex)
        : payload.seats?.find((x) => x.holeCards && x.holeCards[0] !== '**');
    if (viewer?.userId) setMyUserId(viewer.userId);
    const turnSeat = payload.currentTurnSeat;
    if (turnSeat === null || turnSeat === undefined || !viewer?.userId) {
      setTurnContext(null);
    } else {
      const actor = payload.seats?.find((s) => s.seatIndex === turnSeat);
      if (actor?.userId !== viewer.userId) setTurnContext(null);
    }
  }, []);

  const isPrivate = state.roomType === 'PRIVATE';
  const isHost = myUserId !== null && state.hostUserId === myUserId;
  const mySeat =
    state.mySeatIndex != null
      ? state.seats.find((s) => s.seatIndex === state.mySeatIndex)
      : state.seats.find((s) => s.userId === myUserId);
  const myChips = mySeat?.chips ?? 0;
  const isSeated = !!mySeat;
  const isOfficialSpectator = !isPrivate && !isSeated;

  const isMyTurn =
    turnContext !== null &&
    myUserId !== null &&
    state.seats.some(
      (seat) => seat.seatIndex === state.currentTurnSeat && seat.userId === myUserId,
    );

  useEffect(() => {
    if (state.phase !== 'WAITING' || isPrivate) return;
    const humans = state.seats.filter((s) => s.userId && !s.isBot).length;
    if (humans >= 1 && state.seats.length < 2) {
      setHandNotice(t('game.matching_opponents'));
    }
  }, [state.phase, state.seats, isPrivate, t]);

  useEffect(() => {
    const token = getToken();
    if (!token || !roomId) return;

    const s = io(ROOM_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    setSocket(s);

    const buyIn = buyInCapParam ? Number(buyInCapParam) : 100;
    const officialTable = !roomId?.startsWith('P');

    void restoreSession().then((session) => {
      if (session?.user?.id != null) setMyUserId(String(session.user.id));
    });

    const showNotice = (text: string, autoDismissMs = 2500) => {
      setHandNotice(text);
      if (handNoticeTimer.current) clearTimeout(handNoticeTimer.current);
      if (autoDismissMs > 0) {
        handNoticeTimer.current = setTimeout(() => setHandNotice(null), autoDismissMs);
      }
    };

    const join = (reconnect = false) => {
      const event = reconnect ? 'reconnect_room' : 'join_room';
      const payload = reconnect
        ? { roomId, requestId: `reconnect-${Date.now()}` }
        : officialTable
          ? { roomId, requestId: `join-${Date.now()}` }
          : { roomId, buyInAmount: buyIn, requestId: `join-${Date.now()}` };
      s.emit(event, payload, (ack: { ok: boolean; error?: string }) => {
        if (ack?.ok) {
          setConnectionStatus('connected');
          if (reconnect) showNotice(t('table.reconnected'));
          return;
        }
        if (reconnect) {
          setConnectionStatus('disconnected');
          showNotice(t('table.connection_lost'), 0);
        } else {
          const errKey =
            ack?.error === 'IP_CONFLICT'
              ? 'errors.ip_conflict'
              : ack?.error === 'INSUFFICIENT_CHIPS'
                ? 'errors.insufficient_chips'
                : ack?.error === 'ROOM_FULL'
                  ? 'errors.room_full'
                  : null;
          Alert.alert(
            t('common.error'),
            errKey ? t(errKey) : ack?.error ?? t('common.error'),
          );
          router.back();
        }
      });
    };

    const onConnect = () => {
      setConnectionStatus('connected');
      join(joinedRef.current);
      joinedRef.current = true;
    };

    const onDisconnect = () => {
      setConnectionStatus('reconnecting');
      showNotice(t('table.reconnecting'), 0);
    };

    const onReconnectAttempt = () => {
      setConnectionStatus('reconnecting');
    };

    const onReconnectFailed = () => {
      setConnectionStatus('disconnected');
      showNotice(t('table.connection_lost'), 0);
    };

    const onRoomState = (msg: { seq?: number; payload: SnapshotPayload }) => {
      if (typeof msg.seq === 'number') {
        if (msg.seq < lastSeqRef.current) return;
        lastSeqRef.current = msg.seq;
      }
      applySnapshot(msg.payload);
      setConnectionStatus('connected');
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
      if (actionInFlightRef.current) return;
      const wait = ignoreTurnUntilRef.current - Date.now();
      if (wait > 0) {
        const delayed = msg.payload;
        setTimeout(() => {
          if (actionInFlightRef.current || Date.now() < ignoreTurnUntilRef.current) return;
          setTurnContext({
            seatIndex: delayed.seatIndex,
            deadline: delayed.deadline,
            validActions: delayed.validActions.filter((a) => a !== 'call' || delayed.callAmount > 0),
            callAmount: delayed.callAmount,
            minRaise: delayed.minRaise,
            maxRaise: delayed.maxRaise,
          });
        }, wait);
        return;
      }
      const p = msg.payload;
      setTurnContext({
        seatIndex: p.seatIndex,
        deadline: p.deadline,
        validActions: p.validActions.filter((a) => a !== 'call' || p.callAmount > 0),
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
      setSeatActions((prev) => ({
        ...prev,
        [msg.payload.seatIndex]: {
          type: msg.payload.actionType,
          amount: msg.payload.amount,
        },
      }));
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
        ignoreTurnUntilRef.current = Date.now() + 800;
        clearActionLock();
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
        refunds: p.refunds ?? [],
        pots: p.pots ?? [],
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
      const blinds = msg.payload.blindsPosted;
      setSeatActions({
        [msg.payload.sbSeat]: { type: 'sb', amount: blinds?.sb },
        [msg.payload.bbSeat]: { type: 'bb', amount: blinds?.bb },
      });
      const p = msg.payload;
      setState((prev) => ({
        ...prev,
        handId: p.handId ?? prev.handId,
        buttonSeat: p.buttonSeat,
        sbSeat: p.sbSeat,
        bbSeat: p.bbSeat,
        communityCards: [],
        phase: 'PRE_FLOP',
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
      }, 2200);
    };

    const onCommunityDealt = (msg: {
      payload: { phase: string; cards: string[]; boardCards?: string[] };
    }) => {
      const incoming = normalizeBoard(msg.payload.boardCards ?? msg.payload.cards);
      setState((prev) => ({
        ...prev,
        phase: msg.payload.phase || prev.phase,
        communityCards: mergeCommunity(
          prev.communityCards,
          incoming.length >= prev.communityCards.length
            ? incoming
            : [...prev.communityCards, ...normalizeBoard(msg.payload.cards)],
          prev.handId,
          prev.handId,
          msg.payload.phase || prev.phase,
        ),
      }));
      const phaseKey =
        msg.payload.phase === 'FLOP'
          ? 'game.phase.flop'
          : msg.payload.phase === 'TURN'
            ? 'game.phase.turn'
            : 'game.phase.river';
      setSeatActions((prev) => {
        const next: Record<number, SeatAction> = {};
        for (const [key, value] of Object.entries(prev)) {
          if (value.type === 'fold' || value.type === 'all_in') next[Number(key)] = value;
        }
        return next;
      });
      setHandNotice(t('game.community_dealt', { phase: t(phaseKey) }));
      if (handNoticeTimer.current) clearTimeout(handNoticeTimer.current);
      handNoticeTimer.current = setTimeout(() => setHandNotice(null), 2200);
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
      clearActionLock();
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
    s.on('disconnect', onDisconnect);
    s.io.on('reconnect_attempt', onReconnectAttempt);
    s.io.on('reconnect_failed', onReconnectFailed);
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
      s.off('disconnect', onDisconnect);
      s.io.off('reconnect_attempt', onReconnectAttempt);
      s.io.off('reconnect_failed', onReconnectFailed);
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
      clearActionLock();
    };
  }, [roomId, buyInCapParam, router, applySnapshot, t, clearActionLock]);

  const emitAdmin = (action: string, targetUserId?: string) => {
    socket?.emit('room_admin_action', {
      action,
      targetUserId,
      requestId: `admin-${Date.now()}`,
    });
  };

  const sendAction = (actionType: PokerAction, amount?: number) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    if (actionLockTimer.current) clearTimeout(actionLockTimer.current);
    actionLockTimer.current = setTimeout(() => {
      actionInFlightRef.current = false;
    }, 4000);
    setTurnContext(null);
    socket?.emit('player_action', { actionType, amount, requestId: `a-${Date.now()}` });
  };

  const sendEmoji = (emojiId: string) => {
    socket?.emit('send_emoji', { emojiId, requestId: `emoji-${Date.now()}` });
  };

  const retryConnection = useCallback(() => {
    if (!socket || !roomId) return;
    setConnectionStatus('reconnecting');
    setHandNotice(t('table.reconnecting'));
    const finish = (ok: boolean) => {
      if (ok) {
        setConnectionStatus('connected');
        setHandNotice(t('table.reconnected'));
        if (handNoticeTimer.current) clearTimeout(handNoticeTimer.current);
        handNoticeTimer.current = setTimeout(() => setHandNotice(null), 2000);
      } else {
        setConnectionStatus('disconnected');
        setHandNotice(t('table.connection_lost'));
      }
    };
    if (socket.connected) {
      socket.emit(
        'reconnect_room',
        { roomId, requestId: `reconnect-${Date.now()}` },
        (ack: { ok: boolean }) => finish(!!ack?.ok),
      );
    } else {
      socket.connect();
    }
  }, [socket, roomId, t]);

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

  const leaveTable = () => {
    setEmojiOpen(false);
    socket?.emit('leave_room', { requestId: `leave-${Date.now()}` });
    router.back();
  };

  const changeTable = async () => {
    if (changingTable || isPrivate) return;
    setChangingTable(true);
    setEmojiOpen(false);
    try {
      const match = await switchPublicTable(roomId);
      socket?.emit('leave_room', { requestId: `leave-switch-${Date.now()}` });
      router.replace({
        pathname: '/table',
        params: { roomId: match.roomId, buyInCap: String(match.buyInCap ?? 100) },
      });
    } catch (e) {
      showAlert(t('common.error'), formatApiError((e as Error).message, t));
      setChangingTable(false);
    }
  };

  // standUpAckFix: 2026-08-30 — always ack + notice; overlay must not eat the tap
  const standUp = () => {
    setEmojiOpen(false);
    if (!socket) {
      showAlert(t('common.error'), t('table.connection_lost'));
      return;
    }
    let settled = false;
    const requestId = `stand-${Date.now()}`;
    const finish = (ack?: { ok?: boolean; deferred?: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      if (!ack?.ok) {
        showAlert(t('common.error'), ack?.error ?? t('common.error'));
        return;
      }
      setHandNotice(ack.deferred ? t('table.standing_after_hand') : t('table.now_watching'));
    };
    socket.emit('stand_up', { requestId }, finish);
    setTimeout(() => {
      if (!settled) setHandNotice(t('table.standing_after_hand'));
    }, 1200);
  };

  // sitDownWebConfirm: 2026-08-30 — Expo web cannot use Alert.alert buttons
  const sitDown = (seatIndex: number) => {
    if (!socket) {
      showAlert(t('common.error'), t('table.connection_lost'));
      return;
    }
    const amount = Math.min(state.buyInCap, buyInCapParam ? Number(buyInCapParam) : state.buyInCap);
    const emitSit = () => {
      socket.emit(
        'sit_down',
        { seatIndex, buyInAmount: amount, requestId: `sit-${Date.now()}` },
        (ack: { ok: boolean; error?: string; nextHand?: boolean }) => {
          if (!ack?.ok) {
            const errKey =
              ack?.error === 'IP_CONFLICT'
                ? 'errors.ip_conflict'
                : ack?.error === 'INSUFFICIENT_CHIPS'
                  ? 'errors.insufficient_chips'
                  : ack?.error === 'ROOM_FULL'
                    ? 'errors.room_full'
                  : ack?.error === 'SEAT_TAKEN'
                    ? 'errors.seat_taken'
                    : ack?.error === 'GUEST_NOT_ALLOWED'
                      ? 'errors.guest_not_allowed'
                      : null;
            showAlert(t('common.error'), errKey ? t(errKey) : ack?.error ?? t('common.error'));
            return;
          }
          if (ack.nextHand) setHandNotice(t('table.sitting_next_hand'));
        },
      );
    };
    showConfirm(
      t('table.sit_confirm_title'),
      t('table.sit_confirm_body', { amount }),
      emitSit,
      { confirm: t('table.sit_down'), cancel: t('table.cancel_sit') },
    );
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
        phase={state.phase}
        buttonSeat={state.buttonSeat}
        sbSeat={state.sbSeat}
        bbSeat={state.bbSeat}
        turnDeadline={state.actionDeadline}
        winnerSeats={winnerSeats}
        chipFlyEvents={chipFlyEvents}
        animateHoleDeal={animateHoleDeal}
        seatEmojis={seatEmojis}
        emptySeatLabel={t('table.seat_empty')}
        seatActions={seatActions}
        isSpectator={isOfficialSpectator}
        onSeatPress={isOfficialSpectator ? sitDown : undefined}
        onChipFlyDone={(id) =>
          setChipFlyEvents((prev) => prev.filter((e) => e.id !== id))
        }
      />

      {isOfficialSpectator && (
        <View style={styles.watchBanner}>
          <Text style={styles.watchText}>
            {state.emptySeats.length > 0 ? t('table.watching') : t('table.table_full_watching')}
          </Text>
          {state.emptySeats[0] != null && (
            <Pressable style={styles.sitCta} onPress={() => sitDown(state.emptySeats[0])}>
              <Text style={styles.sitCtaText}>{t('table.sit_down')}</Text>
            </Pressable>
          )}
        </View>
      )}
      {isSeated && state.pendingSitIn && (
        <View style={styles.watchBanner}>
          <Text style={styles.watchText}>{t('table.sitting_next_hand')}</Text>
        </View>
      )}

      <HandStatusBar
        phase={state.phase}
        blinds={state.blinds}
        lastAction={lastAction}
        handNotice={handNotice}
        connectionStatus={connectionStatus}
      />

      {connectionStatus === 'disconnected' && (
        <View style={styles.connectionBanner}>
          <Text style={styles.connectionText}>{t('table.connection_lost')}</Text>
          <Pressable style={styles.retryBtn} onPress={retryConnection}>
            <Text style={styles.retryText}>{t('table.retry_connection')}</Text>
          </Pressable>
        </View>
      )}

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

      {isSeated && isMyTurn && turnContext && (
        <View style={styles.actionWrap}>
          <ActionPanel turn={turnContext} onAction={sendAction} />
        </View>
      )}

      {!isPrivate && isSeated && emojiOpen && (
        <View style={[styles.emojiWrap, isMyTurn && turnContext && styles.emojiWrapAboveActions]}>
          <EmojiBar
            onSend={(emojiId) => {
              sendEmoji(emojiId);
              setEmojiOpen(false);
            }}
            onClose={() => setEmojiOpen(false)}
          />
        </View>
      )}

      <ShowdownOverlay
        visible={!!showdown}
        handId={showdown?.handId ?? ''}
        winners={showdown?.winners ?? []}
        potSize={showdown?.potSize ?? 0}
        boardCards={showdown?.boardCards ?? ''}
        nextHandIn={showdown?.nextHandIn ?? 3000}
        refunds={showdown?.refunds ?? []}
        pots={showdown?.pots ?? []}
        onStep={(info) => {
          setWinnerSeats(info.seatIndexes);
          setChipFlyEvents((prev) => [
            ...prev,
            ...info.seatIndexes.map((seatIndex, i) => ({
              id: `payout-${Date.now()}-${seatIndex}-${i}`,
              seatIndex,
              amount: info.amounts[i] ?? info.amounts[0] ?? 0,
              direction: 'out' as const,
            })),
          ]);
        }}
      />

      <View style={styles.topActions}>
        {isSeated && !isPrivate && (
          <Pressable
            style={styles.topBtn}
            onPress={() => setEmojiOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={emojiOpen ? t('table.emoji_close') : t('table.emoji_open')}
          >
            <Text style={styles.backText}>
              {emojiOpen ? t('table.emoji_close') : t('table.emoji_open')}
            </Text>
          </Pressable>
        )}
        {!isPrivate && (
          <Pressable style={styles.topBtn} onPress={() => void changeTable()} disabled={changingTable}>
            <Text style={styles.backText}>
              {changingTable ? t('table.change_table_loading') : t('table.change_table')}
            </Text>
          </Pressable>
        )}
        {isSeated && !isPrivate && (
          <Pressable style={styles.topBtn} onPress={standUp}>
            <Text style={styles.backText}>{t('table.stand_up')}</Text>
          </Pressable>
        )}
        <Pressable style={styles.topBtn} onPress={leaveTable}>
          <Text style={styles.backText}>← {t('table.leave_table')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.lobby },
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
    zIndex: 19,
    maxWidth: '72%',
  },
  emojiWrapAboveActions: {
    bottom: 120,
  },
  connectionBanner: {
    position: 'absolute',
    bottom: 88,
    left: 16,
    right: 16,
    zIndex: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(180,40,40,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  connectionText: { color: '#fff', fontWeight: '600', flex: 1 },
  retryBtn: {
    marginLeft: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryText: { color: '#8B1A1A', fontWeight: '700', fontSize: 13 },
  topActions: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 200,
    flexDirection: 'row',
    gap: 8,
  },
  topBtn: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: palette.inverse,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.line,
  },
  backText: { color: colors.brand.primary, fontWeight: '700' },
  watchBanner: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    zIndex: 12,
    backgroundColor: palette.inverse,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.line,
  },
  watchText: { color: colors.text.primary, fontWeight: '600', textAlign: 'center', fontSize: 13 },
  sitCta: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  sitCtaText: { color: palette.inverse, fontWeight: '800', fontSize: 14 },
});
