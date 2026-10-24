/**
 * MASTERY RPG — System Configuration
 * Central constants: attributes, mastery levels, weapon categories, mastery attack table.
 * All source values ported from Mastery System.md and Weapon Mastery.md.
 */

export const MASTERY = {};

/* ============================================================
 * ALIGNMENT
 *
 * Three-value enum (Lawful / Neutral / Chaotic). Universal
 * character field — every PC has one. Some classes lock the
 * value at build (Paladin / Knight → Lawful, Avenger → Chaotic);
 * the lock is declared per class as `alignmentLock` on the class
 * record and enforced via a preUpdateActor hook that silently
 * coerces `details.alignment` when the assigned class changes.
 *
 * "" (blank) = unset. Persisted alongside the three values so a
 * freshly-created character with no class doesn't have to be
 * assigned an alignment before the dropdown is committed.
 *
 * Legacy free-text values (from pre-enum characters) are best-
 * effort coerced at data-prep time (lowercase-first-word match;
 * fall back to blank on no match).
 * ============================================================ */

MASTERY.alignments = {
  lawful:  { label: "MASTERY.Alignment.lawful" },
  neutral: { label: "MASTERY.Alignment.neutral" },
  chaotic: { label: "MASTERY.Alignment.chaotic" }
};

MASTERY.alignmentKeys = Object.keys(MASTERY.alignments);

/**
 * Best-effort coercion of an arbitrary alignment string into the
 * enum. Returns one of "lawful" | "neutral" | "chaotic" | "".
 * Matches on the first whitespace-delimited word, case-insensitive,
 * so "Lawful Good", "lawful", "L awful", "LAWFUL" all → "lawful".
 * Anything not matching a known key returns "".
 */
export function coerceAlignment(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "";
  if (MASTERY.alignments[s]) return s;
  const first = s.split(/\s+/)[0];
  if (MASTERY.alignments[first]) return first;
  return "";
}

/* ============================================================
 * ATTRIBUTES
 * ============================================================ */

MASTERY.attributes = {
  strength:     { label: "MASTERY.Attribute.strength",     short: "MASTERY.AttributeShort.strength",     group: "physical" },
  agility:      { label: "MASTERY.Attribute.agility",      short: "MASTERY.AttributeShort.agility",      group: "physical" },
  physique:     { label: "MASTERY.Attribute.physique",     short: "MASTERY.AttributeShort.physique",     group: "physical" },
  endurance:    { label: "MASTERY.Attribute.endurance",    short: "MASTERY.AttributeShort.endurance",    group: "physical" },
  intelligence: { label: "MASTERY.Attribute.intelligence", short: "MASTERY.AttributeShort.intelligence", group: "mental" },
  wisdom:       { label: "MASTERY.Attribute.wisdom",       short: "MASTERY.AttributeShort.wisdom",       group: "mental" },
  charisma:     { label: "MASTERY.Attribute.charisma",     short: "MASTERY.AttributeShort.charisma",     group: "mental" },
  perception:   { label: "MASTERY.Attribute.perception",   short: "MASTERY.AttributeShort.perception",   group: "mental" }
};

MASTERY.attributeKeys = Object.keys(MASTERY.attributes);

/* ============================================================
 * ATTRIBUTE SCORE → TIER → TIER DIE (one rule, PCs and NPCs)
 * Score 0-4=T1, 5-9=T2, 10-14=T3, 15-19=T4, 20-24=T5, 25-29=T6,
 * 30-34=T7, 35-39=T8 … 60+=T13. Dice from tierToDie below.
 * ============================================================ */

export function scoreToTier(score) {
  // One rule for PCs and NPCs (Jon 2026-09-24; Mastery Core Classes
  // "Applying Points to Scores" + Monster Manual Attributes table):
  // Tier = 1 + every full 5 points. Score 5 → T2, 30 → T7, 35 → T8 …
  // 60+ → T13 (4d8, the attribute ceiling; die shifts can still reach
  // 4d12). Score 0 never exists in play — an unrolled PC sheet reads 0,
  // shown as T1 as a placeholder.
  const s = Math.floor(Number(score) || 0);
  if (s < 5) return 1;
  return Math.min(13, Math.floor(s / 5) + 1);
}

/**
 * Tier → die formula string ("1d2" … "1d12", "2d6" … "4d8"). One ladder
 * for PCs and NPCs (Jon 2026-09-24): this is a formatter over
 * `tierToDie` below; the old PC-only Tier 1–7 table is gone.
 */
export function tierToTierDie(tier) {
  const t = Number(tier) || 0;
  if (t <= 0) return "—";
  const d = tierToDie(t);
  return (d.c > 0 && d.s > 1) ? `${d.c}d${d.s}` : "—";
}

/* ============================================================
 * TIER → DIE (EXTENDED, 1-13+)
 *
 * One ladder for everyone (Jon 2026-09-24). Tiers past 7 extend into
 * 2d6/2d8/2d10/2d12/4d6/4d8. `tierToDie` returns the {c, s} die for ANY
 * tier by walking `dieProgression`:
 *
 *   Tier N → dieProgression[N + 1]
 *     (skip index 0 = "0" and index 1 = "flat 1"; tier 1 = 1d2 at index 2)
 *
 *   Tier 1  → 1d2      Tier 8  → 2d6
 *   Tier 2  → 1d3      Tier 9  → 2d8
 *   Tier 3  → 1d4      Tier 10 → 2d10
 *   Tier 4  → 1d6      Tier 11 → 2d12
 *   Tier 5  → 1d8      Tier 12 → 4d6
 *   Tier 6  → 1d10     Tier 13 → 4d8
 *   Tier 7  → 1d12     Tier 14+ → clamps at 4d12 (dominance ceiling)
 *
 * PC pyramids top out at score 30 (T7); `scoreToTier` runs to 60+ = T13
 * for creatures and magic (see Monster Manual). Dominance can still push
 * an already-rolled T13 die into 2d10/2d12/4d6/etc. via the engine's
 * shiftDie; the CEILING here (tier→die lookup) is 4d8, and the ENGINE
 * ceiling (progression max shift) is 4d12.
 * ============================================================ */

export function tierToDie(tier) {
  const t = Number(tier) || 0;
  if (t <= 0) return { c: 0, s: 0 };
  const index = Math.min(t + 1, MASTERY.dieProgression.length - 1);
  return { ...MASTERY.dieProgression[index] };
}

/**
 * Format a tier's die as a formula string ("1d8", "2d6", "0").
 */
export function tierToDieFormula(tier) {
  const d = tierToDie(tier);
  if (d.c === 0 && d.s === 0) return "0";
  if (d.c === 0 && d.s === 1) return "1";
  return `${d.c}d${d.s}`;
}


/* ============================================================
 * ATTRIBUTE POINT COST → SCORE
 * Triangular cost. Each tier has 5 boxes.
 *   Tier 1 boxes cost 1 point each, Tier 2 boxes cost 2, ..., Tier 6 boxes cost 6.
 *   Cumulative tier boundaries: 5, 15, 30, 50, 75, 105 points → scores 5, 10, 15, 20, 25, 30.
 * ============================================================ */

export function pointsToScore(points) {
  let score = 0;
  let remaining = Number(points) || 0;
  for (let costTier = 1; costTier <= 6; costTier++) {
    const boxCost = costTier;
    const tierCost = boxCost * 5;
    if (remaining >= tierCost) {
      score += 5;
      remaining -= tierCost;
    } else {
      score += Math.floor(remaining / boxCost);
      return score;
    }
  }
  return score; // max 30
}

/* ============================================================
 * MASTERY LEVELS
 * ============================================================ */

