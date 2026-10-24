/**
 * ADVANCEMENT (milestone 3): levels from experience, attribute points,
 * mastery points, health and magan, free skills, titles, and companions.
 * Mastery Core Classes (Leveling, Applying Points to Scores, Tier Dice
 * Pools, each class's table) and Mastery System (Mastery Points, Weapon
 * Mastery Caps, Free Combat Style), with the class data built from
 * Foundry's class pack and Foundry's advancement rules.
 */
import { CLASSES } from "./data/classes.js";
import { tierOf, dieOfTier } from "./mastery.js";
import { levelPoints } from "./vendor/foundry/module/helpers/advancement-rules.mjs";
import { computeClassMpTotal, pointsToScore, pointsToMasteryIndex } from "./vendor/foundry/module/config.mjs";

/** Mastery level index (1 Unskilled … 7 Grand Master) → points invested to reach it (Mastery System, Mastery Points). */
export const MASTERY_POINTS = { 1: 0, 2: 1, 3: 3, 4: 6, 5: 10, 6: 15, 7: 21 };
export const MASTERY_NAMES = { 1: "Unskilled", 2: "Untrained", 3: "Basic", 4: "Skilled", 5: "Expert", 6: "Master", 7: "Grand Master" };
const CAP_INDEX = { skilled: 4, expert: 5, master: 6, grandMaster: 7 };
const TIER_INDEX = { untrained: 2, basic: 3, skilled: 4, expert: 5, master: 6, grandMaster: 7 };
export const WEAPON_TYPES = ["axes", "bludgeons", "daggers", "poleWeapons", "projectiles", "swords"];
export const STYLES = ["single", "shield", "twoHanded", "twoWeapon", "ranged"];
export const ATTRIBUTES = ["strength", "agility", "physique", "endurance", "intelligence", "wisdom", "charisma", "perception"];
const TRADES = ["alchemist", "blacksmith", "healer", "scribe"];

/** The points it takes to reach a score: 1 each for 1–5, 2 for 6–10, … 6 for 26–30. */
export function pointsForScore(score) {
  let p = 0;
  for (let s = 1; s <= score; s++) p += Math.ceil(s / 5);
  return p;
}
/** The Chantment tier table, which companions share: Tier 1 at level 1, then every 4 levels to Tier 7 at 24. */
export const tierForLevel = (level) => Math.min(7, 1 + Math.floor(level / 4));
export const titleOf = (m) => [...(CLASSES[m.cls]?.titles || [])].reverse().find(t => m.level >= t.fromLevel)?.title || null;

/** Fill in what an older save lacks: invested points, from the masteries the sheet records. */
export function ensureAdvancement(m) {
  m.unspent ??= { attr: 0, weapon: 0, spell: 0, skill: 0, style: 0 };
  m.titleName ??= titleOf(m);
  if (!m.attrPts) m.attrPts = Object.fromEntries(ATTRIBUTES.map(a => [a, pointsForScore(m.attributes[a])]));
  if (!m.invest) {
    m.invest = {};
    for (const [k, v] of Object.entries(m.weaponSkill || {})) m.invest[`weapon:${k}`] = MASTERY_POINTS[v] || 0;
    for (const [k, v] of Object.entries(m.styles || {})) m.invest[`style:${k}`] = MASTERY_POINTS[v] || 0;
    for (const [k, v] of Object.entries(m.casting?.forms || {})) m.invest[`form:${k}`] = MASTERY_POINTS[v] || 0;
    const free = CLASSES[m.cls]?.skills.free || [];
    for (const [k, v] of Object.entries(m.skills || {})) if (!free.includes(k)) m.invest[`skill:${k}`] = MASTERY_POINTS[v] || 0;
  }
}

/* ------------------------------------------------------------------ */
/* Gaining levels                                                       */

/** XP needed for the next level, or null past the table. */
export const nextLevelXp = (m) => CLASSES[m.cls]?.xp?.[m.level] ?? null;

/**
 * "When this number of Experience Points have been earned, you
 * automatically move up to the next level." Each level brings its
 * attribute points, mastery points by the class's progressions, the class's
 * health every third level, free skills, the title, and the companion's tier.
 */
