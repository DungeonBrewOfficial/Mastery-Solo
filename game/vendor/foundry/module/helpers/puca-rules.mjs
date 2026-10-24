/**
 * Puca rules with no dependencies — safe to import from the NPC data
 * model (derived data). Actions and sheet context live in puca.mjs.
 */

export const NATURAL_WEAPON = "Natural Weapon";

export const PUCA_FORMS = {
  // Utility forms' natural attack types (Jon 2026-09-24), matched to the
  // Mortal Beasts stat blocks: bites and talons Piercing, kicks Crushing.
  // Footprint + locomotion per form (source § Forms, 2026-09-25): "½
  // square footprint … Speed: +4 land", "Flight … +4 fly", "2 square
  // footprint … +4 land", combat forms "begin at 1 square. Speed: +4 land."
  smallScout:  { label: "Small Scout",  combat: false, damageType: "piercing", squares: 0.5, loco: "quadruped" },
  aerialScout: { label: "Aerial Scout", combat: false, damageType: "piercing", squares: 0.5, loco: "flying" },
  mount:       { label: "Mount",        combat: false, damageType: "crushing", squares: 2,   loco: "quadruped" },
  bear:        { label: "Bear",         combat: true, damageType: "cutting",   squares: 1,   loco: "quadruped" },
  wolf:        { label: "Wolf",         combat: true, damageType: "piercing",  squares: 1,   loco: "quadruped" },
  boar:        { label: "Boar",         combat: true, damageType: "piercing",  squares: 1,   loco: "quadruped" },
  // 2026-10-22: new combat forms. Great Serpent "Speed: +0 land"; Great Raptor "+4 fly; no land bonus".
  greatCat:     { label: "Great Cat",     combat: true, damageType: "cutting",  squares: 1, loco: "quadruped" },
  greatSerpent: { label: "Great Serpent", combat: true, damageType: "piercing", squares: 1, loco: "none" },
  greatRaptor:  { label: "Great Raptor",  combat: true, damageType: "piercing", squares: 1, loco: "flying" }
};

/**
 * Combat forms known (Core Classes 2026-10-22): "At Tier 1, choose your
 * Puca's first combat form. It learns another at Tiers 2, 4, and 6. Each
 * combat form comes with all of its abilities." Utility forms are always
 * available.
 */
export const knownFormCap = (tier) => { const t = Number(tier) || 1; return t >= 6 ? 4 : t >= 4 ? 3 : t >= 2 ? 2 : 1; };
export const knownForms = (sys) => (Array.isArray(sys?.companion?.knownForms) ? sys.companion.knownForms : []).filter(k => PUCA_FORMS[k]?.combat);
export const canTakeForm = (sys, key) => !!PUCA_FORMS[key] && (!PUCA_FORMS[key].combat || knownForms(sys).includes(key));

/**
 * The Puca's body in its current form: footprint + locomotion. Form
 * Mastery takes combat forms to 2 squares — the Size table then supplies
 * +2 attack / +2 speed ("size bonuses apply"), so nothing adds it twice.
 */
export function pucaBody(sys) {
  const key = currentForm(sys);
  const f = PUCA_FORMS[key];
  const squares = (f.combat && hasPick(sys, "formMastery")) ? 2 : f.squares;
  return { squares, locomotion: f.loco && f.loco !== "none" ? { [f.loco]: true } : {} };
}

export function currentForm(sys) {
  const k = String(sys?.companion?.form || "");
  return PUCA_FORMS[k] ? k : "smallScout";
}

export function hasPick(sys, key) {
  return (sys?.companion?.picks || []).includes(key);
}

/**
 * Derived-data hook: Form Mastery bonuses beyond size. Combat forms get
 * theirs from the 2-square size row (pucaBody); the Mount gets "+2 speed".
 */
export function formMasteryBonus(sys) {
  if (!hasPick(sys, "formMastery")) return { attack: 0, speed: 0 };
  if (currentForm(sys) === "mount") return { attack: 0, speed: 2 };
  return { attack: 0, speed: 0 };
}

/** Data for the stored natural attack (creation + migration). */
export function naturalWeaponAttack(damageType = "piercing") {
  return { name: NATURAL_WEAPON, weapon: NATURAL_WEAPON, phase: "moderate", damageType,
    attribute: "wisdom", style: "natural", bonusFlat: 0, exploding: true };
}