MASTERY.masteryLevels = [
  { key: "unskilled",   index: 1, cumulative: 0,  label: "MASTERY.Mastery.unskilled" },
  { key: "untrained",   index: 2, cumulative: 1,  label: "MASTERY.Mastery.untrained" },
  { key: "basic",       index: 3, cumulative: 3,  label: "MASTERY.Mastery.basic" },
  { key: "skilled",     index: 4, cumulative: 6,  label: "MASTERY.Mastery.skilled" },
  { key: "expert",      index: 5, cumulative: 10, label: "MASTERY.Mastery.expert" },
  { key: "master",      index: 6, cumulative: 15, label: "MASTERY.Mastery.master" },
  { key: "grandMaster", index: 7, cumulative: 21, label: "MASTERY.Mastery.grandMaster" }
];

MASTERY.masteryThresholds = MASTERY.masteryLevels.map(m => m.cumulative);
MASTERY.masteryMaxPoints = 21;

/**
 * Class MP-per-level progression tables. Named after the weapon mastery
 * cap each progression corresponds to (source doc: `Mastery System.md
 * § Mastery Point Progression`). All three subsystems (weapon / spell /
 * skill) use the same four progression rates; a class item picks a
 * progression per subsystem independently (e.g. Fighter is grandMaster
 * for weapons but medium for skills and none for magic).
 *
 * Structure per entry:
 *   startPoints    — MP granted at level 1 (must be spent at character
 *                    build; capped at Untrained tier per class rules)
 *   gainsAtLevel   — map of {threshold-level: MP-per-level starting
 *                    at that level}. Levels between thresholds use the
 *                    most-recent lower threshold's rate.
 *
 * Total-at-level derivation lives in `computeClassMpTotal(progression,
 * level)` below.
 */
MASTERY.classProgressionTables = {
  skilled:     { startPoints: 1, gainsAtLevel: { 2: 1, 21: 2 } },
  expert:      { startPoints: 2, gainsAtLevel: { 2: 1, 16: 2, 26: 3 } },
  master:      { startPoints: 3, gainsAtLevel: { 2: 1, 11: 2, 21: 3 } },
  grandMaster: { startPoints: 4, gainsAtLevel: { 2: 1, 6: 2, 16: 3, 26: 4 } }
};

/**
 * Compute total MP available for a given progression at a given level.
 *
 * Formula: startPoints + sum over levels 2..L of (gain-rate at that level).
 * Gain rate at level N = the value at the largest threshold <= N in
 * `gainsAtLevel`. Level 1 grants only `startPoints`, no per-level gain.
 *
 * @param {string} progression — "skilled" | "expert" | "master" | "grandMaster"
 * @param {number} level — 1-based level
 * @returns {number} cumulative MP available at that level
 */
export function computeClassMpTotal(progression, level) {
  if (!progression) return 0;
  const table = MASTERY.classProgressionTables[progression];
  if (!table) return 0;
  const L = Math.max(1, Math.floor(Number(level) || 1));
  let total = Number(table.startPoints) || 0;
  const thresholds = Object.keys(table.gainsAtLevel || {})
    .map(k => Number(k))
    .sort((a, b) => a - b);
  if (thresholds.length === 0) return total;
  for (let lv = 2; lv <= L; lv++) {
    let rate = 0;
    for (const t of thresholds) {
      if (t <= lv) rate = table.gainsAtLevel[t];
      else break;
    }
    total += rate;
  }
  return total;
}

/**
 * Convert cumulative points to mastery level index (1-7).
 */
export function pointsToMasteryIndex(points) {
  const p = Number(points) || 0;
  for (let i = MASTERY.masteryLevels.length - 1; i >= 0; i--) {
    if (p >= MASTERY.masteryLevels[i].cumulative) return MASTERY.masteryLevels[i].index;
  }
  return 1;
}

/**
 * Get the mastery level record for a level index (1-7).
 */
export function masteryLevelByIndex(index) {
  const clamped = Math.max(1, Math.min(7, Math.floor(index)));
  return MASTERY.masteryLevels[clamped - 1];
}

/* ============================================================
 * WEAPON TYPES (mastery categories: 6)
 * ============================================================ */

MASTERY.weaponTypes = {
  axes:        { label: "MASTERY.WeaponType.axes" },
  bludgeons:   { label: "MASTERY.WeaponType.bludgeons" },
  daggers:     { label: "MASTERY.WeaponType.daggers" },
  poleWeapons: { label: "MASTERY.WeaponType.poleWeapons" },
  projectiles: { label: "MASTERY.WeaponType.projectiles" },
  swords:      { label: "MASTERY.WeaponType.swords" }
};

MASTERY.weaponTypeKeys = Object.keys(MASTERY.weaponTypes);

/* ============================================================
 * COMBAT STYLES (5)
 * ============================================================ */

MASTERY.combatStyles = {
  single:    { label: "MASTERY.CombatStyle.single" },
  shield:    { label: "MASTERY.CombatStyle.shield" },
  twoHanded: { label: "MASTERY.CombatStyle.twoHanded" },
  twoWeapon: { label: "MASTERY.CombatStyle.twoWeapon" },
  ranged:    { label: "MASTERY.CombatStyle.ranged" }
};

MASTERY.combatStyleKeys = Object.keys(MASTERY.combatStyles);

/* ============================================================
 * CORE SKILL MASTERIES (10)
 * Each is a discrete Mastery track (same shape as weapon type mastery —
 * 7 tiers, 21 points to Grand Master). Sub-skills describe what
 * disciplines fall under each core skill; they are descriptive text,
 * not separate tracks.
 * ============================================================ */

MASTERY.skills = {
  tactics:    { label: "MASTERY.Skill.tactics",    subskills: "Poliorcetics, Tactics" },
  presence:   { label: "MASTERY.Skill.presence",   subskills: "Bartering, Deceit, Etiquette, Interrogation, Intimidation, Rhetoric, Stoic" },
  athletics:  { label: "MASTERY.Skill.athletics",  subskills: "Balance, Climbing, Jumping, Lifting, Running, Swimming" },
  stealth:    { label: "MASTERY.Skill.stealth",    subskills: "Disguise, Sneaking" },
  alertness:  { label: "MASTERY.Skill.alertness",  subskills: "Danger Sense, Discernment, Secret Doors, Stalking, Treasure Sense" },
  thievery:   { label: "MASTERY.Skill.thievery",   subskills: "Breaching, Cryptography, Demimonde, Escamotage, Forgery, Savvy" },
  wilderness: { label: "MASTERY.Skill.wilderness", subskills: "Beast Lore, Hunting and Foraging, Orienteering, Riding, Weather Sense" },
  lore:       { label: "MASTERY.Skill.lore",       subskills: "Creature Lores (Asura, Daeva, Dragon, Fae, Morphon, Primordial) and Knowledge Lores (Ancient, Artifact, Cultural, Curse, Heterodox, Stone)" },
  spellcraft: { label: "MASTERY.Skill.spellcraft", subskills: "Tradition disciplines (Occult, Priscan, Telluric, Theurgic)" },
  trade:      { label: "MASTERY.Skill.trade",      subskills: "Alchemist, Blacksmith, Healer, Scribe" }
};

MASTERY.skillKeys = Object.keys(MASTERY.skills);

/* ============================================================
 * MAGIC FORMS (8 total; max 6 per PC — the sheet always shows all 8)
 * Classified by Material/Energy and Elemental/Entropic.
 *
 *                 Energy          Material
 *   Elemental     Fire, Sky       Sea, Stone
 *   Entropic      Sacred, Void    Primal, Profane
 *
 * Note (from PDF Page 5): Energy bypasses material. Material stops material.
 * ============================================================ */

