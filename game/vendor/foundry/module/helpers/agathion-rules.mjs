/**
 * Agathion rules with no dependencies — safe to import from the NPC data
 * model, companions.mjs and pools.mjs. Actions / sheet context live in
 * agathion.mjs. Source: Mastery Core Classes.md § Cursed › Agathion.
 */

export const AGATHION_FORMS = {
  beast:    { label: "Beast Form" },
  humanoid: { label: "Humanoid Form" }
};

/**
 * Spirit Track → the Agathion's CONNECTED magic form only (Jon 2026-09-24,
 * source § Spirit Track): "The Agathion's body is mortal: it has no
 * immunity or vulnerability. Its spirit is connected to the spirit's magic
 * form, and spells that interact with the Agathion beyond dealing damage
 * require that magic." Classification stays Mortal.
 */
export const AGATHION_SPIRITS = {
  fae:     { label: "Fae (Primal)",    connectedForm: "primal" },
  daeva:   { label: "Daeva (Profane)", connectedForm: "profane" },
  morphon: { label: "Morphon (Void)",  connectedForm: "void" }
};

/** Track resistance passives: "resistance to <type> magic equal to its tier". */
export const AGATHION_RESIST_PASSIVES = {
  primalresistance:  "primal",
  profaneresistance: "profane",
  voidresistance:    "void"
};

export const agathionForm = (sys) => (sys?.companion?.form === "humanoid" ? "humanoid" : "beast");
export const agathionSpirit = (sys) => (AGATHION_SPIRITS[sys?.companion?.track] ? sys.companion.track : "");

/** Passives allowed: one per tier from Tier 2 to Tier 7 (T2 → 1 … T7 → 6). */
export const agathionPickCap = (tier) => Math.max(0, Math.min(6, (Number(tier) || 0) - 1));

/**
 * Daeva / Morphon death passives (Cursed › Agathion; playtest 2026-10-19).
 * What happens when an agathion would reach 0 Health:
 *   "tenacity"  Profane Tenacity, unused since the last Dawn: stays at 1.
 *   "phase"     Phase Death: phases out, reforms at the next Dawn at 1.
 *   "trueDeath" Phase Death again within a week (7 days of game time) of the last phasing.
 *   "death"     neither.
 */
export const WEEK_SECONDS = 7 * 24 * 60 * 60;
export function agathionZeroOutcome({ picks = [], tenacityUsed = false, lastPhasedAt = null, now = 0 } = {}) {
  if (picks.includes("profanetenacity") && !tenacityUsed) return "tenacity";
  if (picks.includes("phasedeath")) {
    if (lastPhasedAt !== null && lastPhasedAt !== undefined && Number(now) - Number(lastPhasedAt) < WEEK_SECONDS) return "trueDeath";
    return "phase";
  }
  return "death";
}

/** Bound Magan (2026-10-21): "If it dies, your maximum and current magan both drop by that amount, to no lower than 0." Pure. */
export const boundMaganAfterDeath = (current, tier) => Math.max(0, (Number(current) || 0) - (Number(tier) || 0));

/**
 * Humanoid Agathion › Combat Style (Core Classes 2026-10-21): "Its style moves
 * both dice of its attack and defense rolls … one step up or down the Die
 * Progression Chart: Single: no change. Two-Handed: attack rolls step up;
 * defense rolls step down. Shield: attack rolls step down; defense rolls step
 * up. A beast has no combat style." It "can equip one weapon … and a shield.
 * It cannot dual wield."
 */
export const AGATHION_STYLES = { single: "Single", twoHanded: "Two-Handed", shield: "Shield" };
export function agathionStyleStep(style, roll) {
  if (style === "twoHanded") return roll === "attack" ? 1 : -1;
  if (style === "shield") return roll === "attack" ? -1 : 1;
  return 0;
}
/** "" = allowed; otherwise why not. */
export function agathionStyleProblem(style, { form = "beast", hasShield = false, twoHandedWeapon = false } = {}) {
  if (form !== "humanoid") return style && style !== "single" ? "A beast has no combat style." : "";
  if (style === "shield" && !hasShield) return "Shield style needs a shield.";
  if (style === "twoHanded" && !twoHandedWeapon) return "Two-Handed style needs a two-handed weapon.";
  return "";
}
