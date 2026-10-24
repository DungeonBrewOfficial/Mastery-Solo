/**
 * COMPANION ATTACK PHASE BY SIZE (Core Classes, 2026-10-20). Pure.
 *   Puca:     "Its natural attacks act by its current size: Fast at ½ square,
 *             Moderate at 1 square, Slow at 2 squares or more."
 *   Familiar: "Its natural attacks are Fast if it is small and Moderate if it
 *             is average."
 *   Agathion: Beast Form "Fast if it occupies ½ square and Moderate if it
 *             occupies 1 square"; Humanoid Form "acts at the speed of its
 *             weapon, like any character" → null (the weapon decides).
 * Returns "fast" | "moderate" | "slow" | null (not a size-phased companion).
 */
export function companionNaturalPhase(kind, squares, { form = "" } = {}) {
  const sq = Number(squares) || 1;
  if (kind === "puca") return sq < 1 ? "fast" : sq < 2 ? "moderate" : "slow";
  if (kind === "familiar") return sq < 1 ? "fast" : "moderate";
  if (kind === "agathion") return form === "humanoid" ? null : (sq < 1 ? "fast" : "moderate");
  return null;
}
