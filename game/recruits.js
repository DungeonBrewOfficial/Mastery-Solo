/**
 * RECRUITS AND NEW CHARACTERS (milestone 3; design/06-settlements.md,
 * Recruiting). A character rolled up by Mastery Core Classes: each
 * attribute's class dice, the 3 starting points, health and magan as tier
 * dice pools, the class's starting wealth and masteries, gear bought from
 * it, and the class's companion. Higher-level recruits are leveled up from
 * there, and cost their XP in silver pennies [Jon, 2026-10-24].
 */
import { CLASSES } from "./data/classes.js";
import { WEAPONS, ARMOR, SHIELDS } from "./data/arms.js";
import { SPELLS } from "./data/spells.js";
import { GEAR } from "./data/gear.js";
import { RECOMMENDED_DICE } from "./vendor/foundry/module/data/chargen-data.mjs";
import { PUCA_FORMS } from "./vendor/foundry/module/helpers/puca-rules.mjs";
import { computeClassMpTotal, pointsToScore } from "./vendor/foundry/module/config.mjs";
import { tierOf, dieOfTier } from "./mastery.js";
import { ATTRIBUTES, ensureAdvancement, invest, raiseAttribute, checkLevels, masteryTargets, cannotInvest } from "./advance.js";
import { add, ensureStores } from "./supplies.js";
import { squareAt } from "./world.js";

/** The recruit's class [Jon, 2026-10-24]: a d6 (1–5 human, 6 demihuman), then a d12 with Fighter on two faces, or a d7. */
export const HUMANS = ["Fighter", "Fighter", "Knight", "Ranger", "Thief", "Cleric", "Paladin", "Avenger", "Magus", "Bahador", "Druid", "Fili"];
export const DEMIHUMANS = ["Cursed", "Dwarf", "Gray Elf", "Sylvan Elf", "Gnome", "Halfling", "Orc"];
export function rollClass(rng, demihumanFrom = 6) {
  return rng.d(6) >= demihumanFrom ? DEMIHUMANS[rng.d(7) - 1] : HUMANS[rng.d(12) - 1];
}

/** Starting Wealth by Class (Equipment): 2d6 × a hundred or fifty, plus a base. */
const WEALTH = { Avenger: [100, 450], Bahador: [100, 450], Cleric: [50, 200], Cursed: [50, 50], Druid: [50, 50], Dwarf: [100, 400], Fighter: [100, 400],
  Fili: [50, 50], Gnome: [50, 200], "Gray Elf": [50, 50], Halfling: [50, 50], Knight: [100, 400], Magus: [50, 50], Orc: [50, 50], Paladin: [100, 450],
  Ranger: [50, 50], "Sylvan Elf": [50, 50], Thief: [50, 50] };

const NAMES = ["Aelfric", "Agnes", "Alard", "Amice", "Baldric", "Beatrix", "Benedict", "Berenga", "Cuthbert", "Cecily", "Dunstan", "Edith", "Eadric", "Emma",
  "Fulk", "Godiva", "Godric", "Hawise", "Hereward", "Isolde", "Joscelin", "Leofric", "Mabel", "Matilda", "Osbert", "Petronilla", "Ranulf", "Rohese",
  "Sibyl", "Sigeric", "Theobald", "Ulf", "Wymarc", "Wulfstan", "Ysmay", "Odo", "Aveline", "Hamelin", "Ida", "Walter"];

/** Roll a set like "3d10". */
const rollSet = (rng, set) => { const [, c, s] = /(\d+)d(\d+)/.exec(set); return Array.from({ length: Number(c) }, () => rng.d(Number(s))).reduce((a, b) => a + b, 0); };
/** A tier dice pool (Tier Dice Pools): one die for each tier up to the current one. */
const pool = (rng, tier) => Array.from({ length: tier }, (_, i) => rng.d(dieOfTier(i + 1)[1])).reduce((a, b) => a + b, 0);
const sizes = (set) => Number(/d(\d+)/.exec(set)[1]);

/**
 * Gear from the starting wealth [N, a first pass]: a weapon by the stronger
 * of Strength and Physique, a shield for a one-handed fighter whose class
 * allows one, the sturdiest armor the class may wear and the purse affords,
 * a bow for Rangers and Sylvan Elves, and an Adventurer's Pack. What's left
 * goes into the party's purse.
 */
