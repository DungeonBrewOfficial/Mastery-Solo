/**
 * NPC Health computation — the shared logic behind:
 *   - Automatic Health assignment on `createActor` for type "npc"
 *   - The "Recompute Health" button on the NPC sheet
 *
 * The world setting `mastery.npcHealthMode` picks between:
 *   - "rolled":   evaluates the Health formula as a real dice roll (VTT default,
 *                 varies per creature so players can't meta-track)
 *   - "averaged": takes the average of every die in the formula (matches the
 *                 "~12" style number written on the paper stat block)
 *
 * The formula itself is deterministic and derives from the actor's stored data
 * (armored/unarmored, tier, rank, END score, END die, DTD, size bonus dice).
 *
 * Formula shape (from Monster Manual Rules — Health section):
 *   Unarmored: END score + (Division × END TD) + DTD + (size bonus dice × END TD)
 *   Armored:   (Division × END TD) + Creature Tier
 *
 * "Division × END TD" means Division separate dice of type END TD. Same for the
 * size bonus. So a Division-2 creature with END die 1d3 rolls 2d3 for that
 * component. If END die is 2d6 (T8), Division 9 (T3 Legendary), rolls 18d6.
 */

import { MASTERY, tierToDie, dtdForTierRank } from "../config.mjs";

/**
 * Convert a {c, s} die into a Foundry formula term. Returns "" for null dice.
 */
function dieToTerm(die) {
  if (!die || (!die.c && !die.s)) return "";
  if (die.c === 0 && die.s === 0) return "";
  if (die.c === 0 && die.s === 1) return "1";
  if (die.c > 0 && die.s > 0) return `${die.c}d${die.s}`;
  return "";
}

/**
 * Average value of a {c, s} die. Flat 1 → 1, 1d2 → 1.5, 1d6 → 3.5, 2d6 → 7.
 * Real math — matches the expected value of a fair die. Rolled mode uses
 * Foundry's actual dice engine so it varies per roll regardless.
 */
function averageOfDie(die) {
  if (!die || (!die.c && !die.s)) return 0;
  if (die.c === 0) return die.s;
  return die.c * (die.s + 1) / 2;
}

/**
 * Multiply a {c, s} die's dice count by n (for "Division × END TD" style terms).
 * Returns a new {c, s} object. 3 × 1d3 → 3d3. 4 × 2d6 → 8d6.
 */
function scaleDieCount(die, n) {
  if (!die || !die.c || !die.s) return { c: 0, s: 0 };
  return { c: die.c * n, s: die.s };
}

/**
 * Build the pieces that make up an NPC's Health formula.
 * Returns { armored, terms: [{label, die?, flat?}], formula, average }.
 */
export function buildHealthPlan(system) {
  const armored = !!system.armored;
  const tier = Number(system.tier) || 1;
  const rank = system.rank || "adept";
  const rankRec = MASTERY.npcRanks[rank] || MASTERY.npcRanks.adept;
  const division = tier + rankRec.offset;
  const dtd = dtdForTierRank(tier, rank);
  const endScore = Number(system.attributes?.endurance?.score) || 0;
  const endTier = Number(system.attributes?.endurance?.tier) || 0;
  const endDie = tierToDie(endTier);
  const sizeRow = system.sizeRow || { healthBonusDice: 0 };
  const sizeBonusDiceCount = Number(sizeRow.healthBonusDice) || 0;

  const terms = [];

  if (armored) {
    // Rules-doc formula: (Division × END TD) + Creature Tier.
    // Paper stat blocks additionally apply the size health bonus dice
    // to armored creatures (e.g. Rouncey War Horse 2sq: 4d4 + 2d4 + 1).
    // We follow the stat blocks; the rules-doc omission is tracked in
    // DEFERRED.md.
    terms.push({ label: `${division} × END die`, die: scaleDieCount(endDie, division) });
    if (endDie.c > 0 && sizeBonusDiceCount > 0) {
      terms.push({ label: `size bonus ${sizeBonusDiceCount} × END die`, die: scaleDieCount(endDie, sizeBonusDiceCount) });
    }
    terms.push({ label: "Creature Tier",        flat: tier });
  } else {
    // END score + (Division × END TD) + DTD + (size bonus × END TD)
    if (endScore > 0)                terms.push({ label: "END score", flat: endScore });
    if (endDie.c > 0 && division > 0) terms.push({ label: `${division} × END die`, die: scaleDieCount(endDie, division) });
    if (dtd.c > 0)                   terms.push({ label: "DTD", die: dtd });
    if (endDie.c > 0 && sizeBonusDiceCount > 0) {
      terms.push({ label: `size bonus ${sizeBonusDiceCount} × END die`, die: scaleDieCount(endDie, sizeBonusDiceCount) });
    }
  }

  // Formula string for Foundry Roll.
  const parts = [];
  for (const t of terms) {
    if (t.die) {
      const term = dieToTerm(t.die);
      if (term) parts.push(term);
    } else if (t.flat) {
      parts.push(String(t.flat));
    }
  }
  const formula = parts.length ? parts.join(" + ") : "0";

  // Average total.
  let average = 0;
  for (const t of terms) {
    if (t.die) average += averageOfDie(t.die);
    else if (t.flat) average += t.flat;
  }
  average = Math.max(0, Math.floor(average));

  return { armored, terms, formula, average };
}

