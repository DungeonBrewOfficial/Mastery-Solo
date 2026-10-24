/**
 * COMBAT (milestone 5, stage 1). A fight opens a small square grid with the
 * party and the enemies as tokens, and runs Mastery's round (Combat, Combat
 * Flow): declarations, a d6 for which side goes first, then the Fast,
 * Moderate, and Slow phases, winning side first.
 *
 * What stage 1 covers: weapon attacks and defense, the three Untrained
 * guards, styles (Single Weapon, Two-Handed, Weapon and Shield), ranged
 * attacks and the Aiming Trial, flanking, movement with reprisal attacks,
 * counterattacks, durability then health (Foundry's resolveDamage), 0 health
 * (Injury, the dying timer, Fighting On, Traumas), Triage, minion groups,
 * Startle, Impaired, the morale ladder (design/02-encounters.md), and running.
 *
 * Stage 2 adds the chained conditions (Restricted with holds, Tainted,
 * Infected, Inspired, Invigorated, Prone, Attrition), creature abilities
 * (data/abilities.js: riders, Mob traits, pack reactions, Riposte, Leader
 * buffs, Charge, grabs, Smash, auras), and what the party can use at level 1:
 * Charge, Snap Shot, the shield bash, Opportunist with Backstab, Danger
 * Sense, Avoid Death, Challenge, and Hearten. Stage 3 adds spells, class abilities, and companions.
 *
 * Everything lives in state.battle as plain data, so a fight can be saved
 * and picked up mid-round. Work waits in battle.queue (moves and attacks);
 * when a character must decide something (defend? counter?), the queue
 * stops at battle.prompt until the player answers.
 */
import { roll } from "./rng.js";
import { trial, passes, tierOf, dieOfTier, PROGRESSION } from "./mastery.js";
import { CREATURES } from "./data/creatures.js";
import { MASTERY, dtdForTierRank, sizeRowForSquares } from "./vendor/foundry/module/config.mjs";
import { buildHealthPlan, armoredDurability } from "./vendor/foundry/module/helpers/npc-health.mjs";
import { headsLost, groupTokenSize, bandFor as groupBand, mobDC } from "./vendor/foundry/module/helpers/minion-rules.mjs";
import { abilitiesOf, unbuilt } from "./data/abilities.js";
import { SPELLS, wardCovers } from "./data/spells.js";
import { RULES } from "./data/rules-text.js";
import { TRAUMA_TABLE } from "./vendor/foundry/module/data/trauma-table.mjs";
import { resolveDamage } from "./vendor/foundry/extract/resolve-damage.mjs";
import { speedOf, creatureSpeed, creatureTrial, awardCombatXp, spoils, chase, breakAway, cannotRun } from "./events.js";

export const GRID_W = 16, GRID_H = 12;

/**
 * The Dryad's bonded tree (Creatures - Fae, Dryad, The Bonded Tree): a 2×2
 * object that cannot defend and is reduced only by resistance. It can't be
 * destroyed in a fight ("an undertaking measured in hours or days"), but
 * damage dealt to it between the Dryad's turns trips her thresholds.
 */
CREATURES["Bonded Tree"] ||= {
  name: "Bonded Tree", tier: 2, rank: "adept", division: 7, classification: "fae", kingdom: "sidhe",
  size: { width: 2, height: 2, reach: 15 }, locomotion: [],
  attributes: Object.fromEntries(["strength", "agility", "physique", "endurance", "intelligence", "wisdom", "charisma", "perception"].map(k => [k, { score: 0, tier: 1 }])),
  armored: false,
  resistance: { cutting: 14, crushing: 14, cleaving: 7, piercing: 14, puncturing: 14, sea: 14, stone: 14, sky: 14, sacred: 14, profane: 14, fire: 7, void: 7, primal: 0 },
  attacks: [{ name: "Branch Slam", phase: "slow", damageType: "crushing", attribute: "perception", style: "natural", dice: [12, 8], bonus: 0, range: "" }],
  grips: [], armor: [], shield: null, abilities: [], abilityText: {}, senses: "", immuneDamage: ["primal"]
};
/** Things on the field that aren't foes to beat: they don't count for winning, morale, or numbers. */
const isObject = (u) => !!u.object;
export const PHASES = ["fast", "moderate", "slow"];
export const GUARDS = {
  mutable: { label: "Mutable", text: "No change to attack or defense." },
  stable: { label: "Stable", text: "Defense with Dominance, attacks with Impotence." },
  striking: { label: "Striking", text: "Attacks with Dominance, defense with Impotence." }
};
const ONE_HANDED = ["Light One-Handed", "Heavy One-Handed", "Versatile One-Handed"];
const IMPAIRED = { 1: "Dazed", 2: "Stunned", 3: "Paralyzed" };
const DEMORALIZED = { 1: "Shaken", 2: "Frightened", 3: "Panicked" };

/* ------------------------------------------------------------------ */
/* Dice                                                                 */

const stepOf = (c, s) => PROGRESSION.findIndex(([pc, ps]) => pc === c && ps === s);
const shift = ([c, s], edge) => { const i = stepOf(c, s); return i < 0 ? [c, s] : PROGRESSION[Math.max(0, Math.min(15, i + Math.sign(edge)))]; };
const fromCS = (d) => d.flat ? [1, 1] : [d.c, d.s];
const label = ([c, s]) => s === 1 ? "1" : `${c > 1 ? c : ""}d${s}`;

/**
 * Attack and defense dice (Mastery System, Dice Mechanics): every die d3 and
 * up explodes on its maximum, d2 never; Inferiority stops explosions.
 * Dominance and Impotence (edge) move each die one step on the chart.
 * extra: the index of a die rolled once more with the lowest dropped
 * (Two-Handed Style). kept counts the dice kept, explosions included, for
 * killing minion heads.
 */
function rollPool(rng, dice, { edge = 0, bonus = 0, inferiority = false, superiority = false, extra = -1 } = {}) {
  if (inferiority && superiority) inferiority = superiority = false;
  let total = bonus, kept = 0, exploded = false;
  const parts = [];
  dice.forEach((d, i) => {
    const [c, s] = shift(d, edge);
    if (s === 1) { total += c; parts.push(String(c)); return; }
    const chains = [];
    for (let k = 0; k < c + (i === extra ? 1 : 0); k++) {
      const chain = [rng.d(s)];
      while (s >= 3 && !inferiority && chain[chain.length - 1] >= (superiority ? s - 1 : s) && chain.length < 20) chain.push(rng.d(s));
      chains.push(chain);
    }
    const sum = (ch) => ch.reduce((a, b) => a + b, 0);
    let dropped = null;
    if (i === extra) { dropped = chains.reduce((lo, ch, j) => sum(ch) < sum(chains[lo]) ? j : lo, 0); }
    chains.forEach((ch, j) => { if (j !== dropped) { total += sum(ch); kept += ch.length; if (ch.length > 1) exploded = true; } });
    const shown = chains.map((ch, j) => `${j === dropped ? "~" : ""}${ch.join("!")}`).join(",");
    parts.push(`${label([c + (i === extra ? 1 : 0), s])}${i === extra ? "kh" + c : ""}[${shown}]`);
  });
  const mods = [];
  if (bonus) mods.push(bonus > 0 ? `+ ${bonus}` : `− ${-bonus}`);
  const tags = [edge > 0 ? "Dominance" : edge < 0 ? "Impotence" : "", inferiority ? "Inferiority" : "", superiority ? "Superiority" : ""].filter(Boolean);
  return { total: Math.max(0, total), kept, exploded, text: `${parts.join(" + ")}${mods.length ? " " + mods.join(" ") : ""}${tags.length ? ` (${tags.join(", ")})` : ""} = ${Math.max(0, total)}` };
}

/* ------------------------------------------------------------------ */
/* The grid                                                             */

const unitById = (b, id) => b.units.find(u => u.id === id);
/** A character, or a character's companion (Tallow, Clabber), which keeps its own record on its owner. */
const memberOf = (state, u) => state.party.members.find(m => m.id === u.id) || state.party.members.find(m => m.companion?.id === u.id)?.companion;
const ownerOf = (state, u) => state.party.members.find(m => m.companion?.id === u.id);
/** A companion's dice: its owner's attribute tier die (Perception for an agathion, Wisdom for a Puca) and its own tier die. */
function petDice(state, u) {
  const o = ownerOf(state, u), pet = o.companion;
  const attr = pet.kind === "agathion" ? "perception" : "wisdom";
  return { owner: [1, dieOfTier(tierOf(o.attributes[attr]))[1]], tier: dieOfTier(pet.tier), dc: pet.tier + tierOf(o.attributes[attr]) };
}
const speedFor = (state, u) => u.companion ? memberOf(state, u).speed : speedOf(memberOf(state, u));
/** Squares between two footprints, Chebyshev: 1 is adjacent. */
export function gap(a, b) {
  const dx = Math.max(0, a.x - (b.x + b.w - 1), b.x - (a.x + a.w - 1));
  const dy = Math.max(0, a.y - (b.y + b.h - 1), b.y - (a.y + a.h - 1));
  return Math.max(dx, dy);
}
const covers = (u, x, y) => x >= u.x && x < u.x + u.w && y >= u.y && y < u.y + u.h;
export const onField = (u) => !u.dead && !u.fled;
/** Standing and able to fight: on the field and conscious. */
export const standing = (state, u) => onField(u) && (u.pc ? !memberOf(state, u).down : true);

function blockedFor(b, mover, x, y) {
  if (x < 0 || y < 0 || x + mover.w > b.w || y + mover.h > b.h) return true;
  return b.units.some(o => o !== mover && onField(o) && x < o.x + o.w && x + mover.w > o.x && y < o.y + o.h && y + mover.h > o.y);
}

