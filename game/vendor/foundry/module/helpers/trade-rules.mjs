/**
 * TRADE RULES (pure, 2026-10-10). Skill Mastery.md › Trade Skill: Universal
 * Trade Rules (Production, Automatic Use), Healer and Blacksmith
 * disciplines. Runtime: trade-healer.mjs, trade-smith.mjs.
 * Mastery level index: Unskilled 1, Untrained 2, Basic 3, Skilled 4,
 * Expert 5, Master 6, Grand Master 7.
 */

/* ------------------------------------------------------------------ *
 * Healing Supplies and Automatic Use
 * ------------------------------------------------------------------ */
/** "Healing Supply Dice and Costs" (tier = Social Class). */
export const SUPPLIES = [
  { tier: 1, social: "Serf", dice: "2d2", cost: "1 sp" },
  { tier: 2, social: "Peasant", dice: "2d3", cost: "1 ss" },
  { tier: 3, social: "Knight", dice: "2d4", cost: "1 sc" },
  { tier: 4, social: "Burgher", dice: "3d6", cost: "1 gs" },
  { tier: 5, social: "Magnate", dice: "4d8", cost: "2 gs" },
  { tier: 6, social: "Noble", dice: "5d10", cost: "4 gs" },
  { tier: 7, social: "Royal", dice: "6d12", cost: "8 gs" }
];
/** "Healing Supplies (Peasant)" → 2. */
export function supplyTierOf(name = "") {
  const m = /^Healing Supplies\s*\((\w+)\)/i.exec(String(name));
  return m ? (SUPPLIES.find(s => s.social.toLowerCase() === m[1].toLowerCase())?.tier || 0) : 0;
}
export const supplyDice = (tier) => SUPPLIES.find(s => s.tier === Number(tier))?.dice || "";
/** Automatic Use table (Skill Mastery, 2026-10-22): Use DC by item tier (T1 Serf 3 … T7 Royal 14). */
export const USE_DC = { 1: 3, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 7: 14 };
/** No roll at: T1 and T2 Untrained, T3 Basic … T7 Grand Master (levelIndex: 2 Untrained … 7 Grand Master). */
export const autoUse = (levelIndex, tier) => (Number(levelIndex) || 0) >= Math.max(2, Number(tier) || 0);

/**
 * Treat Tainted / Treat Infected: "Supply bonus equals supply tier minus 1.
 * Before rolling, you may sacrifice 2 bonus to increase the tier reduction
 * by 1 (maximum reduction 3)." → [{ bonus, reduce }]
 */
export function treatOptions(tier) {
  const base = Math.max(0, (Number(tier) || 1) - 1);
  const out = [];
  for (let k = 0; k < 3 && base - 2 * k >= 0; k++) out.push({ bonus: base - 2 * k, reduce: 1 + k });
  return out;
}
/**
 * Treat Injuries: "Clears a number of Injuries equal to the supply tier used.
 * If the supply tier exceeds the number of Injuries treated, excess tiers
 * convert to healing using the supply dice for the corresponding excess tier."
 */
export function treatInjuries(tier, injured) {
  const t = Number(tier) || 0, inj = Math.max(0, Number(injured) || 0);
  const cleared = Math.min(t, inj), excess = t - cleared;
  return { cleared, excess, healDice: excess > 0 ? supplyDice(excess) : "" };
}
/**
 * Treat Trauma: the Trauma table's recovery text names the treatment and its
 * tier — "Set (Healer, T3)", "Reset (Healer, T2)", "Stop the bleeding
 * (Healer, T2)", "Tend daily (Healer, T3), 10 successes", "Healer, T3, same
 * day only" (revise a scar). → { label, tier, successes, useDc } | null
 */
