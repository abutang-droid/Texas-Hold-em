import gsap from 'gsap';

export interface FlyCardOptions {
  from: DOMRect;
  to: DOMRect;
  faceUp: boolean;
  delay?: number;
  duration?: number;
}

function centerOf(box: DOMRect): { x: number; y: number } {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * Tweens a card from the dealer pile to a hole / board slot.
 * Rotation settles face-up or face-down depending on `faceUp`.
 */
export function flyCardToSeat(el: HTMLElement, options: FlyCardOptions): Promise<void> {
  const from = centerOf(options.from);
  const to = centerOf(options.to);
  const startRot = -18 + Math.random() * 12;
  const endRot = options.faceUp ? 0 : 180;

  gsap.set(el, {
    x: from.x - el.offsetWidth / 2,
    y: from.y - el.offsetHeight / 2,
    rotation: startRot,
    scale: 0.72,
    autoAlpha: 1,
  });

  return new Promise((resolve) => {
    gsap.to(el, {
      x: to.x - el.offsetWidth / 2,
      y: to.y - el.offsetHeight / 2,
      rotation: endRot,
      scale: 1,
      duration: options.duration ?? 0.48,
      delay: options.delay ?? 0,
      ease: 'power3.out',
      onComplete: () => resolve(),
    });
  });
}

export function clearTweens(el: HTMLElement | null): void {
  if (el) gsap.killTweensOf(el);
}