export function checkLevels(state, note, rng = null) {
  for (const m of state.party.members.filter(x => !x.dead)) {
    ensureAdvancement(m);
    const c = CLASSES[m.cls];
    while (c?.xp && m.level < c.xp.length && m.xp >= c.xp[m.level]) {
      const L = ++m.level;
      const gain = { attr: levelPoints(L) };
      for (const d of ["weapon", "spell", "skill"]) gain[d] = c.progression[d] ? computeClassMpTotal(c.progression[d], L) - computeClassMpTotal(c.progression[d], L - 1) : 0;
      for (const [k, n] of Object.entries(gain)) m.unspent[k] += n;
      const bits = [`${gain.attr} attribute point${gain.attr === 1 ? "" : "s"}`];
      for (const d of ["weapon", "spell", "skill"]) if (gain[d]) bits.push(`${gain[d]} ${d} mastery`);
      // Health: the class's step every three levels, on top of the Endurance pool.
      if (L % 3 === 0 && c.healthPer3Levels) { m.health += c.healthPer3Levels; m.hp += c.healthPer3Levels; bits.push(`+${c.healthPer3Levels} health`); }
      for (const f of freeSkillsAt(m, L)) bits.push(f);
      const t = titleOf(m);
      if (t && t !== m.titleName) { m.titleName = t; bits.push(`the title ${t}`); }
      const pet = m.companion;
      if (pet && !pet.dead && tierForLevel(L) > pet.tier) bits.push(raisePet(m, tierForLevel(L), rng));
      note(`${m.name} reaches level ${L}: ${bits.join(", ")}.`, "reward");
    }
  }
}

/** Free skills that climb with the class (a Druid's Wilderness, a Thief's Stealth and Thievery, a Paladin's Theurgic Lore). */
function freeSkillsAt(m, L) {
  const c = CLASSES[m.cls], out = [];
  const step = c.freeSkillAt.find(x => x.level === L);
  if (!step) return out;
  for (const k of c.skills.free) {
    const idx = TIER_INDEX[step.tier];
    if ((m.skills[k] || 1) >= idx) continue;
    m.skills[k] = idx;
    if (k === "lore" && m.theurgy) m.theurgy.lore = idx;
    out.push(`${MASTERY_NAMES[idx]} ${cap(k)}`);
  }
  return out;
}

/**
 * A companion's tier follows its owner's level. Each tier adds 2 of its tier
 * die to its health and, from Tier 2, 1 resistance to every damage type
 * [Foundry companions.mjs, from Core Classes: Puca, Agathion].
 */
function raisePet(m, tier, rng) {
  const pet = m.companion;
  const die = dieOfTier(tier)[1];
  const add = rng ? rng.d(die) + rng.d(die) : die + 1;
  pet.tier = tier;
  pet.health += add; pet.hp += add;
  pet.resistAll = Math.max(0, tier - 1);
  return `${pet.name} to Tier ${tier} (+${add} health)`;
}

/* ------------------------------------------------------------------ */
/* Spending points                                                      */

const cap = (k) => k[0].toUpperCase() + k.slice(1);
/** What a mastery key reads as on the page. */
export const masteryLabel = (key) => {
  const [d, k] = key.split(":");
  const words = { poleWeapons: "Pole weapons", twoHanded: "Two-Handed", twoWeapon: "Two-Weapon", single: "Single Weapon" };
  return `${words[k] || cap(k)}${d === "form" ? " magic" : d === "style" ? " style" : TRADES.includes(k) ? " (Trade)" : ""}`;
};
export const masteryIndex = (m, key) => pointsToMasteryIndex(m.invest?.[key] || 0);

/** What a character could put mastery points into, by domain. */
export function masteryTargets(m) {
  const c = CLASSES[m.cls];
  const skills = [...c.skills.learnable.filter(k => k !== "trade"), ...(c.skills.learnable.includes("trade") ? c.trade.learnable : [])];
  return {
    weapon: [...WEAPON_TYPES.map(k => `weapon:${k}`), ...STYLES.map(k => `style:${k}`)],
    spell: c.progression.spell ? c.forms.map(k => `form:${k}`) : [],
    skill: skills.map(k => `skill:${k}`)
  };
}