/** Breadth-first search over the grid; diagonal steps cost 1 like straight ones. */
function search(b, mover, goal, limit = 200) {
  const key = (x, y) => `${x},${y}`;
  const prev = new Map([[key(mover.x, mover.y), null]]);
  let frontier = [[mover.x, mover.y]];
  for (let depth = 0; depth < limit && frontier.length; depth++) {
    const next = [];
    for (const [x, y] of frontier) {
      if (goal(x, y)) {
        const path = [];
        for (let k = key(x, y); prev.get(k); k = prev.get(k)) path.unshift(k.split(",").map(Number));
        return path;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (prev.has(k) || blockedFor(b, mover, nx, ny)) continue;
        prev.set(k, key(x, y));
        next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return null;
}
export const pathTo = (b, u, x, y) => search(b, u, (px, py) => px === x && py === y);
const pathToReach = (b, u, target, reach) => search(b, u, (px, py) => gap({ ...u, x: px, y: py }, target) <= reach);

/** Squares a unit's next Move action covers (Combat, Movement: each move after the first in a row is half again as far). */
const moveStep = (u, speed) => speed + (u.lastMove ? Math.floor(speed / 2) : 0);

/* ------------------------------------------------------------------ */
/* Characters                                                           */

const attrTD = (m, a) => [1, dieOfTier(tierOf(m.attributes[a]))[1]];
export const weaponOf = (m, u) => (u.weapon >= 0 ? m.weapons[u.weapon] : null);
const usesShield = (m, w) => !!(m.shield && m.shield.durability > 0 && (!w || ONE_HANDED.includes(w.category)));

function pcAttackDice(state, u, w) {
  const m = memberOf(state, u);
  if (u.companion) { const d = petDice(state, u); return { dice: [d.owner, d.tier], bonus: 0, extra: -1, type: m.attack.type, name: m.attack.name }; }
  if (!w) return { dice: [attrTD(m, m.attributes.strength >= m.attributes.physique ? "strength" : "physique")], bonus: 0, extra: -1, type: "crushing", name: "Unarmed" };
  const level = m.weaponSkill?.[w.type] || 1;
  const wd = fromCS(MASTERY.weaponAttackTable[level][w.track]);
  let bonus = 0;
  // Single Weapon Style: a one-hander, nothing in the off hand. Unskilled adds 1.
  if (ONE_HANDED.includes(w.category) && !usesShield(m, w)) bonus += m.styles?.single || 1;
  return { dice: [attrTD(m, w.attribute), wd], bonus, extra: w.twoHanded ? 1 : -1, type: w.damage, name: w.name };
}

/** Can this character defend, and with what? (Combat, Defense) */
function pcDefense(state, u, type, ranged) {
  const m = memberOf(state, u);
  if (u.companion) {
    if (ranged) return { can: false, why: "only a shield stops a missile" };
    const d = petDice(state, u);
    return { can: true, dice: [d.owner, d.tier], bonus: ["cutting", "cleaving", "crushing", "piercing", "puncturing"].includes(type) ? m.resistance : 0 };
  }
  const w = weaponOf(m, u);
  const shield = usesShield(m, w);
  if (ranged && !shield) return { can: false, why: "only a shield stops a missile" };
  if (w?.projectile && !shield) return { can: false, why: "a sling can't parry" };
  const attr = w && !w.ranged ? w.attribute : (m.attributes.strength >= m.attributes.physique ? "strength" : "physique");
  const res = m.armor && m.armor.durability > 0 ? (m.armor.resistance[type] || 0) : 0;
  return { can: true, dice: [attrTD(m, attr)], bonus: res + (shield ? m.shield.defense : 0) + (w?.defense || 0), unarmed: !w && !shield };
}

/* ------------------------------------------------------------------ */
/* Reactions: each character's standing choice, Ask, Always, or Never    */

export const REACTIONS = {
  defend: { label: "Defend", default: "ask", text: "Spend 1 AP to defend against an incoming attack, declared before the roll (Combat, Defense)." },
  counter: { label: "Counterattack", default: "ask", text: "If you successfully defend against an attack, you can spend 1 AP as a reaction to make a counterattack against your attacker (Combat, Triggered Reactions)." },
  reprisal: { label: "Reprisal attack", default: "ask", text: "If a creature moves out of your melee attack range, you can spend 1 AP as a reaction to make an attack against that creature (Combat, Triggered Reactions)." },
  snap: { label: "Snap Shot", default: "ask", text: "Reprisal, when a creature uses movement to approach within 15 feet of your position. Make a ranged attack with Impotence and move up to half your movement speed away from the triggering creature (Weapon Mastery, Ranged Baseline)." },
  avoidDeath: { label: "Avoid Death", default: "always", text: "When an attack or spell would reduce you to 0 health, you can roll your Endurance tier die and restore that amount of health. This costs no AP. You cannot use this again until you complete a rest (Skill Mastery, Athletics)." },
  heartenDefense: { label: "Hearten an ally's defense", default: "ask", text: "As a reaction, you may spend 1 AP when an ally makes a trial, attack, or defense roll. You grant a bonus equal to your Charisma tier to that roll (Skill Mastery, Presence, Rhetoric)." },
  heartenAttack: { label: "Hearten an ally's attack", default: "ask", text: "As a reaction, you may spend 1 AP when an ally makes a trial, attack, or defense roll. You grant a bonus equal to your Charisma tier to that roll (Skill Mastery, Presence, Rhetoric)." },
  heartenTrial: { label: "Hearten an ally's trial", default: "ask", text: "As a reaction, you may spend 1 AP when an ally makes a trial, attack, or defense roll. You grant a bonus equal to your Charisma tier to that roll (Skill Mastery, Presence, Rhetoric). Ask stops for trials against an enemy's attack (venom, a grab, a Low Cut, a Mob trait); other trials, like Endurance at 0 health, take Hearten only on Always." }
};
export const reactOf = (m, k) => m.react?.[k] || REACTIONS[k].default;
/** The reactions a character has, for the settings page. */
export function reactionsFor(m) {
  const keys = ["defend", "counter", "reprisal"];
  if (m.weapons.some(w => w.ranged && (m.weaponSkill?.[w.type] || 1) >= 2)) keys.push("snap");
  if ((m.abilities || []).includes("Avoid Death")) keys.push("avoidDeath");
  if ((m.abilities || []).includes("Hearten")) keys.push("heartenDefense", "heartenAttack", "heartenTrial");
  return keys;
}
export function setReaction(m, k, v) { if (REACTIONS[k] && ["ask", "always", "never"].includes(v)) (m.react ||= {})[k] = v; }

/* ------------------------------------------------------------------ */
/* Conditions (Conditions chapter)                                      */

export const COND_LABELS = {
  restricted: { 1: "Grappled", 2: "Pinned", 3: "Restrained" },
  exhausted: { 1: "Weary", 2: "Fatigued", 3: "Depleted" },
  tainted: { 1: "Dosed", 2: "Blighted", 3: "Corrupted" },
  infected: { 1: "Afflicted", 2: "Sickened", 3: "Diseased" },
  inspired: { 1: "Rallied", 2: "Emboldened", 3: "Fearless" },
  invigorated: { 1: "Energized", 2: "Empowered", 3: "Tireless" }
};
/** Possessed (Cursed): fire resistance of half the character's level. */
const innateRes = (m, type) => type === "fire" && (m.abilities || []).includes("Possessed") ? Math.floor((m.level || 1) / 2) : 0;
const MUNDANE = ["cutting", "cleaving", "crushing", "piercing", "puncturing"];
const PHYSICAL = ["strength", "agility", "physique", "endurance"];
/** Conditions that deteriorate on their own; Impaired's Startle tiers follow the Startle rule instead, and Demoralized holds while its source is in sight. */
const DECAYS = ["impaired", "restricted", "tainted", "inspired", "invigorated", "quarry"];
/** Halved movement: Tainted 2 and up, Exhausted 3. */
const slowed = (u) => cond(u, "tainted") >= 2 || cond(u, "exhausted") >= 3;
const cond = (u, k) => (k === "impaired" ? u.impaired : k === "demoralized" ? u.demoralized : u.cond?.[k]) || 0;
function setCond(u, k, v) {
  if (k === "impaired") u.impaired = v;
  else if (k === "demoralized") u.demoralized = v;
  else (u.cond ||= {})[k] = v;
}
function immuneTo(state, u, k) {
  if (u.pc) return (memberOf(state, u).immuneConds || []).includes(k);
  return abilitiesOf(CREATURES[u.cname]).some(a => a.kind === "immune" && a.conds?.includes(k));
}
function immuneToDamage(state, u, type) {
  if (u.pc) return (memberOf(state, u).immune || []).includes(type);
  return (CREATURES[u.cname].immuneDamage || []).includes(type) || abilitiesOf(CREATURES[u.cname]).some(a => a.kind === "immune" && a.damage?.includes(type));
}

/**
 * Advance a condition by n tiers, to Tier 3 (or a source's max). Inspired and
 * Demoralized counter each other tier for tier. Infected lives on the
 * character, not the fight.
 */
function addCond(state, note, u, k, n = 1, { max = 3, by = null, lasting = false, decays = null } = {}) {
  if (immuneTo(state, u, k)) { note(`${u.name} is immune to ${k === "tainted" ? "poison" : k === "infected" ? "disease" : k}.`); return; }
  if (k === "infected" && u.pc) {
    const m = memberOf(state, u);
    m.infected = Math.min(3, (m.infected || 0) + n);
    note(`${u.name} is ${COND_LABELS.infected[m.infected]} (Infected ${m.infected}).`, "event");
    return;
  }
  const pair = { inspired: "demoralized", demoralized: "inspired" }[k];
  if (pair && cond(u, pair) > 0) {
    const cancel = Math.min(n, cond(u, pair));
    setCond(u, pair, cond(u, pair) - cancel);
    n -= cancel;
    if (!n) { note(`${u.name}'s ${k} cancels against ${pair}.`); return; }
  }
  const before = cond(u, k);
  const next = Math.min(3, Math.max(before, Math.min(max, before + n)));
  if (next === before) return;
  setCond(u, k, next);
  // It wears off from the end of the advancer's next turn (Conditions, Stacking).
  if (!lasting && (decays ?? DECAYS.includes(k))) (u.decay ||= {})[k] = { by, round: state.battle.round };
  const name = k === "impaired" ? IMPAIRED[next] : k === "demoralized" ? DEMORALIZED[next] : COND_LABELS[k]?.[next] || k;
  note(`${u.name} is ${name} (${k[0].toUpperCase() + k.slice(1)} ${next}).`, ["inspired", "invigorated"].includes(k) ? "" : "event");
}

/**
 * Every modifier a creature's conditions put on one roll.
 * kind: "attack" | "defense" | a trial's attribute. → { pen, bonus, edge, sup, inf }
 */
function mods(state, u, kind) {
  const m = u.pc ? memberOf(state, u) : null;
  const physical = kind === "attack" || kind === "defense" || PHYSICAL.includes(kind);
  const mental = !physical;
  const combat = kind === "attack" || kind === "defense";
  let pen = m?.injuries || 0, bonus = 0, dom = false, imp = false, sup = false, inf = false;
  const im = cond(u, "impaired"), re = cond(u, "restricted"), ta = cond(u, "tainted"), de = cond(u, "demoralized");
  const iv = cond(u, "invigorated"), ins = cond(u, "inspired"), ex = cond(u, "exhausted");
  if (ex >= 1) imp = true;
  if (ex >= 2 && combat) inf = true;
  pen += im === 1 ? 1 : im === 2 ? 2 : 0;
  if (im === 2 && combat) inf = true;
  if (physical) pen += re >= 2 ? 2 : re;
  if (re >= 2 && combat) inf = true;
  pen += ta;
  if (ta >= 2) imp = true;
  if (kind === "attack" && de >= 1) inf = true;
  if (kind === "defense" && de >= 2) inf = true;
  if (u.prone && combat) inf = true;
  if (iv >= 1 && (physical || iv >= 3)) dom = true;
  if (iv === 2 && physical) bonus += 1;
  if (iv >= 3) bonus += 2;
  if (ins >= 1 && mental) dom = true;
  if (ins >= 2 && !combat) bonus += ins === 2 ? 1 : 2;
  if (ins >= 3 && combat) sup = true;
  return { pen, bonus, edge: (dom ? 1 : 0) - (imp ? 1 : 0), sup, inf };
}

/** A trial to resist: the character's attribute trial, or the creature's trial dice, with its conditions. */
function resist(state, rng, u, attr, dc, { edge = 0, hearten, forCond, vsType } = {}) {
  const md = mods(state, u, attr);
  // Possessed (Cursed): Impotence on trials to resist Sacred damage.
  if (vsType === "sacred" && u.pc && (memberOf(state, u).abilities || []).includes("Possessed")) edge -= 1;
  const rb = forCond && has(u, "resistBonus");
  if (rb && rb.conds.includes(forCond)) md.bonus += rb.bonus;
  const e = Math.sign(edge + md.edge);
  // Hearten: chosen at a prompt (hearten is the helper's id, or null for no), or Always.
  const helper = hearten ? unitById(state.battle, hearten) : hearten === undefined && u.pc && state.battle ? heartener(state, u, "heartenTrial") : null;
  const lift = helper && (hearten || reactOf(memberOf(state, helper), "heartenTrial") === "always") ? heartenBonus(state, helper.id) : 0;
  const pd = u.companion ? petDice(state, u) : null;
  const t = u.companion ? trial(rng, [pd.tier, pd.owner], { edge: e, bonus: md.bonus - md.pen })
    : u.pc
    ? trial(rng, [dieOfTier(tierOf(memberOf(state, u).attributes[attr])), dieOfTier(tierOf(memberOf(state, u).attributes[attr]))], { edge: e, bonus: md.bonus - md.pen + lift })
    : creatureTrial(rng, CREATURES[u.cname], attr, { edge: e, bonus: md.bonus - md.pen });
  return { ok: passes(t, dc), miss: dc - t.total, text: t.text + (lift ? `, ${helper.name} heartens +${lift}` : "") };
}

/* ------------------------------------------------------------------ */
/* Creatures                                                            */

const RANGE_RE = /(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/;
/** Range bands in squares, from the attack line (filled from the weapon's own entry when the stat block leaves it out). */
const rangeOf = (a) => {
  const r = a?.range || "", m = RANGE_RE.exec(r);
  return m ? m.slice(1, 4).map(n => Math.floor(Number(n) / 5)) : null;
};
const avg = (a) => a.dice.reduce((n, s) => n + (s + 1) / 2, 0) + (a.bonus || 0);
const meleeAttack = (c) => [...c.attacks].filter(a => !rangeOf(a)).sort((x, y) => avg(y) - avg(x))[0] || null;
const rangedAttack = (c) => c.attacks.find(a => rangeOf(a)) || null;
const armorRes = (c, type) => c.armor.reduce((n, p) => n + (p.resistance?.[type] || 0), 0);
const sizeRow = (c) => sizeRowForSquares(c.size.width * c.size.height);
/** Reach in squares: the creature's, or a polearm's written "Reach 10 ft". */
const reachOf = (u, c) => (u.pc ? 1 : Math.max(1, Math.floor((c?.size?.reach || 5) / 5),
  ...(c?.attacks || []).map(a => Math.floor(Number((/Reach (\d+)/i.exec(a.range || "") || [])[1] || 0) / 5))));

function creatureAttackDice(u, c, a) {
  const dice = u.minion ? [[u.heads, 2]] : a.dice.map(s => [1, s]);
  return { dice, bonus: (a.bonus || 0) + (u.minion ? 0 : sizeRow(c).attackBonus || 0), extra: -1, type: a.damageType, name: a.name };
}

function creatureDefense(u, c, type, ranged) {
  if (ranged && !c.shield) return { can: false, why: "no shield" };
  if (!c.attacks.length && !c.grips.length) return { can: false, why: "no weapon" };
  const res = (c.resistance?.[type] || 0) + (u.armorDur > 0 ? armorRes(c, type) : 0);
  if (u.minion) return { can: true, dice: [[u.heads, 2]], bonus: res };
  let dice;
  if (c.grips.length) dice = c.grips[0].dice.map(s => [1, s]);
  else {
    const dtd = dtdForTierRank(c.tier, c.rank);
    const a = meleeAttack(c);
    const attr = !a || a.style === "natural" ? (c.attributes.agility.tier >= c.attributes.physique.tier ? "agility" : "physique") : a.attribute;
    dice = [[dtd.c, dtd.s], [1, dieOfTier(c.attributes[attr]?.tier || 1)[1]]];
  }
  return { can: true, dice, bonus: res + (sizeRow(c).defenseBonus || 0) };
}

function rollHealth(rng, c) {
  const plan = buildHealthPlan({ tier: c.tier, rank: c.rank, armored: c.armored, attributes: c.attributes, sizeRow: sizeRow(c) });
  return Math.max(1, plan.terms.reduce((n, t) => n + (t.die ? roll(rng, `${t.die.c}d${t.die.s}`).total : t.flat || 0), 0));
}

/* ------------------------------------------------------------------ */
/* Setting up                                                           */

const FORMATION = { gerberga: [3, 5], hamon: [3, 6], gisla: [2, 5], corra: [2, 6] };
/** Per-unit condition state for a fresh fight. */
const FRESH = () => ({ cond: {}, decay: {}, attrition: [], prone: false, held: null, tookTurn: false });

/**
 * Open the battle for the current encounter. Distance sets how far apart the
 * sides start; Startle results from contact carry in as Impaired.
 */
export function startBattle(state, rng, note) {
  const e = state.encounter;
  const b = {
    w: GRID_W, h: GRID_H, round: 0, stage: "declare", phaseIdx: 0, sideIdx: 0, order: ["party", "enemy"],
    current: null, queue: [], prompt: null, units: [], head: e.head, xp: e.xp, temper: e.temper, terrain: e.terrain, night: e.night,
    dropped: [], thrown: {}, triaged: [], outcome: null
  };
  state.battle = b;
  const members = state.party.members.filter(m => !m.dead && m.hp > 0);
  members.forEach((m, i) => {
    const [x, y] = FORMATION[m.id] || [2, 3 + i];
    m.down = false; m.dying = null; m.fightingOn = false; m.stable = false;
    b.units.push({ id: m.id, pc: true, side: "party", name: m.name, x, y, w: 1, h: 1, ap: 0, weapon: m.weapons.length ? 0 : -1,
      guard: "mutable", impaired: e.impaired?.[m.id] || 0, demoralized: 0, phase: "fast", doneIn: [], moveLeft: 0, lastMove: false, attacks: 0,
      startle: e.impaired?.[m.id] || 0, mode: "strike", ...FRESH() });
    if (m.exhausted) b.units[b.units.length - 1].cond.exhausted = m.exhausted;
  });
  for (const m of members.filter(x => x.companion && !x.companion.dead && x.companion.hp > 0)) {
    const pet = m.companion, owner = b.units.find(u => u.id === m.id);
    pet.down = false;
    const u = { id: pet.id, pc: true, companion: true, owner: m.id, side: "party", name: pet.name, x: 0, y: 0, w: 1, h: 1, ap: 0, weapon: -1,
      guard: "mutable", impaired: 0, demoralized: 0, phase: "moderate", doneIn: [], moveLeft: 0, lastMove: false, attacks: 0, startle: 0, mode: "strike", ...FRESH() };
    place(b, u, owner.x);
    b.units.push(u);
  }
  const gapCols = { Close: 2, Near: 6, Far: 10 }[e.distance] ?? 6;
  let n = 0;
  for (const g of e.group || [{ name: e.head, count: 1 }]) {
    const c = CREATURES[g.name];
    if (!c) { note(`(${g.name} has no stat block yet; left out.)`, "todo"); continue; }
    const minion = c.rank === "minion";
    const count = g.heads ? 1 : Math.max(1, roll(rng, String(g.count ?? 1)).total);
    const heads = minion ? Math.max(1, roll(rng, String(g.heads ?? g.count ?? 1)).total) : 0;
    for (let k = 0; k < (minion ? 1 : count); k++) {
      const fp = minion ? groupTokenSize(heads, c.size.width * c.size.height) : { width: Math.max(1, Math.ceil(c.size.width)), height: Math.max(1, Math.ceil(c.size.height)) };
      const hp = minion ? heads : rollHealth(rng, c);
      const dur = c.armored ? (c.armor.length ? c.armor.reduce((s, p) => s + (p.durability || 0), 0) : armoredDurability({ armored: true, attributes: c.attributes, tier: c.tier, dtd: dtdForTierRank(c.tier, c.rank) }) || 0) : 0;
      const u = {
        id: `e${++n}`, pc: false, side: "enemy", cname: g.name, minion,
        name: minion ? `${g.name}s (${heads})` : count > 1 ? `${g.name} ${k + 1}` : g.name,
        x: 0, y: 0, w: fp.width, h: fp.height, hp, hpMax: hp, heads, headsMax: heads, armorDur: dur, armorMax: dur,
        ap: 0, phases: [], attack: null, impaired: 0, demoralized: 0, doneIn: [], moveLeft: 0, lastMove: false, attacks: 0, marks: 0, ...FRESH()
      };
      place(b, u, Math.min(GRID_W - fp.width, 3 + gapCols));
      b.units.push(u);
    }
  }
  // Both sides surprised: the creatures roll Startle too (DC 6).
  if (e.enemyStartle) {
    for (const u of b.units.filter(x => !x.pc)) {
      const c = CREATURES[u.cname];
      const keen = abilitiesOf(c).find(a => a.kind === "unflankable")?.startle || 0;
      const t = c.rank === "minion" ? trial(rng, [dieOfTier(c.tier), dieOfTier(c.tier)]) : trial(rng, [dieOfTier(c.attributes.agility.tier), dieOfTier(c.attributes.perception.tier)], { bonus: keen });
      const miss = e.enemyStartle - t.total;
      u.impaired = passes(t, e.enemyStartle) ? 0 : miss >= 5 ? 3 : miss >= 3 ? 2 : 1;
      u.startle = u.impaired;
      note(`${u.name}: Startle ${t.text}${u.impaired ? `, ${IMPAIRED[u.impaired]}` : ", keeps its head"}.`);
    }
  }
  // A Dryad fights beside her bonded tree.
  if (b.units.some(u => !u.pc && abilitiesOf(CREATURES[u.cname]).some(a => a.kind === "regen"))) {
    const tree = { id: "tree", pc: false, side: "enemy", cname: "Bonded Tree", object: true, name: "Bonded Tree", x: 0, y: 0, w: 2, h: 2,
      hp: 9999, hpMax: 9999, heads: 0, armorDur: 0, armorMax: 0, ap: 0, phases: [], attack: 0, impaired: 0, demoralized: 0, doneIn: [], moveLeft: 0, lastMove: false, attacks: 0, marks: 0, dmgSince: 0, ...FRESH() };
    place(b, tree, GRID_W - 3);
    b.units.push(tree);
  }
  note(`The fight begins: ${b.units.filter(u => !u.pc && !isObject(u)).map(u => u.name).join(", ")}, ${e.distance === "Close" ? "close" : e.distance === "Far" ? "far" : "a little way"} off.`, "event");
  const missing = [...new Set(b.units.filter(u => !u.pc).flatMap(u => unbuilt(CREATURES[u.cname]).map(a => `${u.cname}'s ${a}`)))];
  if (missing.length) note(`Not built yet, so not used in this fight: ${missing.join(", ")}.`, "todo");
  startRound(state, rng, note);
}

function place(b, u, col) {
  const rows = [];
  for (let d = 0; d < b.h; d++) { const r = Math.floor((b.h - u.h) / 2) + (d % 2 ? -(d + 1) / 2 : d / 2); if (r >= 0 && r + u.h <= b.h) rows.push(r); }
  for (let dc = 0; dc < b.w; dc++) for (const c of [col + dc, col - dc]) for (const r of rows) {
    if (!blockedFor(b, u, c, r)) { u.x = c; u.y = r; return; }
  }
}

/* ------------------------------------------------------------------ */
/* Rounds                                                               */

function startRound(state, rng, note) {
  const b = state.battle;
  b.round += 1;
  b.stage = "declare"; b.phaseIdx = 0; b.sideIdx = 0; b.current = null; b.rolls = {};
  for (const u of b.units) {
    // Impaired from Startle eases one tier at the start of each round after the first (Combat, Startle).
    // Impaired from anything else wears off like any other condition.
    if (b.round > 1 && u.startle > 0) { u.startle -= 1; u.impaired = Math.max(0, u.impaired - 1); }
    u.doneIn = []; u.moveLeft = 0; u.lastMove = false; u.attacks = 0; u.helpedBy = [];
    u.lostThisRound = 0;
    // A ward cast for one round is gone when the next begins.
    if (u.wards) u.wards = u.wards.filter(w => w.round == null || w.round === b.round);
    if (u.pc) {
      const m = memberOf(state, u);
      u.ap = m.down || u.impaired >= 3 ? 0 : cond(u, "exhausted") >= 3 ? 1 : 2;
      u.tookTurn = false;
    } else if (u.object) {
      // The tree acts only when the Dryad's threshold wakes it (set at her turn).
      u.tookTurn = false; u.phases = []; u.ap = 0;
    } else {
      u.tookTurn = false;
      const c = CREATURES[u.cname];
      const rank = MASTERY.npcRanks[c.rank];
      const a = meleeAttack(c) || rangedAttack(c);
      u.attack = a ? c.attacks.indexOf(a) : null;
      const base = a?.phase || "fast";
      // Epic and Legendary creatures get 2 AP in each phase they act in.
      u.phases = rank.phasesActive >= 3 ? [...PHASES] : rank.phasesActive === 2 ? (base === "slow" ? ["moderate", "slow"] : [base, "slow"]) : [u.impaired ? "slow" : base];
      u.ap = u.impaired >= 3 ? 0 : rank.phasesActive > 1 ? 0 : cond(u, "exhausted") >= 3 ? 1 : rank.ap;
      u.feintOn = null;
      // Smash is declared: the creature acts in the Slow phase, open to Superiority until it lands.
      const smash = abilitiesOf(c).find(a => a.kind === "smash");
      u.smashing = !!(smash && onField(u) && u.ap >= 2 && b.units.some(t => t.pc && standing(state, t) && gap(u, t) <= reachOf(u, c)));
      if (u.smashing) { u.phases = ["slow"]; note(`${u.name} gathers itself for a Smash (Slow phase). Until it lands, attacks against it have Superiority.`); }
    }
  }
  note(`Round ${b.round}.`, "day");
}

/**
 * Challenge (Presence, Etiquette): once per encounter, declared before the
 * first phase of round two, against an intelligent creature not yet hurt.
 */
export function challengeTargets(state, u) {
  const b = state.battle;
  if (!(memberOf(state, u).abilities || []).includes("Challenge") || u.challenged || b.round > 2) return [];
  return b.units.filter(t => !t.pc && standing(state, t) && t.hp >= t.hpMax && (t.armorDur ?? 0) >= (t.armorMax ?? 0) &&
    (CREATURES[t.cname].kingdom === "folk" || (CREATURES[t.cname].attributes.intelligence?.score || 0) >= 5));
}

/**
 * Declarations are in (main.js sets each character's weapon and guard):
 * charge for changed weapons, set phases, roll for the first side.
 */
export function beginRound(state, rng, note, picks = {}) {
  const b = state.battle;
  if (!b || b.stage !== "declare") return;
  for (const u of b.units.filter(x => x.pc && standing(state, x))) {
    const m = memberOf(state, u);
    const p = picks[u.id] || {};
    if (u.companion) {
      // Hellfire is declared: the Agathion acts in the Fast phase, if its caster has the magan.
      const o = ownerOf(state, u);
      u.declared = { hellfire: !!p.hellfire && m.ability === "Hellfire" && (o.mp || 0) >= 2 };
      u.hellfired = false;
      if (u.declared.hellfire) note(`${m.name} gathers Hellfire (Fast phase).`);
    }
    if (p.guard && GUARDS[p.guard]) u.guard = p.guard;
    if (m.shield && typeof p.shieldAbsorbs === "boolean") m.shieldAbsorbs = p.shieldAbsorbs;
    if (p.challenge && challengeTargets(state, u).some(t => t.id === p.challenge)) {
      u.challenge = p.challenge; u.challenged = true;
      note(`${m.name} challenges ${unitById(b, p.challenge).name}.`, "event");
    }
    let slowest = null;
    if (Number.isInteger(p.weapon) && p.weapon !== u.weapon && m.weapons[p.weapon]) {
      // Drop what's in hand (free) and draw the new weapon (1 AP). Dropped weapons are picked up after the fight.
      const old = weaponOf(m, u);
      if (old) b.dropped.push({ member: m.id, weapon: u.weapon });
      slowest = old?.speed;
      u.weapon = p.weapon;
      if (u.ap > 0) u.ap -= 1;
      note(`${m.name} ${old ? `drops the ${old.name.toLowerCase()} and ` : ""}draws the ${weaponOf(m, u).name.toLowerCase()} (1 AP).`);
    }
    if (p.free) setFreeSlot(u, p.free);
    upkeepImbue(state, note, u);
    u.casting = null; u.theurgy = null;
    const turnPick = p.turn && turnOptions(state, u).find(o => o.key === p.turn);
    if (turnPick) {
      const [mode, spirit, division] = p.turn.split(":");
      u.theurgy = { mode, spirit, division: Number(division), phase: turnPick.phase, label: turnPick.label };
      u.turnUsed = true; // once per encounter
      note(`${m.name} declares: ${turnPick.label.replace(/ \(.*\)$/, "")} (${cap(turnPick.phase)} phase).`, "event");
    } else if (p.spell) declareSpell(state, note, u, p.spell);
    const w = weaponOf(m, u);
    // A declared spell sets the phase by its speed (Magic Mastery, Spell Speed); a weapon drawn this round can still slow it.
    const speeds = u.companion ? [u.declared?.hellfire ? "fast" : "moderate"] : [u.theurgy ? u.theurgy.phase : u.casting ? u.casting.phase : w?.speed || "fast", slowest].filter(Boolean);
    u.phase = u.impaired === 1 || u.impaired === 2 ? "slow" : PHASES[Math.max(...speeds.map(s => PHASES.indexOf(s)))];
  }
  const d = rng.d(6);
  b.order = d <= 3 ? ["party", "enemy"] : ["enemy", "party"];
  note(`Initiative d6 ${d}: ${d <= 3 ? "your side" : "their side"} goes first in each phase.`);
  b.stage = "phase";
  advance(state, rng, note);
}

function endRound(state, rng, note) {
  const b = state.battle;
  for (const u of b.units.filter(x => x.fireAura > 0)) { u.fireAura -= 1; if (!u.fireAura) note(`${u.name}'s Fire Aura gutters out.`); }
  // Whoever had no turn this round (unconscious, Paralyzed) still bleeds at its end.
  for (const u of b.units.filter(x => onField(x) && !x.tookTurn)) endOfTurn(state, rng, note, u);
  // Tiers no source holds deteriorate by one each round; a hold keeps Restricted.
  for (const u of b.units.filter(onField)) {
    if (u.held && !holdStands(state, u)) { note(`${u.name} is no longer held.`); u.held = null; }
    // A source that is gone, or had no turn this round, lets its tiers go at the round's end instead.
    for (const k of Object.keys(u.decay || {})) {
      const src = u.decay[k].by && unitById(b, u.decay[k].by);
      if (!src || !onField(src) || !src.tookTurn) wearOff(state, note, u, k);
    }
  }
  if (checkEnd(state, rng, note)) return;
  // The dying timer runs down at the end of each round.
  for (const u of b.units.filter(x => x.pc && onField(x))) {
    const m = memberOf(state, u);
    if (m.dying != null && !m.stable) {
      m.dying -= 1;
      if (m.dying <= 0) die(state, note, u);
      else note(`${m.name} is dying: ${m.dying} round${m.dying === 1 ? "" : "s"} left.`, "event");
    }
  }
  if (checkEnd(state, rng, note)) return;
  startRound(state, rng, note);
}

const able = (state, u) => standing(state, u) && u.impaired < 3 && u.demoralized < 3 || (!u.pc && onField(u) && u.demoralized >= 3);

function nextActor(state, rng, note) {
  const b = state.battle;
  const phase = PHASES[b.phaseIdx], side = b.order[b.sideIdx];
  const u = b.units.find(x => x.side === side && able(state, x) && !x.doneIn.includes(phase) &&
    (x.pc ? x.phase === phase : x.phases.includes(phase)));
  if (u) {
    b.current = u.id;
    u.moveLeft = 0; u.lastMove = false; u.attacks = 0; u.brokeFree = false;
    u.movedLastTurn = !!u.movedThisTurn; u.movedThisTurn = false;
    if (!u.pc && u.phases.length > 1) u.ap = 2;
    startOfTurn(state, rng, note, u);
    return;
  }
  b.sideIdx += 1;
  if (b.sideIdx > 1) { b.sideIdx = 0; b.phaseIdx += 1; }
  if (b.phaseIdx > 2) endRound(state, rng, note);
}

function finishTurn(state, u, rng, note) {
  const b = state.battle;
  if (u.casting) loseSpell(state, note, u, "the turn ended without releasing it");
  if (u.theurgy) { note(`${u.name} lets the declared ${u.theurgy.mode === "destroy" ? "Destroy" : "Turn"} go unspoken.`); u.theurgy = null; }
  endOfTurn(state, rng, note, u);
  u.doneIn.push(PHASES[b.phaseIdx]);
  u.moveLeft = 0; u.lastMove = false;
  if (!u.pc && u.phases.length > 1) u.ap = 0;
  b.current = null;
}

/** Things that happen as a creature starts its turn: Mob traits that work on presence (Death Tick). */
function startOfTurn(state, rng, note, u) {
  const b = state.battle;
  // Regrowth at the start of its own turn (Tree-Bound), unless the tree has been hurt enough since.
  const rg = has(u, "regen");
  const tree = rg && b.units.find(x => isObject(x));
  if (tree && u.treeRound !== b.round) {
    u.treeRound = b.round;
    const d = tree.dmgSince, div = CREATURES[u.cname].division;
    tree.dmgSince = 0;
    u.tree1 = d >= div; u.tree2 = d >= 2 * div;
    if (u.tree2) { tree.phases = ["slow"]; tree.ap = 2; note(`The bonded tree has taken ${d}: ${u.name} can't meld, her spells strike harder, she can't regrow, and the tree itself lashes out this round.`, "event"); }
    else if (u.tree1) note(`The bonded tree has taken ${d}: ${u.name} can't regrow, and her spells strike harder.`, "event");
    if (!u.tree2) { tree.phases = []; tree.ap = 0; }
  }
  if (rg && u.hp < u.hpMax && !u.tree1) {
    const n = roll(rng, u.meldBoost ? "2d6" : rg.amount).total;
    u.meldBoost = false;
    u.hp = Math.min(u.hpMax, u.hp + n);
    note(`${u.name} regrows ${n} health (${rg.name}).`);
  }
  for (const o of b.units.filter(x => x.side !== u.side && !x.pc && onField(x) && (!x.minion || x.heads > 0))) {
    for (const a of abilitiesOf(CREATURES[o.cname]).filter(x => x.kind === "presence")) {
      const key = `${o.id}:${a.name}`;
      // An aura you enter once (Presence of the Ideal) tests you on entering, and not again unless you leave and return; a success makes you immune.
      if (a.once && gap(o, u) > a.range) { if (u.auraIn) delete u.auraIn[key]; continue; }
      if (gap(o, u) > a.range || cond(u, a.cond.name) >= (a.cond.max || 3)) continue;
      if (a.once && (u.auraIn?.[key] || u.auraImmune?.includes(key))) continue;
      if (a.once) (u.auraIn ||= {})[key] = true;
      const dc = a.resist.dc === "band" ? mobDC(CREATURES[o.cname].tier, o.heads) : a.resist.dc;
      const t = resist(state, rng, u, a.resist.attr, dc);
      note(`${o.name}: ${a.name}. ${u.name} resists (${t.text} against ${dc}): ${t.ok ? "steady" : "it gets under the skin"}.`);
      if (t.ok && a.once) (u.auraImmune ||= []).push(key);
      if (!t.ok) { addCond(state, note, u, a.cond.name, a.cond.n, { max: a.cond.max, by: o.id }); if (a.cond.name === "demoralized") u.fearOf = o.id; }
    }
  }
}

/**
 * The end of a creature's turn (Conditions): its Attrition instances resolve
 * and expire, Tainted 2 and 3 cost health, and an aura burns whoever ends
 * the turn inside it.
 */
function endOfTurn(state, rng, note, u) {
  if (!onField(u)) return;
  u.tookTurn = true;
  const b = state.battle;
  for (const v of b.units.filter(onField)) for (const k of Object.keys(v.decay || {})) if (v.decay[k].by === u.id) wearOff(state, note, v, k);
  const hits = u.attrition || [];
  u.attrition = [];
  for (const a of hits) {
    if (!onField(u)) break;
    if (u.minion) {
      // Attrition removes one head per instance.
      u.heads -= 1; u.hp = u.heads;
      note(`Attrition (${a.label}): one of the ${u.cname.toLowerCase()}s falls${u.heads ? `, ${u.heads} left` : ""}.`, "event");
      if (u.heads <= 0) { note(`The last of the ${u.cname.toLowerCase()}s falls.`, "reward"); creatureFalls(state, rng, note, u); }
      else regroupHeads(u);
      continue;
    }
    secondaryDamage(state, rng, note, u, a.amount, a.type, `Attrition (${a.label})`, { direct: true });
  }
  if (onField(u)) fireAuraAt(state, rng, note, u);
  const ta = cond(u, "tainted");
  if (ta >= 2 && onField(u)) secondaryDamage(state, rng, note, u, ta === 3 ? 2 : 1, null, "poison", { direct: true, noResist: true });
  for (const o of b.units.filter(x => x.side !== u.side && onField(x) && !x.pc)) {
    for (const a of abilitiesOf(CREATURES[o.cname]).filter(x => x.kind === "aura")) {
      if (onField(u) && gap(o, u) <= a.radius) secondaryDamage(state, rng, note, u, a.amount, a.type, `${o.name}'s ${a.name}`);
    }
  }
}

/**
 * Damage outside an attack: Attrition, poison, venom, flame. It meets
 * resistance of its type and, unless direct, the armor's durability like
 * any hit (resolveDamage, passive). Immunity stops it.
 */
function secondaryDamage(state, rng, note, t, amount, type, label, { direct = false, noResist = false, magic = false } = {}) {
  if (!onField(t) || !(amount > 0)) return;
  const ab = has(t, "absorb");
  if (ab && ab.type === type) { t.hp = Math.min(t.hpMax, t.hp + amount); note(`${label}: ${t.name} drinks it in (${ab.name}), healing ${amount}.`, "event"); return; }
  if (type && immuneToDamage(state, t, type)) { note(`${label}: ${t.name} is immune.`); return; }
  if (t.pc) {
    const m = memberOf(state, t);
    if (m.dead) return;
    const res = noResist || !type ? 0 : (t.companion ? (MUNDANE.includes(type) ? m.resistance : 0) : !m.armor || m.armor.durability <= 0 ? 0 : (m.armor.resistance[type] || 0)) + innateRes(m, type);
    const ward = type && wardFor(t, type);
    const r = direct ? { healthDamage: Math.max(0, amount - res), durabilityDamage: 0 }
      : resolveDamage({ attackTotal: amount, damageType: type, armorResistance: res, durabilityCurrent: m.armor?.durability || 0, healthCurrent: m.hp, activeDefense: false, wardPool: ward?.pool || 0 });
    drainWard(state, note, t, ward, r.wardAbsorbed);
    if (r.durabilityDamage) { m.armor.durability -= r.durabilityDamage; shaken(state, note, t); }
    note(`${label}: ${t.name} takes ${[r.durabilityDamage ? `${r.durabilityDamage} to the ${m.armor.name.toLowerCase()}` : "", r.healthDamage ? `${r.healthDamage} to health` : ""].filter(Boolean).join(", ") || "nothing"}.`, r.healthDamage ? "event" : "");
    if (r.healthDamage || (magic && m.hp <= 0)) hurtPC(state, rng, note, t, r.healthDamage, { magic });
    return;
  }
  const c = CREATURES[t.cname];
  if (isObject(t)) {
    const got = Math.max(0, amount - (noResist || !type ? 0 : c.resistance?.[type] || 0));
    t.dmgSince += got;
    note(`${label}: the bonded tree takes ${got} (${t.dmgSince} since the Dryad's last turn).`, got ? "event" : "");
    return;
  }
  const res = noResist || !type ? 0 : (c.resistance?.[type] || 0) + (t.armorDur > 0 && !direct ? armorRes(c, type) : 0);
  const r = direct ? { healthDamage: Math.max(0, amount - res), durabilityDamage: 0 }
    : resolveDamage({ attackTotal: amount, damageType: type, armorResistance: res, durabilityCurrent: t.armorDur, healthCurrent: t.hp, activeDefense: false });
  if (r.durabilityDamage) t.armorDur -= r.durabilityDamage;
  if (t.minion) { if (r.healthDamage) { t.heads -= 1; t.hp = t.heads; regroupHeads(t); } }
  else t.hp = Math.max(0, t.hp - (r.healthDamage || 0));
  note(`${label}: ${t.name} takes ${[r.durabilityDamage ? `${r.durabilityDamage} to armor` : "", r.healthDamage ? (t.minion ? "a head" : `${r.healthDamage} to health`) : ""].filter(Boolean).join(", ") || "nothing"}.`, "event");
  if (t.hp <= 0) { note(`${t.name} falls.`, "reward"); creatureFalls(state, rng, note, t); }
}

/**
 * Tiers no source holds drop by one at the end of the turn of the creature
 * that last advanced them, starting with its next turn, not the turn it
 * advanced them [Jon, 2026-10-24]. A grab's hold keeps Restricted.
 */
function wearOff(state, note, u, k) {
  const d = u.decay[k];
  // Startle's tiers of Impaired aren't this source's to wear off.
  const own = k === "impaired" ? u.impaired - (u.startle || 0) : cond(u, k);
  if (own <= 0) { delete u.decay[k]; return; }
  if (d.round >= state.battle.round || (k === "restricted" && u.held)) return;
  setCond(u, k, cond(u, k) - 1);
  d.round = state.battle.round;
  if (!cond(u, k)) { delete u.decay[k]; note(`${u.name} is no longer ${k}.`); }
}

/** A creature falls: Grief Fury in its kin, then morale. */
function creatureFalls(state, rng, note, t) {
  t.dead = true;
  for (const o of state.battle.units.filter(x => !x.pc && x !== t && standing(state, x) && gap(x, t) <= 6)) {
    const g = abilitiesOf(CREATURES[o.cname]).find(a => a.kind === "griefFury");
    if (g && g.who.test(t.cname)) { note(`${o.name} roars in grief (Grief Fury).`, "event"); addCond(state, note, o, "invigorated", 1, { by: o.id }); }
  }
  morale(state, rng, note, "fall");
}
/** Panicked or turned: it runs, or cowers when cornered, and attacks no one. */
const cowed = (u) => u.demoralized >= 3 || !!u.turnedBy;
const has = (u, kind) => !u.pc && abilitiesOf(CREATURES[u.cname]).find(a => a.kind === kind);

function regroupHeads(u) {
  const c = CREATURES[u.cname];
  const fp = groupTokenSize(Math.max(1, u.heads), c.size.width * c.size.height);
  u.w = fp.width; u.h = fp.height;
  u.name = `${u.cname}s (${u.heads})`;
}

/** A grab holds only while the grabber stands beside its catch. */
function holdStands(state, u) {
  const g = u.held && unitById(state.battle, u.held.by);
  return !!(g && standing(state, g) && (u.held.ranged || gap(g, u) <= reachOf(g, CREATURES[g.cname])));
}

/** Run the battle until it needs the player: a character's turn, a decision, or the next declarations. */
export function advance(state, rng, note) {
  const b = state.battle;
  for (let n = 0; n < 2000 && state.battle === b; n++) {
    if (b.prompt || b.stage !== "phase") return;
    if (b.queue.length) { runOp(state, rng, note); if (checkEnd(state, rng, note)) return; continue; }
    if (checkEnd(state, rng, note)) return;
    if (b.current) {
      const u = unitById(b, b.current);
      if (!able(state, u) || u.ap <= 0) { finishTurn(state, u, rng, note); continue; }
      if (u.pc) return;
      aiStep(state, rng, note, u);
      continue;
    }
    nextActor(state, rng, note);
  }
}

/* ------------------------------------------------------------------ */
/* The player's actions                                                 */

export function currentPC(state) {
  const b = state.battle;
  if (!b || b.stage !== "phase" || b.prompt || b.queue.length) return null;
  const u = b.current && unitById(b, b.current);
  return u?.pc ? u : null;
}

/** What it costs to move a character to x, y: { path, ap } or null. */
export function moveCost(state, u, x, y) {
  const b = state.battle;
  if (cond(u, "restricted") >= 1) return null;
  const path = pathTo(b, u, x, y);
  if (!path || !path.length) return null;
  // Demoralized: no willing step toward the source of the fear.
  const fear = u.demoralized && u.fearOf && unitById(b, u.fearOf);
  if (fear && onField(fear) && gap({ ...u, x, y }, fear) < gap(u, fear)) return null;
  // Prone: one square per AP. Tainted 2 and up: movement halved.
  let speed = u.prone ? 1 : speedFor(state, u);
  if (slowed(u)) speed = Math.max(1, Math.floor(speed / 2));
  let left = u.moveLeft, ap = 0, last = u.lastMove;
  while (left < path.length) {
    if (ap >= u.ap) return null;
    left += speed + (last ? Math.floor(speed / 2) : 0);
    last = true; ap += 1;
  }
  return { path, ap, left: left - path.length };
}

export function pcMove(state, rng, note, x, y) {
  const u = currentPC(state);
  if (!u) return;
  const cost = moveCost(state, u, x, y);
  if (!cost) return;
  u.ap -= cost.ap;
  u.moveLeft = cost.left;
  u.lastMove = true;
  state.battle.queue.push({ op: "move", id: u.id, path: cost.path, asked: [] });
  advance(state, rng, note);
}

/** The attack modes a character has: a plain strike, the shield bash, Opportunist. */
export function attackModes(state, u) {
  const m = memberOf(state, u), w = weaponOf(m, u);
  if (u.companion) {
    const modes = [{ id: "strike", label: m.attack.name }];
    // The boar form (Mastery Core Classes, Puca): Gore and Trample. Charge is the plain strike from far off.
    if (m.form === "boar") modes.push({ id: "gore", label: "Gore (Impotence, bleeding)" }, { id: "trample", label: "Trample (2 AP)" });
    if (m.ability === "Hellfire" && u.declared?.hellfire && !u.hellfired) modes.push({ id: "hellfire", label: "Hellfire (2 AP, 2 magan)" });
    return modes;
  }
  const modes = [{ id: "strike", label: w ? w.name : "Unarmed" }];
  if (usesShield(m, w) && w && !w.ranged) modes.push({ id: "shield", label: `${m.shield.name} bash` });
  if ((m.abilities || []).includes("Opportunist") && w?.attribute === "physique") modes.push({ id: "opportunist", label: "Opportunist (2 AP)" });
  return modes;
}

/** Opportunist (Stealth): flanking, two or more allies threatening, or a target Impaired from Startle. */
function opportunity(state, u, t, ranged) {
  const b = state.battle;
  const threats = b.units.filter(o => o.side === u.side && o !== u && standing(state, o) && gap(o, t) <= 1).length;
  if (threats >= 2) return true;
  if (t.startle > 0) return true;
  return !ranged && flanking(state, u, t);
}

/** A straight line of at least 3 squares, no farther than one Move, that ends within reach of the target (Charge). */
export function chargeLine(state, u, t, speed) {
  const b = state.battle;
  const reach = u.pc ? 1 : reachOf(u, CREATURES[u.cname]);
  if (gap(u, t) <= reach || cond(u, "restricted") || u.prone) return null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const path = [];
    for (let k = 1; k <= speed; k++) {
      const x = u.x + dx * k, y = u.y + dy * k;
      if (blockedFor(b, u, x, y)) break;
      path.push([x, y]);
      if (k >= 3 && gap({ ...u, x, y }, t) <= reach) return path;
    }
  }
  return null;
}

/**
 * Trample (Puca, boar form): a straight run of up to full speed; the enemies
 * beside the path, this one first and at most one more, share one tusk roll.
 */
function trampleRun(state, u, t) {
  const b = state.battle;
  let best = null;
  for (const run of straightRuns(b, u, speedFor(state, u))) {
    for (let k = 1; k <= run.path.length; k++) {
      const path = run.path.slice(0, k);
      const near = (o) => path.some(([x, y]) => gap({ ...u, x, y }, o) <= 1) || gap(u, o) <= 1;
      if (!near(t)) continue;
      const others = b.units.filter(o => o !== t && o.side !== u.side && standing(state, o) && !isObject(o) && near(o));
      const hit = [t, ...others.slice(0, 1)];
      if (!best || hit.length > best.hit.length) best = { path, hit };
    }
  }
  return best;
}

/** Can the current character attack this target? → { ok, why, ranged, charge, cost } */
export function canAttack(state, u, t, mode = u.mode || "strike") {
  if (!t || t.side === u.side || !onField(t)) return { ok: false };
  if (cond(u, "restricted") >= 3) return { ok: false, why: "Restrained: only breaking free" };
  if (turning(u)) return { ok: false, why: "holding the Turn: only defense and movement" };
  const cost = mode === "opportunist" || mode === "trample" || mode === "hellfire" ? 2 : 1;
  if (u.ap < cost) return { ok: false, why: `needs ${cost} AP` };
  const m = memberOf(state, u), w = weaponOf(m, u);
  const g = gap(u, t);
  if (mode === "hellfire") {
    const o = ownerOf(state, u);
    if ((o.mp || 0) < 2) return { ok: false, why: `${o.name} has no 2 magan to give` };
    if (g > 3) return { ok: false, why: "beyond the 15-foot cone" };
    return { ok: true, ranged: false, hellfire: true, cost };
  }
  if (mode === "trample") {
    if (cond(u, "restricted") || u.prone) return { ok: false, why: "can't run" };
    const run = trampleRun(state, u, t);
    return run ? { ok: true, ranged: false, trample: run, cost } : { ok: false, why: "no straight run passes it" };
  }
  const ranged = !!w?.ranged && mode !== "shield";
  if (mode === "opportunist" && !opportunity(state, u, t, ranged)) return { ok: false, why: "no opening for Opportunist (flank it, or two allies on it)" };
  if (ranged) {
    const b = state.battle;
    if (w.thrown && (w.count ?? 1) - (b.thrown[`${m.id}:${u.weapon}`] || 0) <= 0) return { ok: false, why: `no ${w.name.toLowerCase()} left` };
    if (w.projectile && b.units.some(o => o.side !== u.side && standing(state, o) && gap(u, o) <= 1)) return { ok: false, why: "an enemy is too close to shoot" };
    if (g > w.range[2]) return { ok: false, why: "out of range" };
    return { ok: true, ranged: true, cost };
  }
  if (g > 1) {
    // Charge (Untrained baseline maneuver): 2 AP, a straight run of 15 feet or more, then the attack with Dominance.
    if (mode === "strike" && u.ap >= 2 && !u.prone && chargeLine(state, u, t, speedFor(state, u))) return { ok: true, ranged: false, charge: true, cost: 2 };
    return { ok: false, why: "out of reach" };
  }
  return { ok: true, ranged: false, cost };
}

/**
 * What the current character could do right now that a player might miss:
 * openings, charges, allies to save or free, help on hand. → [{ text, rule }]
 */
export function opportunities(state, u) {
  const b = state.battle, m = memberOf(state, u), out = [];
  if (turning(u)) return [{ text: "You're holding the Turn: you can move and defend, nothing else. Release it to act.", rule: "Turned creatures are compelled to flee from you as fast as they are able for as long as you concentrate. While turning, you must hold your Focus in hand and can take no actions other than defense and movement (Paladin, Turn)." }];
  const foes = b.units.filter(t => !t.pc && standing(state, t));
  if (attackModes(state, u).some(x => x.id === "opportunist") && u.ap >= 2) {
    for (const t of foes.filter(f => canAttack(state, u, f, "opportunist").ok)) {
      const why = t.startle > 0 ? "it's dazed from Startle" : b.units.filter(o => o.side === u.side && o !== u && standing(state, o) && gap(o, t) <= 1).length >= 2 ? "two allies are on it" : "you're flanking it";
      const sup = t.demoralized >= 2 || t.startle >= 2;
      out.push({ text: `Opportunist on ${t.name}: ${why}. Backstab gives Dominance${sup ? " and Superiority" : ""}.`, rule: RULES.opportunist + "\n\n" + RULES.backstab });
    }
  }
  if (u.ap >= 2) for (const t of foes.filter(f => canAttack(state, u, f, "strike").charge)) out.push({ text: `Charge ${t.name}: a straight run in, 2 AP, Dominance.`, rule: RULES.charge });
  for (const t of foes.filter(f => gap(u, f) <= 1 && flanking(state, u, f))) out.push({ text: `You're flanking ${t.name}: +2 to your attacks on it.`, rule: RULES.flanking });
  for (const t of foes.filter(f => f.prone)) out.push({ text: `${t.name} is prone: melee attacks on it have Superiority.`, rule: RULES.prone });
  for (const t of foes.filter(f => f.smashing)) out.push({ text: `${t.name} is winding up a Smash: attacks on it have Superiority until it lands.`, rule: RULES.smash });
  for (const t of foes.filter(f => helpless(state, f))) out.push({ text: `${t.name} is helpless: it can't defend.`, rule: RULES.helpless });
  for (const t of b.units.filter(x => x.pc && x !== u && onField(x) && memberOf(state, x).dying != null && !memberOf(state, x).stable)) {
    const d = gap(u, t);
    out.push({ text: d <= 1 ? `${t.name} is bleeding out (${memberOf(state, t).dying} rounds): stop it now, 2 AP.` : `${t.name} is bleeding out (${memberOf(state, t).dying} rounds), ${d - 1} square${d === 2 ? "" : "s"} from reach: get beside them and spend 2 AP.`, rule: RULES.triage });
  }
  if (u.held) out.push({ text: `You're held (${u.held.name}): break free for 1 AP, Strength against ${u.held.dc}.`, rule: RULES.breakFree });
  for (const t of b.units.filter(x => x.pc && x !== u && onField(x) && x.held && gap(u, x) <= 1)) out.push({ text: `${t.name} is held: help them break free for 1 AP.`, rule: RULES.assist });
  if (u.casting) out.push({ text: `You're casting ${u.casting.label}: release it this turn (1 AP)${u.casting.noSomatic ? "" : ". Attacking or defending first loses it"}.`, rule: "You lose the spell and its magan if, before it resolves, you: cast another spell, use another ability, or choose to stop; defend, attack, or interact with an object, unless the spell has no somatic components; cannot spend its AP when it resolves; take health damage and fail a Miscast trial against a DC equal to the health lost (Magic Mastery, Interrupted Casting)." });
  for (const o of reapplyOptions(state, u).filter(x => x.targets.length)) out.push({ text: `${o.e.name} is still held: 1 AP turns it on a target again.`, rule: "When a target resists a sustained condition spell or breaks free of it, the spell stays in your concentration slot for its duration. On your turn, you can spend 1 AP to apply it again to the same target or to a new one within the spell's reach. The target makes a fresh trial to resist (Magic Mastery, Conditions)." });
  if (u.theurgy) out.push({ text: `${u.theurgy.mode === "destroy" ? "Destroy" : "Turn"} is ready: 1 AP, Charisma and Lore dice against ${u.theurgy.division * 2}.`, rule: "Choose Asura or Daeva, then choose one Division; every creature of that Division you can see is targeted. On your turn, roll your Charisma tier die + Lore skill die. DC: Division × 2. Roll ÷ Division (rounded down) = number turned. Turned creatures flee from you as long as you concentrate. While turning, you can take no actions other than defense and movement. Destroy Daeva: roll ÷ DC = number destroyed (Paladin, Theurgic Authority)." });
  if (u.fireAura) out.push({ text: `Your Fire Aura burns everyone within 10 feet at the end of their turns, your own side too (${u.fireAura} round${u.fireAura === 1 ? "" : "s"} left).`, rule: "Fire Aura: all creatures within 10 feet take fire damage equal to Perception tier each round. Lasts a number of rounds equal to Wisdom tier. You retain full control of your actions (Cursed, Possessed)." });
  for (const o of b.units.filter(x => x.pc && x !== u && x.fireAura > 0 && gap(x, u) <= 2)) out.push({ text: `You're inside ${o.name}'s Fire Aura: end your turn more than 10 feet from her or burn.`, rule: "Area auras fill the radius. A creature within the radius at the end of its turn takes the aura's damage; a creature that moves out during its turn takes none (Magic Mastery, Auras)." });
  if (imbueOptions(state, u).length && !u.imbue) out.push({ text: `You can Imbue your weapon (1 AP, 1 magan a round): +d${dieOfTier(chantTier(m))[1]} ${imbueOptions(state, u).join(" or ")} on every blow that lands.`, rule: "Imbue: spend 1 AP to imbue your weapon with a damage type from a spell form in which you have at least Untrained mastery. While imbued, when your weapon deals damage to durability or health, it deals additional damage of the chosen type equal to your tier die. You either dedicate your concentration slot to maintain the imbuing or spend 1 AP per round. Cost: 1 magan per round (Paladin, Chantment)." });
  if (attackModes(state, u).some(x => x.id === "hellfire")) out.push({ text: `Hellfire is ready: pick a target within 3 squares. Everything in the cone burns, your own side included.`, rule: "Hellfire (2 AP, Fast, declared): spend 2 magan from your bonded caster to breathe a 15-foot cone of hellfire. Creatures in the cone make an Agility trial against your DC or take d2 + d4 fire damage. Control trial: your tier die; on a 1, the Daeva chooses the direction." });
  if (attackModes(state, u).some(x => x.id === "trample")) for (const t of foes.filter(f => canAttack(state, u, f, "trample").trample?.hit.length > 1)) out.push({ text: `Trample can catch ${canAttack(state, u, t, "trample").trample.hit.map(x => x.name).join(" and ")} in one run (2 AP, Inferiority).`, rule: "Trample (2 AP, Movement + Attack): move in a straight line up to full speed. Roll one tusk attack with Inferiority and apply it to up to 2 targets in the path." });
  const helper = heartener(state, u, "heartenDefense");
  if (helper) out.push({ text: `${helper.name} can hearten your rolls (+${tierOf(memberOf(state, helper).attributes.charisma)}).`, rule: RULES.hearten });
  if (usesShield(m, weaponOf(m, u)) && attackModes(state, u).some(x => x.id === "shield")) out.push({ text: `You can bash with the ${m.shield.name.toLowerCase()} instead of the weapon (1 AP, Crushing).`, rule: RULES.shield });
  return out;
}

export function setMode(state, mode) {
  const u = currentPC(state);
  if (u && attackModes(state, u).some(x => x.id === mode)) u.mode = mode;
}

export function pcAttack(state, rng, note, targetId) {
  const u = currentPC(state);
  if (!u) return;
  const b = state.battle;
  const t = unitById(b, targetId);
  const can = canAttack(state, u, t);
  if (!can.ok) { if (can.why) note(can.why[0].toUpperCase() + can.why.slice(1) + "."); return; }
  const m = memberOf(state, u), w = weaponOf(m, u);
  u.ap -= can.cost; u.attacks += 1;
  if (can.hellfire) {
    u.mode = "strike";
    hellfire(state, rng, note, u, t);
    return advance(state, rng, note);
  }
  if (can.trample) {
    // One tusk roll with Inferiority, shared by everyone beside the path.
    const key = `trample:${u.id}:${b.round}:${u.attacks}`;
    b.queue.push({ op: "move", id: u.id, path: can.trample.path, asked: [] });
    for (const x of can.trample.hit) b.queue.push({ op: "attack", by: u.id, target: x.id, ranged: false, inf: true, shared: key, lineReach: true, rider: "Trample" });
    note(`${u.name} tramples through (${can.trample.hit.map(x => x.name).join(", ")}).`);
    u.moveLeft = 0; u.lastMove = false; u.mode = "strike";
    return advance(state, rng, note);
  }
  const op = { op: "attack", by: u.id, target: t.id, ranged: can.ranged };
  if (u.mode === "gore") {
    // Gore: Impotence, and health damage opens an Endurance trial or Attrition (Bleeding) by the Puca's tier.
    const pd = petDice(state, u);
    op.edge = -1; op.rider = "Gore";
    op.riderSpec = { name: "Gore", gate: "health", resist: { attr: "endurance", dc: pd.dc }, attrition: { label: "Bleeding", amount: m.tier } };
  }
  if (u.mode === "shield") op.shield = true;
  if (u.mode === "opportunist") {
    op.opportunist = true;
    // Backstab: Opportunist attacks always have Dominance; Superiority against the badly shaken or startled.
    if ((m.abilities || []).includes("Backstab")) { op.edge = 1; if (t.demoralized >= 2 || t.startle >= 2) op.sup = true; }
  }
  if (can.ranged && w?.thrown) op.thrownKey = `${m.id}:${u.weapon}`;
  if (can.charge) {
    const path = chargeLine(state, u, t, speedFor(state, u));
    b.queue.push({ op: "move", id: u.id, path, asked: [] });
    op.edge = 1; op.charge = true;
    note(`${u.name} charges ${t.name}.`);
  }
  u.moveLeft = 0; u.lastMove = false;
  if (u.mode !== "strike") u.mode = "strike";
  b.queue.push(op);
  advance(state, rng, note);
}

/**
 * Hellfire (Agathion, Daeva): declared, Fast, 2 AP, and 2 magan from its
 * bonded caster. The control trial is the Agathion's tier die; on a 1 the
 * Daeva aims it. A 15-foot cone (3 squares, 90 degrees): every creature in
 * it, friend or foe, makes an Agility trial against the Agathion's DC or
 * takes d2 + d4 fire.
 */
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
export function coneSquares(u, dir) {
  const out = [];
  const len = Math.hypot(dir[0], dir[1]) || 1;
  for (let y = u.y - 3; y <= u.y + 3; y++) for (let x = u.x - 3; x <= u.x + 3; x++) {
    const dx = x - u.x, dy = y - u.y;
    if (!dx && !dy) continue;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 3) continue;
    const cos = (dx * dir[0] + dy * dir[1]) / (Math.hypot(dx, dy) * len);
    if (cos >= Math.SQRT1_2 - 1e-9) out.push([x, y]);
  }
  return out;
}
const centre = (u) => [u.x + (u.w - 1) / 2, u.y + (u.h - 1) / 2];
function hellfire(state, rng, note, u, t) {
  const b = state.battle, o = ownerOf(state, u), pet = memberOf(state, u), pd = petDice(state, u);
  o.mp -= 2; u.hellfired = true;
  const ctl = rng.d(pd.tier[1]);
  let dir;
  if (ctl === 1) {
    dir = DIRS[rng.d(8) - 1];
    note(`${pet.name} breathes Hellfire (2 AP; ${o.name} gives 2 magan). Control d${pd.tier[1]} 1: the Daeva aims it.`, "event");
  } else {
    const [tx, ty] = centre(t);
    dir = [tx - u.x, ty - u.y];
    note(`${pet.name} breathes Hellfire at ${t.name} (2 AP; ${o.name} gives 2 magan). Control d${pd.tier[1]} ${ctl}: it goes where it's sent.`);
  }
  const sq = coneSquares(u, dir);
  const caught = b.units.filter(x => x !== u && onField(x) && !(x.pc && memberOf(state, x).dead) && sq.some(([x0, y0]) => covers(x, x0, y0)));
  if (!caught.length) { note("The fire finds no one."); return; }
  for (const x of caught) {
    if (!onField(x)) continue;
    if (isObject(x)) { secondaryDamage(state, rng, note, x, rng.d(2) + rng.d(4), "fire", "Hellfire", { magic: true }); continue; }
    const r = resist(state, rng, x, "agility", pd.dc);
    note(`${x.name} twists away from the fire (Agility ${r.text} against ${pd.dc}): ${r.ok ? "clear" : "caught"}.`);
    if (!r.ok) secondaryDamage(state, rng, note, x, rng.d(2) + rng.d(4), "fire", "Hellfire", { magic: true });
  }
}

/* ------------------------------------------------------------------ */
/* Spells (Magic Mastery)                                               */

/** Spell speed from the cost before components (Magic Mastery, Spell Speed). */
const cap = (w) => w[0].toUpperCase() + w.slice(1);
export const spellSpeed = (cost) => cost <= 3 ? "fast" : cost <= 6 ? "moderate" : "slow";
const castDie = (m) => dieOfTier(tierOf(m.attributes[m.casting.attr]));
const masteryDie = (m, form) => dieOfTier(m.casting.forms[form] || 1);
/** A spell as this caster recorded it: the chapter's spell with the caster's own parameters over it. */
function spellOf(m, name) {
  const sp = SPELLS[name];
  return sp && { ...sp, ...(m.casting?.recorded?.[name] || {}), name };
}

/**
 * The castings a character could declare this round, with what each costs:
 * the familiar spell as recorded, and for a heal, the older-wounds version
 * (this encounter, ×3), a modified casting with a miscast trial against
 * the change in cost (Magic Mastery, Healing and Repair; Modified Familiar Casting).
 */
export function castOptions(state, u) {
  const m = memberOf(state, u);
  if (!m.casting || u.companion || turning(u)) return [];
  const out = [];
  for (const name of m.spells || []) {
    const sp = spellOf(m, name);
    if (!sp) continue;
    const pay = (c) => m.casting.polestar ? Math.max(1, c - 1) : c; // the Polestar focus: 1 less, never below 1
    out.push({ key: name, name, label: name, base: sp.cost, cost: pay(sp.cost), phase: spellSpeed(sp.cost), age: sp.kind === "heal" ? "round" : null });
    if (sp.kind === "heal") {
      const older = sp.cost + 2 * SPELLS[name].cost;
      out.push({ key: `${name}:older`, name, label: `${name}, older wounds`, base: older, cost: pay(older), phase: spellSpeed(older), age: "encounter", miscast: Math.max(2, older - sp.cost) });
    }
  }
  return out;
}

/** Declaring draws the magan (Interrupted Casting). Short of it, the pool empties and the caster advances Exhausted (Overcasting). */
function declareSpell(state, note, u, key) {
  const m = memberOf(state, u);
  const opt = castOptions(state, u).find(o => o.key === key);
  if (!opt) return;
  if ((m.mp || 0) >= opt.cost) m.mp -= opt.cost;
  else {
    m.mp = 0;
    addCond(state, note, u, "exhausted", 1, { lasting: true });
    note(`${m.name} overcasts: the pool runs dry.`, "event");
  }
  u.casting = { ...opt, noSomatic: !!spellOf(m, opt.name).noSomatic };
  note(`${m.name} begins casting ${opt.label} (${opt.cost} magan, ${cap(opt.phase)} phase).`);
}

/** The spell in hand is lost, and its magan with it. */
function loseSpell(state, note, u, why) {
  if (!u.casting) return;
  note(`${u.name} loses ${u.casting.label} (${why}); the magan is spent.`, "event");
  u.casting = null;
}
/** Attacking or defending loses a spell cast with gestures. */
const somatic = (u) => u.casting && !u.casting.noSomatic;

/** Health lost while casting: a Miscast trial against the health lost, or the spell is gone. Even familiar spells, and no coercing. */
function miscastOnHurt(state, rng, note, u, dmg) {
  if (!u.casting) return;
  const m = memberOf(state, u);
  const t = trial(rng, [castDie(m), masteryDie(m, SPELLS[u.casting.name].form)]);
  const ok = passes(t, dmg);
  note(`${m.name} holds ${u.casting.label} through the pain? Miscast ${t.text} against ${dmg}: ${ok ? "holds" : "no"}.`);
  if (!ok) loseSpell(state, note, u, "the wound broke it");
}

/** Where a spell can come from: the caster, or a Puca within 30 feet (Spell Conduit). */
function spellOrigins(state, u) {
  const m = memberOf(state, u), out = [u];
  if (m.companion?.ability === "Spell Conduit") {
    const pet = unitById(state.battle, m.companion.id);
    if (pet && standing(state, pet) && gap(u, pet) <= 6) out.push(pet);
  }
  return out;
}

/** Who the spell in hand could land on now. */
export function castTargets(state, u) {
  const b = state.battle, c = u.casting;
  if (!c || u.ap < 1 || turning(u)) return [];
  const sp = spellOf(memberOf(state, u), c.name);
  const near = (t) => spellOrigins(state, u).some(o => o === t || gap(o, t) <= (sp.reach || 1));
  if (sp.kind === "damage" || sp.kind === "condition") return b.units.filter(t => t.side !== u.side && standing(state, t) && !isObject(t) && near(t));
  return b.units.filter(t => t.side === u.side && onField(t) && !memberOf(state, t).dead && near(t) &&
    (sp.kind !== "heal" || memberOf(state, t).hp < (t.companion ? memberOf(state, t).health : memberOf(state, t).health)) &&
    (sp.kind !== "heal" || c.age !== "round" || (t.lostThisRound || 0) > 0));
}

/** Release the spell in hand on a target: 1 AP. */
export function pcCast(state, rng, note, targetId) {
  const u = currentPC(state);
  if (!u?.casting) return;
  const t = castTargets(state, u).find(x => x.id === targetId);
  if (!t) return;
  const c = u.casting, m = memberOf(state, u);
  u.ap -= 1; u.casting = null; u.moveLeft = 0; u.lastMove = false;
  if (c.miscast) {
    const tr = trial(rng, [castDie(m), masteryDie(m, SPELLS[c.name].form)]);
    if (!passes(tr, c.miscast)) {
      state.battle.queue.unshift({ op: "ask" });
      state.battle.prompt = { kind: "coerce", id: u.id, target: t.id, cast: c, yes: "Force it", no: "Let it fail",
        text: `${m.name}'s ${c.label} slips (Miscast ${tr.text} against ${c.miscast}). Force it through and advance Exhausted by 1 tier?` };
      return;
    }
    note(`${m.name} reaches back for the older wounds (Miscast ${tr.text} against ${c.miscast}).`);
  }
  releaseSpell(state, rng, note, u, t, c);
  advance(state, rng, note);
}

function releaseSpell(state, rng, note, u, t, c) {
  const b = state.battle, m = memberOf(state, u), sp = spellOf(m, c.name);
  const dc = m.casting.dc;
  const power = () => rollPool(rng, [castDie(m), masteryDie(m, sp.form)], { extra: -1 });
  if (sp.kind === "damage") {
    const r = resist(state, rng, t, sp.resist, dc, { vsType: sp.type });
    note(`${m.name} casts ${sp.name} at ${t.name}. ${t.name} resists with ${cap(sp.resist)} (${r.text} against ${dc}): ${r.ok ? "untouched" : "it lands"}.`);
    if (!r.ok) {
      const d = power(), before = tally(t);
      note(`${sp.name}: ${d.text}.`);
      secondaryDamage(state, rng, note, t, d.total, sp.type, sp.name, { magic: true });
      if (!t.pc && onField(t)) morale(state, rng, note, "hurt", t);
      demonTrigger(state, rng, note, u, kills(t, before));
    }
    return;
  }
  if (sp.kind === "condition") {
    const r = resist(state, rng, t, sp.resist, dc, { forCond: sp.cond });
    note(`${m.name} casts ${sp.name} on ${t.name}. ${t.name} resists with ${cap(sp.resist)} (${r.text} against ${dc}): ${r.ok ? "it holds firm" : "it gives"}.`);
    const entry = concentrate(state, note, u, { name: sp.name, kind: "condition", cond: sp.cond, target: r.ok ? null : t.id });
    if (!r.ok) { addCond(state, note, t, sp.cond, 1, { by: u.id, lasting: true }); if (sp.cond === "demoralized") t.fearOf = u.id; }
    else note(`${sp.name} stays in ${m.name}'s concentration: 1 AP on a later turn tries again.`);
    return entry;
  }
  if (sp.kind === "ward") {
    const pool = (m.casting.forms[sp.form] || 1) * 5 * (sp.duration || 1);
    (t.wards ||= []).push({ by: u.id, name: sp.name, against: sp.against, pool, round: (sp.duration || 1) === 1 ? b.round : null });
    note(`${m.name} casts ${sp.name} on ${t.name}: a ward of ${pool} against ${sp.against} damage${(sp.duration || 1) === 1 ? ", for this round" : ""}.`, "reward");
    if (sp.concentration !== false && (sp.duration || 1) > 1) concentrate(state, note, u, { name: sp.name, kind: "ward", target: t.id });
    return;
  }
  if (sp.kind === "heal") {
    const tm = memberOf(state, t), max = tm.health;
    const d = power();
    let n = Math.min(d.total, max - tm.hp);
    if (c.age === "round") n = Math.min(n, t.lostThisRound || 0);
    if (c.age === "round") t.lostThisRound -= n;
    const was = tm.hp;
    tm.hp += n;
    note(`${m.name} casts ${c.label} on ${t.name} (${d.text}): ${was} → ${tm.hp} health${c.age === "round" && d.total > n ? " (only this round's wounds)" : ""}.`, "reward");
    if (was <= 0 && tm.hp > 0 && !t.companion) {
      tm.down = false; tm.dying = null; tm.stable = false; tm.fightingOn = false;
      note(`${tm.name} comes to.`, "reward");
    }
  }
}

/**
 * Concentration (Magic Mastery): the newest spell takes the free slot and
 * the one it displaces turns passive. A passive spell breaks on any damage
 * to health or durability, unless it was cast this round.
 */
function concentrate(state, note, u, entry) {
  // Imbue holds only in the free slot (the 1 AP a round to pay for it elsewhere isn't built): pushed out, it ends.
  for (const e of [...(u.conc || [])]) if (e.slot === "free" && e.kind === "imbue") endConcentration(state, note, u, e, "ends: the free slot went elsewhere");
  for (const e of u.conc || []) if (e.slot === "free") e.slot = "passive";
  const e = { id: `${entry.name}:${state.battle.round}:${(u.conc || []).length}`, ...entry, slot: "free", round: state.battle.round };
  (u.conc ||= []).push(e);
  return e;
}
export function concentrationOf(u) { return u.conc || []; }
/** At declarations: which spell takes the free slot this round. */
function setFreeSlot(u, id) {
  if (!(u.conc || []).some(e => e.id === id)) return;
  for (const e of u.conc) e.slot = e.id === id ? "free" : "passive";
}
function endConcentration(state, note, u, e, why) {
  const b = state.battle;
  u.conc = (u.conc || []).filter(x => x !== e);
  const t = e.target && unitById(b, e.target);
  if (e.kind === "ward" && t) t.wards = (t.wards || []).filter(w => !(w.by === u.id && w.name === e.name));
  // A held condition starts standard deterioration (Conditions spells).
  if (e.kind === "condition" && t && cond(t, e.cond)) (t.decay ||= {})[e.cond] = { by: null, round: b.round };
  if (e.kind === "turn") for (const id of e.targets || []) { const x = unitById(b, id); if (x) x.turnedBy = null; }
  if (e.kind === "imbue") u.imbue = null;
  note(`${u.name}'s ${e.name} ${why}.`, "event");
}
/** Damage reached the caster: passive spells break. */
function shaken(state, note, u) {
  for (const e of [...(u.conc || [])]) if (e.slot === "passive" && e.round !== state.battle.round) endConcentration(state, note, u, e, "breaks as the blow lands");
}
/** Out cold or dead: every spell lets go. */
function dropAllSpells(state, note, u) {
  loseSpell(state, note, u, "they went down");
  for (const e of [...(u.conc || [])]) endConcentration(state, note, u, e, "ends");
}
/** The ward standing against this damage type, if any. */
const wardFor = (t, type) => (t.wards || []).find(w => w.pool > 0 && wardCovers(w.against, type));
function drainWard(state, note, t, w, n) {
  if (!w || !n) return;
  w.pool -= n;
  note(`${w.name} on ${t.name} takes ${n}${w.pool > 0 ? ` (${w.pool} left)` : ", and fails"}.`);
  if (w.pool > 0) return;
  t.wards = t.wards.filter(x => x !== w);
  const caster = unitById(state.battle, w.by);
  const e = caster && (caster.conc || []).find(x => x.kind === "ward" && x.name === w.name && x.target === t.id);
  if (e) caster.conc = caster.conc.filter(x => x !== e);
}
/** Reapply a resisted or broken condition spell still held in concentration: 1 AP, no magan. */
export function reapplyOptions(state, u) {
  const b = state.battle;
  return (u.conc || []).filter(e => e.kind === "condition" && !e.target).map(e => ({ e, targets: u.ap < 1 ? [] : b.units.filter(t => t.side !== u.side && standing(state, t) && !isObject(t) && spellOrigins(state, u).some(o => gap(o, t) <= (SPELLS[e.name].reach || 1))) }));
}
export function pcReapply(state, rng, note, entryId, targetId) {
  const u = currentPC(state);
  if (!u) return;
  const opt = reapplyOptions(state, u).find(o => o.e.id === entryId);
  const t = opt?.targets.find(x => x.id === targetId);
  if (!t) return;
  u.ap -= 1;
  const m = memberOf(state, u), sp = spellOf(m, opt.e.name);
  const r = resist(state, rng, t, sp.resist, m.casting.dc, { forCond: sp.cond });
  note(`${m.name} turns ${sp.name} on ${t.name} again (1 AP). ${t.name} resists with ${cap(sp.resist)} (${r.text} against ${m.casting.dc}): ${r.ok ? "it holds firm" : "it gives"}.`);
  if (!r.ok) { opt.e.target = t.id; addCond(state, note, t, sp.cond, 1, { by: u.id, lasting: true }); if (sp.cond === "demoralized") t.fearOf = u.id; }
  advance(state, rng, note);
}

/* ------------------------------------------------------------------ */
/* Class abilities: the Cursed and the Paladin (Mastery Core Classes)   */

/** How much of a creature there is to kill: heads for a minion group, else whether it still stands. */
const tally = (t) => t.minion ? t.heads : onField(t) && t.hp > 0 ? 1 : 0;
const kills = (t, before) => t.pc ? 0 : Math.max(0, before - tally(t));

/**
 * Demon Trigger (Possessed): each killing blow Gisla deals herself, she rolls
 * her Wisdom tier die; a 1 fails, and each kill in the same action widens it
 * by one. A failure lights her Fire Aura.
 */
function demonTrigger(state, rng, note, u, n) {
  const m = memberOf(state, u);
  if (!n || !(m.abilities || []).includes("Possessed")) return;
  const die = dieOfTier(tierOf(m.attributes.wisdom))[1], r = rng.d(die);
  const fail = r <= n;
  note(`Demon Trigger: ${m.name} rolls d${die} ${r}${n > 1 ? ` (${n} kills: fails on 1-${n})` : ""}: ${fail ? "the demon wakes" : "she holds it down"}.`, fail ? "event" : "");
  if (!fail) return;
  u.fireAura = tierOf(m.attributes.wisdom);
  note(`${m.name}'s Fire Aura flares: everyone within 10 feet burns for ${tierOf(m.attributes.perception)} each round, friend or foe, for ${u.fireAura} rounds.`, "event");
}
/** Area aura (Magic Mastery, Auras): a creature within the radius at the end of its turn takes the damage. Gisla is immune to her own. */
function fireAuraAt(state, rng, note, u) {
  for (const o of state.battle.units.filter(x => x.pc && x !== u && x.fireAura > 0 && onField(x) && !memberOf(state, x).dead)) {
    if (gap(o, u) <= 2) secondaryDamage(state, rng, note, u, tierOf(memberOf(state, o).attributes.perception), "fire", `${o.name}'s Fire Aura`);
  }
}

/** The Chantment tier: 1 at level 1, 2 at 4, 3 at 8, then every 4 levels (Chantment table). */
const chantTier = (m) => Math.min(7, 1 + Math.floor((m.level || 1) / 4));
/** Imbue (Chantment): 1 AP, a damage type from a form she knows; 1 magan a round, held in the concentration slot. */
export function imbueOptions(state, u) {
  const m = memberOf(state, u);
  if (!(m.abilities || []).includes("Imbue") || u.ap < 1 || turning(u) || (m.mp || 0) < (u.imbue ? 0 : 1)) return [];
  return Object.keys(m.casting?.forms || {}).filter(f => f !== u.imbue);
}
export function pcImbue(state, rng, note, type) {
  const u = currentPC(state);
  if (!u || !imbueOptions(state, u).includes(type)) return;
  const m = memberOf(state, u);
  u.ap -= 1;
  if (!u.imbue) {
    m.mp -= 1;
    concentrate(state, note, u, { name: "Imbue", kind: "imbue" });
  }
  u.imbue = type;
  note(`${m.name} imbues the ${weaponOf(m, u)?.name.toLowerCase() || "weapon"} with ${type} (1 AP${u.imbueRound === state.battle.round ? "" : ", 1 magan"}).`);
  u.imbueRound = state.battle.round;
  advance(state, rng, note);
}
/** Each new round the imbuing costs 1 magan; with none left, it fades. */
function upkeepImbue(state, note, u) {
  if (!u.imbue || u.imbueRound === state.battle.round) return;
  const m = memberOf(state, u);
  if ((m.mp || 0) < 1) {
    const e = (u.conc || []).find(x => x.kind === "imbue");
    if (e) endConcentration(state, note, u, e, "fades: no magan left"); else u.imbue = null;
    return;
  }
  m.mp -= 1; u.imbueRound = state.battle.round;
}

/**
 * Turn and Destroy Daeva (Theurgic Authority, Paladin). Declared: the
 * spirit and one Division, every creature of it in sight. On her turn,
 * Charisma tier die + Lore die against Division × 2.
 */
const LORE_DIE = { 1: 2, 2: 3, 3: 4, 4: 6, 5: 8, 6: 10, 7: 12 };
export const turning = (u) => (u.conc || []).some(e => e.kind === "turn");
export function turnOptions(state, u) {
  const m = memberOf(state, u), b = state.battle;
  if (!(m.abilities || []).includes("Turn") || u.turnUsed) return [];
  const out = [];
  const seen = new Set();
  for (const t of b.units.filter(x => !x.pc && standing(state, x) && !isObject(x) && !x.turnImmune)) {
    const c = CREATURES[t.cname];
    if (c.classification !== "daeva" && c.classification !== "asura") continue;
    const key = `${c.classification}:${c.division}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const who = b.units.filter(x => !x.pc && standing(state, x) && CREATURES[x.cname].classification === c.classification && CREATURES[x.cname].division === c.division).map(x => x.name).join(", ");
    out.push({ key: `turn:${key}`, label: `Turn ${c.classification === "daeva" ? "Daeva" : "Asura"} of Division ${c.division} (${who})`, phase: "fast" });
    if (c.classification === "daeva") out.push({ key: `destroy:${key}`, label: `Destroy Daeva of Division ${c.division} (${who})`, phase: "slow" });
  }
  return out;
}
export function pcTurn(state, rng, note) {
  const u = currentPC(state);
  if (!u?.theurgy || u.ap < 1) return;
  const b = state.battle, m = memberOf(state, u);
  const { mode, spirit, division } = u.theurgy;
  u.theurgy = null; u.ap -= 1;
  const targets = b.units.filter(x => !x.pc && standing(state, x) && !x.turnImmune && CREATURES[x.cname].classification === spirit && CREATURES[x.cname].division === division)
    .sort((x, y) => gap(u, x) - gap(u, y));
  const cha = dieOfTier(tierOf(m.attributes.charisma)), lore = [1, LORE_DIE[m.theurgy?.lore || 2]];
  const t = trial(rng, [cha, lore]);
  const dc = division * 2;
  const word = mode === "destroy" ? "destroy" : "turn";
  if (!passes(t, dc)) {
    note(`${m.name} raises the Swordbreaker and calls on her numen to ${word} the ${spirit} (${t.text} against ${dc}): nothing answers.`, "event");
    for (const x of targets) x.turnImmune = true;
    return advance(state, rng, note);
  }
  let n = Math.floor(t.total / (mode === "destroy" ? dc : division));
  note(`${m.name} calls on her numen to ${word} the ${spirit} (${t.text} against ${dc}): ${n} ${n === 1 ? "is" : "are"} ${mode === "destroy" ? "destroyed" : "turned"}.`, "reward");
  const held = [];
  for (const x of targets) {
    if (n <= 0) { x.turnImmune = true; continue; }
    if (x.minion) {
      // Heads are creatures: some of the group can go while the rest stand.
      const k = Math.min(n, x.heads);
      n -= k;
      if (k >= x.heads) {
        if (mode === "destroy") { x.heads = 0; x.hp = 0; note(`The ${x.cname.toLowerCase()}s crumble to nothing.`, "reward"); creatureFalls(state, rng, note, x); }
        else { x.turnedBy = u.id; held.push(x.id); note(`The ${x.cname.toLowerCase()}s break and flee from ${m.name}.`, "reward"); }
      } else {
        x.heads -= k; x.hp = x.heads; regroupHeads(x);
        note(`${k} of the ${x.cname.toLowerCase()}s ${mode === "destroy" ? "crumble to nothing" : "break away and flee the field"}; ${x.heads} stand.`, "reward");
        x.turnImmune = true;
      }
    } else {
      n -= 1;
      if (mode === "destroy") { x.hp = 0; note(`${x.name} crumbles to nothing, never to rise again.`, "reward"); creatureFalls(state, rng, note, x); }
      else { x.turnedBy = u.id; held.push(x.id); note(`${x.name} is turned: it flees from ${m.name}.`, "reward"); }
    }
  }
  if (held.length) {
    u.turnUsed = true;
    concentrate(state, note, u, { name: "Turn", kind: "turn", targets: held });
    note(`While she holds the Turn, ${m.name} can only defend and move.`);
  }
  morale(state, rng, note, "fall");
  advance(state, rng, note);
}
/** Let the Turn go: the turned are free of it. */
export function pcStopTurning(state, rng, note) {
  const u = currentPC(state);
  const e = u && (u.conc || []).find(x => x.kind === "turn");
  if (!e) return;
  endConcentration(state, note, u, e, "is released");
  advance(state, rng, note);
}

/** Break free of a hold (Conditions, Breaking free), for yourself or an adjacent ally: 1 AP, a Strength trial against the hold. */
export function freeTargets(state, u) {
  return state.battle.units.filter(t => t.pc && onField(t) && t.held && (t === u || gap(u, t) <= 1));
}
export function pcBreakFree(state, rng, note, targetId) {
  const u = currentPC(state);
  if (!u || u.ap < 1) return;
  const t = freeTargets(state, u).find(x => x.id === targetId);
  if (!t || (t === u ? u.brokeFree : t.helpedBy?.includes(u.id))) return;
  u.ap -= 1;
  if (t === u) u.brokeFree = true; else (t.helpedBy ||= []).push(u.id);
  const r = resist(state, rng, u, "strength", t.held.dc);
  note(`${u.name} ${t === u ? "strains against" : `helps ${t.name} against`} the ${t.held.name.toLowerCase()} (Strength ${r.text} against ${t.held.dc}): ${r.ok ? "it gives" : "it holds"}.`);
  if (r.ok) { setCond(t, "restricted", Math.max(0, cond(t, "restricted") - 1)); if (!cond(t, "restricted")) { t.held = null; note(`${t.name} is free.`); } }
  advance(state, rng, note);
}

/** Stand from Prone: 1 AP. */
export function pcStand(state, rng, note) {
  const u = currentPC(state);
  if (!u || !u.prone || u.ap < 1) return;
  u.ap -= 1; u.prone = false;
  note(`${u.name} gets up.`);
  advance(state, rng, note);
}

/** Triage (Combat): 2 AP beside a dying ally stops the dying timer. */
export function triageTargets(state, u) {
  if (turning(u)) return [];
  return state.battle.units.filter(t => t.pc && t !== u && onField(t) && gap(u, t) <= 1 && memberOf(state, t).dying != null && !memberOf(state, t).stable);
}
export function pcTriage(state, rng, note, targetId) {
  const u = currentPC(state);
  if (!u || u.ap < 2) return;
  const t = triageTargets(state, u).find(x => x.id === targetId);
  if (!t) return;
  u.ap -= 2; u.moveLeft = 0; u.lastMove = false;
  loseSpell(state, note, u, "tending a wound instead");
  const m = memberOf(state, t);
  m.stable = true; m.dying = null;
  note(`${u.name} stops ${m.name}'s bleeding (Triage, 2 AP). ${m.name} is stable, unconscious at 0 health.`, "reward");
  advance(state, rng, note);
}

export function pcEndTurn(state, rng, note) {
  const u = currentPC(state);
  if (!u) return;
  finishTurn(state, u, rng, note);
  advance(state, rng, note);
}

/** Answer the battle's prompt: true or false. */
export function respond(state, rng, note, yes) {
  const b = state.battle;
  const p = b?.prompt;
  if (!p) return;
  b.prompt = null;
  const head = b.queue[0];
  switch (p.kind) {
    case "defend": head.defend = !!yes; if (yes === "hearten" && p.helper) head.hearten = p.helper; else if (yes && p.autoHearten) head.hearten = p.autoHearten; break;
    case "snapshot": {
      b.queue.shift();
      if (yes) snapShot(state, unitById(b, p.by), unitById(b, p.target));
      break;
    }
    case "heartenAttack": head.heartenAsked = true; if (yes) head.heartenAtk = p.by; break;
    case "heartenTrial": head.heartenTrial = yes ? p.by : null; break;
    case "avoidDeath": {
      b.queue.shift();
      const u = unitById(b, p.id);
      if (yes) avoidDeath(state, rng, note, u); else dropToZero(state, rng, note, u, p.dmg);
      break;
    }
    case "counter":
    case "reprisal": {
      b.queue.shift();
      const u = unitById(b, p.by);
      if (yes && u.ap > 0) {
        u.ap -= 1;
        b.queue.unshift({ op: "attack", by: p.by, target: p.target, ranged: false, reaction: p.kind });
      }
      break;
    }
    case "coerce": {
      b.queue.shift();
      const u = unitById(b, p.id), t = unitById(b, p.target);
      if (yes) {
        addCond(state, note, u, "exhausted", 1, { lasting: true });
        note(`${u.name} forces ${p.cast.label} through (Coerced success).`, "event");
        if (t && onField(t)) releaseSpell(state, rng, note, u, t, p.cast);
      } else note(`${p.cast.label} fails; the magan is spent.`);
      break;
    }
    case "fightOn": {
      b.queue.shift();
      const u = unitById(b, p.id), m = memberOf(state, u);
      if (yes) { m.fightingOn = true; note(`${m.name} fights on at 0 health. Any more health damage is a Trauma.`, "event"); }
      else knockOut(state, note, u, "lets go and falls unconscious");
      break;
    }
  }
  advance(state, rng, note);
}

/**
 * Who runs and who is carried if the party breaks away: characters standing
 * on their own legs run; the unconscious are carried or left; anyone who
 * can't run (no legs, Paralyzed) is carried.
 */
export function runPlan(state) {
  const b = state.battle;
  const pcs = b.units.filter(u => u.pc && onField(u));
  const lame = (u) => cannotRun(memberOf(state, u)) || u.impaired >= 3;
  return {
    runners: pcs.filter(u => standing(state, u) && !lame(u)),
    downed: pcs.filter(u => memberOf(state, u).down),
    lame: pcs.filter(u => standing(state, u) && lame(u))
  };
}

/**
 * Break away (design/02-encounters.md, Running from a fight). It takes the
 * round: enemies beside a runner get their reprisal attacks as the party
 * goes, then one trial, at Impotence if anyone is carried. Clear of them,
 * the dying are tended; then the chase. carry: ids of the unconscious to carry.
 */
export function retreat(state, rng, note, carry = []) {
  const b = state.battle;
  if (!b || b.stage !== "declare") return;
  const d = rng.d(6);
  b.order = d <= 3 ? ["party", "enemy"] : ["enemy", "party"];
  b.breaking = { carry };
  note(`You try to break away. Initiative d6 ${d}: ${d <= 3 ? "your side" : "their side"} first if it comes to blows.`, "event");
  b.stage = "phase";
  for (const u of b.units.filter(x => x.pc)) { u.doneIn = [...PHASES]; u.ap = Math.min(u.ap, 1); }
  const { runners } = runPlan(state);
  for (const o of b.units.filter(x => !x.pc && standing(state, x) && x.ap > 0 && x.impaired < 3 && !cowed(x))) {
    const melee = meleeAttack(CREATURES[o.cname]);
    const t = runners.filter(r => gap(o, r) <= reachOf(o, CREATURES[o.cname])).sort((x, y) => preyRank(state, x) - preyRank(state, y))[0];
    if (!melee || !t) continue;
    o.ap -= 1; o.attack = CREATURES[o.cname].attacks.indexOf(melee);
    b.queue.push({ op: "attack", by: o.id, target: t.id, ranged: false, reaction: "reprisal" });
  }
  b.queue.push({ op: "breakaway" });
  advance(state, rng, note);
}

function runBreakaway(state, rng, note) {
  const b = state.battle;
  b.queue.shift();
  const plan = runPlan(state);
  const carried = [...plan.downed.filter(u => b.breaking.carry.includes(u.id)), ...plan.lame];
  const left = plan.downed.filter(u => !b.breaking.carry.includes(u.id));
  // One runner carries one body.
  if (carried.length > plan.runners.length) {
    const extra = carried.splice(plan.runners.length);
    note(`There aren't enough hands to carry ${extra.map(u => u.name).join(" and ")}.`, "event");
    left.push(...extra);
  }
  b.breaking = null;
  if (!plan.runners.length) { note("No one is left who can run.", "event"); return; }
  if (!breakAway(state, rng, b.head, note, plan.runners.filter(u => !u.companion).map(u => memberOf(state, u)), { carrying: carried.length > 0 })) {
    note("The round is spent running, and they come on.", "event");
    return;
  }
  for (const u of left) die(state, note, u, "is left behind");
  // The round is over: the dying timer ticks once, then the bleeding can be stopped.
  for (const u of b.units.filter(x => x.pc && onField(x))) {
    const m = memberOf(state, u);
    if (m.dying == null || m.stable) continue;
    if (m.dying <= 1) { die(state, note, u, "dies before anyone can stop the bleeding"); continue; }
    m.dying = null; m.stable = true;
    note(`Clear of them, you stop ${m.name}'s bleeding.`, "reward");
  }
  const runners = plan.runners.filter(u => onField(u) && !u.companion).map(u => memberOf(state, u));
  const stillCarried = carried.some(onField);
  if (chase(state, rng, b.head, note, runners, { carrying: stillCarried })) {
    note("No XP for a fight you ran from.");
    finish(state, rng, note, "fled");
    return;
  }
  note("The fight starts again at close quarters. You saw it coming, so no one is Startled.", "event");
  regroup(state);
  startRound(state, rng, note);
}

/** Caught after a chase: the party together on the left, the enemy close. */
function regroup(state) {
  const b = state.battle;
  const units = b.units.filter(onField);
  for (const u of units) { u.x = -100; u.y = -100; }
  units.filter(u => u.pc).forEach((u, i) => {
    const [x, y] = FORMATION[u.id] || [2, 3 + i];
    if (!blockedFor(b, u, x, y)) { u.x = x; u.y = y; } else place(b, u, 2);
  });
  for (const u of units.filter(x => !x.pc)) place(b, u, 5);
}

/* ------------------------------------------------------------------ */
/* The queue                                                            */

function runOp(state, rng, note) {
  const b = state.battle;
  const op = b.queue[0];
  if (op.op === "move") return runMove(state, rng, note, op);
  if (op.op === "attack") return runAttack(state, rng, note, op);
  if (op.op === "breakaway") return runBreakaway(state, rng, note);
  if (op.op === "trample" || op.op === "bolt" || op.op === "feed") { b.queue.shift(); return runEffect(state, rng, note, op); }
  if (op.op === "fallback") {
    b.queue.shift();
    const u = unitById(b, op.id), from = unitById(b, op.from);
    const path = u && from && onField(u) ? fallBackPath(state, u, from, op.steps) : null;
    if (path) b.queue.unshift({ op: "move", id: u.id, path, asked: [], noReprisal: true });
    return;
  }
  if (op.op === "afterHit") {
    b.queue.shift();
    const a = unitById(b, op.by), t = unitById(b, op.target);
    if (a && t) afterHit(state, rng, note, a, t, op.src, op.hit, op.info, op.heartenTrial ?? null);
    return;
  }
  b.queue.shift();
}

/** One step at a time, so leaving an enemy's reach can draw a reprisal attack first. */
function runMove(state, rng, note, op) {
  const b = state.battle;
  const u = unitById(b, op.id);
  while (op.path.length) {
    if (!onField(u) || (u.pc && memberOf(state, u).down)) break;
    const [nx, ny] = op.path[0];
    if (blockedFor(b, u, nx, ny)) break;
    const next = { ...u, x: nx, y: ny };
    for (const o of op.noReprisal ? [] : b.units) {
      if (o.side === u.side || op.asked.includes(o.id) || !standing(state, o) || o.ap < 1 || o.impaired >= 3) continue;
      const reach = reachOf(o, CREATURES[o.cname]);
      if (o.pc && (weaponOf(memberOf(state, o), o)?.ranged || turning(o))) continue;
      if (gap(o, u) > reach || gap(o, next) <= reach) continue;
      op.asked.push(o.id);
      if (o.pc) {
        const set = reactOf(memberOf(state, o), "reprisal");
        if (set === "never") continue;
        if (set === "always") { o.ap -= 1; b.queue.unshift({ op: "attack", by: o.id, target: u.id, ranged: false, reaction: "reprisal" }); return; }
        b.queue.unshift({ op: "ask" });
        b.prompt = { kind: "reprisal", by: o.id, target: u.id, text: `${u.name} is moving away from ${o.name}. Make a reprisal attack (1 AP)?` };
        return;
      }
      const om = meleeAttack(CREATURES[o.cname]);
      if (o.demoralized < 3 && (o.ap >= 2 || o.doneIn.length) && om) {
        o.ap -= 1; o.attack = CREATURES[o.cname].attacks.indexOf(om);
        b.queue.unshift({ op: "attack", by: o.id, target: u.id, ranged: false, reaction: "reprisal" });
        return;
      }
    }
    // Snap Shot (Untrained ranged baseline): a creature closing within 15 feet of a ready missile.
    if (!u.pc && !op.noReprisal) for (const o of b.units.filter(x => x.pc && standing(state, x) && x.ap > 0 && !op.asked.includes(`snap:${x.id}`))) {
      if (gap(o, u) <= 3 || gap(o, next) > 3 || !snapReady(state, o)) continue;
      op.asked.push(`snap:${o.id}`);
      const set = reactOf(memberOf(state, o), "snap");
      if (set === "never") continue;
      if (set === "always") { snapShot(state, o, u); return; }
      b.queue.unshift({ op: "ask" });
      b.prompt = { kind: "snapshot", by: o.id, target: u.id, yes: "Snap Shot", no: "Hold",
        text: `${u.name} is closing on ${o.name}. Snap Shot: a shot with Impotence, then fall back half a move (1 AP, ${o.ap} left)?` };
      return;
    }
    const wasIn = auraHolders(state, u).filter(h => gap(h.o, u) <= h.a.radius).map(h => h.o.id);
    u.x = nx; u.y = ny;
    if (u.id === b.current) u.movedThisTurn = true;
    op.path.shift();
    // Stepping into an aura on your own turn burns.
    if (u.id === b.current) for (const h of auraHolders(state, u)) {
      if (gap(h.o, u) <= h.a.radius && !wasIn.includes(h.o.id)) secondaryDamage(state, rng, note, u, h.a.amount, h.a.type, `${h.o.name}'s ${h.a.name}`);
    }
  }
  b.queue.shift();
  if (op.flee && onField(u) && (u.x === 0 || u.y === 0 || u.x + u.w >= b.w || u.y + u.h >= b.h)) {
    u.fled = true;
    note(`${u.name} flees the field.`, "event");
  }
}

/** Helpless creatures can't defend (Conditions: Paralyzed, Restrained, unconscious). */
const helpless = (state, t) => isObject(t) || t.impaired >= 3 || cond(t, "restricted") >= 3 || (t.pc && memberOf(state, t).down);

const auraHolders = (state, u) => state.battle.units.filter(o => o.side !== u.side && !o.pc && onField(o))
  .flatMap(o => abilitiesOf(CREATURES[o.cname]).filter(a => a.kind === "aura").map(a => ({ o, a })));

/** Is this character holding a missile they can loose right now? */
function snapReady(state, o) {
  const m = memberOf(state, o), w = weaponOf(m, o);
  if (!w?.ranged || (m.weaponSkill?.[w.type] || 1) < 2) return false;
  if (w.thrown && (w.count ?? 1) - (state.battle.thrown[`${m.id}:${o.weapon}`] || 0) <= 0) return false;
  if (w.projectile && state.battle.units.some(x => x.side !== o.side && standing(state, x) && gap(o, x) <= 1)) return false;
  return true;
}

/** Snap Shot: the shot with Impotence, then the fall back. */
function snapShot(state, u, t) {
  const b = state.battle;
  if (!u || !t || u.ap < 1) return;
  u.ap -= 1;
  const m = memberOf(state, u), w = weaponOf(m, u);
  const back = fallBack(state, u, t);
  if (back) b.queue.unshift({ op: "move", id: u.id, path: back, asked: [] });
  b.queue.unshift({ op: "attack", by: u.id, target: t.id, ranged: true, edge: -1, reaction: "snap", thrownKey: w.thrown ? `${m.id}:${u.weapon}` : null });
}

/** Fall back up to half a move, as far from the threat as the ground allows. */
function fallBack(state, u, from) {
  const b = state.battle;
  const steps = Math.floor(speedFor(state, u) / 2);
  let best = null;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const path = pathTo(b, u, x, y);
    if (!path || !path.length || path.length > steps) continue;
    const d = gap({ ...u, x, y }, from);
    if (!best || d > best.d) best = { d, path };
  }
  return best?.path || null;
}

function canDefend(state, t, type, ranged) {
  if (!standing(state, t) || t.ap < 1 || helpless(state, t)) return { can: false };
  return t.pc ? pcDefense(state, t, type, ranged) : creatureDefense(t, CREATURES[t.cname], type, ranged);
}

/** The dice for this attack: the weapon (or shield, or Opportunist), or the creature's attack line, or a special. */
function attackInfo(state, a, op = {}) {
  if (op.special) return { ...op.special, dice: op.special.dice.map(d => Array.isArray(d) ? d : [1, d]), extra: -1 };
  if (a.pc) {
    const m = memberOf(state, a), w = weaponOf(m, a);
    if (op.shield) {
      // Weapon and Shield: a shield attack follows track I, deals Crushing, and uses the main weapon's attribute.
      const level = m.styles?.shield || 1;
      return { dice: [attrTD(m, w?.attribute || "strength"), fromCS(MASTERY.weaponAttackTable[level][1])], bonus: 0, extra: -1, type: "crushing", name: m.shield.name };
    }
    const info = pcAttackDice(state, a, w);
    // Opportunist (Stealth): two Stealth mastery dice join the roll.
    if (op.opportunist) return { ...info, dice: [...info.dice, dieOfTier(m.skills.stealth), dieOfTier(m.skills.stealth)], name: `${info.name} (Opportunist)` };
    return info;
  }
  const c = CREATURES[a.cname];
  const atk = c.attacks[a.attack] || meleeAttack(c) || c.attacks[0];
  return creatureAttackDice(a, c, atk);
}

function runAttack(state, rng, note, op) {
  const b = state.battle;
  const a = unitById(b, op.by), t = unitById(b, op.target);
  if (!a || !t || !standing(state, a) || !onField(t) || (t.pc && memberOf(state, t).dead)) { b.queue.shift(); return; }
  if (!op.ranged && !op.lineReach && gap(a, t) > reachOf(a, CREATURES[a.cname])) { b.queue.shift(); return; }
  // Intercept: a knight beside the target steps in and takes the attack, defending with Dominance.
  if (a.pc && !t.pc && !op.interceptChecked) {
    op.interceptChecked = true;
    const k = b.units.find(o => !o.pc && o !== t && standing(state, o) && o.ap >= 2 && gap(o, t) <= 1 && has(o, "intercept") && (op.ranged || gap(o, a) <= reachOf(a)));
    if (k) { k.ap -= 1; op.target = k.id; op.interceptDom = true; note(`${k.name} steps in front of ${t.name} (Intercept).`, "event"); return; }
  }
  const info = attackInfo(state, a, op);
  // Grab: in lieu of an attack roll, a trial.
  if (op.grab) {
    const helper = !op.heartenAsked && t.pc && heartener(state, t, "heartenTrial");
    if (helper && reactOf(memberOf(state, helper), "heartenTrial") === "ask") {
      op.heartenAsked = true;
      b.prompt = { kind: "heartenTrial", by: helper.id, target: t.id, yes: "Hearten", no: "Hold",
        text: `${a.name} tries to seize ${t.name} (${op.grab.name}): a Strength trial against ${op.grab.resist.dc}. ${helper.name}: hearten it (+${tierOf(memberOf(state, helper).attributes.charisma)}, 1 AP, ${helper.ap} left)?` };
      return;
    }
    b.queue.shift();
    return runGrab(state, rng, note, a, t, op.grab, op.heartenTrial);
  }
  // Declare the defense before the roll (Combat, Defense).
  if (op.defend === undefined) {
    const d = canDefend(state, t, info.type, op.ranged);
    if (!d.can) op.defend = false;
    else if (t.pc) {
      const set = reactOf(memberOf(state, t), "defend");
      const helper = heartener(state, t, "heartenDefense");
      const auto = helper && reactOf(memberOf(state, helper), "heartenDefense") === "always" ? helper.id : null;
      // A caster mid-spell is asked even on Always: defending would lose the spell.
      if (set !== "ask" && !(set === "always" && somatic(t))) { op.defend = set === "always"; if (op.defend && auto) op.hearten = auto; return; }
      b.prompt = { kind: "defend", by: a.id, target: t.id, helper: auto ? null : helper?.id, helperName: helper?.name, autoHearten: auto,
        text: `${a.name} ${op.reaction === "reprisal" ? "lashes out at" : op.reaction === "counter" || op.reaction === "riposte" ? "counters" : op.charge ? "charges" : "attacks"} ${t.name} (${info.name}${op.ranged ? ", ranged" : ""}). Defend (1 AP, ${t.ap} left)?${somatic(t) ? ` Defending loses ${t.casting.label}.` : ""}` };
      return;
    } else if (has(t, "doubleDamage") && !op.ranged && t.ap >= 1 && t.hp > t.hpMax / 2) {
      // Double Damage: it lets the blow land, with Superiority, to answer it with its own.
      t.ap -= 1; op.defend = false; op.sup = true; op.doubleDamage = true;
      note(`${t.name} opens its guard to take the blow (Double Damage).`, "event");
    } else if (op.reaction === "reprisal" && has(t, "false") && t.ap >= 1) {
      op.defend = true; op.falseBonus = 1;
    } else op.defend = op.interceptDom ? t.ap >= 1 : t.ap > (t.doneIn.length || b.current === t.id ? 0 : 1);
  }
  // Hearten the attack (Presence, Rhetoric), if an ally is set to.
  if (a.pc && !op.heartenAsked) {
    op.heartenAsked = true;
    const helper = heartener(state, a, "heartenAttack");
    if (helper) {
      if (reactOf(memberOf(state, helper), "heartenAttack") === "always") op.heartenAtk = helper.id;
      else {
        b.prompt = { kind: "heartenAttack", by: helper.id, target: a.id, yes: "Hearten", no: "Hold",
          text: `${a.name} attacks ${t.name}. ${helper.name}: hearten the attack (+${tierOf(memberOf(state, helper).attributes.charisma)}, 1 AP, ${helper.ap} left)?` };
        return;
      }
    }
  }
  b.queue.shift();
  if (op.defend) t.ap -= 1;
  // Attacking or defending loses a spell cast with gestures (Interrupted Casting).
  if (a.pc && somatic(a)) loseSpell(state, note, a, "attacking");
  if (op.defend && t.pc && somatic(t)) loseSpell(state, note, t, "defending");
  if (op.thrownKey) b.thrown[op.thrownKey] = (b.thrown[op.thrownKey] || 0) + 1;

  // Ranged: the Aiming Trial (Combat, Attack). Helpless targets are hit automatically.
  if (op.ranged && !helpless(state, t)) {
    const m = a.pc ? memberOf(state, a) : null;
    const w = m ? weaponOf(m, a) : null;
    const range = w?.range || rangeOf(CREATURES[a.cname]?.attacks[a.attack]) || [6, 12, 18];
    const g = gap(a, t);
    const friends = b.units.filter(o => o.side === a.side && o !== a && standing(state, o) && gap(o, t) <= 1).length;
    const evade = !t.pc && abilitiesOf(CREATURES[t.cname]).some(x => x.kind === "evasion") ? CREATURES[t.cname].attributes.agility.tier : 0;
    const dc = Math.max(1, 2 + (g > range[1] ? 3 : g > range[0] ? 1 : 0) + friends + evade - (t.minion && t.heads > 1 ? 2 : 0));
    const per = a.pc ? dieOfTier(tierOf(m.attributes.perception)) : dieOfTier(CREATURES[a.cname].rank === "minion" ? CREATURES[a.cname].tier : CREATURES[a.cname].attributes.perception.tier);
    const r = per[1] === 1 ? 1 : rng.d(per[1]);
    const hit = r !== 1 && (r === per[1] || r >= dc);
    note(`${a.name} takes aim at ${t.name}: d${per[1]} ${r} against ${dc}${friends ? ` (${friends} of their own beside it)` : ""}${evade ? " (on the wing)" : ""}, ${hit ? "on target" : "misses"}.`);
    if (!hit) return;
  }

  const am = mods(state, a, "attack");
  const flankOn = !op.ranged && b.units.some(o => o.side === a.side && o !== a && standing(state, o) && gap(o, t) <= 1 && opposite(a, o, t));
  // Opportunist always has the flanking bonus; Hamstring gives it up.
  const flank = (flankOn || op.opportunist) && !op.forfeitFlank;
  let dom = op.edge > 0 || am.edge > 0, imp = op.edge < 0 || am.edge < 0;
  if (a.pc) { if (a.guard === "striking") dom = true; if (a.guard === "stable") imp = true; }
  let sup = !!op.sup || am.sup, inf = !!op.inf || am.inf;
  if (!op.ranged && t.prone) sup = true;
  if (op.ranged && t.prone) inf = true;
  if (t.smashing) sup = true;
  // Root Snare's Pin and a Cunning Feint: Superiority against that one target.
  if (has(a, "hold")?.supWhenPinned && t.held?.by === a.id && cond(t, "restricted") >= 2) sup = true;
  // Mark Quarry: Invigorated against that target only (Dominance; +1 at Tier 2; +2 at Tier 3).
  const hunt = a.quarryOn === t.id ? cond(a, "quarry") : 0;
  if (hunt) dom = true;
  const huntBonus = hunt === 2 ? 1 : hunt === 3 ? 2 : 0;
  if (a.feintOn === t.id) { sup = true; a.feintOn = null; }
  // Possessed: Sacred damage against the Cursed has Superiority.
  if (t.pc && info.type === "sacred" && (memberOf(state, t).abilities || []).includes("Possessed")) sup = true;
  // Incorporeal: mundane damage has Inferiority against it.
  if (has(t, "incorporeal") && ["cutting", "cleaving", "crushing", "piercing", "puncturing"].includes(info.type)) inf = true;
  const lift = op.heartenAtk ? heartenBonus(state, op.heartenAtk) : 0;
  if (lift) note(`${unitById(b, op.heartenAtk).name} heartens ${a.name} (+${lift}).`);
  // One roll against several targets (Swipe, Timber, Boulder Throw): the first rolls, the rest share it.
  let atk = op.shared && b.rolls?.[op.shared];
  if (!atk) {
    atk = rollPool(rng, info.dice, { edge: (dom ? 1 : 0) - (imp ? 1 : 0), bonus: info.bonus + (op.bonus || 0) + (flank ? 2 : 0) + am.bonus - am.pen + lift + huntBonus, inferiority: inf, superiority: sup, extra: info.extra });
    // Breaker: an exploding die lets the orc add its Strength score, and costs it three tiers of Exhausted.
    if (!a.pc && atk.exploded && !cond(a, "exhausted") && abilitiesOf(CREATURES[a.cname]).some(x => x.kind === "breaker")) {
      const str = CREATURES[a.cname].attributes.strength.score;
      atk = { ...atk, total: atk.total + str, text: `${atk.text}, Breaker + ${str} = ${atk.total + str}` };
      addCond(state, note, a, "exhausted", 3, { by: a.id, decays: true });
    }
    if (op.shared) (b.rolls ||= {})[op.shared] = atk;
  }
  let def = null;
  if (op.defend) {
    const d = canDefend(state, { ...t, ap: 1 }, info.type, op.ranged);
    const dm = mods(state, t, "defense");
    const guard = t.quarryOn === a.id ? cond(t, "quarry") : 0; // a hunter defending against its quarry
    let ddom = dm.edge > 0 || !!op.interceptDom || guard > 0, dimp = dm.edge < 0;
    if (t.pc) { if (t.guard === "stable") ddom = true; if (t.guard === "striking") dimp = true; }
    const hearten = op.hearten ? heartenBonus(state, op.hearten) : 0;
    def = rollPool(rng, d.dice, { edge: (ddom ? 1 : 0) - (dimp ? 1 : 0), bonus: d.bonus + dm.bonus - dm.pen + hearten + (op.falseBonus || 0) + (guard === 2 ? 1 : guard === 3 ? 2 : 0), inferiority: dm.inf || d.unarmed, superiority: dm.sup });
    if (hearten) note(`${unitById(b, op.hearten).name} heartens ${t.name} (+${hearten}).`);
  }
  const verb = op.reaction === "counter" || op.reaction === "riposte" ? "counters" : op.reaction === "reprisal" ? "strikes at" : op.reaction === "pack" ? "piles onto" : op.charge ? "charges" : op.ranged ? "shoots" : "attacks";
  note(`${a.name} ${verb} ${t.name} with ${info.name.toLowerCase()}${flank ? ", flanking (+2)" : ""}${op.rider ? ` (${op.rider})` : ""}: ${atk.text}.${def ? ` ${t.name} defends: ${def.text}.` : ""}`);
  const killedBefore = !onField(t), before = tally(t);
  const hit = applyHit(state, rng, note, a, t, atk, def, info.type, op.ranged);
  if (!killedBefore) afterHit(state, rng, note, a, t, op, hit, info);
  if (a.pc) demonTrigger(state, rng, note, a, kills(t, before));
}

/** What lands after the damage: riders, Mob traits, flame, the pack, Challenge, Riposte, and counters. */
function afterHit(state, rng, note, a, t, op, hit, info, heartenTrial) {
  const b = state.battle;
  const dealt = (hit.durabilityDamage || 0) + (hit.healthDamage || 0) > 0;
  if (dealt && onField(t)) {
    const riders = [...(op.riderSpec ? [op.riderSpec] : op.rider && !a.pc ? [abilitiesOf(CREATURES[a.cname]).find(x => x.name === op.rider)] : []), ...(a.minion ? abilitiesOf(CREATURES[a.cname]).filter(x => x.kind === "mob") : [])].filter(Boolean);
    // A trial is coming and an ally could hearten it: stop and ask, then pick up here.
    if (heartenTrial === undefined && riders.some(r => r.resist) && t.pc) {
      const helper = heartener(state, t, "heartenTrial");
      if (helper && reactOf(memberOf(state, helper), "heartenTrial") === "ask") {
        const r = riders.find(x => x.resist);
        b.queue.unshift({ op: "afterHit", by: a.id, target: t.id, src: { ...op }, hit: { durabilityDamage: hit.durabilityDamage || 0, healthDamage: hit.healthDamage || 0, defended: !!hit.defended }, info: { type: info.type } });
        b.prompt = { kind: "heartenTrial", by: helper.id, target: t.id, yes: "Hearten", no: "Hold",
          text: `${t.name} must resist ${a.name}'s ${r.name} with ${r.resist.attr[0].toUpperCase() + r.resist.attr.slice(1)}. ${helper.name}: hearten the trial (+${tierOf(memberOf(state, helper).attributes.charisma)}, 1 AP, ${helper.ap} left)?` };
        return;
      }
    }
    for (const r of riders) applyRider(state, rng, note, a, t, r, hit, heartenTrial);
    // Imbue (Chantment): the weapon's damage carries the imbued type, the Chantment tier die more.
    if (a.pc && a.imbue && !op.shield && onField(t)) {
      const n = rng.d(dieOfTier(chantTier(memberOf(state, a)))[1]);
      secondaryDamage(state, rng, note, t, n, a.imbue, `Imbued ${a.imbue} (${n})`, { magic: true });
    }
    if (!a.pc) for (const f of abilitiesOf(CREATURES[a.cname]).filter(x => x.kind === "flame" && x.whenType === info.type)) secondaryDamage(state, rng, note, t, f.amount, f.type, `${a.name}'s ${f.name}`);
  }
  if (dealt && op.push && onField(t) && !(t.pc && memberOf(state, t).dead)) {
    const r = resist(state, rng, t, op.push.resist.attr, op.push.resist.dc);
    note(`${t.name} braces against the blow (Strength ${r.text} against ${op.push.resist.dc}): ${r.ok ? "holds" : "is thrown back"}.`);
    if (!r.ok) pushAway(state, t, a, op.push.squares);
  }
  if (dealt && a.minion) for (const m of abilitiesOf(CREATURES[a.cname]).filter(x => x.kind === "mobSelf")) addCond(state, note, a, m.cond, 1, { by: a.id });
  // Double Damage: having taken the blow, the orc answers with Superiority and Dominance.
  if (op.doubleDamage && standing(state, t) && standing(state, a) && meleeAttack(CREATURES[t.cname])) {
    t.attack = CREATURES[t.cname].attacks.indexOf(meleeAttack(CREATURES[t.cname]));
    b.queue.unshift({ op: "attack", by: t.id, target: a.id, ranged: false, reaction: "counter", sup: true, edge: 1 });
    return;
  }
  // False: the reprisal missed, and the warrior answers with Superiority before it moves on.
  if (op.falseBonus && hit.defended && standing(state, t) && meleeAttack(CREATURES[t.cname])) {
    b.queue.unshift({ op: "attack", by: t.id, target: a.id, ranged: false, reaction: "counter", sup: true });
    note(`${t.name} turns the reprisal into an opening (False).`, "event");
    return;
  }
  // Shed: a successful defense lets the wolf shove its attacker aside.
  if (hit.defended && !op.ranged && has(t, "shed") && t.ap >= 1 && standing(state, a) && a.w * a.h <= t.w * t.h) {
    const spots = [];
    for (let y = a.y - 1; y <= a.y + 1; y++) for (let x = a.x - 1; x <= a.x + 1; x++) {
      if ((x !== a.x || y !== a.y) && !blockedFor(b, a, x, y) && gap({ ...a, x, y }, t) <= reachOf(t, CREATURES[t.cname])) spots.push([x, y]);
    }
    const spot = spots.find(([x, y]) => !b.units.some(o => o.side === a.side && o !== a && standing(state, o) && gap(o, t) <= 1 && opposite({ ...a, x, y }, o, t))) || spots[0];
    if (spot) { t.ap -= 1; a.x = spot[0]; a.y = spot[1]; note(`${t.name} sheds ${a.name} aside (Shed).`, "event"); }
  }
  // Press: its melee blow turned without harm, the revenant strikes twice more with Inferiority.
  if (!a.pc && !op.ranged && !dealt && hit.defended && has(a, "press") && a.ap >= 1 && standing(state, t) && !op.pressed) {
    a.ap -= 1;
    for (let i = 0; i < 2; i++) b.queue.unshift({ op: "attack", by: a.id, target: t.id, ranged: false, inf: true, pressed: true });
    note(`${a.name} presses the attack (Press).`, "event");
    return;
  }
  // Challenge: the killing blow on the challenged foe inspires the challenger.
  if (a.pc && !onField(t) && a.challenge === t.id) {
    const n = { minion: 1, adept: 1, leader: 2, champion: 2 }[CREATURES[t.cname].rank] || 3;
    note(`${a.name} answers the Challenge with the killing blow.`, "reward");
    addCond(state, note, a, "inspired", n, { by: a.id });
  }
  // The pack: allies with Pack or Swarm Frenzy pile onto a creature that was hit.
  if (dealt && !a.pc && onField(t) && standing(state, a)) {
    for (const o of b.units.filter(x => !x.pc && x !== a && standing(state, x) && x.ap > 0 && !cowed(x) && gap(x, t) <= reachOf(x, CREATURES[x.cname]))) {
      const p = abilitiesOf(CREATURES[o.cname]).find(x => x.kind === "pileOn");
      const atk = p && CREATURES[o.cname].attacks.find(x => p.attack.test(x.name));
      if (!atk || !(o.ap >= 2 || o.doneIn.length)) continue;
      o.ap -= 1; o.attack = CREATURES[o.cname].attacks.indexOf(atk);
      b.queue.unshift({ op: "attack", by: o.id, target: t.id, ranged: false, reaction: "pack" });
      break;
    }
  }
  if (b.prompt || op.ranged || !standing(state, t) || t.ap <= 0 || gap(t, a) > reachOf(t, CREATURES[t.cname])) return;
  // Riposte: no damage taken from a melee attack, defended or not, opens a counter with its bonus.
  const rip = !t.pc && abilitiesOf(CREATURES[t.cname]).find(x => x.kind === "riposte");
  if (rip && !dealt && !cowed(t) && meleeAttack(CREATURES[t.cname])) {
    t.ap -= 1; t.attack = CREATURES[t.cname].attacks.indexOf(meleeAttack(CREATURES[t.cname]));
    b.queue.unshift({ op: "attack", by: t.id, target: a.id, ranged: false, reaction: "riposte", bonus: rip.bonus });
    return;
  }
  // A successful defense opens a counterattack (Combat, Triggered Reactions).
  if (!op.defend || !hit.defended || (t.pc && (weaponOf(memberOf(state, t), t)?.ranged || turning(t)))) return;
  if (t.pc) {
    const set = reactOf(memberOf(state, t), "counter");
    if (set === "never") return;
    if (set === "always" && !somatic(t)) { t.ap -= 1; b.queue.unshift({ op: "attack", by: t.id, target: a.id, ranged: false, reaction: "counter" }); return; }
    b.queue.unshift({ op: "ask" });
    b.prompt = { kind: "counter", by: t.id, target: a.id, text: `${t.name} turned the blow. Counterattack ${a.name} (1 AP, ${t.ap} left)?${somatic(t) ? ` Attacking loses ${t.casting.label}.` : ""}` };
  } else if (!cowed(t) && (t.ap >= 2 || t.doneIn.length) && meleeAttack(CREATURES[t.cname])) {
    t.ap -= 1; t.attack = CREATURES[t.cname].attacks.indexOf(meleeAttack(CREATURES[t.cname]));
    b.queue.unshift({ op: "attack", by: t.id, target: a.id, ranged: false, reaction: "counter" });
  }
}

/** A rider or Mob trait landing: extra damage, then a resist trial, then the condition, Attrition, or swap. */
function applyRider(state, rng, note, a, t, ab, hit, hearten) {
  if (!ab || !onField(t)) return;
  if (ab.gate === "health" && !hit.healthDamage) return;
  if (ab.extra) secondaryDamage(state, rng, note, t, ab.extra.amount, ab.extra.type, `${a.name}'s ${ab.name}`);
  if (!onField(t) || (t.pc && memberOf(state, t).dead)) return;
  if (ab.cond && cond(t, ab.cond.name) >= (ab.cond.max || 3) && ab.cond.name !== "infected") return;
  if (ab.resist) {
    const dc0 = ab.resist.dc === "band" ? mobDC(CREATURES[a.cname].tier, a.heads) : ab.resist.dc;
    const dc = dc0 + (ab.resist.plus || 0);
    const r = resist(state, rng, t, ab.resist.attr, dc, { hearten, forCond: ab.cond?.name });
    hearten = null; // one Hearten, one roll
    note(`${ab.name}: ${t.name} resists with ${ab.resist.attr[0].toUpperCase() + ab.resist.attr.slice(1)} (${r.text} against ${dc}), ${r.ok ? "and shrugs it off" : "and fails"}.`);
    if (r.ok) return;
  }
  if (ab.cond) addCond(state, note, t, ab.cond.name, ab.cond.n, { max: ab.cond.max, by: a.id });
  if (ab.attrition) {
    const c = CREATURES[a.cname];
    const amount = ab.attrition.amount ?? (a.minion ? c.tier : Math.max(c.attributes.strength.tier, c.attributes.physique.tier));
    t.attrition.push({ label: ab.attrition.label, type: ab.attrition.type || null, amount });
    note(`${t.name} suffers Attrition (${ab.attrition.label}) ${amount}, at the end of their turn.`, "event");
  }
  if (ab.swap && standing(state, a)) {
    const [ax, ay, tx, ty] = [a.x, a.y, t.x, t.y];
    a.x = -100; t.x = tx; // swap if both fit
    if (!blockedFor(state.battle, t, ax, ay)) { t.x = ax; t.y = ay; a.x = tx; a.y = ty; note(`${a.name} hooks ${t.name} past it: they swap places.`, "event"); }
    else { a.x = ax; a.y = ay; t.x = tx; t.y = ty; }
  }
}

/** Grab and Constrict: a Strength trial or Restricted, held while the grabber stays beside its catch. */
function runGrab(state, rng, note, a, t, ab, hearten) {
  if (cond(t, "restricted") >= 3) return;
  const r = resist(state, rng, t, ab.resist.attr, ab.resist.dc, { hearten, forCond: "restricted" });
  note(`${a.name} tries to ${ab.name === "Constrict" ? "wrap around" : "seize"} ${t.name} (${ab.name}). ${t.name} resists with Strength (${r.text} against ${ab.resist.dc}), ${r.ok ? "and slips free" : "and is caught"}.`, r.ok ? "" : "event");
  if (r.ok) return;
  addCond(state, note, t, "restricted", 1, { by: a.id });
  t.held = { by: a.id, dc: ab.resist.dc, name: ab.name, ranged: (ab.range || 1) > 1 };
}

/** Corra's Hearten (Presence, Rhetoric): a standing ally with AP can add their Charisma tier to this roll. */
function heartener(state, t, kind = "heartenDefense") {
  return state.battle.units.find(o => o.pc && o !== t && standing(state, o) && o.ap > 0 && !turning(o) && (memberOf(state, o).abilities || []).includes("Hearten") && reactOf(memberOf(state, o), kind) !== "never");
}
function heartenBonus(state, id) {
  const u = unitById(state.battle, id);
  if (!u || u.ap < 1) return 0;
  u.ap -= 1;
  return tierOf(memberOf(state, u).attributes.charisma);
}

/** Is the ally on the far side of the target from the attacker? (Combat, Flanking) */
function opposite(a, o, t) {
  if (has(t, "unflankable")) return false;
  const side = (u) => [u.x + u.w - 1 < t.x ? -1 : u.x > t.x + t.w - 1 ? 1 : 0, u.y + u.h - 1 < t.y ? -1 : u.y > t.y + t.h - 1 ? 1 : 0];
  const [ax, ay] = side(a), [ox, oy] = side(o);
  return (ax !== 0 && ox === -ax) || (ay !== 0 && oy === -ay);
}
export const flanking = (state, a, t) => state.battle.units.some(o => o.side === a.side && o !== a && standing(state, o) && gap(o, t) <= 1 && opposite(a, o, t));

/* ------------------------------------------------------------------ */
/* Damage                                                               */

function applyHit(state, rng, note, a, t, atk, def, type, ranged) {
  const ab = has(t, "absorb");
  if (ab && ab.type === type && !(def && def.total >= atk.total)) {
    const gain = Math.max(0, atk.total - (def?.total || 0));
    t.hp = Math.min(t.hpMax, t.hp + gain);
    note(`${t.name} drinks it in (${ab.name}): it heals ${gain}.`, "event");
    return { defended: false, durabilityDamage: 0, healthDamage: 0 };
  }
  if (immuneToDamage(state, t, type)) { note(`${t.name} is immune to ${type} damage.`); return { defended: false, durabilityDamage: 0, healthDamage: 0 }; }
  if (t.pc) {
    const m = memberOf(state, t);
    // Whether the shield takes the hit is the character's standing choice (Foundry's shieldAbsorbs).
    const shield = usesShield(m, weaponOf(m, t)) && m.shieldAbsorbs !== false ? m.shield.durability : 0;
    const armor = m.armor?.durability || 0;
    // A companion's own hide: its mundane resistance stands whether or not it defends.
    const res = (t.companion ? (MUNDANE.includes(type) ? m.resistance : 0) : armor > 0 ? (m.armor.resistance[type] || 0) : 0) + innateRes(m, type);
    const ward = wardFor(t, type);
    const r = resolveDamage({ attackTotal: atk.total, damageType: type, armorResistance: res,
      durabilityCurrent: shield + armor, healthCurrent: m.hp, activeDefense: !!def, defenseTotal: def?.total || 0, wardPool: ward?.pool || 0 });
    if (r.defended) { note(`${t.name} turns it aside.`); return r; }
    drainWard(state, note, t, ward, r.wardAbsorbed);
    if (r.durabilityDamage) shaken(state, note, t);
    if (r.absorbed) { note(`${m.armor?.name || "Armor"} takes it.`); return r; }
    // The shield soaks durability damage before the armor (Weapon and Shield Style).
    const toShield = Math.min(shield, r.durabilityDamage), toArmor = r.durabilityDamage - toShield;
    const bits = [];
    if (toShield) { m.shield.durability -= toShield; bits.push(`${toShield} to the ${m.shield.name.toLowerCase()}${m.shield.durability <= 0 ? ", which breaks" : ""}`); }
    if (toArmor) { m.armor.durability -= toArmor; bits.push(`${toArmor} to the ${m.armor.name.toLowerCase()}${m.armor.durability <= 0 ? ", which breaks" : ""}`); }
    if (r.healthDamage) bits.push(`${r.healthDamage} to health`);
    note(`${t.name} takes ${bits.join(", ")}.`, r.healthDamage ? "event" : "");
    if (r.healthDamage) hurtPC(state, rng, note, t, r.healthDamage);
    return r;
  }
  const c = CREATURES[t.cname];
  if (isObject(t)) {
    const got = Math.max(0, atk.total - (c.resistance?.[type] || 0));
    t.dmgSince += got;
    note(got ? `The bonded tree takes ${got} (${t.dmgSince} since the Dryad's last turn).` : "It doesn't get through the bark.", got ? "event" : "");
    return { defended: false, durabilityDamage: 0, healthDamage: got };
  }
  const res = (c.resistance?.[type] || 0) + (t.armorDur > 0 ? armorRes(c, type) : 0);
  const r = resolveDamage({ attackTotal: atk.total, damageType: type, armorResistance: res, durabilityCurrent: t.armorDur, healthCurrent: t.hp, activeDefense: !!def, defenseTotal: def?.total || 0 });
  if (r.defended) { note(`${t.name} turns it aside.`); return r; }
  if (r.absorbed || (!r.durabilityDamage && !r.healthDamage)) { note(`It doesn't get through ${t.minion ? "their" : "its"} hide${t.armorDur > 0 ? " and armor" : ""}.`); return r; }
  const bits = [];
  if (r.durabilityDamage) { t.armorDur -= r.durabilityDamage; bits.push(`${r.durabilityDamage} to armor${t.armorDur <= 0 ? ", which breaks" : ""}`); }
  if (t.minion) {
    const lost = headsLost({ mode: ranged ? "ranged" : "", damage: r.healthDamage, kept: atk.kept, current: t.heads }).heads;
    t.heads -= lost; t.hp = t.heads;
    if (lost) {
      regroupHeads(t);
      bits.push(`${lost} of the ${t.cname.toLowerCase()}s fall${t.heads ? `, ${t.heads} left` : ""}`);
    }
  } else if (r.healthDamage) { t.hp = Math.max(0, t.hp - r.healthDamage); bits.push(`${r.healthDamage} to health`); }
  if (t.minion) note(bits.length ? `${bits.join(", ").replace(/^./, ch => ch.toUpperCase())}.` : "None of them fall.", "event");
  else note(`${t.name} takes ${bits.join(", ") || "nothing"}.`, "event");
  if (t.hp <= 0) {
    note(`${t.minion ? `The last of the ${t.cname.toLowerCase()}s falls` : `${t.name} falls`}.`, "reward");
    creatureFalls(state, rng, note, t);
  } else morale(state, rng, note, "hurt", t);
  return r;
}

/** Health damage to a character: 0 health, the dying timer, Fighting On, Traumas (Combat, Death). */
function hurtPC(state, rng, note, u, dmg, { magic = false } = {}) {
  const m = memberOf(state, u);
  // Hard to Kill (Cursed): at 0 health, only magic can kill, on a 1 on the Endurance tier die.
  if (hardToKill(m) && m.hp <= 0 && magic) {
    const die = dieOfTier(tierOf(m.attributes.endurance))[1], n = rng.d(die);
    note(`Magic finds ${m.name} at 0 health: Endurance d${die} ${n}${n === 1 ? ": the head is destroyed" : ", and the curse holds"}.`, "event");
    if (n === 1) return kill(state, note, u, "dies, past any resurrection");
  }
  u.lostThisRound = (u.lostThisRound || 0) + dmg;
  shaken(state, note, u);
  if (u.casting) miscastOnHurt(state, rng, note, u, dmg);
  if (u.companion) {
    m.hp = Math.max(0, m.hp - dmg);
    if (m.hp > 0) return;
    m.dead = true; m.down = true; u.dead = true;
    const o = ownerOf(state, u);
    note(`${m.name} dies.`, "event");
    if (m.boundMagan) { o.mp = Math.max(0, (o.mp || 0) - m.boundMagan); note(`${o.name} loses the ${m.boundMagan} magan bound to ${m.name}.`); }
    return;
  }
  const endure = () => trial(rng, [dieOfTier(tierOf(m.attributes.endurance)), dieOfTier(tierOf(m.attributes.endurance))]);
  if (m.hp > 0) {
    m.hp = Math.max(0, m.hp - dmg);
    if (m.hp > 0) return;
    // Avoid Death (Athletics): once per rest, by the character's setting.
    if ((m.abilities || []).includes("Avoid Death") && !m.spent?.avoidDeath && reactOf(m, "avoidDeath") !== "never") {
      if (reactOf(m, "avoidDeath") === "always") return avoidDeath(state, rng, note, u);
      state.battle.queue.unshift({ op: "ask" });
      state.battle.prompt = { kind: "avoidDeath", id: u.id, dmg, yes: "Avoid Death", no: "Save it",
        text: `${m.name} is about to drop to 0 health. Use Avoid Death (roll the Endurance tier die and restore that much; once per rest)?` };
      return;
    }
    if (hardToKill(m)) {
      m.hp = 0; m.injuries = (m.injuries || 0) + 1; m.dying = null; m.stable = false; m.fightingOn = true;
      note(`${m.name} drops to 0 health: an Injury, but no dying and no falling (Hard to Kill). Every wound now is a Trauma.`, "event");
      return;
    }
    return dropToZero(state, rng, note, u, dmg);
  }
  if (!m.fightingOn || !dmg) return;
  const tr = traumaFor(rng, m);
  note(`${m.name} takes a Trauma (d100 ${tr.n}): ${tr.row.name}. ${tr.row.none ? "" : tr.row.text}`, "event");
  if (hardToKill(m)) return; // always fighting on
  const t = endure();
  if (!passes(t, dmg)) { note(`Endurance ${t.text} against ${dmg}: ${m.name} goes down.`); knockOut(state, note, u); }
  else note(`Endurance ${t.text} against ${dmg}: ${m.name} stays up.`);
}

function avoidDeath(state, rng, note, u) {
  const m = memberOf(state, u);
  const die = dieOfTier(tierOf(m.attributes.endurance))[1];
  const n = rng.d(die);
  (m.spent ||= {}).avoidDeath = true;
  m.hp = n;
  note(`${m.name} refuses to fall (Avoid Death, d${die} ${n}): back to ${n} health.`, "reward");
}

/** 0 health (Combat, Death): an Injury, the dying timer, and the Endurance trial to stay up. */
function dropToZero(state, rng, note, u, dmg) {
  const m = memberOf(state, u);
  m.hp = 0;
  m.injuries = (m.injuries || 0) + 1;
  m.dying = tierOf(m.attributes.endurance);
  m.stable = false;
  const end = dieOfTier(tierOf(m.attributes.endurance));
  const t = trial(rng, [end, end]);
  note(`${m.name} drops to 0 health: an Injury, and ${m.dying} rounds to live unless someone stops the bleeding. Endurance ${t.text} against ${dmg}: ${passes(t, dmg) ? "still conscious" : "falls unconscious"}.`, "event");
  if (passes(t, dmg)) {
    state.battle.queue.unshift({ op: "ask" });
    state.battle.prompt = { kind: "fightOn", id: u.id, text: `${m.name} is still on their feet at 0 health and dying. Fight on (every wound now is a Trauma) or go down?`, yes: "Fight on", no: "Go down" };
  } else knockOut(state, note, u);
}

function traumaFor(rng, m) {
  const n = rng.d(100);
  const row = TRAUMA_TABLE.find(r => n >= r.lo && n <= r.hi) || { name: "Close Call!", text: "", none: true };
  if (!row.none) (m.traumas ||= []).push({ name: row.name, tier: row.tier, text: row.text });
  return { n, row };
}

function knockOut(state, note, u, how = "falls unconscious") {
  const m = memberOf(state, u);
  dropAllSpells(state, note, u);
  m.down = true; m.fightingOn = false;
  u.ap = 0;
  note(`${m.name} ${how}.`, "event");
}

/** Who a creature goes for: the most hurt, but a Hard to Kill at 0 health can't be finished, so it comes last. */
const preyRank = (state, u) => { const m = memberOf(state, u); return hardToKill(m) && m.hp <= 0 ? 1e6 : m.hp; };
const hardToKill = (m) => (m.abilities || []).includes("Hard to Kill");
const kill = (state, note, u, how) => die(state, note, u, how);
function die(state, note, u, how = "dies") {
  const m = memberOf(state, u);
  dropAllSpells(state, note, u);
  m.dead = true; m.down = true; m.dying = null; m.hp = 0;
  u.dead = true;
  note(`${m.name} ${how}.`, "event");
}

/* ------------------------------------------------------------------ */
/* Morale (design/02-encounters.md)                                     */

function morale(state, rng, note, why, hurt = null) {
  const b = state.battle;
  if (b.temper === "Restless dead") return;
  const foes = b.units.filter(u => !u.pc && onField(u) && !isObject(u));
  if (!foes.length) return;
  const heads = foes.filter(u => ["leader", "master"].includes(CREATURES[u.cname].rank));
  let rolling = [];
  if (why === "fall" && !heads.length) rolling = foes;
  // A lone creature checks at half its health and again at a quarter.
  for (const u of foes.length === 1 ? foes : []) {
    const marks = (u.hp <= u.hpMax / 4 ? 2 : u.hp <= u.hpMax / 2 ? 1 : 0);
    if (marks > u.marks) { u.marks = marks; if (!rolling.includes(u)) rolling.push(u); }
  }
  if (b.temper === "Guardian") rolling = rolling.filter(u => u.hp <= u.hpMax / 4);
  if (!rolling.length) return;
  const them = foes.reduce((n, u) => n + (u.minion ? u.heads : 1), 0);
  const us = b.units.filter(u => u.pc && standing(state, u)).length;
  const edge = them > us ? 1 : them < us ? -1 : 0;
  // Epic and Legendary creatures fight to the death [Jon, 2026-10-24].
  for (const u of rolling) {
    if (u.demoralized >= 3 || ["epic", "legendary"].includes(CREATURES[u.cname].rank)) continue;
    const t = creatureTrial(rng, CREATURES[u.cname], "wisdom", { edge });
    const miss = 5 - t.total;
    if (passes(t, 5)) { note(`${u.name} holds (Wisdom ${t.text}).`); continue; }
    u.demoralized = Math.min(3, u.demoralized + (miss >= 3 ? 2 : 1));
    note(`${u.name} wavers (Wisdom ${t.text} against 5): ${DEMORALIZED[u.demoralized]}.`, "event");
  }
}

/* ------------------------------------------------------------------ */
/* The enemy                                                            */

/** Dominance on a damage expression: each die one step up the chart ("1d12+1d8" → "2d6+1d10"). */
function stepUp(expr) {
  return expr.replace(/(\d*)d(\d+)/g, (m, c, sd) => {
    const [nc, ns] = shift([Number(c || 1), Number(sd)], 1);
    return `${nc}d${ns}`;
  });
}

/** Shove a creature straight away from another, square by square, until something stops it. */
function pushAway(state, t, from, squares) {
  const b = state.battle;
  const cx = (u) => u.x + (u.w - 1) / 2, cy = (u) => u.y + (u.h - 1) / 2;
  const dx = Math.sign(cx(t) - cx(from)), dy = Math.sign(cy(t) - cy(from));
  for (let i = 0; i < squares; i++) {
    if (blockedFor(b, t, t.x + dx, t.y + dy)) break;
    t.x += dx; t.y += dy;
  }
}

/** Up to steps squares, as far from the threat as the ground allows. */
function fallBackPath(state, u, from, steps) {
  const b = state.battle;
  let best = null;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const path = pathTo(b, u, x, y);
    if (!path || !path.length || path.length > steps) continue;
    const d = gap({ ...u, x, y }, from);
    if (!best || d > best.d) best = { d, path };
  }
  return best?.path || null;
}

/** Straight runs from a unit: each direction's free squares, up to len. */
function straightRuns(b, u, len) {
  const runs = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const path = [];
    for (let k = 1; k <= len; k++) { const x = u.x + dx * k, y = u.y + dy * k; if (blockedFor(b, u, x, y)) break; path.push([x, y]); }
    if (path.length) runs.push({ dx, dy, path });
  }
  return runs;
}