/**
 * Compute Health max for an NPC given the current world setting mode.
 * Returns { max, rolled, formula, roll? } where `roll` is the evaluated
 * Foundry Roll (only present in rolled mode).
 *
 * @param {object} system  actor.system
 * @param {string} mode    "rolled" | "averaged" (defaults to "rolled")
 */
export async function computeHealthFromMode(system, mode = "rolled") {
  const plan = buildHealthPlan(system);
  if (mode === "averaged") {
    return { max: plan.average, rolled: false, formula: plan.formula };
  }
  // Rolled path
  try {
    const roll = new Roll(plan.formula);
    await roll.evaluate();
    return { max: Math.max(0, Math.floor(roll.total)), rolled: true, formula: plan.formula, roll };
  } catch (err) {
    console.warn("Mastery | computeHealthFromMode: roll failed, falling back to average", err);
    return { max: plan.average, rolled: false, formula: plan.formula };
  }
}

/**
 * Read the world setting for NPC Health mode. Guarded for pre-init callers.
 * Defaults to "rolled" — the VTT-preferred behavior per Jon 2026-09-10.
 */
export function readNpcHealthMode() {
  try {
    return game?.settings?.get?.("mastery", "npcHealthMode") || "rolled";
  } catch (e) {
    return "rolled";
  }
}

/**
 * Apply a freshly-computed Health value to an NPC actor. Sets both max and
 * value (a freshly-created / recomputed creature starts full).
 */
/**
 * Armored NPC Durability (Monster Manual § Armored Health, 2026-09-24):
 * Durability = 2 × (END Score + average DTD − Creature Tier). Null when
 * the creature isn't armored.
 */
export function armoredDurability(system) {
  if (!system?.armored) return null;
  const end = Number(system.attributes?.endurance?.score) || 0;
  const d = system.dtd || { c: 0, s: 0 };
  const avgDtd = d.c > 0 ? d.c * (d.s + 1) / 2 : (d.s === 1 ? 1 : 0);
  return Math.max(0, Math.round(2 * (end + avgDtd - (Number(system.tier) || 0))));
}

export async function assignHealthToActor(actor, computed) {
  if (!actor || !computed) return;
  const patch = {
    "system.health.max":   computed.max,
    "system.health.value": computed.max
  };
  // Armored creatures: Recompute also sets Durability from the formula.
  const dur = armoredDurability(actor.system);
  if (dur !== null) {
    patch["system.armor.durability.max"] = dur;
    patch["system.armor.durability.value"] = dur;
  }
  await actor.update(patch);
}

/**
 * Register the createActor hook that auto-assigns Health when a new NPC
 * is added to the world. Called once from ready.
 */
export function registerNpcHealthHooks() {
  Hooks.on("createActor", async (actor, options, userId) => {
    // Only run for the user that created the actor (avoid double-fire in
    // multi-client sessions).
    if (game.user.id !== userId) return;
    if (actor?.type !== "npc") return;
    // Companions get health from their rolled pool (helpers/pools.mjs),
    // not the NPC creation formula.
    if (actor.system?.companion?.kind) return;
    // Shapeshift forms (spell phase 6b): health is the spell's pool.
    if (actor.flags?.mastery?.shapeshiftForm) return;
    // Minion groups: Health = heads (set when the token is placed).
    if (actor.system?.rank === "minion") return;
    const mode = readNpcHealthMode();
    const computed = await computeHealthFromMode(actor.system, mode);
    await assignHealthToActor(actor, computed);
    // Chat announcement — helpful during creature building, and consistent
    // with the pattern of announcing meaningful state changes (AP grants,
    // condition changes, etc.). The seed helper passes `masteryQuiet: true`
    // via options to suppress the flood when bulk-creating starter content.
    if (computed.rolled && !options?.masteryQuiet) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<strong>${actor.name}</strong> — Health rolled: <strong>${computed.max}</strong> (${computed.formula})`
      });
    }
  });
}