const ARMOR_RANK = { None: 0, Light: 1, Medium: 2, Heavy: 3, Any: 3 };
const WEIGHT_RANK = { light: 1, medium: 2, heavy: 3 };
function outfitCharacter(m, cls, coin) {
  const c = CLASSES[cls];
  let left = coin;
  const pay = (n) => { left = Math.round((left - n) * 4) / 4; };
  const strong = m.attributes.strength > m.attributes.physique;
  const martial = ["grandMaster", "master"].includes(c.weaponCap);
  const shieldOk = c.equipment.shield !== "None" && martial;
  const weapon = WEAPONS[strong ? (shieldOk ? "Mace, Knobbed" : "Spear") : (martial ? "Backsword" : "Seax")] || WEAPONS["Seax"];
  m.weapons = [structuredClone(weapon)];
  pay(weapon.sp);
  if (["Ranger", "Sylvan Elf"].includes(cls)) { m.weapons.push(structuredClone(WEAPONS["Selfbow"])); pay(WEAPONS["Selfbow"].sp); }
  if (shieldOk && !weapon.twoHanded) { const s = SHIELDS["Heater"]; m.shield = { name: s.name, defense: s.defense, durability: s.durability, max: s.durability }; pay(s.sp); }
  const may = ARMOR_RANK[c.equipment.armor] ?? 0;
  const budget = left - GEAR["Adventurer's Pack"].sp - 20;
  const armor = Object.values(ARMOR).filter(a => WEIGHT_RANK[a.weightClass] <= may && a.sp <= budget).sort((x, y) => y.durability - x.durability || x.sp - y.sp)[0];
  if (armor) { m.armor = { name: armor.name, weightClass: armor.weightClass, durability: armor.durability, max: armor.durability, resistance: { ...armor.resistance } }; pay(armor.sp); }
  pay(GEAR["Adventurer's Pack"].sp);
  return left;
}

/** Starting masteries: each domain's level-1 points to Untrained, on what the character carries and the class leans toward. */
const SKILL_LEAN = { Fighter: ["athletics", "tactics", "alertness"], Knight: ["athletics", "tactics", "presence"], Ranger: ["wilderness", "alertness", "stealth"],
  Thief: ["alertness", "athletics", "presence"], Cleric: ["healer", "presence", "lore"], Paladin: ["athletics", "presence"], Avenger: ["athletics", "tactics"],
  Magus: ["lore", "spellcraft"], Bahador: ["athletics", "spellcraft"], Druid: ["healer", "presence"], Fili: ["presence", "lore", "alertness"],
  Cursed: ["spellcraft", "lore"], Dwarf: ["athletics", "blacksmith", "alertness"], "Gray Elf": ["alertness", "lore"], "Sylvan Elf": ["wilderness", "alertness"],
  Gnome: ["alertness", "lore"], Halfling: ["stealth", "alertness", "athletics"], Orc: ["athletics", "wilderness", "alertness"] };
function startingMasteries(m, cls) {
  const c = CLASSES[cls], t = masteryTargets(m);
  const spend = (domain, wanted) => {
    m.unspent[domain] = c.progression[domain] ? computeClassMpTotal(c.progression[domain], 1) : 0;
    for (const k of [...new Set([...wanted, ...t[domain]])]) if (m.unspent[domain] > 0 && t[domain].includes(k) && !cannotInvest(m, k)) invest(m, k);
    m.unspent[domain] = 0;
  };
  const styles = [m.shield ? "style:shield" : m.weapons[0].twoHanded ? "style:twoHanded" : "style:single", ...(m.weapons.some(w => w.ranged) ? ["style:ranged"] : [])];
  spend("weapon", [...m.weapons.map(w => `weapon:${w.type}`), ...styles, "style:single", "style:shield", "style:twoHanded", "style:ranged"]);
  const entropic = c.forms.filter(f => ["primal", "sacred", "profane", "void"].includes(f));
  spend("spell", [...entropic, ...c.forms].map(f => `form:${f}`));
  spend("skill", (SKILL_LEAN[cls] || []).map(k => `skill:${k}`));
  // Free skills start at Untrained (Druid's Wilderness, Thief's Stealth and Thievery, Paladin's Theurgic Lore, and the like).
  for (const k of c.skills.free) m.skills[k] = Math.max(m.skills[k] || 1, 2);
}

