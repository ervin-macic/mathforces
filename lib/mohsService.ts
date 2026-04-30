/**
 * MOHS Difficulty Update Service
 *
 * Implements the MOHS (Math Olympiad Hardness Scale) update rule.
 *
 * Scale: -60 (too easy for any high school competition) to +60 (too hard for any high school competition)
 * Stored in multiples of 5 (quantised).
 *
 * Update rule:
 *   When a user rates a problem, their 1–10 star rating is mapped to a
 *   "perceived MOHS" value. The stored difficulty is then updated as a
 *   weighted average between the old value and the perceived value.
 *   The result is clamped to [-60, +60] and rounded to the nearest 5.
 *
 * Source prior guard:
 *   Some competition sources have known difficulty floors/ceilings that
 *   prevent troll users from pushing the problem too far out of
 *   its natural range. E.g., an IMO P6 cannot be driven below 25 MOHS.
 */

export const MOHS_MIN = -60;
export const MOHS_MAX = 60;
export const MOHS_STEP = 5;

/** Weight given to the user's new rating vs the stored difficulty (0–1) */
const USER_WEIGHT = 0.30;

/** Source-based floors and ceilings (inclusive, in MOHS). */
const SOURCE_BOUNDS: Record<string, { floor?: number; ceiling?: number }> = {
  IMO_P1: { floor: 0, ceiling: 25 },
  IMO_P2: { floor: 5, ceiling: 45 },
  IMO_P3: { floor: 20, ceiling: 50 },
  IMO_P4: { floor: 5, ceiling: 20 },
  IMO_P5: { floor: 25, ceiling: 40 },
  IMO_P6: { floor: 25, ceiling: 55 },
  RMM_P3: { floor: 25, ceiling: 60 },
  EGMO_P4: { floor: 30, ceiling: 55 },
  BMO: { floor: 10, ceiling: 45 },
  IMO: { floor: 20 },
  AoPS: {},
};

/**
 * Convert a user's 1–10 star rating to a MOHS estimate.
 * Mapping: 1 star → 5 MOHS, 10 stars → 50 MOHS (linear).
 * This reflects a typical problem pool (beginner to hard competition).
 */
export function ratingToMohs(rating: number): number {
  const clamped = Math.max(1, Math.min(10, rating));
  return Math.round((clamped * 5) / MOHS_STEP) * MOHS_STEP;
}

/**
 * Round a raw MOHS value to the nearest multiple of MOHS_STEP.
 */
export function quantiseMohs(raw: number): number {
  return Math.round(raw / MOHS_STEP) * MOHS_STEP;
}

/**
 * Clamp a MOHS value to [MOHS_MIN, MOHS_MAX].
 */
export function clampMohs(value: number): number {
  return Math.max(MOHS_MIN, Math.min(MOHS_MAX, value));
}

/**
 * Compute the updated MOHS for a problem after a user rates it.
 *
 * @param currentMohs  - the problem's stored MOHS value
 * @param userRating   - user's 1–10 star rating
 * @param sourceTag    - optional source tag to apply bounds (e.g. "IMO_P6")
 * @returns            new MOHS value (quantised, clamped)
 */
export function computeUpdatedMohs(
  currentMohs: number,
  userRating: number,
  sourceTag?: string,
): number {
  const perceivedMohs = ratingToMohs(userRating);
  const rawNew = currentMohs * (1 - USER_WEIGHT) + perceivedMohs * USER_WEIGHT;
  let newMohs = quantiseMohs(clampMohs(rawNew));

  // Apply source-based bounds if available
  if (sourceTag) {
    const bounds = SOURCE_BOUNDS[sourceTag] ?? SOURCE_BOUNDS[sourceTag.split('_')[0]] ?? {};
    if (bounds.floor !== undefined) newMohs = Math.max(newMohs, bounds.floor);
    if (bounds.ceiling !== undefined) newMohs = Math.min(newMohs, bounds.ceiling);
    // Re-quantise after clamping
    newMohs = quantiseMohs(clampMohs(newMohs));
  }

  return newMohs;
}

/**
 * Determine whether an update should be persisted.
 * No-ops when the rating would not change the stored MOHS.
 */
export function shouldUpdateMohs(currentMohs: number, newMohs: number): boolean {
  return currentMohs !== newMohs;
}