/** Trample (everyone beside the path resists), bolt (a trial or the damage), feed (damage, then a trial). */
function runEffect(state, rng, note, op) {
  const b = state.battle;
  const a = unitById(b, op.by);
  const ab = abilitiesOf(CREATURES[a.cname]).find(x => x.name === op.ab);
  const targets = (op.ids || [op.target]).map(id => unitById(b, id)).filter(t => t && onField(t) && !(t.pc && memberOf(state, t).dead));
  for (const t of targets) {
    if (op.op === "feed") {
      secondaryDamage(state, rng, note, t, roll(rng, ab.damage).total, ab.type, `${a.name} feeds on ${t.name}`);
      if (!onField(t)) continue;
    }
    const r = resist(state, rng, t, ab.resist.attr, ab.resist.dc, { forCond: ab.cond?.name, vsType: op.op === "bolt" ? ab.type : null });
    note(`${ab.name}: ${t.name} resists with ${ab.resist.attr[0].toUpperCase() + ab.resist.attr.slice(1)} (${r.text} against ${ab.resist.dc}), ${r.ok ? "and avoids it" : "and fails"}.`);
    if (r.ok) continue;
    if (op.op === "bolt") secondaryDamage(state, rng, note, t, roll(rng, a.tree1 ? stepUp(ab.damage) : ab.damage).total, ab.type, `${a.name}'s ${ab.name}${a.tree1 ? " (Dominance)" : ""}`, { magic: true });
    if (!onField(t)) continue;
    if (ab.cond) addCond(state, note, t, ab.cond.name, ab.cond.n, { by: a.id, lasting: ab.cond.name === "exhausted" });
    if (ab.attrition) { t.attrition.push({ ...ab.attrition }); note(`${t.name} suffers Attrition (${ab.attrition.label}) ${ab.attrition.amount}.`, "event"); }
  }
}