/** Abilities the game knows how to play, by class; the rest of a class's features are named on the sheet. */
function classAbilities(rng, m, cls) {
  const ab = [];
  if (cls === "Thief") ab.push("Opportunist", "Backstab");
  if (cls === "Paladin") { ab.push("Turn", "Imbue"); m.theurgy = { lore: 2, chantment: 1 }; }
  if (cls === "Cursed") {
    ab.push("Hard to Kill");
    // The curse, assigned (Core Classes, Cursed): each brings its own immunity.
    const curse = ["Horrific", "Insane", "Possessed", "Undead"][rng.d(4) - 1];
    m.curse = curse;
    if (curse === "Possessed") ab.push("Possessed");
    m.immune = [{ Horrific: "primal", Insane: "void", Possessed: "profane", Undead: "profane" }[curse]];
  }
  return ab;
}

/** A Druid's Puca or a Cursed's Agathion (Core Classes): Tier 1, its owner's die and its tier die, 6 mundane resistance. */
function companionFor(rng, m, cls) {
  if (cls === "Druid") {
    const forms = Object.keys(PUCA_FORMS).filter(k => PUCA_FORMS[k].combat);
    const form = forms[rng.d(forms.length) - 1];
    const label = PUCA_FORMS[form].label;
    const health = m.attributes.wisdom + rng.d(2) + rng.d(2);
    return { id: `${m.id}-puca`, name: `${m.name}'s ${label.toLowerCase()}`, kind: "puca", tier: 1, health, hp: health, speed: 8, form,
      attack: { name: label === "Bear" ? "Claws" : label === "Great Raptor" ? "Talons" : label === "Boar" ? "Tusks" : "Bite", type: PUCA_FORMS[form].damageType },
      resistance: 6, immune: ["primal"], ability: "Spell Conduit" };
  }
  if (cls === "Cursed") {
    const spirit = ["fae", "daeva", "morphon"][rng.d(3) - 1];
    const health = m.attributes.perception + rng.d(2) + rng.d(2);
    return { id: `${m.id}-agathion`, name: `${m.name}'s agathion`, kind: "agathion", spirit, tier: 1, health, hp: health, speed: 8, boundMagan: 1,
      attack: { name: "Horns", type: "crushing" }, resistance: 6, ability: spirit === "daeva" ? "Hellfire" : null };
  }
  return null;
}

/**
 * Roll up a character of a class at level 1 (Mastery Core Classes), then
 * level them to `level` with the points spent as the class leans.
 */
export function rollCharacter(rng, cls, { level = 1, taken = [] } = {}) {
  const c = CLASSES[cls];
  const dice = RECOMMENDED_DICE[cls];
  const names = NAMES.filter(n => !taken.includes(n));
  const name = names[rng.d(names.length) - 1] || `Recruit ${rng.d(999)}`;
  const id = `${name.toLowerCase()}-${rng.d(9999)}`;
  const pts = Object.fromEntries(ATTRIBUTES.map(a => [a, rollSet(rng, dice[a])]));
  // The 3 points for a level 1 character go to the attribute the class rolls biggest dice for.
  const main = [...ATTRIBUTES].sort((a, b) => sizes(dice[b]) - sizes(dice[a]))[0];
  pts[main] += 3;
  const attributes = Object.fromEntries(ATTRIBUTES.map(a => [a, pointsToScore(pts[a])]));
  const m = { id, name, cls, title: "", level: 1, xp: 0, attributes, attrPts: pts, skills: {}, weaponSkill: {}, styles: {}, spells: [], abilities: [], gear: [], recruit: true };
  m.health = pool(rng, tierOf(attributes.endurance)); m.hp = m.health;
  if (c.progression.spell && c.castingAttribute) {
    m.magan = pool(rng, tierOf(attributes[c.castingAttribute])); m.mp = m.magan;
    m.casting = { attr: c.castingAttribute, dc: 0, forms: {} };
  } else m.magan = 0;
  const [mult, base] = WEALTH[cls];
  const coin = (rng.d(6) + rng.d(6)) * mult + base;
  m.purse = outfitCharacter(m, cls, coin);
  ensureAdvancement(m);
  startingMasteries(m, cls);
  // Spells known: the ones the game has, in forms they've reached Untrained in, up to two.
  if (m.casting) m.spells = Object.keys(SPELLS).filter(n => (m.casting.forms[SPELLS[n].form] || 1) >= 2).slice(0, 2);
  m.abilities = classAbilities(rng, m, cls);
  m.features = c.hallmarks || [];
  const pet = companionFor(rng, m, cls);
  if (pet) { m.companion = pet; if (pet.boundMagan) { m.magan += 1; m.mp += 1; } }
  m.titleName = c.titles?.[0]?.title || null;
  m.worn = []; m.lock = {}; m.hungryDays = 0;
  if (level > 1) levelTo(rng, m, level);
  return m;
}

