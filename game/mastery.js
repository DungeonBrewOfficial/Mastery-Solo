/**
 * Mastery's dice (Mastery System, Dice Mechanics; Trials and Difficulty).
 * Trials don't explode. Dominance moves every die one step up the Die
 * Progression Chart, Impotence one step down; they cancel.
 */

/** Die Progression Chart, as [count, sides]; sides 1 is a flat 1. */
export const PROGRESSION = [[1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [1, 8], [1, 10], [1, 12], [2, 6], [2, 8], [2, 10], [2, 12], [4, 6], [4, 8], [4, 10], [4, 12]];
const stepOf = (count, sides) => PROGRESSION.findIndex(([c, s]) => c === count && s === sides);

/** Attribute score → tier (a score of 5 is Tier 2, 30 is Tier 7). */
export const tierOf = (score) => 1 + Math.min(Math.floor((Number(score) || 0) / 5), 12);
/** Tier (or mastery level) 1–7 → its die, as [count, sides]. */
export const dieOfTier = (t) => PROGRESSION[Math.max(1, Math.min(15, t))];
export const MASTERY = { 1: "Unskilled", 2: "Untrained", 3: "Basic", 4: "Skilled", 5: "Expert", 6: "Master", 7: "Grand Master" };
/** A creature's rank die for trials (Monster Manual, Rank). */
export const RANK_DIE = { minion: 1, adept: 2, leader: 3, champion: 4, master: 5, epic: 6, legendary: 7 };
/** Division → the mastery a creature counts as for skill counters (Monster Manual, Creature Skills). */
export const countsAs = (division) => Math.min(7, Math.max(1, division));

const label = ([c, s]) => s === 1 ? "1" : `${c > 1 ? c : ""}d${s}`;

/**
 * Roll a trial: a list of dice (each [count, sides]) plus a bonus.
 * edge: +1 Dominance, -1 Impotence, 0 neither.
 * → { total, text, dice, natMin }
 */
export function trial(rng, dice, { edge = 0, bonus = 0 } = {}) {
  const shifted = dice.map(([c, s]) => PROGRESSION[Math.max(0, Math.min(15, stepOf(c, s) + Math.sign(edge)))]);
  const rolls = shifted.map(([c, s]) => Array.from({ length: c }, () => (s === 1 ? 1 : rng.d(s))));
  const flat = rolls.flat();
  const total = flat.reduce((a, b) => a + b, 0) + bonus;
  const natMin = flat.every(r => r === 1);
  const text = `${shifted.map(label).join(" + ")}${bonus ? (bonus > 0 ? ` + ${bonus}` : ` − ${-bonus}`) : ""}${edge > 0 ? " (Dominance)" : edge < 0 ? " (Impotence)" : ""} = ${total}`;
  return { total, text, dice: shifted, natMin };
}

/** Does a trial meet a DC? A natural minimum always fails. */
export const passes = (t, dc) => !t.natMin && t.total >= dc;