function aiStep(state, rng, note, u) {
  const b = state.battle;
  const c = CREATURES[u.cname];
  if (isObject(u)) {
    const t = b.units.filter(x => x.pc && standing(state, x) && gap(u, x) <= 3).sort((x, y) => preyRank(state, x) - preyRank(state, y))[0];
    if (!t || u.ap < 2) return finishTurn(state, u, rng, note);
    u.ap -= 2; u.attacks += 1;
    note("The bonded tree swings a great branch.", "event");
    b.queue.push({ op: "attack", by: u.id, target: t.id, ranged: false, lineReach: true });
    return;
  }
  const abs = abilitiesOf(c);
  const pcs = b.units.filter(t => t.pc && standing(state, t));
  if (u.ap <= 0 || !pcs.length) return finishTurn(state, u, rng, note);
  // Held: strain against it first.
  if (u.held && !u.brokeFree) {
    u.ap -= 1; u.brokeFree = true;
    const r = resist(state, rng, u, "strength", u.held.dc);
    note(`${u.name} strains against the hold (Strength ${r.text} against ${u.held.dc}): ${r.ok ? "it gives" : "it holds"}.`);
    if (r.ok) { setCond(u, "restricted", Math.max(0, cond(u, "restricted") - 1)); if (!cond(u, "restricted")) u.held = null; }
    return;
  }
  if (cond(u, "restricted") >= 3) return finishTurn(state, u, rng, note);
  if (u.prone) { u.ap -= 1; u.prone = false; note(`${u.name} gets up.`); return; }
  const speed = creatureSpeed(c);
  // Panicked: away from the party by the safest route, off the field.
  // Guardians never leave their place: cornered, they only defend.
  if (u.demoralized >= 3 && !u.turnedBy && b.temper === "Guardian") return finishTurn(state, u, rng, note);
  // Turned (Theurgic Authority): compelled to flee the theurgist as fast as it can; cornered, it cowers.
  if (u.demoralized >= 3 || u.turnedBy) {
    if (cond(u, "restricted")) return finishTurn(state, u, rng, note);
    const edge = (x, y) => x === 0 || y === 0 || x + u.w >= b.w || y + u.h >= b.h;
    const path = search(b, u, (x) => x + u.w >= b.w) || search(b, u, edge);
    if (!path?.length) return finishTurn(state, u, rng, note);
    u.ap -= 1;
    b.queue.push({ op: "move", id: u.id, path: path.slice(0, moveStep(u, speed)), asked: [], flee: true });
    u.lastMove = true;
    return;
  }
  const reach = reachOf(u, c);
  const melee = meleeAttack(c), ranged = rangedAttack(c);
  const yetToAct = pcs.some(t => t.ap > 0 && PHASES.indexOf(t.phase) >= b.phaseIdx && !t.doneIn.includes(t.phase));
  const maxAttacks = MASTERY.npcRanks[c.rank].maxAttacks;
  const mayAttack = u.attacks < maxAttacks && (u.attacks === 0 || u.ap - 1 >= (yetToAct ? 1 : 0));
  const near = pcs.filter(t => gap(u, t) <= reach).sort((x, y) => preyRank(state, x) - preyRank(state, y));

  // Smash: declared at the top of the round; it lands now if anyone is still in reach.
  if (u.smashing) {
    u.smashing = false;
    const sm = abs.find(a => a.kind === "smash");
    if (near.length && u.ap >= 2) {
      u.ap -= 2; u.attacks += 1;
      b.queue.push({ op: "attack", by: u.id, target: near[0].id, ranged: false, special: { name: "Smash", dice: sm.dice, bonus: sm.bonus, type: sm.type } });
      return;
    }
  }
  const hurt = u.hp < u.hpMax / 2;
  // Woodland Meld: badly hurt and pressed, it sinks into the ground and rises far off.
  if (has(u, "meld") && hurt && near.length && u.ap >= 1 && !cond(u, "restricted") && !u.tree2) {
    let spot = null;
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      if (blockedFor(b, u, x, y)) continue;
      const d = Math.min(...pcs.map(t => gap({ ...u, x, y }, t)));
      if (!spot || d > spot.d) spot = { x, y, d };
    }
    if (spot) { u.ap -= 1; u.x = spot.x; u.y = spot.y; u.meldBoost = true; note(`${u.name} melds into the earth and rises elsewhere (Woodland Meld).`, "event"); return; }
  }
  // Reconstitute: once a round, when badly hurt.
  const heal = has(u, "heal");
  if (heal && hurt && u.ap >= 1 && u.healedRound !== b.round) {
    u.ap -= 1; u.healedRound = b.round;
    const n = roll(rng, heal.amount).total;
    u.hp = Math.min(u.hpMax, u.hp + n);
    note(`${u.name} draws itself back together (${heal.name}): ${n} health.`, "event");
    return;
  }
  // Roar and Stomp (2 AP): when two or more of the party stand within it.
  const roar = abs.find(a => a.kind === "roar");
  if (roar && u.ap >= 2 && u.attacks === 0 && u.roared !== b.round) {
    const hit = pcs.filter(t => gap(u, t) <= roar.range && (roar.prone ? !t.prone : cond(t, roar.cond.name) < 3));
    if (hit.length >= 2) {
      u.ap -= 2; u.roared = b.round;
      note(`${u.name} uses ${roar.name}.`, "event");
      for (const t of hit) {
        const r = resist(state, rng, t, roar.resist.attr, roar.resist.dc, { forCond: roar.prone ? "prone" : roar.cond.name });
        note(`${t.name} resists with ${roar.resist.attr[0].toUpperCase() + roar.resist.attr.slice(1)} (${r.text} against ${roar.resist.dc}): ${r.ok ? "holds" : "fails"}.`);
        if (r.ok) continue;
        if (roar.prone) { t.prone = true; note(`${t.name} is knocked prone.`, "event"); }
        else { addCond(state, note, t, roar.cond.name, roar.bigFail && r.miss >= roar.bigFail ? 2 : roar.cond.n, { by: u.id }); if (roar.cond.name === "demoralized") t.fearOf = u.id; }
      }
      return;
    }
  }
  // A Leader's buff (2 AP): when it isn't engaged and has allies near to stir. Some can be used once, and last the fight.
  const buff = abs.find(a => a.kind === "buff");
  if (buff && !near.length && u.ap >= 2 && u.attacks === 0 && !(buff.once && u.usedOnce?.includes(buff.name))) {
    const allies = b.units.filter(o => o !== u && !o.pc && standing(state, o) && buff.who.test(o.cname) && gap(o, u) <= buff.range && cond(o, buff.cond) < 3);
    if (allies.length >= 2 || (buff.once && allies.length)) {
      u.ap -= 2;
      if (buff.once) (u.usedOnce ||= []).push(buff.name);
      note(`${u.name} uses ${buff.name}.`, "event");
      for (const o of allies) addCond(state, note, o, buff.cond, 1, { by: u.id, lasting: !!buff.lasting });
      return finishTurn(state, u, rng, note);
    }
  }
  // Mark Quarry (2 AP): allies within range are Inspired against one target.
  const quarry = has(u, "quarry");
  if (quarry && !near.length && u.ap >= 2 && u.attacks === 0) {
    const t = [...pcs].sort((x, y) => gap(u, x) - gap(u, y))[0];
    const allies = b.units.filter(o => !o.pc && standing(state, o) && gap(o, u) <= quarry.range);
    if (t && allies.length >= 2) {
      u.ap -= 2;
      note(`${u.name} marks ${t.name} as quarry (Mark Quarry).`, "event");
      for (const o of allies) { if (o.quarryOn !== t.id) setCond(o, "quarry", 0); o.quarryOn = t.id; addCond(state, note, o, "quarry", 1, { by: u.id }); }
      return finishTurn(state, u, rng, note);
    }
  }
  // Several at once: Swipe at two in reach, Timber down a line, a boulder on a 2 × 2.
  const multi = has(u, "multi");
  if (multi && near.length >= 2 && mayAttack) {
    const atk = c.attacks.find(a => multi.attack.test(a.name) && !rangeOf(a)) || melee;
    u.ap -= 1; u.attacks += 1; u.attack = c.attacks.indexOf(atk);
    const key = `${u.id}:${b.round}:${u.attacks}`;
    note(`${u.name} swings at ${near.slice(0, multi.targets).map(t => t.name).join(" and ")} (${multi.name}).`, "event");
    for (const t of near.slice(0, multi.targets)) b.queue.push({ op: "attack", by: u.id, target: t.id, ranged: false, inf: !!multi.inf, shared: key });
    return;
  }
  const line = has(u, "line");
  if (line && u.ap >= 2 && u.attacks === 0) {
    // The line runs out from any square of its body, in any of the eight directions.
    let bestLine = null;
    for (let fy = u.y; fy < u.y + u.h; fy++) for (let fx = u.x; fx < u.x + u.w; fx++) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        let x = fx, y = fy;
        while (covers(u, x, y)) { x += dx; y += dy; }
        const cells = Array.from({ length: line.length }, (_, k) => [x + dx * k, y + dy * k]);
        const hit = pcs.filter(t => cells.some(([px, py]) => covers(t, px, py)));
        if (!bestLine || hit.length > bestLine.length) bestLine = hit;
      }
    }
    if (bestLine?.length >= 2) {
      const atk = c.attacks.find(a => line.attack.test(a.name)) || melee;
      u.ap -= 2; u.attacks += 1; u.attack = c.attacks.indexOf(atk);
      const key = `${u.id}:${b.round}:${u.attacks}`;
      note(`${u.name} sweeps a line (${line.name}).`, "event");
      for (const t of bestLine) b.queue.push({ op: "attack", by: u.id, target: t.id, ranged: false, shared: key, push: line.push, lineReach: true });
      return;
    }
  }
  const area = has(u, "area");
  const areaAtk = area && c.attacks.find(a => area.attack.test(a.name) && rangeOf(a));
  if (areaAtk && mayAttack && !near.length) {
    const rr = rangeOf(areaAtk);
    let bestBox = null;
    for (let y = 0; y < b.h - 1; y++) for (let x = 0; x < b.w - 1; x++) {
      const box = { x, y, w: area.size, h: area.size };
      if (gap(u, box) > rr[2]) continue;
      const hit = pcs.filter(t => gap(t, box) === 0);
      if (!bestBox || hit.length > bestBox.length) bestBox = hit;
    }
    if (bestBox?.length >= 2) {
      u.ap -= 1; u.attacks += 1; u.attack = c.attacks.indexOf(areaAtk);
      const key = `${u.id}:${b.round}:${u.attacks}`;
      note(`${u.name} hurls at ${bestBox.map(t => t.name).join(" and ")} (${area.name}).`, "event");
      for (const t of bestBox) b.queue.push({ op: "attack", by: u.id, target: t.id, ranged: true, edge: area.edge || 0, shared: key });
      return;
    }
  }
  // Ranged holds (Web, Root Snare, Ensnare): seize one not yet held.
  const hold = has(u, "hold");
  if (hold && u.ap >= 1 && u.attacks === 0) {
    const t = pcs.filter(x => !x.held && gap(u, x) <= hold.range && cond(x, "restricted") < 3).sort((x, y) => gap(u, x) - gap(u, y))[0];
    if (t) {
      u.ap -= 1; u.attacks += 1;
      b.queue.push({ op: "attack", by: u.id, target: t.id, ranged: true, grab: { ...hold, range: hold.range } });
      return;
    }
  }
  // Feed: on a helpless one beside it.
  const feed = has(u, "feed");
  const prey = feed && b.units.find(t => t.pc && onField(t) && !memberOf(state, t).dead && gap(u, t) <= reach && helpless(state, t));
  if (prey && u.ap >= 1) { u.ap -= 1; u.attacks += 1; b.queue.push({ op: "feed", by: u.id, target: prey.id, ab: feed.name }); return; }
  // Cunning Feint: distract one before striking it.
  const feint = has(u, "feint");
  if (feint && u.ap >= 2 && u.attacks === 0 && !u.feintOn) {
    const t = pcs.find(x => gap(u, x) <= feint.range);
    if (t) {
      u.ap -= 1;
      const r = resist(state, rng, t, feint.resist.attr, feint.resist.dc);
      note(`${u.name} feints at ${t.name} (Cunning Feint; Perception ${r.text} against ${feint.resist.dc}): ${r.ok ? "not fooled" : "fooled"}.`);
      if (!r.ok) u.feintOn = t.id;
      return;
    }
  }
  // Bolts at range (Thorn Bolt, Consume): when nothing is in reach.
  const bolt = abs.find(a => a.kind === "bolt" && u.ap >= (a.ap || 1));
  if (bolt && !near.length && mayAttack) {
    const t = pcs.filter(x => gap(u, x) <= bolt.range).sort((x, y) => gap(u, x) - gap(u, y))[0];
    if (t) { u.ap -= bolt.ap || 1; u.attacks += 1; note(`${u.name} uses ${bolt.name} on ${t.name}.`, "event"); b.queue.push({ op: "bolt", by: u.id, target: t.id, ab: bolt.name }); return; }
  }
  if (near.length && melee) {
    if (!mayAttack) return finishTurn(state, u, rng, note);
    // A heavy blow (Vicious Bite, 2 AP) to open.
    const heavy = has(u, "heavy");
    if (heavy && u.ap >= 2 && u.attacks === 0) {
      const t = near.find(x => u.quarryOn === x.id) || near[0];
      u.ap -= 2; u.attacks += 1;
      b.queue.push({ op: "attack", by: u.id, target: t.id, ranged: false, special: { ...heavy.special } });
      return;
    }
    // Squeeze what it holds; seize what it doesn't.
    const grab = abs.find(a => a.kind === "grab");
    const caught = near.find(t => t.held?.by === u.id);
    if (grab?.squeeze && caught) {
      attack(b, u, caught, false);
      b.queue[b.queue.length - 1].special = { name: grab.squeeze.name, dice: grab.squeeze.dice, bonus: grab.squeeze.bonus, type: grab.squeeze.type };
      return;
    }
    if (grab && !caught && u.attacks === 0) {
      const t = near.find(x => !x.held) || near[0];
      if (!t.held) { attack(b, u, t, false); b.queue[b.queue.length - 1].grab = grab; return; }
    }
    const t = near.find(x => u.quarryOn === x.id && cond(u, "quarry") >= 1) || near[0];
    const pick = riderFor(state, u, c, t, false);
    u.attack = c.attacks.indexOf(pick?.atk || melee);
    attack(b, u, t, false);
    if (pick) Object.assign(b.queue[b.queue.length - 1], { rider: pick.ab.name, edge: pick.ab.edge || 0, inf: !!pick.ab.inf, sup: !!pick.ab.sup, forfeitFlank: !!pick.ab.needsFlank, special: pick.ab.special ? { ...pick.ab.special } : undefined });
    return;
  }
  if (cond(u, "restricted")) return finishTurn(state, u, rng, note);
  // Rush (Relentless Chase, Dive): any route in, drawing no reprisals, then the attack. Dive flies back out.
  const rush = has(u, "rush");
  if (rush && u.ap >= 2 && u.attacks === 0 && !u.demoralized) {
    const r = pcs.map(t => ({ t, path: pathToReach(b, u, t, reach) })).filter(x => x.path && x.path.length <= speed).sort((x, y) => x.path.length - y.path.length)[0];
    const atk = c.attacks.find(a => rush.attack.test(a.name)) || melee;
    if (r && atk) {
      u.ap -= 2; u.attacks += 1; u.attack = c.attacks.indexOf(atk);
      note(`${u.name} ${rush.flyBack ? "dives on" : "runs down"} ${r.t.name} (${rush.name}).`, "event");
      b.queue.push({ op: "move", id: u.id, path: r.path, asked: [], noReprisal: true });
      b.queue.push({ op: "attack", by: u.id, target: r.t.id, ranged: false, sup: !!(rush.supIfMoved && r.t.movedLastTurn) });
      if (rush.flyBack) b.queue.push({ op: "fallback", id: u.id, from: r.t.id, steps: Math.floor(speed / 2) });
      return;
    }
  }
  // Trample (Wildfire, Avalanche): a straight run past the party; everyone beside the path resists.
  const tr = has(u, "trample");
  if (tr && u.ap >= 2 && u.attacks === 0 && !u.demoralized) {
    let bestRun = null;
    for (const run of straightRuns(b, u, speed)) {
      const hit = pcs.filter(t => run.path.some(([x, y]) => gap({ ...u, x, y }, t) <= 1));
      if (!bestRun || hit.length > bestRun.hit.length) bestRun = { ...run, hit };
    }
    if (bestRun?.hit.length) {
      u.ap -= 2; u.attacks += 1;
      note(`${u.name} tears through (${tr.name}).`, "event");
      b.queue.push({ op: "move", id: u.id, path: bestRun.path, asked: [], noReprisal: true });
      b.queue.push({ op: "trample", by: u.id, ids: bestRun.hit.map(t => t.id), ab: tr.name });
      return;
    }
  }
  // Charge: a straight run into the nearest it can reach that way.
  const ch = abs.find(a => a.kind === "charge");
  if (ch && u.ap >= 2 && u.attacks === 0 && !u.moveLeft && !u.demoralized) {
    for (const t of [...pcs].sort((x, y) => gap(u, x) - gap(u, y))) {
      const path = chargeLine(state, u, t, speed);
      const atk = c.attacks.find(a => ch.attack.test(a.name) && !rangeOf(a)) || melee;
      if (!path || !atk) continue;
      u.ap -= 2; u.attacks += 1;
      u.attack = c.attacks.indexOf(atk);
      note(`${u.name} charges ${t.name}.`, "event");
      b.queue.push({ op: "move", id: u.id, path, asked: [] });
      b.queue.push({ op: "attack", by: u.id, target: t.id, ranged: false, edge: 1, charge: true });
      return;
    }
  }
  // Out of reach: close in, or throw if it can't get there.
  const routes = pcs.map(t => ({ t, path: pathToReach(b, u, t, reach) })).filter(r => r.path).sort((x, y) => x.path.length - y.path.length);
  const best = routes[0];
  const reachable = best && best.path.length <= u.moveLeft + speed + (u.ap > 1 ? speed + Math.floor(speed / 2) : 0);
  // Archers shoot while no one is beside them (a bow can't be loosed with an enemy within 5 feet).
  const archer = ranged && /bow|projectile/i.test(`${ranged.name} ${ranged.range}`);
  const pressed = pcs.some(t => gap(u, t) <= 1);
  if (ranged && mayAttack && !(archer && pressed) && (!melee || !reachable || u.demoralized >= 1 || archer)) {
    const rr = rangeOf(ranged);
    const shot = pcs.filter(t => gap(u, t) <= rr[2]).sort((x, y) => gap(u, x) - gap(u, y))[0];
    if (shot) {
      u.attack = c.attacks.indexOf(ranged);
      attack(b, u, shot, true);
      const rider = abs.find(a => a.kind === "rider" && a.attack.test(ranged.name));
      if (rider) Object.assign(b.queue[b.queue.length - 1], { rider: rider.name, edge: rider.edge || 0, inf: !!rider.inf });
      return;
    }
  }
  if (!best || u.demoralized >= 1 || !melee) return finishTurn(state, u, rng, note);
  let steps = u.moveLeft;
  if (slowed(u)) steps = Math.min(steps, Math.floor(speed / 2));
  if (steps < best.path.length) {
    if (u.ap < 1) return finishTurn(state, u, rng, note);
    u.ap -= 1;
    steps += slowed(u) ? Math.floor(moveStep(u, speed) / 2) : moveStep(u, speed);
  }
  const go = best.path.slice(0, steps);
  u.moveLeft = steps - go.length;
  u.lastMove = true;
  b.queue.push({ op: "move", id: u.id, path: go, asked: [], noReprisal: !!has(u, "stride") });
}