export function traumaTreatment(recovery = "") {
  // 2026-10-22: the table reads "(Healer)" with no tier; the roll is against the Trauma's own tier.
  const t = String(recovery);
  const m = /(?:^|\b)([A-Z][a-z]+(?: [a-z]+)*)?\s*\(?Healer(?:, T(\d))?\)?/.exec(t);
  if (!m) return null;
  let label = (m[1] || "").trim();
  if (!label || /^Healer$/i.test(label)) label = /same day/i.test(t) ? "Revise the scar (same day only)" : "Treat";
  const s2 = /(\d+) successes/.exec(t);
  return { label, successes: s2 ? Number(s2[1]) : 1 };
}
/** Treat Supplies kept for old characters' items only (Healing Supplies were retired 2026-10-22). */
export const traumaSupplyOk = (supplyTier, treatmentTier) => (Number(supplyTier) || 0) >= (Number(treatmentTier) || 0);

/* ------------------------------------------------------------------ *
 * Healer, rebuilt around kits (Skill Mastery 2026-10-22). Pure.
 * ------------------------------------------------------------------ */
export const HEALER_KITS = { heal: "Wound Kit", triage: "Wound Kit", injury: "Injury Kit", trauma: "Trauma Kit", poison: "Physic Kit", disease: "Physic Kit" };
/** "Roll against the Trauma's tier: Minor 5, Severe 7, Grievous 9." */
export const traumaTreatDc = (tier) => ({ minor: 5, severe: 7, grievous: 9 })[String(tier || "").toLowerCase()] ?? 7;
/** Tools a treatment needs: pocket set (Wounds, Injuries, Minor Traumas) or chest (Severe / Grievous); null = no tools. */
export function toolsFor(kind, traumaTier = "") {
  if (kind === "heal" || kind === "injury") return "pocket";
  if (kind === "trauma") return /^minor$/i.test(String(traumaTier)) ? "pocket" : "chest";
  return null;
}
/** A chest counts as a pocket set. */
export const hasTools = (need, { pocket = false, chest = false } = {}) => !need || (need === "pocket" ? (pocket || chest) : chest);
/** Untrained hands: "you roll before using a Wound Kit (against 3) or an Injury Kit (against 4)". */
export const untrainedKitDc = (kit) => (kit === "Wound Kit" ? 3 : kit === "Injury Kit" ? 4 : null);
/** Treat Poison: "Tainted drops by 1 tier, or by 2 if you succeed by 5 or more." */
export const poisonReduction = (total, dc) => ((Number(total) || 0) - (Number(dc) || 0) >= 5 ? 2 : 1);
/** Dwale on the patient (Alchemy): Drowsy → Dominance on Heal and Treat Injury; Asleep / Deep → Heal and Treat Trauma; Deep can't botch a bone. */
export function dwaleHelp(dwaleTier, kind) {
  const t = Number(dwaleTier) || 0;
  if (!t) return { dominance: false, noBotch: false };
  const dom = t === 1 ? ["heal", "injury"].includes(kind) : ["heal", "trauma"].includes(kind);
  return { dominance: dom, noBotch: t >= 3 && kind === "trauma" };
}

/* ------------------------------------------------------------------ *
 * Trade Production (Blacksmith crafting)
 * ------------------------------------------------------------------ */
