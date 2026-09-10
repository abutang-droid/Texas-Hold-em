import { useMemo, useRef, useState } from 'react';
import { flyCardToSeat } from '../animation/dealFly';
import {
  burnAndDeal,
  cardId,
  createDeck,
  dealHoleRound,
  shuffleDeck,
  type PlayingCard,
} from '../deck';
import { DEMO_PLAYERS, MAX_SEATS, SEAT_CLASS } from '../table/seats';
import { PlayingCardFace } from './PlayingCardFace';
import { SeatAvatar } from './SeatAvatar';

interface Flight {
  key: string;
  card: PlayingCard;
}

const emptyHoles = (): Array<Array<PlayingCard | undefined>> =>
  Array.from({ length: MAX_SEATS }, () => [undefined, undefined]);

export function PokerTable() {
  const dealerRef = useRef<HTMLDivElement>(null);
  const holeRefs = useRef<Array<Array<HTMLDivElement | null>>>(
    Array.from({ length: MAX_SEATS }, () => [null, null]),
  );
  const boardRefs = useRef<Array<HTMLDivElement | null>>([null, null, null, null, null]);
  const flightRef = useRef<HTMLDivElement>(null);

  const [holes, setHoles] = useState(emptyHoles);
  const [board, setBoard] = useState<Array<PlayingCard | undefined>>([
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('洗牌后点「发牌」—— 牌从荷官飞向各座位');

  const remainingLabel = useMemo(() => {
    const used =
      holes.flat().filter(Boolean).length + board.filter(Boolean).length;
    return 52 - used;
  }, [holes, board]);

  const waitFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

  const waitFlightEl = async () => {
    for (let i = 0; i < 24; i += 1) {
      if (flightRef.current) return flightRef.current;
      await waitFrame();
    }
    return null;
  };

  const animateTo = async (target: HTMLElement | null, faceUp: boolean) => {
    const el = await waitFlightEl();
    const from = dealerRef.current?.getBoundingClientRect();
    const to = target?.getBoundingClientRect();
    if (!from || !to || !el) return;
    await flyCardToSeat(el, { from, to, faceUp, duration: 0.42 });
  };

  const deal = async () => {
    if (busy) return;
    setBusy(true);
    setHoles(emptyHoles());
    setBoard([undefined, undefined, undefined, undefined, undefined]);
    setLog('Fisher–Yates 洗牌中…');

    let deck = shuffleDeck(createDeck());
    await new Promise((r) => setTimeout(r, 220));

    try {
      for (let slot = 0; slot < 2; slot += 1) {
        const round = dealHoleRound(deck, MAX_SEATS);
        deck = round.remaining;
        for (let seat = 0; seat < MAX_SEATS; seat += 1) {
          const card = round.holes[seat]!;
          setFlight({ key: `${cardId(card)}-${seat}-${slot}`, card });
          setLog(`发底牌 · 座位 ${seat + 1}`);
          await animateTo(holeRefs.current[seat]?.[slot] ?? null, seat === 0);
          setHoles((prev) => {
            const next = prev.map((row) => [...row]);
            next[seat]![slot] = card;
            return next;
          });
          setFlight(null);
        }
      }

      const flop = burnAndDeal(deck, 3);
      deck = flop.remaining;
      for (let i = 0; i < 3; i += 1) {
        const card = flop.dealt[i]!;
        setFlight({ key: `flop-${cardId(card)}`, card });
        setLog('翻牌');
        await animateTo(boardRefs.current[i], true);
        setBoard((prev) => {
          const next = [...prev];
          next[i] = card;
          return next;
        });
        setFlight(null);
      }

      setLog(`发牌完成 · 剩余 ${deck.length} 张（已烧 1 张）`);
    } finally {
      setFlight(null);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/55">
            Hold'em · 6-max
          </p>
          <h1 className="font-display text-2xl font-extrabold text-emerald-50">墨绿牌桌</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-emerald-100/70">
            牌墙 {remainingLabel}
          </span>
          <button
            type="button"
            data-testid="deal-button"
            disabled={busy}
            onClick={() => void deal()}
            className="rounded-xl border border-emerald-300/30 bg-emerald-800/80 px-5 py-2.5 text-sm font-extrabold text-emerald-50 shadow-[0_8px_24px_rgba(16,80,55,0.45)] transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? '发牌中…' : '发牌'}
          </button>
        </div>
      </header>

      <div className="relative aspect-[16/10] min-h-[420px] overflow-hidden rounded-[2.2rem] border border-emerald-900/80 bg-[#07140f] shadow-[0_30px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="pointer-events-none absolute inset-0 felt-texture" />
        <div className="absolute inset-[4.5%] rounded-[46%] border border-amber-200/15 shadow-[inset_0_0_80px_rgba(0,0,0,0.35),0_0_0_10px_rgba(18,28,22,0.9),0_0_0_11px_rgba(201,176,120,0.18)]" />
        <div className="absolute inset-[11%] rounded-[46%] border border-emerald-200/10 bg-[radial-gradient(ellipse_at_center,#145c43_0%,#0c3a2b_55%,#08241c_100%)]" />

        <div
          ref={dealerRef}
          className="absolute left-1/2 top-[42%] z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
        >
          <div className="rounded-full border border-emerald-200/25 bg-black/35 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/80">
            Dealer
          </div>
          <PlayingCardFace faceDown size="sm" />
          <div className="flex gap-1.5">
            {board.map((card, i) => (
              <div
                key={`board-${i}`}
                ref={(node) => {
                  boardRefs.current[i] = node;
                }}
                className="min-h-14 min-w-10"
              >
                {card ? <PlayingCardFace card={card} size="sm" /> : <div className="h-14 w-10" />}
              </div>
            ))}
          </div>
        </div>

        {DEMO_PLAYERS.map((player, seat) => (
          <div key={player.id} className={`absolute z-10 ${SEAT_CLASS[seat]}`}>
            <div className="flex flex-col items-center gap-2">
              {seat !== 0 ? (
                <SeatAvatar player={player} dealer={seat === 3} active={seat === 3} />
              ) : null}
              <div className="flex gap-1">
                {[0, 1].map((slot) => (
                  <div
                    key={slot}
                    ref={(node) => {
                      holeRefs.current[seat]![slot] = node;
                    }}
                    className="min-h-16 min-w-11"
                  >
                    {holes[seat]?.[slot] ? (
                      <PlayingCardFace
                        card={holes[seat]![slot]}
                        faceDown={seat !== 0}
                        size={seat === 0 ? 'md' : 'sm'}
                      />
                    ) : (
                      <div className="h-14 w-9 rounded-[0.55rem] border border-dashed border-emerald-100/15 sm:h-16 sm:w-11" />
                    )}
                  </div>
                ))}
              </div>
              {seat === 0 ? <SeatAvatar player={player} active /> : null}
            </div>
          </div>
        ))}

        {flight ? (
          <div
            ref={flightRef}
            className="pointer-events-none fixed left-0 top-0 z-50 opacity-0"
          >
            <PlayingCardFace card={flight.card} faceDown />
          </div>
        ) : null}
      </div>

      <p className="text-center text-[12px] text-emerald-100/55" data-testid="deal-log">
        {log}
      </p>
    </div>
  );
}