MASTERY.magicForms = {
  fire:    { label: "MASTERY.MagicForm.fire",    axis: "elemental", type: "energy"   },
  sky:     { label: "MASTERY.MagicForm.sky",     axis: "elemental", type: "energy"   },
  sea:     { label: "MASTERY.MagicForm.sea",     axis: "elemental", type: "material" },
  stone:   { label: "MASTERY.MagicForm.stone",   axis: "elemental", type: "material" },
  sacred:  { label: "MASTERY.MagicForm.sacred",  axis: "entropic",  type: "energy"   },
  void:    { label: "MASTERY.MagicForm.void",    axis: "entropic",  type: "energy"   },
  primal:  { label: "MASTERY.MagicForm.primal",  axis: "entropic",  type: "material" },
  profane: { label: "MASTERY.MagicForm.profane", axis: "entropic",  type: "material" }
};

MASTERY.magicFormKeys = Object.keys(MASTERY.magicForms);

/* Commands — 8 verbs by which spells shape their effect. */
MASTERY.magicCommands = {
  divine:     { label: "MASTERY.MagicCommand.divine",     tagline: "To Discover" },
  evoke:      { label: "MASTERY.MagicCommand.evoke",      tagline: "To Summon" },
  formulate:  { label: "MASTERY.MagicCommand.formulate",  tagline: "To Create" },
  preservate: { label: "MASTERY.MagicCommand.preservate", tagline: "To Protect" },
  enchant:    { label: "MASTERY.MagicCommand.enchant",    tagline: "To Fix Upon" },
  exorcise:   { label: "MASTERY.MagicCommand.exorcise",   tagline: "To Invoke / Banish" },
  obliterate: { label: "MASTERY.MagicCommand.obliterate", tagline: "To Destroy" },
  transmute:  { label: "MASTERY.MagicCommand.transmute",  tagline: "To Transform" }
};

MASTERY.rangedDoctrines = {
  none:       { label: "MASTERY.Doctrine.none" },
  marksman:   { label: "MASTERY.Doctrine.marksman" },
  skirmisher: { label: "MASTERY.Doctrine.skirmisher" }
};

/* ============================================================
 * DAMAGE TYPES (5 mundane)
 * ============================================================ */

MASTERY.damageTypes = {
  // Mundane (5) — armor has per-type resistance fields for these.
  cleaving:   { label: "MASTERY.Damage.cleaving" },
  cutting:    { label: "MASTERY.Damage.cutting" },
  crushing:   { label: "MASTERY.Damage.crushing" },
  piercing:   { label: "MASTERY.Damage.piercing" },
  puncturing: { label: "MASTERY.Damage.puncturing" },
  // Material Magic (4) — flow through armor pool with 0 resistance today.
  // Magical resistance (Stone R 2, Fire R 4, etc.) is deferred to enchanted
  // armor / buffs / spells — outside this framework.
  sea:     { label: "MASTERY.Damage.sea" },
  stone:   { label: "MASTERY.Damage.stone" },
  primal:  { label: "MASTERY.Damage.primal" },
  profane: { label: "MASTERY.Damage.profane" },
  // Energy Magic (4) — bypasses armor entirely, straight to Health.
  fire:    { label: "MASTERY.Damage.fire" },
  sky:     { label: "MASTERY.Damage.sky" },
  sacred:  { label: "MASTERY.Damage.sacred" },
  void:    { label: "MASTERY.Damage.void" }
};

MASTERY.damageTypeKeys = Object.keys(MASTERY.damageTypes);

// Subset used wherever we specifically need only the Mundane 5 (armor
// resistance schema, resistance table on the sheet). Anything routing
// through the full damage flow uses the full damageTypeKeys instead.
MASTERY.mundaneDamageTypeKeys = ["cleaving", "cutting", "crushing", "piercing", "puncturing"];

/* ============================================================
 * DAMAGE CLASSES — Material vs Energy
 *
 * Per combat_revised.md + Jon's Material/Energy framing (magic docs
 * are more up-to-date than the combat doc on this point):
 *
 *   - Mundane (weapons, physical): flows through armor —
 *       resistance → durability pool → overflow to Health.
 *   - Material Magic (Sea, Stone, Primal, Profane): same as Mundane;
 *       Material substances can stop other Material substances.
 *   - Energy Magic (Fire, Sky, Sacred, Void): bypasses armor entirely.
 *       Applies directly to Health. Resistance does not apply.
 *
 * Each damage type maps to a class. Callers of resolveDamage don't
 * need to pass a class — it's derived from the damage type.
 * ============================================================ */

MASTERY.damageClasses = {
  mundane:       { label: "MASTERY.DamageClass.mundane" },
  materialMagic: { label: "MASTERY.DamageClass.materialMagic" },
  energyMagic:   { label: "MASTERY.DamageClass.energyMagic" }
};

MASTERY.damageTypeClass = {
  // Mundane
  cleaving:   "mundane",
  cutting:    "mundane",
  crushing:   "mundane",
  piercing:   "mundane",
  puncturing: "mundane",
  // Material magic (stopped by armor like mundane)
  sea:     "materialMagic",
  stone:   "materialMagic",
  primal:  "materialMagic",
  profane: "materialMagic",
  // Energy magic (bypasses armor)
  fire:    "energyMagic",
  sky:     "energyMagic",
  sacred:  "energyMagic",
  void:    "energyMagic"
};

/** True if a given damage type interacts with armor (resistance + durability). */
export function damageInteractsWithArmor(damageType) {
  const cls = MASTERY.damageTypeClass[damageType] || "mundane";
  return cls !== "energyMagic";
}

/* ============================================================
 * AMMUNITION TYPES
 * Each launcher weapon accepts exactly one of these; each ammunition
 * item declares which one it is. Compatibility check is a string match.
 * ============================================================ */

MASTERY.ammoTypes = {
  arrow:   { label: "MASTERY.AmmoType.arrow" },
  quarrel: { label: "MASTERY.AmmoType.quarrel" },
  bullet:  { label: "MASTERY.AmmoType.bullet" },
  dart:    { label: "MASTERY.AmmoType.dart" }
};

MASTERY.ammoTypeKeys = Object.keys(MASTERY.ammoTypes);

/* ============================================================
 * AMMUNITION ENGAGEMENT MODIFIERS
 * Ammo can shift the launcher's effective engagement speed.
 * "" = no shift; "oneSlower" = shift one step slower on the Fast→Slow
 * scale; "slow" = lock to Slow regardless.
 * ============================================================ */

MASTERY.ammoEngagementModifiers = {
  "":          { label: "MASTERY.AmmoEngagement.none" },
  "oneSlower": { label: "MASTERY.AmmoEngagement.oneSlower" },
  "slow":      { label: "MASTERY.AmmoEngagement.slow" }
};

/* ============================================================
 * WEAPON SPEED (initiative phase)
 * ============================================================ */

MASTERY.speeds = {
  fast:     { label: "MASTERY.Speed.fast" },
  moderate: { label: "MASTERY.Speed.moderate" },
  slow:     { label: "MASTERY.Speed.slow" }
};

/* ============================================================
 * WEIGHT CLASSES (encumbrance)
 * ============================================================ */

MASTERY.weightClasses = {
  light:    { label: "MASTERY.WeightClass.light",    value: 1 },
  moderate: { label: "MASTERY.WeightClass.moderate", value: 2 },
  heavy:    { label: "MASTERY.WeightClass.heavy",    value: 4 }
};

/* ============================================================
 * WEAPON CATEGORIES (10)
 * From Weapon Mastery.md — Weapon Speed and Attribute by Category
 * Each category maps to speed, primary attack attribute, and damage track (I-VI).
 * ============================================================ */