/** Level a fresh character to a level: the XP for it, then its points spent where the class leans. */
function levelTo(rng, m, level) {
  m.xp = CLASSES[m.cls].xp?.[level - 1] || 0;
  const fake = { party: { members: [m] } };
  checkLevels(fake, () => {}, rng);
  const dice = RECOMMENDED_DICE[m.cls];
  const order = [...ATTRIBUTES].sort((a, b) => sizes(dice[b]) - sizes(dice[a]));
  for (let i = 0; m.unspent.attr > 0 && i < 500; i++) raiseAttribute(fake, m, order[i % 3], rng, () => {});
  const owned = Object.keys(m.invest);
  for (const d of ["weapon", "spell", "skill", "style"]) {
    for (let guard = 0; m.unspent[d] > 0 && guard < 50; guard++) {
      const t = d === "style" ? owned.filter(k => k.startsWith("style:")) : owned.filter(k => (d === "weapon" ? /^(weapon|style):/ : d === "spell" ? /^form:/ : /^skill:/).test(k));
      const k = t.find(x => !cannotInvest(m, x, { free: d === "style" })) || masteryTargets(m)[d === "style" ? "weapon" : d]?.find(x => !cannotInvest(m, x, { free: d === "style" }));
      if (!k) break;
      invest(m, k, { free: d === "style" });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Who's available                                                      */

/** Recruits by settlement size (design/06-settlements.md, What each settlement offers). */
export function recruitCount(rng, size) {
  switch (size) {
    case "roadhouse": return rng.d(6) === 6 ? 1 : 0;
    case "village": return rng.d(2);
    case "town": return rng.d(3);
    case "city": return rng.d(4) + 1;
    case "metropolis": return rng.d(4) + rng.d(4);
    default: return 0;
  }
}
/** The highest level a settlement's recruits can be: towns up to two below the party, cities one below [Jon, 2026-10-24]. */
export function recruitCap(size, partyLevel) {
  if (size === "town") return Math.max(1, partyLevel - 2);
  if (size === "city" || size === "metropolis") return Math.max(1, partyLevel - 1);
  return 1;
}
/** What a recruit costs: nothing at level 1; above that, their XP in silver pennies. */
export const recruitCost = (m) => m.level > 1 ? m.xp : 0;

/* ------------------------------------------------------------------ */
/* Joining the party                                                    */

export const PARTY_SIZE = 4; // the baseline party [Jon, 2026-10-23]
const living = (state) => state.party.members.filter(m => !m.dead);
const here = (state) => { const sq = squareAt(state.world, state.party.x, state.party.y); return sq?.settlement ? { ...sq.settlement, key: `${state.party.x},${state.party.y}` } : null; };

/** A character joins: their purse goes into the party's, their Adventurer's Pack into its stores, and empty roles fill. */
export function join(state, m) {
  ensureStores(state);
  state.party.members.push(m);
  state.party.coin = Math.round((state.party.coin + (m.purse || 0)) * 4) / 4;
  m.purse = 0;
  add(state, "Adventurer's Pack", 1, { wearer: m.id });
  const roles = state.party.roles;
  for (const r of ["scout", "watchman"]) if (!roles[r] || !living(state).some(x => x.id === roles[r])) roles[r] = m.id;
  // Scout and Watchman are different people when there are two to go round.
  if (roles.scout === roles.watchman) roles.watchman = living(state).find(x => x.id !== roles.scout)?.id || roles.scout;
  for (const r of ["forager", "cook", "healer", "smith"]) if (roles[r] && !living(state).some(x => x.id === roles[r])) roles[r] = null;
}

/**
 * Who's in this settlement looking for work: rolled once each visit by its
 * size, each with the class roll and a level up to what the place offers.
 */
export function recruitsHere(state, rng) {
  const s = here(state);
  if (!s) return [];
  const visit = state.visitId || 0;
  if (state.recruits?.key === s.key && state.recruits.visit === visit) return state.recruits.list;
  const lvl = Math.max(1, Math.round(living(state).reduce((n, m) => n + m.level, 0) / Math.max(1, living(state).length)));
  const cap = recruitCap(s.size, lvl);
  const taken = state.party.members.map(m => m.name);
  const list = [];
  for (let i = recruitCount(rng, s.size); i > 0; i--) {
    const m = rollCharacter(rng, rollClass(rng), { level: rng.d(cap), taken: [...taken, ...list.map(x => x.name)] });
    list.push(m);
  }
  state.recruits = { key: s.key, visit, list };
  return list;
}
/** Take on a recruit: free at level 1, their XP in silver pennies above it. */
export function hire(state, note, id) {
  const list = state.recruits?.list || [];
  const m = list.find(x => x.id === id);
  if (!m || living(state).length >= PARTY_SIZE) return false;
  const cost = recruitCost(m);
  if (state.party.coin < cost) { note(`${m.name} wants ${cost} sp to join.`); return false; }
  state.party.coin -= cost;
  state.recruits.list = list.filter(x => x !== m);
  join(state, m);
  note(`${m.name}, a level ${m.level} ${m.cls}, joins the party${cost ? ` for ${cost} sp` : ""}${m.companion ? `, with ${m.companion.name}` : ""}.`, "reward");
  return true;
}
/** Build a level 1 character of a class instead; the player is assumed to have found someone (design/06-settlements.md). */
export function build(state, rng, note, cls) {
  if (!here(state) || living(state).length >= PARTY_SIZE || !CLASSES[cls]) return null;
  const m = rollCharacter(rng, cls, { taken: state.party.members.map(x => x.name) });
  join(state, m);
  note(`${m.name}, a level 1 ${cls}, joins the party${m.companion ? `, with ${m.companion.name}` : ""}.`, "reward");
  return m;
}

/* ------------------------------------------------------------------ */
/* The next generation                                                  */

/**
 * When the last hero falls, the dynasty goes on (design/01-the-turn.md,
 * Ending a Run): the map and what the old heroes found stay, and a new party
 * of level 1 characters sets out from the home village. Each class is the
 * player's choice, or rolled.
 */
export function nextGeneration(state, rng, note, classes) {
  if (!state.over) return false;
  const d = (state.dynasty ||= { generation: 1, fallen: [] });
  d.fallen.push({ generation: d.generation, day: state.over.day, why: state.over.why, heroes: state.party.members.map(m => ({ name: m.name, cls: m.cls, level: m.level, dead: !!m.dead })) });
  d.generation += 1;
  const home = { x: 3, y: 3 }; // the home village (world.js, startDynasty)
  const p = state.party;
  Object.assign(p, { x: home.x, y: home.y, members: [], coin: 0, pelts: [], bankedXp: 0, food: [], stores: {}, water: 0, skins: 0, carry: 0,
    hours: { total: 0, fast: 0, marathon: 0 }, roles: { scout: null, watchman: null, forager: null, cook: null, healer: null, smith: null } });
  state.over = null; state.encounter = null; state.sign = null; state.following = null; state.battle = null; state.pending = null; state.target = null;
  state.hoursUsed = 0; state.morningDone = false; state.recruits = null; state.market = null;
  for (const cls of classes.slice(0, PARTY_SIZE)) {
    const m = rollCharacter(rng, cls === "roll" ? rollClass(rng) : cls, { taken: [...p.members.map(x => x.name), ...d.fallen.flatMap(f => f.heroes.map(h => h.name))] });
    join(state, m);
  }
  const roles = p.roles, ms = p.members;
  roles.healer = (ms.find(m => (m.skills.healer || 0) >= 2) || ms[0]).id;
  roles.forager = ms.find(m => (m.skills.wilderness || 0) >= 2)?.id || null;
  note(`Generation ${d.generation} of the dynasty sets out from the home village: ${ms.map(m => `${m.name} (${m.cls})`).join(", ")}.`, "title");
  return true;
}