/** Which rider, if any, the creature uses on this attack: one whose effect the target doesn't already carry. */
function riderFor(state, u, c, t, ranged) {
  for (const ab of abilitiesOf(c).filter(a => a.kind === "rider")) {
    const atk = c.attacks.find(a => ab.attack.test(a.name) && !!rangeOf(a) === ranged);
    if (!atk) continue;
    if (ab.needsFlank && !flanking(state, u, t)) continue;
    if (ab.needsCond && !cond(t, ab.needsCond)) continue;
    if (ab.cond && cond(t, ab.cond.name) >= 1) continue;
    if (ab.attrition && t.attrition?.length) continue;
    return { ab, atk };
  }
  return null;
}

function attack(b, u, t, ranged) {
  u.ap -= 1; u.attacks += 1; u.moveLeft = 0; u.lastMove = false;
  b.queue.push({ op: "attack", by: u.id, target: t.id, ranged });
}

/* ------------------------------------------------------------------ */
/* The end                                                              */

function checkEnd(state, rng, note) {
  const b = state.battle;
  if (!b || b.outcome) return true;
  const foes = b.units.filter(u => !u.pc && onField(u) && !isObject(u));
  const pcs = b.units.filter(u => u.pc && standing(state, u));
  if (!foes.length) return aftermath(state, rng, note, pcs);
  if (!pcs.length) { finish(state, rng, note, "lost"); return true; }
  // Hard to Kill at 0 health can't be finished by mundane blows, and can't win alone either.
  // Until Jon rules on it, a party down to only that counts as fallen (a wipe).
  if (pcs.every(u => hardToKill(memberOf(state, u)) && memberOf(state, u).hp <= 0)) {
    note(`${pcs.map(u => u.name).join(" and ")} stand${pcs.length > 1 ? "" : "s"} alone at 0 health, unkillable and unable to win. (How this ends is an open question; for now it counts as the party falling.)`, "todo");
    finish(state, rng, note, "lost");
    return true;
  }
  return false;
}