MASTERY.weaponCategories = {
  lightProjectile:     { label: "MASTERY.Category.lightProjectile",     speed: "fast",     attr: "physique",  track: 1, ranged: true,  crossbow: false },
  heavyProjectile:     { label: "MASTERY.Category.heavyProjectile",     speed: "slow",     attr: "physique",  track: 4, ranged: true,  crossbow: false },
  crossbow:            { label: "MASTERY.Category.crossbow",            speed: "slow",     attr: "perception", track: null, ranged: true, crossbow: true }, // fixed dice per weapon
  lightThrown:         { label: "MASTERY.Category.lightThrown",         speed: "fast",     attr: "physique",  track: 1, ranged: true,  crossbow: false },
  heavyThrown:         { label: "MASTERY.Category.heavyThrown",         speed: "slow",     attr: "strength",  track: 2, ranged: true,  crossbow: false },
  lightOneHanded:      { label: "MASTERY.Category.lightOneHanded",      speed: "fast",     attr: "physique",  track: 1, ranged: false, crossbow: false },
  heavyOneHanded:      { label: "MASTERY.Category.heavyOneHanded",      speed: "moderate", attr: "strength",  track: 2, ranged: false, crossbow: false },
  versatileOneHanded:  { label: "MASTERY.Category.versatileOneHanded",  speed: "slow",     attr: "strength",  track: 2, ranged: false, crossbow: false },
  versatileTwoHanded:  { label: "MASTERY.Category.versatileTwoHanded",  speed: "moderate", attr: "strength",  track: 4, ranged: false, crossbow: false },
  twoHanded:           { label: "MASTERY.Category.twoHanded",           speed: "slow",     attr: "strength",  track: 5, ranged: false, crossbow: false }
};

MASTERY.weaponCategoryKeys = Object.keys(MASTERY.weaponCategories);

/* ============================================================
 * WEAPON MASTERY ATTACK DICE TABLE
 * Rows = mastery level index (1=Unskilled ... 7=Grand Master)
 * Cols = damage track (I=1 ... VI=6)
 * Cells = {count, sides} for the weapon die (or {flat: 1} for the "1" cell)
 *
 * From Weapon Mastery.md — Weapon Mastery Attack Dice
 * ============================================================ */

MASTERY.weaponAttackTable = {
  1: { // Unskilled
    1: { flat: 1 },  2: { c: 1, s: 2 },  3: { c: 1, s: 3 },  4: { c: 1, s: 4 },  5: { c: 1, s: 6 },  6: { c: 1, s: 8 }
  },
  2: { // Untrained
    1: { c: 1, s: 2 },  2: { c: 1, s: 3 },  3: { c: 1, s: 4 },  4: { c: 1, s: 6 },  5: { c: 1, s: 8 },  6: { c: 1, s: 10 }
  },
  3: { // Basic
    1: { c: 1, s: 3 },  2: { c: 1, s: 4 },  3: { c: 1, s: 6 },  4: { c: 1, s: 8 },  5: { c: 1, s: 10 }, 6: { c: 1, s: 12 }
  },
  4: { // Skilled
    1: { c: 1, s: 4 },  2: { c: 1, s: 6 },  3: { c: 1, s: 8 },  4: { c: 1, s: 10 }, 5: { c: 1, s: 12 }, 6: { c: 2, s: 6 }
  },
  5: { // Expert
    1: { c: 1, s: 6 },  2: { c: 1, s: 8 },  3: { c: 1, s: 10 }, 4: { c: 1, s: 12 }, 5: { c: 2, s: 6 },  6: { c: 2, s: 8 }
  },
  6: { // Master
    1: { c: 1, s: 8 },  2: { c: 1, s: 10 }, 3: { c: 1, s: 12 }, 4: { c: 2, s: 6 },  5: { c: 2, s: 8 },  6: { c: 2, s: 10 }
  },
  7: { // Grand Master
    1: { c: 1, s: 10 }, 2: { c: 1, s: 12 }, 3: { c: 2, s: 6 },  4: { c: 2, s: 8 },  5: { c: 2, s: 10 }, 6: { c: 2, s: 12 }
  }
};

/* ============================================================
 * DIE PROGRESSION CHART (for Dominance/Impotence shifts)
 * From Mastery System.md — Die Progression Chart
 * 1 → 1d2 → 1d3 → 1d4 → 1d6 → 1d8 → 1d10 → 1d12 → 2d6 → 2d8 → 2d10 → 2d12 → 4d6 → 4d8 → 4d10 → 4d12
 * ============================================================ */

MASTERY.dieProgression = [
  { c: 0, s: 0 },   // step 1: 0 (impotence floor)
  { c: 0, s: 1 },   // step 2: flat 1
  { c: 1, s: 2 },   // step 3: 1d2
  { c: 1, s: 3 },   // step 4: 1d3
  { c: 1, s: 4 },   // step 5: 1d4
  { c: 1, s: 6 },   // step 6: 1d6
  { c: 1, s: 8 },   // step 7: 1d8
  { c: 1, s: 10 },  // step 8: 1d10
  { c: 1, s: 12 },  // step 9: 1d12
  { c: 2, s: 6 },   // step 10: 2d6
  { c: 2, s: 8 },   // step 11: 2d8
  { c: 2, s: 10 },  // step 12: 2d10
  { c: 2, s: 12 },  // step 13: 2d12
  { c: 4, s: 6 },   // step 14: 4d6
  { c: 4, s: 8 },   // step 15: 4d8
  { c: 4, s: 10 },  // step 16: 4d10
  { c: 4, s: 12 }   // step 17: 4d12 (dominance ceiling)
];

MASTERY.dieProgressionCount = MASTERY.dieProgression.length;

/* ============================================================
 * CONDITIONS
 *
 * Per conditions_revised.md. Three families:
 *   - Chained: negative (9) and positive (6). Each has three tiers.
 *     Positives counter their paired negatives tier-for-tier (some 1:1,
 *     three of them dual-paired against two negatives — see pairings map).
 *   - Neutral: Concealed, Cover, Unbound. Tiered 1–3.
 *   - Simple: standalone effects, active/inactive on/off.
 *   - Attrition: nine damage-type flavors of persistent-damage instances.
 *     Stacks as a count with no upper limit (floor 0). No auto tick yet —
 *     needs Combat Tracker + turn events.
 *
 * Deterioration (1 tier per round at inflictor's turn end), automatic
 * modifier application to rolls, and Foundry Active Effects integration
 * are all DEFERRED — this shipping pass only covers config + schema +
 * sheet display + pairing math on manual tier change.
 * ============================================================ */