/**
 * Why a point can't go into this mastery now, or "" if it can. "You may
 * invest no more than 1 mastery point into any single weapon type, combat
 * style, magic form, or skill tree per character level"; at level 1 nothing
 * passes Untrained; weapons and styles stop at the class's cap.
 */
export function cannotInvest(m, key, { free = false } = {}) {
  const c = CLASSES[m.cls];
  const [d] = key.split(":");
  const pool = d === "form" ? "spell" : d === "skill" ? "skill" : free ? "style" : "weapon";
  if (free && d !== "style") return "free points go into a combat style";
  if (!(m.unspent[pool] > 0)) return "no points left";
  // One point per mastery per level comes to this: no mastery holds more points than the character has levels.
  if ((m.invest[key] || 0) >= m.level) return "one point per mastery per level";
  const next = pointsToMasteryIndex((m.invest[key] || 0) + 1);
  if (m.level === 1 && next > 2) return "nothing past Untrained at level 1";
  if ((d === "weapon" || d === "style") && next > (CAP_INDEX[c.weaponCap] || 7)) return `${c.name}s stop at ${MASTERY_NAMES[CAP_INDEX[c.weaponCap]]}`;
  if (free && next > 6) return "free style points stop at Master";
  return "";
}

/** Put one point into a mastery and update the sheet's record of it. */
export function invest(m, key, { free = false } = {}) {
  ensureAdvancement(m);
  if (cannotInvest(m, key, { free })) return false;
  const [d, k] = key.split(":");
  const pool = d === "form" ? "spell" : d === "skill" ? "skill" : free ? "style" : "weapon";
  m.unspent[pool] -= 1;
  m.invest[key] = (m.invest[key] || 0) + 1;
  const idx = pointsToMasteryIndex(m.invest[key]);
  if (d === "weapon") (m.weaponSkill ||= {})[k] = idx;
  if (d === "style") (m.styles ||= {})[k] = idx;
  if (d === "form") (m.casting.forms ||= {})[k] = idx;
  if (d === "skill") m.skills[k] = idx;
  // Free Combat Style: from level 2, each point into a weapon type brings one free point for a style.
  if (d === "weapon" && CLASSES[m.cls].freeStyle && m.level >= 2) m.unspent.style += 1;
  return true;
}

/**
 * Put one attribute point into an attribute (Applying Points to Scores).
 * Crossing into a new tier grows the pools: a new Endurance tier die for
 * health, a new casting tier die for magan; the owner's score feeds the
 * companion's health.
 */
export function raiseAttribute(state, m, attr, rng, note) {
  ensureAdvancement(m);
  if (!(m.unspent.attr > 0) || m.attrPts[attr] >= 105) return false;
  m.unspent.attr -= 1;
  const before = m.attributes[attr], tBefore = tierOf(before);
  m.attrPts[attr] += 1;
  m.attributes[attr] = pointsToScore(m.attrPts[attr]);
  const after = m.attributes[attr], tAfter = tierOf(after);
  if (after === before) return true;
  const pet = m.companion;
  const petAttr = pet?.kind === "agathion" ? "perception" : pet?.kind === "puca" ? "wisdom" : null;
  if (pet && !pet.dead && attr === petAttr) { pet.health += after - before; pet.hp += after - before; }
  if (tAfter > tBefore) {
    const die = dieOfTier(tAfter)[1];
    // Tier Dice Pools: "At each tier after it, roll that tier's die and add it to the pool."
    if (attr === "endurance") { const n = rng.d(die); m.health += n; m.hp += n; note(`${m.name}'s Endurance reaches Tier ${tAfter}: d${die} ${n} more health.`, "reward"); }
    if (m.casting && attr === m.casting.attr) { const n = rng.d(die); m.magan += n; m.mp = (m.mp || 0) + n; note(`${m.name}'s ${cap(attr)} reaches Tier ${tAfter}: d${die} ${n} more magan.`, "reward"); }
  }
  return true;
}

/** Points waiting to be spent? */
export const hasUnspent = (m) => !!m.unspent && Object.values(m.unspent).some(n => n > 0);