/**
 * The last enemy is gone, but someone may still be bleeding out. With the
 * means to hand (a Healer's Kit, or a healing spell and the magan for it),
 * saving them is all but certain [Jon, 2026-10-24]. Without, the rounds go
 * on until each one is stopped by Triage or dies.
 */
function aftermath(state, rng, note, pcs) {
  const b = state.battle;
  const bleeding = b.units.filter(u => u.pc && onField(u) && memberOf(state, u).dying != null && !memberOf(state, u).stable);
  if (bleeding.length) {
    const means = healingMeans(pcs.map(u => memberOf(state, u)));
    if (means) {
      for (const u of bleeding) { const m = memberOf(state, u); m.stable = true; m.dying = null; }
      note(`${means.who} stops the bleeding with ${means.what}: ${bleeding.map(u => u.name).join(", ")} will live.`, "reward");
    } else if (pcs.length) {
      if (!b.aftermath) {
        b.aftermath = true;
        note(`The field is yours, but ${bleeding.map(u => u.name).join(" and ")} ${bleeding.length > 1 ? "are" : "is"} bleeding out and no one has a kit or a healing spell. Get to them and stop the bleeding (Triage, 2 AP).`, "event");
      }
      return false;
    } else for (const u of bleeding) die(state, note, u, "dies with no one left standing to help");
  }
  finish(state, rng, note, "won");
  return true;
}