MASTERY.chainedNegativeConditions = {
  exhausted:   { label: "MASTERY.Condition.exhausted",   resistAttr: "endurance",    tiers: [
    "Weary: Impotence on all rolls.",
    "Fatigued: Impotence on all rolls. Inferiority on attack and defense rolls. All spells require miscast trials.",
    "Depleted: Impotence on all rolls. Inferiority on attack and defense rolls. All spells require miscast trials. Movement halved. 1 AP per round."
  ], pairedPositive: "invigorated" },
  impaired:    { label: "MASTERY.Condition.impaired",    resistAttr: "perception",   tiers: [
    "Dazed: Penalty -1 to all rolls. Must act in Slow phase.",
    "Stunned: Penalty -2 to all rolls. Inferiority on attack, defense, and spell damage. Must act in Slow phase.",
    "Paralyzed: Cannot take any actions. Considered Helpless and Catatonic. Aware but unable to act."
  ], pairedPositive: "hastened" },
  restricted:  { label: "MASTERY.Condition.restricted",  resistAttr: "strength",     tiers: [
    "Grappled: Cannot move. Penalty -1 to physical rolls.",
    "Pinned: Cannot move. Penalty -2 to physical rolls. Inferiority on attack and defense rolls.",
    "Restrained: Cannot move or take actions except attempts to resist. Considered Helpless. Can maintain concentration. Can cast spells without somatic components (+1 magan)."
  ], pairedPositive: "hastened" },
  demoralized: { label: "MASTERY.Condition.demoralized", resistAttr: "wisdom",       tiers: [
    "Shaken: Inferiority on attack rolls and spell damage. Cannot willingly advance toward source of fear.",
    "Frightened: Inferiority on attack, defense, and spell damage. Cannot willingly advance toward source.",
    "Panicked: Inferiority on attack, defense, and spell damage. Must flee from source by safest route. If cornered may defend but cannot attack or cast offensive spells."
  ], pairedPositive: "inspired" },
  disoriented: { label: "MASTERY.Condition.disoriented", resistAttr: "intelligence", tiers: [
    "Befuddled: AP may only be spent on defense or on breaking free. Behaves defensively.",
    "Confused: AP may only be spent attacking the nearest creature (random on tie). Lashes out unpredictably.",
    "Bewildered: AP may only be spent on movement. Roll 1d8 for direction. Considered Catatonic."
  ], pairedPositive: "clarity" },
  tainted:     { label: "MASTERY.Condition.tainted",     resistAttr: "endurance",    tiers: [
    "Dosed: Penalty -1 to all rolls.",
    "Blighted: Penalty -2 to all rolls. Impotence on all rolls. Movement halved. Lose 1 Health at end of turn.",
    "Corrupted: Penalty -3 to all rolls. Impotence on all rolls. Movement halved. Cannot take reactions. Lose 2 Health at end of turn."
  ], pairedPositive: "fortified" },
  infected:    { label: "MASTERY.Condition.infected",    resistAttr: "endurance",    tiers: [
    "Afflicted: Rest is treated as 1 stage lower.",
    "Sickened: Rest is treated as 2 stages lower. Cannot recover Health from meals or rations.",
    "Diseased: Cannot benefit from rest. Cannot recover Health or magan except by magical healing."
  ], pairedPositive: "fortified" },
  charmed:     { label: "MASTERY.Condition.charmed",     resistAttr: "wisdom",       tiers: [
    "Lured: Regards source as trusted ally; cannot willingly harm. Complies with non-line-crossing requests.",
    "Beguiled: Regards source as trusted ally. Personality dulled; complies even with harmful requests unless self-endangering.",
    "Enthralled: Identity subsumed by devotion to source. Complies with all requests except direct self-harm."
  ], pairedPositive: "warded" },
  controlled:  { label: "MASTERY.Condition.controlled",  resistAttr: "charisma",     tiers: [
    "Compelled: Controller directs 1 AP with a simple command. Target retains 1 AP.",
    "Possessed: Controller directs both AP. Mundane actions and familiar spells.",
    "Dominated: Controller directs both AP with full access to target's capabilities. Self-harm allows a CHA trial to resist."
  ], pairedPositive: "warded" }
};

MASTERY.chainedPositiveConditions = {
  invigorated: { label: "MASTERY.Condition.invigorated", tiers: [
    "Energized: Dominance on physical rolls.",
    "Empowered: Dominance on physical rolls. Bonus +1 to physical rolls.",
    "Tireless: Dominance on all rolls. Bonus +2 to all rolls."
  ], pairedNegatives: ["exhausted"], pairing: "1:1" },
  inspired:    { label: "MASTERY.Condition.inspired", tiers: [
    "Rallied: Dominance on mental rolls.",
    "Emboldened: Dominance on mental rolls. Bonus +1 to attribute and mastery trials.",
    "Fearless: Dominance on mental rolls. Bonus +2 to attribute and mastery trials. Superiority on attack, defense, and spell damage rolls."
  ], pairedNegatives: ["demoralized"], pairing: "1:1" },
  clarity:     { label: "MASTERY.Condition.clarity", tiers: [
    "Focused: Bonus +1 to mastery trials.",
    "Lucid: Bonus +1 to mastery trials. +1 Mastery DC.",
    "Transcendent: Bonus +1 to mastery trials. +2 Mastery DC."
  ], pairedNegatives: ["disoriented"], pairing: "1:1" },
  hastened:    { label: "MASTERY.Condition.hastened", tiers: [
    "Quickened: Bonus +1 to physical rolls. Agility tier +1.",
    "Alert: Bonus +2 to physical rolls. Agility tier +1. Act one phase earlier.",
    "Hasted: Bonus +3 to physical rolls. Agility tier +1. Act one phase earlier. +1 AP."
  ], pairedNegatives: ["impaired", "restricted"], pairing: "dual" },
  fortified:   { label: "MASTERY.Condition.fortified", tiers: [
    "Girded: +1 mundane and primal resistance.",
    "Hardened: +2 mundane and primal resistance. Recover 1 Health at end of turn.",
    "Robust: +3 mundane and primal resistance. Recover 1 Health at end of turn."
  ], pairedNegatives: ["tainted", "infected"], pairing: "dual" },
  warded:      { label: "MASTERY.Condition.warded", tiers: [
    "Buffered: Dominance on attribute trials. +1 resistance to magic damage.",
    "Shielded: Dominance on attribute trials. +2 resistance to magic damage.",
    "Impervious: Dominance on attribute trials. +3 resistance to magic damage."
  ], pairedNegatives: ["charmed", "controlled"], pairing: "dual" }
};

MASTERY.neutralConditions = {
  // conditions_revised › Concealed (rewritten 2026-10-18); per viewer — helpers/concealment.mjs.
  concealed: { label: "MASTERY.Condition.concealed", tiers: [
    "Obscured: You can make out a shape. An attack against it from beyond 5 feet, with a ranged or reach weapon, requires an Aiming Trial with its DC increased by 2. A hiding creature is treated as flanking its target.",
    "Shrouded: You know the direction, not the place. The creature cannot be directly targeted. A hiding creature's attacks impose Inferiority on the target's defense.",
    "Hidden: You do not know where it is. The creature cannot be directly targeted. A hiding creature's attacks cannot be defended against."
  ] },
  cover:     { label: "MASTERY.Condition.cover", tiers: [
    "Partial Cover: Aiming Trial DC +2. +2 to trials against AoE / single-target damage spells.",
    "Majority Cover: Aiming Trial DC +4. +4 to trials against AoE / single-target damage spells.",
    "Total Cover: Cannot be targeted by ranged / LoS-requiring spells. AoE may still affect depending on epicenter."
  ] },
  unbound:   { label: "MASTERY.Condition.unbound", tiers: [
    "Fleet: +2 movement. Can jump as part of movement. Must begin and end movement on a surface per AP.",
    "Suspended: 3D movement at half speed. One axis per AP (horizontal or vertical). Water walking included. Requires concentration.",
    "Soaring: 3D movement at full speed in any direction. Immune to Prone. Requires concentration."
  ] }
};

/**
 * Simple conditions. Some carry a T-cost for spell casting (Prone T2,
 * Blinded T3, Deafened T1, Attrition T1) — the tier here is that cost,
 * not a level. Effect text is the full mechanical description.
 */
