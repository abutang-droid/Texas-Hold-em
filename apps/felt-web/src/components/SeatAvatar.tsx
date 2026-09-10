import type { SeatPlayer } from '../table/seats';

interface Props {
  player: SeatPlayer;
  active?: boolean;
  dealer?: boolean;
}

export function SeatAvatar({ player, active, dealer }: Props) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <div
          className={[
            'flex h-14 w-14 items-center justify-center rounded-2xl border bg-stone-950/70 text-[11px] font-extrabold tracking-wide text-emerald-50',
            active
              ? 'seat-breathe-active border-emerald-300/80'
              : 'seat-breathe border-emerald-800/80',
          ].join(' ')}
        >
          {player.initials}
        </div>
        {dealer ? (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-amber-200/50 bg-stone-900 text-[9px] font-bold text-amber-100">
            D
          </span>
        ) : null}
      </div>
      <div className="min-w-[4.5rem] rounded-full border border-white/10 bg-black/45 px-2.5 py-0.5 text-center backdrop-blur-sm">
        <div className="text-[11px] font-semibold text-emerald-50/95">{player.name}</div>
        <div className="text-[10px] font-bold tabular-nums text-emerald-200/80">{player.stack}</div>
      </div>
    </div>
  );
}