const HEALING_SPELLS = ["Mend", "Mend Flesh"];
/** Who can save the dying after a fight, and with what. */
export function healingMeans(standingMembers) {
  for (const m of standingMembers) {
    // TODO(party): kits and current magan are tracked from milestone 3; for now carrying a kit or knowing the spell is enough.
    if (m.gear?.includes("Healer's Kit")) return { who: m.name, what: "a Healer's Kit" };
    const spell = (m.spells || []).find(sp => HEALING_SPELLS.includes(sp));
    if (spell && (m.mp ?? m.magan) > 0) return { who: m.name, what: spell };
  }
  return null;
}

function finish(state, rng, note, outcome) {
  const b = state.battle;
  b.outcome = outcome;
  b.queue = []; b.prompt = null;
  const e = state.encounter;
  const living = state.party.members.filter(m => !m.dead);
  if (outcome === "lost") {
    for (const m of living) { m.dead = true; m.hp = 0; }
    note("The party falls. No one is left standing to carry the others away.", "event");
    state.over = { day: state.day, why: `Fell to ${e?.head ? e.head.toLowerCase() : "the wild"} on day ${state.day}.` };
  }
  if (outcome === "won") {
    note("The field is yours.", "reward");
    awardCombatXp(state, b.xp, note);
    if (b.units.some(u => !u.pc && u.dead && u.cname === b.head)) spoils(state, rng, e, note);
    for (const d of b.dropped) note(`${state.party.members.find(m => m.id === d.member).name} picks up the ${state.party.members.find(m => m.id === d.member).weapons[d.weapon].name.toLowerCase()}.`);
    if (Object.keys(b.thrown).length) note("You gather up the thrown weapons.");
  }
  if (outcome === "fled") {
    // What was dropped or thrown stays on the field.
    for (const d of [...b.dropped].sort((x, y) => y.weapon - x.weapon)) {
      const m = state.party.members.find(x => x.id === d.member);
      note(`${m.name}'s ${m.weapons[d.weapon].name.toLowerCase()} is left lying where it fell.`);
      m.weapons.splice(d.weapon, 1);
    }
    for (const [k, n] of Object.entries(b.thrown)) {
      const [id, i] = k.split(":");
      const w = state.party.members.find(x => x.id === id).weapons[Number(i)];
      if (w && b.dropped.every(d => d.member !== id)) { w.count = Math.max(0, (w.count ?? 1) - n); note(`${n} ${w.name.toLowerCase()} left behind; ${w.count} remain.`); }
    }
  }
  if (outcome === "won" || outcome === "fled") tend(state, rng, note);
  for (const u of b.units.filter(x => x.pc)) { const m = memberOf(state, u); m.exhausted = cond(u, "exhausted") || 0; }
  for (const m of state.party.members) { m.down = m.dead || m.hp <= 0; m.fightingOn = false; m.stable = false; m.dying = null; }
  state.encounter = null;
  state.battle = null;
}

