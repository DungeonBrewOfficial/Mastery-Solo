/**
 * MINION GROUPS (pure, 2026-10-04). Monster Manual § Minions (Monster Claude
 * 2026-10-04, approved by Jon) + Jon's rulings:
 *   - A group is one creature (one token). Health = heads; each lost head is
 *     1 Health. Attack = current heads × d2 against one target (two attacks a
 *     round, may target different creatures). Defense = current heads × d2 +
 *     Resistance (once). Trials 1d2 + Creature Tier die (trials.mjs).
 *   - Bands at current heads: Cluster 4–7 (+2), Brood 8–15 (+4), Swarm 16+
 *     (+6); below 4, +0. Mob trait DC = Creature Tier + band bonus.
 *   - The group's combined footprint is its size only for abilities that
 *     check a target's size — never for size bonuses (Jon 2026-10-04).
 *   - Effects aimed at one creature apply only their damage to a group.
 */

export const BANDS = [
  { key: "swarm",   label: "Swarm",   min: 16, bonus: 6 },
  { key: "brood",   label: "Brood",   min: 8,  bonus: 4 },
  { key: "cluster", label: "Cluster", min: 4,  bonus: 2 }
];
/** Presets offered when placing a group (the stat blocks' band table rows). */
export const PRESETS = [{ label: "Cluster", heads: 6 }, { label: "Brood", heads: 12 }, { label: "Swarm", heads: 16 }];

export const isMinion = (sys) => sys?.rank === "minion";

/** Band for a head count: { key, label, bonus } (key "" below 4 heads). */
export function bandFor(heads) {
  const h = Math.max(0, Math.floor(Number(heads) || 0));
  const b = BANDS.find(x => h >= x.min);
  return b ? { key: b.key, label: b.label, bonus: b.bonus } : { key: "", label: h === 1 ? "Solo" : "Group", bonus: 0 };
}

/** Mob trait DC = Creature Tier + band bonus. */
export const mobDC = (tier, heads) => (Number(tier) || 1) + bandFor(heads).bonus;

/** The group's attack / defense dice: current heads × d2 (never fewer than one die while alive). */
export const groupDice = (heads) => [{ c: Math.max(1, Math.floor(Number(heads) || 0)), s: 2 }];

/** Current heads = current Health, clamped to the group's size. */
export function currentHeads(sys) {
  const max = Math.max(1, Math.floor(Number(sys?.heads) || 1));
  const hp = Math.floor(Number(sys?.health?.value));
  return Number.isFinite(hp) ? Math.max(0, Math.min(max, hp)) : max;
}

/** "Brood (12) · Mob DC 6" */
export function groupLabel(sys) {
  const h = currentHeads(sys);
  const b = bandFor(h);
  const max = Math.max(1, Math.floor(Number(sys?.heads) || 1));
  return `${b.label} (${h}${h !== max ? ` of ${max}` : ""} head${h === 1 ? "" : "s"}) · Mob DC ${mobDC(sys?.tier, h)}`;
}

/**
 * Token size for a group on placement (Jon 2026-10-04): the footprint is the
 * heads' footprints combined, laid out as a near-square rectangle
 * (6 → 3×2, 12 → 4×3, 16 → 4×4; 16 ½-square sprites = 8 squares → 3×3).
 * headSquares = one head's footprint in squares (½ = 0.5).
 */
export function groupTokenSize(heads, headSquares = 1) {
  const sq = Math.max(1, Math.ceil(Math.max(1, Math.floor(Number(heads) || 1)) * Math.max(0.5, Number(headSquares) || 1)));
  const w = Math.ceil(Math.sqrt(sq));
  return { width: w, height: Math.ceil(sq / w), squares: sq };
}

/* ------------------------------------------------------------------ *
 * Damage to a group (Monster Manual § Minions, 2026-10-04):
 *   melee attacks and spells — one head per kept damage die (explosion dice
 *   count, dropped dice don't), capped at net damage; ranged weapon attacks —
 *   one head per hit; Attrition — one head per instance.
 * ------------------------------------------------------------------ */

/** Kept dice in a Foundry Roll: every active die result (explosions add results; dropped ones are inactive). */
export function keptDiceOf(roll) {
  if (!roll?.dice) return null;
  return roll.dice.reduce((n, d) => n + (d.results || []).filter(r => r.active !== false && !r.discarded).length, 0);
}

/**
 * Heads lost. mode "ranged" | "attrition" | default (melee / spell).
 *   damage = net damage that got through; kept = kept dice; instances = Attrition count.
 * → { heads, why }
 */
export function headsLost({ mode = "", damage = 0, kept = null, instances = 0, current = Infinity } = {}) {
  const dmg = Math.max(0, Math.floor(Number(damage) || 0));
  let heads, why;
  if (mode === "attrition") { heads = Math.max(0, Math.floor(Number(instances) || 0)); why = "one head per Attrition instance"; }
  else if (mode === "ranged") { heads = dmg > 0 ? 1 : 0; why = "one head per ranged hit"; }
  else if (Number.isFinite(kept)) { heads = Math.min(kept, dmg); why = `one head per kept damage die (${kept}), capped at net damage (${dmg})`; }
  else { heads = dmg; why = "no dice to count — one head per point of damage; adjust if needed"; }
  return { heads: Math.max(0, Math.min(heads, Number.isFinite(current) ? current : heads)), why };
}