MASTERY.simpleConditions = {
  helpless:    { label: "MASTERY.Condition.helpless",    tCost: null, effect: "Cannot make defense rolls. Lose Agility contribution to armor resistance. Ranged attacks auto-hit. Auto-fail Agility and Physique trials. A creature that is also Catatonic auto-fails Strength trials." },
  catatonic:   { label: "MASTERY.Condition.catatonic",   tCost: null, effect: "Cannot cast spells, speak, or concentrate (loses active concentration). Auto-fail mental attribute trials. Physical body unaffected." },
  unconscious: { label: "MASTERY.Condition.unconscious", tCost: null, effect: "Considered Helpless and Catatonic. Unaware of surroundings and events." },
  prone:       { label: "MASTERY.Condition.prone",       tCost: 2,    effect: "On the ground. Standing costs 1 AP. Inferiority on attack and defense. Enemies have Superiority on melee, Inferiority on ranged against you. Movement 1 per AP. Cannot use weapon maneuvers." },
  blinded:     { label: "MASTERY.Condition.blinded",     tCost: 3,    effect: "Cannot see. Treats all other creatures as Concealed T3. 1 AP + Perception trial (DC = source) to make a single attack or defense with Impotence and Inferiority." },
  deafened:    { label: "MASTERY.Condition.deafened",    tCost: 1,    effect: "Cannot hear. Auto-fail hearing-related Perception trials. Spells with verbal components require a Miscast trial." },
  injured:     { label: "MASTERY.Condition.injured",     tCost: null, effect: "Each untreated Injury applies a cumulative Penalty -1 to all rolls. Injuries do not deteriorate naturally without treatment.", counter: true },
  dead:        { label: "MASTERY.Condition.dead",        tCost: null, effect: "The character is dead. No actions, no AP regen, no recovery except by GM/system-specific revival. Token gains the DEFEATED overlay." },

  // Round-locked declaration flags. Toggle these via the maneuvers
  // panel; they're auto-cleared at combat round-start by turn-events.
  // `apDelta` describes the net AP change on toggle-on (reversed on
  // toggle-off); handleDeclarationToggle applies it symmetrically.
  // GM adjudicates any mid-round mismatch via the sheet's AP +/-.
  // `wieldRequirement` is the transient half of the maneuver's prereq
  // that must remain satisfied round-to-round — the wielded-weapon
  // shape and the active combat style. Shape matches what
  // checkPrerequisite() consumes, so the auto-clear hook can hand it
  // straight to that helper and reuse existing logic (weaponType,
  // anyMelee, arrays, both-hand span). Null = no wielding constraint,
  // so wielding changes never invalidate the declaration (Deflect).
  deflect:     { label: "MASTERY.Condition.deflect",     tCost: null, effect: "You cannot attack this round. You can defend against up to 3 attacks this round (instead of the normal 2).", declaration: true, apCost: 2, apDelta: 1, wieldRequirement: null },
  fend:        { label: "MASTERY.Condition.fend",        tCost: null, effect: "You make no attacks this round. Defend against up to 4 melee attacks, alternating hands; each defense uses the weapon's die in place of your attribute tier die with Impotence and Inferiority.", declaration: true, apCost: 2, apDelta: 2, wieldRequirement: { wielded: { anyMelee: true }, combatStyleActive: "twoWeapon" } },
  mordhau:     { label: "MASTERY.Condition.mordhau",     tCost: null, effect: "Your sword deals Crushing damage this round. Your attacks and defense rolls have Inferiority.", declaration: true, apCost: 0, apDelta: 0, wieldRequirement: { wielded: { weaponType: "swords" }, combatStyleActive: "twoHanded" } },

  // Exposed — self-debuff applied by maneuvers that trade defensive
  // posture for offensive commitment (Wrath, Cleave, Throwing the
  // Point). While active, all attacks against this actor gain
  // Dominance. Auto-clears at the start of the owner's next turn
  // (turn-events onCombatTurn). Not a declaration — applied
  // automatically after the maneuver's attack fires, not toggled.
  exposed:     { label: "MASTERY.Condition.exposed",     tCost: null, effect: "All attacks against you gain Dominance until the start of your next turn." },

  // Provoked — target failed a Provoke check and must, on their next
  // turn, either move toward the provoker or make an attack against
  // them. GM enforces the constraint at the table; the tag is here so
  // the player-side sheet shows the state and the flag is queryable
  // by future automation.
  provoked:    { label: "MASTERY.Condition.provoked",    tCost: null, effect: "On your next turn you must either move toward the provoker or make an attack against them." }
};

/**
 * Attrition types — each is a stackable persistent-damage instance.
 * Damage type maps to armor resistance where relevant. Stack count is
 * unbounded above 0; healing / rest reduces via the sheet's − button.
 */
MASTERY.attritionTypes = {
  bleeding:   { label: "MASTERY.Condition.attritionBleeding",   damageType: null,      note: "Mundane untyped damage — no resistance applies." },
  burning:    { label: "MASTERY.Condition.attritionBurning",    damageType: "fire",    note: "Fire damage; Fire resistance applies." },
  freezing:   { label: "MASTERY.Condition.attritionFreezing",   damageType: "sea",     note: "Sea damage; Sea resistance applies." },
  corroding:  { label: "MASTERY.Condition.attritionCorroding",  damageType: "sea",     note: "Sea damage (acids, caustics); Sea resistance applies." },   // conditions_revised 2026-10-09
  arcing:     { label: "MASTERY.Condition.attritionArcing",     damageType: "sky",     note: "Sky damage; Sky resistance applies." },
  fracturing: { label: "MASTERY.Condition.attritionFracturing", damageType: "stone",   note: "Stone damage; Stone resistance applies." },
  withering:  { label: "MASTERY.Condition.attritionWithering",  damageType: "primal",  note: "Primal damage; Primal resistance applies." },
  decaying:   { label: "MASTERY.Condition.attritionDecaying",   damageType: "profane", note: "Profane damage; Profane resistance applies." },
  searing:    { label: "MASTERY.Condition.attritionSearing",    damageType: "sacred",  note: "Sacred damage; Sacred resistance applies." },
  unraveling: { label: "MASTERY.Condition.attritionUnraveling", damageType: "void",    note: "Void damage; Void resistance applies." }
};

/* ============================================================
 * TRIAL DIFFICULTY (reference — for future use)
 * ============================================================ */

MASTERY.trialDifficulty = {   // Mastery System › Trial Difficulty (renumbered 2026-10-20)
  effortless:      2,
  easy:            3,
  straightforward: 4,
  tricky:          5,
  difficult:       7,
  intricate:       9,
  sophisticated:  11,
  challenging:    13,
  ambitious:      15,
  heroic:         17,
  unfathomable:   19,
  immeasurable:   21,
  impossible:     23
};

/* ============================================================
 * NPC RANKS
 *
 * Source: Monster Manual Rules (revised) — Rank, Division, DTD, AP,
 * ability slot, and trial base die per rank.
 *
 * `offset`         — Division = Tier + offset. Used for DTD lookup,
 *                    resistance budget, and health formulas.
 * `trialBaseDie`   — the die added to a creature's TD for attribute /
 *                    mastery trials (Minion 1d2 through Legendary 1d12).
 * `rankMult`       — resistance budget = Tier × rankMult × 5.
 * `ap` / `maxAttacks` / `phasesActive` — standard combat resources.
 *   Epic  = 2 AP per phase across 2 phases (4 total).
 *   Legendary = 2 AP per phase across 3 phases (6 total).
 *   Phase enforcement is deferred to Stage 7; MVP grants total AP as
 *   a lump each round and the GM enforces phase gating by hand.
 * `abilitySlots`   — target count (diagnostic, not a hard limit). Per
 *   the rules, Adept "1-2", Leader "2-3 (must include a buff)",
 *   Champion "3+", Master "4", Epic/Legendary creature-specific.
 * ============================================================ */