/**
 * After a fight, the party's healer Heals each wounded character once
 * (Skill Mastery, Healer Discipline: Trade mastery die + Intelligence tier die).
 */
function tend(state, rng, note) {
  const living = state.party.members.filter(m => !m.dead);
  const healer = living.filter(m => m.hp > 0 && (m.skills?.healer || 0) >= 2).sort((x, y) => y.skills.healer - x.skills.healer)[0];
  const hurt = living.filter(m => m.hp < m.health);
  if (!healer || !hurt.length) return;
  for (const m of hurt) {
    const t = trial(rng, [dieOfTier(healer.skills.healer), dieOfTier(tierOf(healer.attributes.intelligence))]);
    const before = m.hp;
    m.hp = Math.min(m.health, m.hp + t.total);
    note(`Heal (${healer.name}, ${t.text}): ${m.name}, ${before} → ${m.hp} health.`, "reward");
  }
  note("(Wound Kits aren't counted yet; that comes with milestone 3.)", "todo");
}

/* ------------------------------------------------------------------ */
/* Labels for the page                                                  */

export function conditionsOf(state, u) {
  const bits = [];
  if (u.imbue) bits.push(`imbued ${u.imbue}`);
  if (u.fireAura) bits.push(`Fire Aura (${u.fireAura})`);
  if (u.turnedBy) bits.push("turned");
  if (u.theurgy) bits.push(`declared ${u.theurgy.mode === "destroy" ? "Destroy" : "Turn"}`);
  if (u.casting) bits.push(`casting ${u.casting.label}`);
  for (const w of u.wards || []) bits.push(`${w.name} ${w.pool}`);
  for (const e of u.conc || []) bits.push(`holding ${e.name}${e.slot === "passive" ? " (passive)" : ""}`);
  if (u.impaired) bits.push(IMPAIRED[u.impaired]);
  if (u.demoralized) bits.push(DEMORALIZED[u.demoralized]);
  for (const k of Object.keys(COND_LABELS)) if (cond(u, k)) bits.push(COND_LABELS[k][cond(u, k)]);
  if (cond(u, "quarry") && u.quarryOn) bits.push(`hunting ${unitById(state.battle, u.quarryOn)?.name || "its quarry"} (${cond(u, "quarry")})`);
  if (u.held) bits.push(`held (${u.held.name})`);
  if (u.prone) bits.push("prone");
  if (u.attrition?.length) bits.push(`bleeding ${u.attrition.reduce((n, a) => n + a.amount, 0)}`);
  if (u.smashing) bits.push("winding up");
  if (u.pc) {
    const m = memberOf(state, u);
    if (m.infected) bits.push(COND_LABELS.infected[m.infected]);
    if (m.dead) bits.push("dead");
    else if (m.dying != null) bits.push(`dying (${m.dying})`);
    else if (m.stable) bits.push("stable");
    if (m.down && !m.dead) bits.push("unconscious");
    if (m.fightingOn) bits.push("fighting on");
    if (u.challenge && onField(unitById(state.battle, u.challenge) || {})) bits.push(`challenging ${unitById(state.battle, u.challenge).name}`);
  }
  if (u.minion) bits.push(groupBand(u.heads).label);
  return bits;
}
export const memberFor = memberOf;
export const creatureFor = (u) => CREATURES[u.cname];
