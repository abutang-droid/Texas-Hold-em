import { RANK_LABEL, SUIT_GLYPH, isRedSuit, type PlayingCard } from '../deck';

interface Props {
  card?: PlayingCard;
  faceDown?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function PlayingCardFace({ card, faceDown = false, size = 'md', className = '' }: Props) {
  const wide = size === 'md' ? 'w-11 h-16 sm:w-12 sm:h-[4.6rem]' : 'w-9 h-[3.25rem] sm:w-10 sm:h-14';
  if (faceDown || !card) {
    return (
      <div
        className={`relative ${wide} rounded-[0.55rem] border border-emerald-900/70 bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-950 shadow-[0_8px_16px_rgba(0,0,0,0.35)] ${className}`}
      >
        <div className="absolute inset-[3px] rounded-[0.4rem] border border-emerald-700/40 bg-[repeating-linear-gradient(135deg,rgba(46,125,99,0.35)_0_4px,rgba(6,20,15,0.9)_4px_8px)]" />
        <div className="absolute inset-0 m-auto h-5 w-5 rotate-45 rounded-sm border border-lime-200/20" />
      </div>
    );
  }

  const red = isRedSuit(card.suit);
  const ink = red ? 'text-rose-700' : 'text-stone-900';

  return (
    <div
      className={`relative ${wide} rounded-[0.55rem] border border-stone-200 bg-gradient-to-b from-white to-stone-100 shadow-[0_10px_18px_rgba(0,0,0,0.28)] ${className}`}
    >
      <div className={`absolute left-1 top-0.5 text-[11px] font-extrabold leading-none ${ink}`}>
        {RANK_LABEL[card.rank]}
        <div className="text-[10px] leading-none">{SUIT_GLYPH[card.suit]}</div>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center text-xl ${ink}`}>
        {SUIT_GLYPH[card.suit]}
      </div>
      <div
        className={`absolute bottom-0.5 right-1 rotate-180 text-[11px] font-extrabold leading-none ${ink}`}
      >
        {RANK_LABEL[card.rank]}
        <div className="text-[10px] leading-none">{SUIT_GLYPH[card.suit]}</div>
      </div>
    </div>
  );
}
