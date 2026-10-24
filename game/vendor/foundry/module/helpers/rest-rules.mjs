/**
 * REST RULES (pure, 2026-09-30). General Rules § Resting, with the
 * Companions paragraph (Jon 2026-09-30):
 *
 *   Dungeon Rest     1 health / 1 magan (health only if at least 1 health).
 *                    Does not reduce Exhausted.
 *   Wilderness Rest  In danger → a Dungeon Rest. Safe: 1d3 / 1d3; Exhausted
 *                    −1, not below T1. Gnomes, Druids, Elves, Orcs, Rangers — and
 *                    animal companions, the Puca, Fae Agathions — treat a
 *                    safe Wilderness Rest as a Good Night's Rest.
 *   Good Night's     Endurance tier die / casting tier die; Exhausted −1.
 *   Civilized        ×2; Exhausted −2.
 *   Bed Rest         ×2 + level; Exhausted removed.
 *   Interrupted      (danger, or strenuous activity during a Civilized / Bed
 *                    Rest — Jon 2026-09-30) counts as the rest one step
 *                    down in every way: Bed → Civilized → Good Night's →
 *                    Wilderness → Dungeon → No Rest. No separate +1.
 *   No Rest          No recovery; advance Exhausted by 1.
 *   "A rest"         Any rest from a Dungeon Rest up restores it.
 */

export const REST_ORDER = ["dungeon", "wilderness", "goodNight", "civilized", "bed"];
export const REST_LABELS = { none: "No Rest", nil: "No benefit", dungeon: "Dungeon Rest", wilderness: "Wilderness Rest",
  goodNight: "Good Night's Rest", civilized: "Civilized Rest", bed: "Bed Rest" };

/**
 * Which rest a creature actually gets.
 *   type        "none" | one of REST_ORDER
 *   danger      Wilderness only: in danger → Dungeon
 *   upgrade     the creature treats a safe Wilderness Rest as Good Night's
 *   interrupted true when disturbed (danger / strenuous activity)
 * Returns { stage, exhausted, note, noRest } — stage is the recovery column
 * ("nil" = none), exhausted is the Exhausted rule:
 *   { advance: n } | { set: n } | { reduce: n, floor?: n } | null
 */
export function effectiveRest({ type, danger = false, upgrade = false, interrupted = false }) {
  const NO_REST = (note) => ({ stage: "nil", exhausted: { advance: 1 }, note, noRest: true });
  if (type === "none") return NO_REST("No Rest");
  let t = type, note = REST_LABELS[type];
  if (t === "wilderness" && danger) { t = "dungeon"; note = "Wilderness Rest in danger → Dungeon Rest"; }
  else if (t === "wilderness" && upgrade) { t = "goodNight"; note = "safe Wilderness Rest → Good Night's Rest"; }
  if (interrupted) {
    if (t === "dungeon") return NO_REST(`${note}, interrupted → No Rest`);
    const down = REST_ORDER[REST_ORDER.indexOf(t) - 1];
    return { stage: down, exhausted: exhaustedRule(down), note: `${note}, interrupted → ${REST_LABELS[down]}` };
  }
  return { stage: t, exhausted: exhaustedRule(t), note };
}

function exhaustedRule(stage) {
  switch (stage) {
    case "wilderness": return { reduce: 1, floor: 1 };    // −1, not below T1
    case "goodNight":  return { reduce: 1 };
    case "civilized":  return { reduce: 2 };
    case "bed":        return { set: 0 };
    default:           return null;                       // Dungeon: no change
  }
}

/** Exhausted tier after the rest's rule (and Vigorous: "always reduce by 1 when resting"). */
export function exhaustedAfter(tier, rule, { vigorous = false, rested = true } = {}) {
  let t = Math.max(0, Number(tier) || 0);
  if (rule?.advance) t = Math.min(3, t + rule.advance);
  else if (rule?.set !== undefined) t = rule.set;
  else if (rule?.reduce) t = rule.floor ? (t > rule.floor ? Math.max(rule.floor, t - rule.reduce) : t) : Math.max(0, t - rule.reduce);
  // Vigorous: "regardless of rest quality" — any rest (interrupted too), not
  // No Rest (incl. an interrupted Dungeon Rest; Jon 2026-09-30).
  if (vigorous && rested) t = Math.max(0, t - 1);
  return t;
}

/**
 * The recovery for a stage: { dice, flat } per pool.
 *   die    {c, s} — the Endurance tier die (or the companion's die) / the
 *          casting tier die
 *   level  class level (or the master's level)
 */
export function recoveryFor(stage, die, level = 0) {
  switch (stage) {
    case "dungeon":    return { dice: [], flat: 1 };
    case "wilderness": return { dice: [{ c: 1, s: 3 }], flat: 0 };
    case "goodNight":  return { dice: [die], flat: 0 };
    case "civilized":  return { dice: [die, die], flat: 0 };
    case "bed":        return { dice: [die, die], flat: Math.max(0, Number(level) || 0) };
    default:           return null;
  }
}

/** Formula text for a recovery ("2d6 + 12"), or "" when none. */
export function recoveryFormula(rec) {
  if (!rec) return "";
  const parts = rec.dice.filter(d => d?.c > 0 && d?.s > 0).map(d => `${d.c}d${d.s}`);
  if (rec.flat) parts.push(String(rec.flat));
  return parts.join(" + ");
}

/** Full Recovery (Halfling): "the maximum health for that type of rest instead of rolling." */
export function recoveryMax(rec) {
  if (!rec) return 0;
  return rec.dice.reduce((n, d) => n + (d?.c || 0) * (d?.s || 0), 0) + (rec.flat || 0);
}

/** "A rest" happened (anything from a Dungeon Rest up that recovered). */
export const isARest = (stage) => REST_ORDER.includes(stage);

/** Classes that treat a safe Wilderness Rest as a Good Night's Rest. */
export function classUpgrades(className) {
  const n = String(className || "").toLowerCase();
  return ["gnome", "druid", "orc", "ranger"].includes(n) || n.includes("elf");
}