MASTERY.npcRanks = {
  minion:    { label: "MASTERY.NpcRank.minion",    offset: 0, trialBaseDie: { c: 1, s: 2 },  rankMult: 1, ap: 2, maxAttacks: 2, phasesActive: 1, abilitySlots: 0 },
  adept:     { label: "MASTERY.NpcRank.adept",     offset: 1, trialBaseDie: { c: 1, s: 3 },  rankMult: 2, ap: 2, maxAttacks: 2, phasesActive: 1, abilitySlots: 2 },
  leader:    { label: "MASTERY.NpcRank.leader",    offset: 2, trialBaseDie: { c: 1, s: 4 },  rankMult: 3, ap: 2, maxAttacks: 2, phasesActive: 1, abilitySlots: 3 },
  champion:  { label: "MASTERY.NpcRank.champion",  offset: 3, trialBaseDie: { c: 1, s: 6 },  rankMult: 4, ap: 3, maxAttacks: 2, phasesActive: 1, abilitySlots: 4 },
  master:    { label: "MASTERY.NpcRank.master",    offset: 4, trialBaseDie: { c: 1, s: 8 },  rankMult: 5, ap: 3, maxAttacks: 2, phasesActive: 1, abilitySlots: 4 },
  epic:      { label: "MASTERY.NpcRank.epic",      offset: 5, trialBaseDie: { c: 1, s: 10 }, rankMult: 6, ap: 4, maxAttacks: 2, phasesActive: 2, abilitySlots: 5 },
  legendary: { label: "MASTERY.NpcRank.legendary", offset: 6, trialBaseDie: { c: 1, s: 12 }, rankMult: 7, ap: 6, maxAttacks: 2, phasesActive: 3, abilitySlots: 6 }
};

MASTERY.npcRankKeys = Object.keys(MASTERY.npcRanks);

/**
 * DTD (Division Tier Die) for a given tier + rank.
 * Minions always d2. Adept+ uses tierToDie(tier + rankOffset).
 */
export function dtdForTierRank(tier, rankKey) {
  const rank = MASTERY.npcRanks[rankKey];
  if (!rank) return { c: 0, s: 0 };
  if (rankKey === "minion") return { c: 1, s: 2 };
  const division = (Number(tier) || 1) + rank.offset;
  return tierToDie(division);
}

/**
 * Resistance budget = Tier × rankMult × 5.
 */
export function resistanceBudgetForTierRank(tier, rankKey) {
  const rank = MASTERY.npcRanks[rankKey];
  if (!rank) return 0;
  return (Number(tier) || 1) * rank.rankMult * 5;
}

/* ============================================================
 * NPC TIER BUDGET (target sum of attribute tiers, ~2 tolerance)
 * Source: Monster Manual Rules — Tier Budget table.
 * ============================================================ */

MASTERY.npcTierBudget = {
  minion:    { 1:  8, 2:  8, 3:  8, 4:  8, 5:  8, 6:  8, 7:  8 },
  adept:     { 1: 12, 2: 18, 3: 24, 4: 30, 5: 36, 6: 42, 7: 48 },
  leader:    { 1: 14, 2: 20, 3: 26, 4: 32, 5: 38, 6: 44, 7: 50 },
  champion:  { 1: 16, 2: 22, 3: 28, 4: 34, 5: 40, 6: 46, 7: 52 },
  master:    { 1: 18, 2: 24, 3: 30, 4: 36, 5: 42, 6: 48, 7: 54 },
  epic:      { 1: 20, 2: 28, 3: 36, 4: 44, 5: 52, 6: 60, 7: 68 },
  legendary: { 1: 24, 2: 32, 3: 40, 4: 48, 5: 56, 6: 64, 7: 72 }
};

export function tierBudgetForTierRank(tier, rankKey) {
  const t = Number(tier) || 1;
  const clamped = Math.min(7, Math.max(1, t));
  return MASTERY.npcTierBudget[rankKey]?.[clamped] ?? 0;
}

/* ============================================================
 * NPC CLASSIFICATIONS + KINGDOMS
 *
 * Every creature has: classification, kingdom, and (for Primordial)
 * a subForm identifying its elemental affinity. The classification
 * package (immunity + vulnerability + connected form) is derived.
 * ============================================================ */

MASTERY.npcClassifications = {
  asura:      { label: "MASTERY.Classification.asura",      category: "spiritual", immunity: "sacred",  vulnerability: "profane", connectedForm: "sacred" },
  daeva:      { label: "MASTERY.Classification.daeva",      category: "spiritual", immunity: "profane", vulnerability: "sacred",  connectedForm: "profane" },
  fae:        { label: "MASTERY.Classification.fae",        category: "spiritual", immunity: "primal",  vulnerability: "void",    connectedForm: "primal" },
  morphon:    { label: "MASTERY.Classification.morphon",    category: "spiritual", immunity: "void",    vulnerability: "primal",  connectedForm: "void" },
  primordial: { label: "MASTERY.Classification.primordial", category: "elemental", immunity: null,      vulnerability: null,      connectedForm: null }, // depends on subForm
  mortal:     { label: "MASTERY.Classification.mortal",     category: "mortal",    immunity: null,      vulnerability: null,      connectedForm: "void" }
};

MASTERY.npcClassificationKeys = Object.keys(MASTERY.npcClassifications);

MASTERY.npcKingdoms = {
  asura:      [ { key: "ameshaSpenta", label: "MASTERY.Kingdom.ameshaSpenta" }, { key: "yazata",     label: "MASTERY.Kingdom.yazata" } ],
  daeva:      [ { key: "div",          label: "MASTERY.Kingdom.div" },          { key: "druj",       label: "MASTERY.Kingdom.druj" } ],
  fae:        [ { key: "de",           label: "MASTERY.Kingdom.de" },           { key: "tuatha",     label: "MASTERY.Kingdom.tuatha" }, { key: "sidhe",    label: "MASTERY.Kingdom.sidhe" } ],
  morphon:    [ { key: "akasha",       label: "MASTERY.Kingdom.akasha" },       { key: "sora",       label: "MASTERY.Kingdom.sora" } ],
  primordial: [ { key: "protogenoi",   label: "MASTERY.Kingdom.protogenoi" },   { key: "autochthon", label: "MASTERY.Kingdom.autochthon" }, { key: "behemoth", label: "MASTERY.Kingdom.behemoth" } ],
  mortal:     [ { key: "folk",         label: "MASTERY.Kingdom.folk" },         { key: "beast",      label: "MASTERY.Kingdom.beast" } ]
};

// Primordial subforms (Fire/Sea/Sky/Stone) determine the package for
// creatures whose classification is Primordial.
MASTERY.npcPrimordialForms = {
  fire:  { label: "MASTERY.PrimordialForm.fire",  immunity: "fire",  vulnerability: "sea",   connectedForm: "fire" },
  sea:   { label: "MASTERY.PrimordialForm.sea",   immunity: "sea",   vulnerability: "fire",  connectedForm: "sea" },
  sky:   { label: "MASTERY.PrimordialForm.sky",   immunity: "sky",   vulnerability: "stone", connectedForm: "sky" },
  stone: { label: "MASTERY.PrimordialForm.stone", immunity: "stone", vulnerability: "sky",   connectedForm: "stone" }
};

/**
 * Resolve the classification package (immunity, vulnerability, connectedForm)
 * for a creature. Handles Primordial subForm resolution.
 */