/* ------------------------------------------------------------------ *
 * Mob traits (2026-10-04): "When the [group/swarm/pack] deals damage, …"
 *   trial    "the target must succeed on a STR trial [Cluster 4 / …] or advance Restricted by 1 tier (max Tier 2)"
 *   attrition "the target suffers Attrition (Bleeding) 2"
 *   self     "it advances Invigorated by 1 tier"
 *   presence "A creature that starts its turn within 30 feet of the swarm and can hear it must succeed on …" (turn start, not on damage)
 * Chained conditions never pass the minion's Creature Tier.
 * ------------------------------------------------------------------ */
const ATTR = { STR: "strength", AGI: "agility", PHY: "physique", END: "endurance", INT: "intelligence", WIS: "wisdom", CHA: "charisma", PER: "perception" };
const strip = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

export function parseMobTrait(description) {
  const t = strip(description);
  let m;
  // Presence (Monster Manual § Mob traits, 2026-10-06): "A creature that
  // starts its turn within 30 feet of the swarm and can hear it must succeed
  // on a WIS trial […] or advance Demoralized by 1 tier (max Tier 1)."
  if ((m = t.match(/starts its turn within (\d+) feet of the \w+ and can (hear|see|smell|perceive) it must succeed on an? (STR|AGI|PHY|END|INT|WIS|CHA|PER) trial \[[^\]]*\] or advance (\w+) by (\d+) tiers?(?: \(max Tier (\d+)\))?/i)))
    return { kind: "presence", range: Number(m[1]), sense: m[2].toLowerCase(), attribute: ATTR[m[3].toUpperCase()], condition: m[4].toLowerCase(), advance: Number(m[5]), maxTier: m[6] ? Number(m[6]) : null };
  if ((m = t.match(/\b(STR|AGI|PHY|END|INT|WIS|CHA|PER) trial \[[^\]]*\] or advance (\w+) by (\d+) tiers?(?: \(max Tier (\d+)\))?/i)))
    { const inc = t.match(/Incubation: each dawn, the target makes an? (STR|AGI|PHY|END|INT|WIS|CHA|PER) trial \[(\d+)\]/i);
      return { kind: "trial", attribute: ATTR[m[1].toUpperCase()], condition: m[2].toLowerCase(), advance: Number(m[3]), maxTier: m[4] ? Number(m[4]) : null,
        incubation: inc ? { attribute: ATTR[inc[1].toUpperCase()], dc: Number(inc[2]) } : null }; }
  if ((m = t.match(/Attrition \((\w+)\) (\d+)/i))) return { kind: "attrition", key: m[1].toLowerCase(), amount: Number(m[2]) };
  if ((m = t.match(/\bit advances (\w+) by (\d+) tiers?/i))) return { kind: "self", condition: m[1].toLowerCase(), advance: Number(m[2]) };
  return null;
}

/** Effect nodes for a Mob trait (ability-executor shapes). */
export function mobTraitNodes(trait, { tier = 1, heads = 1 } = {}) {
  if (!trait) return [];
  const cap = (n) => (n ? Math.min(n, Number(tier) || 1) : (Number(tier) || 1));
  if (trait.kind === "trial" || trait.kind === "presence") {
    const onFail = [{ type: "applyChainedCondition", target: "target", key: trait.condition, advance: trait.advance, maxTier: cap(trait.maxTier) }];
    // Ophiuchus False Cure: "Incubation: each dawn, the target makes an END trial [5]…" — the failed target is marked for Dawn.
    if (trait.incubation) onFail.push({ type: "markIncubation", target: "target", key: trait.condition, ...trait.incubation });
    return [{ type: "trial", target: "target", attribute: trait.attribute, dc: mobDC(tier, heads), onFail }];
  }
  if (trait.kind === "attrition") return [{ type: "applyAttrition", target: "target", key: trait.key, stacks: 1, amount: trait.amount }];
  if (trait.kind === "self") return [{ type: "applyChainedCondition", target: "source", key: trait.condition, advance: trait.advance, maxTier: cap(null) }];
  return [];
}

/** A banded DC "[Cluster 5 / Brood 7 / Swarm 9]" reads as Creature Tier + band bonus at current heads. */
export const isBandedDC = (text) => /\[\s*Cluster\s+\d+\s*\/\s*Brood\s+\d+\s*\/\s*Swarm\s+\d+\s*\]/i.test(String(text || ""));

/**
 * Does a group ignore this condition? "Effects aimed at one creature apply only
 * their damage to a group: their conditions and forced movement have no
 * effect." A group of one is a creature like any other (2026-10-04).
 */
export function groupIgnoresCondition(sys, { area = false } = {}) {
  return isMinion(sys) && currentHeads(sys) >= 2 && !area;
}