export const RATE_DCS = [2, 4, 8, 10, 14, 18, 21];
/** Trade Production Rate (sp/day) by mastery level index; null = "—". */
export const RATES = {
  2: [2, 4, 10, 20, 40, null, null],
  3: [4, 10, 20, 40, 60, null, null],
  4: [10, 20, 40, 60, 80, 100, null],
  5: [20, 40, 60, 80, 100, 120, null],
  6: [40, 60, 80, 100, 120, 160, 200],
  7: [60, 80, 100, 120, 160, 200, 240]
};
/** The rate for a roll ("cross-reference your roll"), or the floor rate (no roll). */
export function productionRate(levelIndex, roll = null) {
  const row = RATES[Math.min(7, Number(levelIndex) || 0)];
  if (!row) return null;
  if (roll === null || roll === undefined) return row[0];
  let best = null;
  for (let i = 0; i < RATE_DCS.length; i++) if (Number(roll) >= RATE_DCS[i] && row[i] !== null) best = row[i];
  return best ?? row[0];
}
/** "Time to craft is item value ÷ production rate in days. Minimum craft time is 1 hour per item, maximum 8 working hours per day." */
export function craftTime(valueSp, rate) {
  const days = (Number(valueSp) || 0) / Math.max(1, Number(rate) || 1);
  const hours = Math.max(1, Math.ceil(days * 8));
  return { hours, days: Math.max(1, Math.ceil(hours / 8)), exactDays: days };
}
/** Blacksmith Repair Formula: "(Trade mastery die + Intelligence tier die) × 4". */
export const repairAmount = (rollTotal) => (Number(rollTotal) || 0) * 4;

/* ------------------------------------------------------------------ *
 * Scribe (2026-10-10; Skill Mastery › Scribe; Magic handoff "Scrolls: item
 * model and use"). A scroll's tier comes from its classification:
 * Vestige 1–2 magan T1, Distortion 3–4 T2, Manifestation 5–6 T3,
 * Incantation 7–9 T4, Invocation 10–15 T5, Devastation 16–20 T6,
 * Culmination 21+ T7 — "A magan cost not listed … uses the classification
 * of the band it falls in." Use DC = that tier's Automatic Use DC. The
 * writing gate is the same: Unskilled for T1 … Grand Master for T7.
 * ------------------------------------------------------------------ */
export const SCROLL_BANDS = [
  { tier: 1, max: 2, label: "Vestige" }, { tier: 2, max: 4, label: "Distortion" }, { tier: 3, max: 6, label: "Manifestation" },
  { tier: 4, max: 9, label: "Incantation" }, { tier: 5, max: 15, label: "Invocation" }, { tier: 6, max: 20, label: "Devastation" }, { tier: 7, max: Infinity, label: "Culmination" }
];
export const scrollBand = (magan) => SCROLL_BANDS.find(b => Math.max(1, Number(magan) || 1) <= b.max);
export const scrollTier = (magan) => scrollBand(magan).tier;
export const scrollUseDc = (magan) => USE_DC[scrollTier(magan)];
/** Writing: "Scribe mastery gate based on magan cost" (Unskilled 1 … Grand Master 7). */
export const canScribe = (levelIndex, magan) => (Number(levelIndex) || 1) >= scrollTier(magan);
/** Supplies: "magan² units of Scribe Supplies"; time: "1 day per magan". */
export const scribeSupplies = (magan) => Math.pow(Math.max(1, Number(magan) || 1), 2);
/** "Trial DC = 2 + (magan cost − Form DC)", only when the magan exceeds the Form DC. → DC or null. */
export const scrollTrialDc = (magan, formDc) => (Number(magan) || 0) > (Number(formDc) || 0) ? 2 + (Number(magan) - Number(formDc)) : null;
/** Tradition by casting attribute: Occult Intelligence, Theurgic Charisma, Priscan Perception (Telluric Wisdom: no scrolls). */
export const TRADITION_BY_ATTR = { intelligence: "occult", charisma: "theurgic", perception: "priscan", wisdom: "telluric" };
export const ATTR_BY_TRADITION = { occult: "intelligence", theurgic: "charisma", priscan: "perception" };
/** "Druid, Fili, and Sylvan Elf have no access … Non-casters … have no access." */
export const scribeBarred = (className = "", castingAttribute = "") => !castingAttribute || castingAttribute === "wisdom" || /sylvan elf/i.test(className);
/** Abandon: "Half the remaining time and half the remaining Scribe Supplies are saved." */
export const abandonRefund = (units, days, done) => Math.floor((Number(units) || 0) * Math.max(0, (Number(days) || 1) - (Number(done) || 0)) / Math.max(1, Number(days) || 1) / 2);