export function classificationPackage(classificationKey, primordialSubForm) {
  const cls = MASTERY.npcClassifications[classificationKey];
  if (!cls) return { immunity: null, vulnerability: null, connectedForm: null };
  if (classificationKey === "primordial") {
    const sub = MASTERY.npcPrimordialForms[primordialSubForm];
    if (sub) return { immunity: sub.immunity, vulnerability: sub.vulnerability, connectedForm: sub.connectedForm };
    return { immunity: null, vulnerability: null, connectedForm: null };
  }
  return { immunity: cls.immunity, vulnerability: cls.vulnerability, connectedForm: cls.connectedForm };
}

/**
 * Default connected forms by classification. Mortal Beasts connect to
 * Primal only (Jon 2026-09-26); stat-block tags override per creature.
 * Returns array of connected forms.
 */
export function connectedFormsFor(classificationKey, kingdomKey, primordialSubForm) {
  const pkg = classificationPackage(classificationKey, primordialSubForm);
  // Mortal Beasts connect to Primal only (Magic Mastery § Exorcise,
  // Connected Form — Jon 2026-09-26). A creature's own stat-block tag
  // (system.connectedFormsTag) overrides this default.
  if (classificationKey === "mortal" && kingdomKey === "beast") return ["primal"];
  return pkg.connectedForm ? [pkg.connectedForm] : [];
}

/* ============================================================
 * SIZE TABLE
 * Source: Monster Manual Rules — Size table. Applies universally to
 * PCs and NPCs (Jon 2026-09-22 — the formula is universal, not NPC-
 * scoped as the earlier prefix suggested). Legacy names npcSizeTable
 * / npcLocomotion renamed to sizeTable / locomotion.
 *
 * Total squares → mechanical bonuses (health dice, attack, defense,
 * speed modifier). Small (½ square, Halfling / Gnome PCs and most
 * ½-square beasts) has +1 defense / -1 speed instead of size bonuses.
 * ============================================================ */

MASTERY.sizeTable = [
  { squares: 0.5, healthBonusDice: 0, attackBonus: 0, defenseBonus: 1, speedMod: -1 },
  { squares: 1,   healthBonusDice: 0, attackBonus: 0, defenseBonus: 0, speedMod:  0 },
  { squares: 2,   healthBonusDice: 2, attackBonus: 2, defenseBonus: 0, speedMod:  2 },
  { squares: 4,   healthBonusDice: 4, attackBonus: 4, defenseBonus: 0, speedMod:  4 },
  { squares: 6,   healthBonusDice: 6, attackBonus: 6, defenseBonus: 0, speedMod:  6 },
  { squares: 9,   healthBonusDice: 8, attackBonus: 8, defenseBonus: 0, speedMod:  8 }
];

/**
 * Return the size row for a given total squares (rounds DOWN to the
 * nearest table entry). Anything < 1 is treated as ½.
 */
export function sizeRowForSquares(squares) {
  const s = Number(squares) || 1;
  if (s < 1) return MASTERY.sizeTable[0];      // ½
  let row = MASTERY.sizeTable[1];               // 1
  for (const r of MASTERY.sizeTable) {
    if (s >= r.squares) row = r;
  }
  return row;
}

/* ============================================================
 * LOCOMOTION
 *
 * Speed = 3 + AGI Tier + Size Modifier + Locomotion Bonus (per mode).
 * Universal — PC and NPC use the same table (Jon 2026-09-22).
 *   - Quadruped: +4 land
 *   - Flying:    +4 fly
 *   - Swimming:  +4 swim
 *   - Climbing:  moves at land speed vertically (no separate bonus)
 *   - Burrowing: half land speed (no separate bonus)
 * ============================================================ */

MASTERY.locomotion = {
  quadruped: { label: "MASTERY.Locomotion.quadruped", speedBonus: 4, mode: "land" },
  flying:    { label: "MASTERY.Locomotion.flying",    speedBonus: 4, mode: "fly" },
  swimming:  { label: "MASTERY.Locomotion.swimming",  speedBonus: 4, mode: "swim" },
  climbing:  { label: "MASTERY.Locomotion.climbing",  speedBonus: 0, mode: "climb" },
  burrowing: { label: "MASTERY.Locomotion.burrowing", speedBonus: 0, mode: "burrow" }
};

MASTERY.locomotionKeys = Object.keys(MASTERY.locomotion);

/* ============================================================
 * CHANTMENT — Level → Tier progression
 *
 * The Avenger / Bahador / Paladin Chantment ability grants a
 * "Chantment tier die" that adds to imbued weapon damage. Tier
 * increases at specific character levels. The tier die itself
 * uses the universal `tierToTierDie` helper (Jon 2026-09-22 —
 * "the relationship between Tier and Tier Die is universal;
 * tie into it") so we only encode the level→tier mapping here.
 *
 *   L1  → T1 (1d2)
 *   L4  → T2 (1d3)
 *   L8  → T3 (1d4)
 *   L12 → T4 (1d6)
 *   L16 → T5 (1d8)
 *   L20 → T6 (1d10)
 *   L24 → T7 (1d12)
 * ============================================================ */

MASTERY.chantmentLevelBreakpoints = [
  { level: 1,  tier: 1 },
  { level: 4,  tier: 2 },
  { level: 8,  tier: 3 },
  { level: 12, tier: 4 },
  { level: 16, tier: 5 },
  { level: 20, tier: 6 },
  { level: 24, tier: 7 }
];

/** Given a character level, return the Chantment tier (1-7). */
export function chantmentTierForLevel(level) {
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  let tier = 1;
  for (const bp of MASTERY.chantmentLevelBreakpoints) {
    if (lvl >= bp.level) tier = bp.tier;
  }
  return tier;
}

/* ============================================================
 * DOMINION — Level → Tier progression
 *
 * The Cleric's Dominion class ability grants a "Dominion tier die"
 * that scales zone effects (Preservation, Retribution, Malediction
 * multi-fires, resistance amounts, etc.). Tier gates the number of
 * picked effects the Cleric has access to — one pick per tier
 * from T1 through T7. Level→tier mapping is identical to
 * Chantment (both use the universal tier-die progression).
 * (Jon 2026-09-22 — Cleric arc.)
 *
 *   L1  → T1 (1d2)
 *   L4  → T2 (1d3)
 *   L8  → T3 (1d4)
 *   L12 → T4 (1d6)
 *   L16 → T5 (1d8)
 *   L20 → T6 (1d10)
 *   L24 → T7 (1d12)
 * ============================================================ */

MASTERY.dominionLevelBreakpoints = [
  { level: 1,  tier: 1 },
  { level: 4,  tier: 2 },
  { level: 8,  tier: 3 },
  { level: 12, tier: 4 },
  { level: 16, tier: 5 },
  { level: 20, tier: 6 },
  { level: 24, tier: 7 }
];

/** Given a character level, return the Dominion tier (1-7). */
export function dominionTierForLevel(level) {
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  let tier = 1;
  for (const bp of MASTERY.dominionLevelBreakpoints) {
    if (lvl >= bp.level) tier = bp.tier;
  }
  return tier;
}

/* ============================================================
 * NPC ATTACK / DEFENSE ACTION TYPES
 * For the abilities list on the sheet — what kind of action the
 * ability is (used to determine whether it counts against max
 * attacks per round).
 * ============================================================ */

MASTERY.npcActionTypes = {
  attack:   { label: "MASTERY.NpcActionType.attack" },   // counts against maxAttacks
  action:   { label: "MASTERY.NpcActionType.action" },   // does not count
  reaction: { label: "MASTERY.NpcActionType.reaction" }, // triggered
  movement: { label: "MASTERY.NpcActionType.movement" }, // move action
  passive:  { label: "MASTERY.NpcActionType.passive" }   // always-on
};

MASTERY.npcActionTypeKeys = Object.keys(MASTERY.npcActionTypes);
