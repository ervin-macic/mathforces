/**
 * Uniform integer in [0, max) using crypto.getRandomValues when available.
 */
export function randomIntExclusive(max: number): number {
  if (max <= 0 || !Number.isFinite(max)) return 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x1_0000_0000 / max) * max;
    let x: number;
    do {
      crypto.getRandomValues(buf);
      x = buf[0]!;
    } while (x >= limit);
    return x % max;
  }
  return Math.floor(Math.random() * max);
}
