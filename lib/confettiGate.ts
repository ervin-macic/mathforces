/** Tailwind `sm` — mirror Play practice mode confetti breakpoint. */
const CONFETTI_MIN_WIDTH_PX = 640;

/**
 * Celebrate on tablet/desktop only — avoids fullscreen canvas work on phones.
 */
export function allowsPracticeConfetti(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(min-width: ${CONFETTI_MIN_WIDTH_PX}px)`).matches;
}

export function firePracticeConfetti(confetti: (opts: Record<string, unknown>) => void): void {
  if (!allowsPracticeConfetti()) return;
  confetti({
    particleCount: 150,
    spread: 120,
    origin: { y: 0.6 },
    colors: ['#e2b713', '#d1d0c5', '#ffffff'],
    scalar: 1.2,
  });
}
