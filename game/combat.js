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
 * Sense, Avoid Death, Challenge, and Hearten. Spells and companions are stage 3.
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
import { RULES } from "./data/rules-text.js";
import { TRAUMA_TABLE } from "./vendor/foundry/module/data/trauma-table.mjs";
import { resolveDamage } from "./vendor/foundry/extract/resolve-damage.mjs";
import { speedOf, creatureSpeed, creatureTrial, awardCombatXp, spoils, chase, breakAway, cannotRun } from "./events.js";

export const GRID_W = 16, GRID_H = 12;
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
  let total = bonus, kept = 0;
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
    chains.forEach((ch, j) => { if (j !== dropped) { total += sum(ch); kept += ch.length; } });
    const shown = chains.map((ch, j) => `${j === dropped ? "~" : ""}${ch.join("!")}`).join(",");
    parts.push(`${label([c + (i === extra ? 1 : 0), s])}${i === extra ? "kh" + c : ""}[${shown}]`);
  });
  const mods = [];
  if (bonus) mods.push(bonus > 0 ? `+ ${bonus}` : `− ${-bonus}`);
  const tags = [edge > 0 ? "Dominance" : edge < 0 ? "Impotence" : "", inferiority ? "Inferiority" : "", superiority ? "Superiority" : ""].filter(Boolean);
  return { total: Math.max(0, total), kept, text: `${parts.join(" + ")}${mods.length ? " " + mods.join(" ") : ""}${tags.length ? ` (${tags.join(", ")})` : ""} = ${Math.max(0, total)}` };
}

/* ------------------------------------------------------------------ */
/* The grid                                                             */

const unitById = (b, id) => b.units.find(u => u.id === id);
const memberOf = (state, u) => state.party.members.find(m => m.id === u.id);
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
  avoidDeath: { label: "Avoid Death", default: "always", text: "When an attack or spell would reduce you to 0 health, you can roll your Endurance tier die and restore that amount of health. You cannot use this again until you complete a rest (Skill Mastery, Athletics)." },
  heartenDefense: { label: "Hearten an ally's defense", default: "ask", text: "As a reaction, you may spend 1 AP when an ally makes a trial, attack, or defense roll. You grant a bonus equal to your Charisma tier to that roll (Skill Mastery, Presence, Rhetoric)." },
  heartenAttack: { label: "Hearten an ally's attack", default: "never", text: "As a reaction, you may spend 1 AP when an ally makes a trial, attack, or defense roll. You grant a bonus equal to your Charisma tier to that roll (Skill Mastery, Presence, Rhetoric)." },
  heartenTrial: { label: "Hearten an ally's trial", default: "never", noAsk: true, text: "As a reaction, you may spend 1 AP when an ally makes a trial, attack, or defense roll. You grant a bonus equal to your Charisma tier to that roll (Skill Mastery, Presence, Rhetoric). Trials come up mid-attack, so this one is Always or Never." }
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
  tainted: { 1: "Dosed", 2: "Blighted", 3: "Corrupted" },
  infected: { 1: "Afflicted", 2: "Sickened", 3: "Diseased" },
  inspired: { 1: "Rallied", 2: "Emboldened", 3: "Fearless" },
  invigorated: { 1: "Energized", 2: "Empowered", 3: "Tireless" }
};
const PHYSICAL = ["strength", "agility", "physique", "endurance"];
/** Conditions that deteriorate on their own; Impaired's Startle tiers follow the Startle rule instead, and Demoralized holds while its source is in sight. */
const DECAYS = ["impaired", "restricted", "tainted", "inspired", "invigorated"];
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
  return abilitiesOf(CREATURES[u.cname]).some(a => a.kind === "immune" && a.damage?.includes(type));
}

/**
 * Advance a condition by n tiers, to Tier 3 (or a source's max). Inspired and
 * Demoralized counter each other tier for tier. Infected lives on the
 * character, not the fight.
 */
function addCond(state, note, u, k, n = 1, { max = 3, by = null } = {}) {
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
  if (DECAYS.includes(k)) (u.decay ||= {})[k] = { by, round: state.battle.round };
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
  const iv = cond(u, "invigorated"), ins = cond(u, "inspired");
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
function resist(state, rng, u, attr, dc, { edge = 0 } = {}) {
  const md = mods(state, u, attr);
  const e = Math.sign(edge + md.edge);
  const helper = u.pc && state.battle ? heartener(state, u, "heartenTrial") : null;
  const lift = helper && reactOf(memberOf(state, helper), "heartenTrial") === "always" ? heartenBonus(state, helper.id) : 0;
  const t = u.pc
    ? trial(rng, [dieOfTier(tierOf(memberOf(state, u).attributes[attr])), dieOfTier(tierOf(memberOf(state, u).attributes[attr]))], { edge: e, bonus: md.bonus - md.pen + lift })
    : creatureTrial(rng, CREATURES[u.cname], attr, { edge: e, bonus: md.bonus - md.pen });
  return { ok: passes(t, dc), text: t.text + (lift ? `, ${helper.name} heartens +${lift}` : "") };
}

/* ------------------------------------------------------------------ */
/* Creatures                                                            */

const RANGE_RE = /(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/;
const rangeOf = (a) => { const m = RANGE_RE.exec(a?.range || ""); return m ? m.slice(1, 4).map(n => Math.floor(Number(n) / 5)) : null; };
const avg = (a) => a.dice.reduce((n, s) => n + (s + 1) / 2, 0) + (a.bonus || 0);
const meleeAttack = (c) => [...c.attacks].filter(a => !rangeOf(a)).sort((x, y) => avg(y) - avg(x))[0] || null;
const rangedAttack = (c) => c.attacks.find(a => rangeOf(a)) || null;
const armorRes = (c, type) => c.armor.reduce((n, p) => n + (p.resistance?.[type] || 0), 0);
const sizeRow = (c) => sizeRowForSquares(c.size.width * c.size.height);
const reachOf = (u, c) => (u.pc ? 1 : Math.max(1, Math.floor((c?.size?.reach || 5) / 5)));

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
  });
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
      const t = c.rank === "minion" ? trial(rng, [dieOfTier(c.tier), dieOfTier(c.tier)]) : trial(rng, [dieOfTier(c.attributes.agility.tier), dieOfTier(c.attributes.perception.tier)]);
      const miss = e.enemyStartle - t.total;
      u.impaired = passes(t, e.enemyStartle) ? 0 : miss >= 5 ? 3 : miss >= 3 ? 2 : 1;
      u.startle = u.impaired;
      note(`${u.name}: Startle ${t.text}${u.impaired ? `, ${IMPAIRED[u.impaired]}` : ", keeps its head"}.`);
    }
  }
  note(`The fight begins: ${b.units.filter(u => !u.pc).map(u => u.name).join(", ")}, ${e.distance === "Close" ? "close" : e.distance === "Far" ? "far" : "a little way"} off.`, "event");
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
  b.stage = "declare"; b.phaseIdx = 0; b.sideIdx = 0; b.current = null;
  for (const u of b.units) {
    // Impaired from Startle eases one tier at the start of each round after the first (Combat, Startle).
    // Impaired from anything else wears off like any other condition.
    if (b.round > 1 && u.startle > 0) { u.startle -= 1; u.impaired = Math.max(0, u.impaired - 1); }
    u.doneIn = []; u.moveLeft = 0; u.lastMove = false; u.attacks = 0; u.helpedBy = [];
    if (u.pc) {
      const m = memberOf(state, u);
      u.ap = m.down || u.impaired >= 3 ? 0 : 2;
      u.tookTurn = false;
    } else {
      u.tookTurn = false;
      const c = CREATURES[u.cname];
      const rank = MASTERY.npcRanks[c.rank];
      const a = meleeAttack(c) || rangedAttack(c);
      u.attack = a ? c.attacks.indexOf(a) : null;
      const base = a?.phase || "fast";
      // Epic and Legendary creatures get 2 AP in each phase they act in.
      u.phases = rank.phasesActive >= 3 ? [...PHASES] : rank.phasesActive === 2 ? (base === "slow" ? ["moderate", "slow"] : [base, "slow"]) : [u.impaired ? "slow" : base];
      u.ap = u.impaired >= 3 ? 0 : rank.phasesActive > 1 ? 0 : rank.ap;
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
    const w = weaponOf(m, u);
    const speeds = [w?.speed || "fast", slowest].filter(Boolean);
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
  endOfTurn(state, rng, note, u);
  u.doneIn.push(PHASES[b.phaseIdx]);
  u.moveLeft = 0; u.lastMove = false;
  if (!u.pc && u.phases.length > 1) u.ap = 0;
  b.current = null;
}

/** Things that happen as a creature starts its turn: Mob traits that work on presence (Death Tick). */
function startOfTurn(state, rng, note, u) {
  const b = state.battle;
  for (const o of b.units.filter(x => x.side !== u.side && x.minion && onField(x) && x.heads > 0)) {
    for (const a of abilitiesOf(CREATURES[o.cname]).filter(x => x.kind === "presence")) {
      if (gap(o, u) > a.range || cond(u, a.cond.name) >= (a.cond.max || 3)) continue;
      const dc = mobDC(CREATURES[o.cname].tier, o.heads);
      const t = resist(state, rng, u, a.resist.attr, dc);
      note(`${o.name}: ${a.name}. ${u.name} resists (${t.text} against ${dc}): ${t.ok ? "steady" : "it gets under the skin"}.`);
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
      if (u.heads <= 0) { u.dead = true; note(`The last of the ${u.cname.toLowerCase()}s falls.`, "reward"); morale(state, rng, note, "fall"); }
      else regroupHeads(u);
      continue;
    }
    secondaryDamage(state, rng, note, u, a.amount, a.type, `Attrition (${a.label})`, { direct: true });
  }
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
function secondaryDamage(state, rng, note, t, amount, type, label, { direct = false, noResist = false } = {}) {
  if (!onField(t) || !(amount > 0)) return;
  if (type && immuneToDamage(state, t, type)) { note(`${label}: ${t.name} is immune.`); return; }
  if (t.pc) {
    const m = memberOf(state, t);
    if (m.dead) return;
    const res = noResist || !type || !m.armor || m.armor.durability <= 0 ? 0 : (m.armor.resistance[type] || 0);
    const r = direct ? { healthDamage: Math.max(0, amount - res), durabilityDamage: 0 }
      : resolveDamage({ attackTotal: amount, damageType: type, armorResistance: res, durabilityCurrent: m.armor?.durability || 0, healthCurrent: m.hp, activeDefense: false });
    if (r.durabilityDamage) m.armor.durability -= r.durabilityDamage;
    note(`${label}: ${t.name} takes ${[r.durabilityDamage ? `${r.durabilityDamage} to the ${m.armor.name.toLowerCase()}` : "", r.healthDamage ? `${r.healthDamage} to health` : ""].filter(Boolean).join(", ") || "nothing"}.`, r.healthDamage ? "event" : "");
    if (r.healthDamage) hurtPC(state, rng, note, t, r.healthDamage);
    return;
  }
  const c = CREATURES[t.cname];
  const res = noResist || !type ? 0 : (c.resistance?.[type] || 0) + (t.armorDur > 0 && !direct ? armorRes(c, type) : 0);
  const r = direct ? { healthDamage: Math.max(0, amount - res), durabilityDamage: 0 }
    : resolveDamage({ attackTotal: amount, damageType: type, armorResistance: res, durabilityCurrent: t.armorDur, healthCurrent: t.hp, activeDefense: false });
  if (r.durabilityDamage) t.armorDur -= r.durabilityDamage;
  if (t.minion) { if (r.healthDamage) { t.heads -= 1; t.hp = t.heads; regroupHeads(t); } }
  else t.hp = Math.max(0, t.hp - (r.healthDamage || 0));
  note(`${label}: ${t.name} takes ${[r.durabilityDamage ? `${r.durabilityDamage} to armor` : "", r.healthDamage ? (t.minion ? "a head" : `${r.healthDamage} to health`) : ""].filter(Boolean).join(", ") || "nothing"}.`, "event");
  if (t.hp <= 0) { t.dead = true; note(`${t.name} falls.`, "reward"); morale(state, rng, note, "fall"); }
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

function regroupHeads(u) {
  const c = CREATURES[u.cname];
  const fp = groupTokenSize(Math.max(1, u.heads), c.size.width * c.size.height);
  u.w = fp.width; u.h = fp.height;
  u.name = `${u.cname}s (${u.heads})`;
}

/** A grab holds only while the grabber stands beside its catch. */
function holdStands(state, u) {
  const g = u.held && unitById(state.battle, u.held.by);
  return !!(g && standing(state, g) && gap(g, u) <= reachOf(g, CREATURES[g.cname]));
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
  let speed = u.prone ? 1 : speedOf(memberOf(state, u));
  if (cond(u, "tainted") >= 2) speed = Math.max(1, Math.floor(speed / 2));
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

/** Can the current character attack this target? → { ok, why, ranged, charge, cost } */
export function canAttack(state, u, t, mode = u.mode || "strike") {
  if (!t || t.side === u.side || !onField(t)) return { ok: false };
  if (cond(u, "restricted") >= 3) return { ok: false, why: "Restrained: only breaking free" };
  const cost = mode === "opportunist" ? 2 : 1;
  if (u.ap < cost) return { ok: false, why: `needs ${cost} AP` };
  const m = memberOf(state, u), w = weaponOf(m, u);
  const g = gap(u, t);
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
    if (mode === "strike" && u.ap >= 2 && !u.prone && chargeLine(state, u, t, speedOf(m))) return { ok: true, ranged: false, charge: true, cost: 2 };
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
  const op = { op: "attack", by: u.id, target: t.id, ranged: can.ranged };
  if (u.mode === "shield") op.shield = true;
  if (u.mode === "opportunist") {
    op.opportunist = true;
    // Backstab: Opportunist attacks always have Dominance; Superiority against the badly shaken or startled.
    if ((m.abilities || []).includes("Backstab")) { op.edge = 1; if (t.demoralized >= 2 || t.startle >= 2) op.sup = true; }
  }
  if (can.ranged && w?.thrown) op.thrownKey = `${m.id}:${u.weapon}`;
  if (can.charge) {
    const path = chargeLine(state, u, t, speedOf(m));
    b.queue.push({ op: "move", id: u.id, path, asked: [] });
    op.edge = 1; op.charge = true;
    note(`${u.name} charges ${t.name}.`);
  }
  u.moveLeft = 0; u.lastMove = false;
  if (u.mode !== "strike") u.mode = "strike";
  b.queue.push(op);
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
  return state.battle.units.filter(t => t.pc && t !== u && onField(t) && gap(u, t) <= 1 && memberOf(state, t).dying != null && !memberOf(state, t).stable);
}
export function pcTriage(state, rng, note, targetId) {
  const u = currentPC(state);
  if (!u || u.ap < 2) return;
  const t = triageTargets(state, u).find(x => x.id === targetId);
  if (!t) return;
  u.ap -= 2; u.moveLeft = 0; u.lastMove = false;
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
  for (const o of b.units.filter(x => !x.pc && standing(state, x) && x.ap > 0 && x.impaired < 3 && x.demoralized < 3)) {
    const melee = meleeAttack(CREATURES[o.cname]);
    const t = runners.filter(r => gap(o, r) <= reachOf(o, CREATURES[o.cname])).sort((x, y) => memberOf(state, x).hp - memberOf(state, y).hp)[0];
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
  if (!breakAway(state, rng, b.head, note, plan.runners.map(u => memberOf(state, u)), { carrying: carried.length > 0 })) {
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
  const runners = plan.runners.filter(onField).map(u => memberOf(state, u));
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
    for (const o of b.units) {
      if (o.side === u.side || op.asked.includes(o.id) || !standing(state, o) || o.ap < 1 || o.impaired >= 3) continue;
      const reach = reachOf(o, CREATURES[o.cname]);
      if (o.pc && weaponOf(memberOf(state, o), o)?.ranged) continue;
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
    if (!u.pc) for (const o of b.units.filter(x => x.pc && standing(state, x) && x.ap > 0 && !op.asked.includes(`snap:${x.id}`))) {
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
const helpless = (state, t) => t.impaired >= 3 || cond(t, "restricted") >= 3 || (t.pc && memberOf(state, t).down);

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
  const steps = Math.floor(speedOf(memberOf(state, u)) / 2);
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
  if (!op.ranged && gap(a, t) > reachOf(a, CREATURES[a.cname])) { b.queue.shift(); return; }
  const info = attackInfo(state, a, op);
  // Grab: in lieu of an attack roll, a trial.
  if (op.grab) { b.queue.shift(); return runGrab(state, rng, note, a, t, op.grab); }
  // Declare the defense before the roll (Combat, Defense).
  if (op.defend === undefined) {
    const d = canDefend(state, t, info.type, op.ranged);
    if (!d.can) op.defend = false;
    else if (t.pc) {
      const set = reactOf(memberOf(state, t), "defend");
      const helper = heartener(state, t, "heartenDefense");
      const auto = helper && reactOf(memberOf(state, helper), "heartenDefense") === "always" ? helper.id : null;
      if (set !== "ask") { op.defend = set === "always"; if (op.defend && auto) op.hearten = auto; return; }
      b.prompt = { kind: "defend", by: a.id, target: t.id, helper: auto ? null : helper?.id, helperName: helper?.name, autoHearten: auto,
        text: `${a.name} ${op.reaction === "reprisal" ? "lashes out at" : op.reaction === "counter" || op.reaction === "riposte" ? "counters" : op.charge ? "charges" : "attacks"} ${t.name} (${info.name}${op.ranged ? ", ranged" : ""}). Defend (1 AP, ${t.ap} left)?` };
      return;
    } else op.defend = t.ap > (t.doneIn.length || b.current === t.id ? 0 : 1);
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
  const lift = op.heartenAtk ? heartenBonus(state, op.heartenAtk) : 0;
  if (lift) note(`${unitById(b, op.heartenAtk).name} heartens ${a.name} (+${lift}).`);
  const atk = rollPool(rng, info.dice, { edge: (dom ? 1 : 0) - (imp ? 1 : 0), bonus: info.bonus + (op.bonus || 0) + (flank ? 2 : 0) + am.bonus - am.pen + lift, inferiority: inf, superiority: sup, extra: info.extra });
  let def = null;
  if (op.defend) {
    const d = canDefend(state, { ...t, ap: 1 }, info.type, op.ranged);
    const dm = mods(state, t, "defense");
    let ddom = dm.edge > 0, dimp = dm.edge < 0;
    if (t.pc) { if (t.guard === "stable") ddom = true; if (t.guard === "striking") dimp = true; }
    const hearten = op.hearten ? heartenBonus(state, op.hearten) : 0;
    def = rollPool(rng, d.dice, { edge: (ddom ? 1 : 0) - (dimp ? 1 : 0), bonus: d.bonus + dm.bonus - dm.pen + hearten, inferiority: dm.inf || d.unarmed, superiority: dm.sup });
    if (hearten) note(`${unitById(b, op.hearten).name} heartens ${t.name} (+${hearten}).`);
  }
  const verb = op.reaction === "counter" || op.reaction === "riposte" ? "counters" : op.reaction === "reprisal" ? "strikes at" : op.reaction === "pack" ? "piles onto" : op.charge ? "charges" : op.ranged ? "shoots" : "attacks";
  note(`${a.name} ${verb} ${t.name} with ${info.name.toLowerCase()}${flank ? ", flanking (+2)" : ""}${op.rider ? ` (${op.rider})` : ""}: ${atk.text}.${def ? ` ${t.name} defends: ${def.text}.` : ""}`);
  const killedBefore = !onField(t);
  const hit = applyHit(state, rng, note, a, t, atk, def, info.type, op.ranged);
  if (!killedBefore) afterHit(state, rng, note, a, t, op, hit, info);
}

/** What lands after the damage: riders, Mob traits, flame, the pack, Challenge, Riposte, and counters. */
function afterHit(state, rng, note, a, t, op, hit, info) {
  const b = state.battle;
  const dealt = (hit.durabilityDamage || 0) + (hit.healthDamage || 0) > 0;
  if (dealt && onField(t)) {
    if (op.rider) applyRider(state, rng, note, a, t, abilitiesOf(CREATURES[a.cname]).find(x => x.name === op.rider), hit);
    if (a.minion) for (const m of abilitiesOf(CREATURES[a.cname]).filter(x => x.kind === "mob")) applyRider(state, rng, note, a, t, m, hit);
    if (!a.pc) for (const f of abilitiesOf(CREATURES[a.cname]).filter(x => x.kind === "flame" && x.whenType === info.type)) secondaryDamage(state, rng, note, t, f.amount, f.type, `${a.name}'s ${f.name}`);
  }
  // Challenge: the killing blow on the challenged foe inspires the challenger.
  if (a.pc && !onField(t) && a.challenge === t.id) {
    const n = { minion: 1, adept: 1, leader: 2, champion: 2 }[CREATURES[t.cname].rank] || 3;
    note(`${a.name} answers the Challenge with the killing blow.`, "reward");
    addCond(state, note, a, "inspired", n, { by: a.id });
  }
  // The pack: allies with Pack or Swarm Frenzy pile onto a creature that was hit.
  if (dealt && !a.pc && onField(t) && standing(state, a)) {
    for (const o of b.units.filter(x => !x.pc && x !== a && standing(state, x) && x.ap > 0 && x.demoralized < 3 && gap(x, t) <= reachOf(x, CREATURES[x.cname]))) {
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
  if (rip && !dealt && t.demoralized < 3 && meleeAttack(CREATURES[t.cname])) {
    t.ap -= 1; t.attack = CREATURES[t.cname].attacks.indexOf(meleeAttack(CREATURES[t.cname]));
    b.queue.unshift({ op: "attack", by: t.id, target: a.id, ranged: false, reaction: "riposte", bonus: rip.bonus });
    return;
  }
  // A successful defense opens a counterattack (Combat, Triggered Reactions).
  if (!op.defend || !hit.defended || (t.pc && weaponOf(memberOf(state, t), t)?.ranged)) return;
  if (t.pc) {
    const set = reactOf(memberOf(state, t), "counter");
    if (set === "never") return;
    if (set === "always") { t.ap -= 1; b.queue.unshift({ op: "attack", by: t.id, target: a.id, ranged: false, reaction: "counter" }); return; }
    b.queue.unshift({ op: "ask" });
    b.prompt = { kind: "counter", by: t.id, target: a.id, text: `${t.name} turned the blow. Counterattack ${a.name} (1 AP, ${t.ap} left)?` };
  } else if (t.demoralized < 3 && (t.ap >= 2 || t.doneIn.length) && meleeAttack(CREATURES[t.cname])) {
    t.ap -= 1; t.attack = CREATURES[t.cname].attacks.indexOf(meleeAttack(CREATURES[t.cname]));
    b.queue.unshift({ op: "attack", by: t.id, target: a.id, ranged: false, reaction: "counter" });
  }
}

/** A rider or Mob trait landing: extra damage, then a resist trial, then the condition, Attrition, or swap. */
function applyRider(state, rng, note, a, t, ab, hit) {
  if (!ab || !onField(t)) return;
  if (ab.gate === "health" && !hit.healthDamage) return;
  if (ab.extra) secondaryDamage(state, rng, note, t, ab.extra.amount, ab.extra.type, `${a.name}'s ${ab.name}`);
  if (!onField(t) || (t.pc && memberOf(state, t).dead)) return;
  if (ab.cond && cond(t, ab.cond.name) >= (ab.cond.max || 3) && ab.cond.name !== "infected") return;
  if (ab.resist) {
    const dc = ab.resist.dc === "band" ? mobDC(CREATURES[a.cname].tier, a.heads) : ab.resist.dc;
    const r = resist(state, rng, t, ab.resist.attr, dc);
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
function runGrab(state, rng, note, a, t, ab) {
  if (cond(t, "restricted") >= 3) return;
  const r = resist(state, rng, t, ab.resist.attr, ab.resist.dc);
  note(`${a.name} tries to ${ab.name === "Constrict" ? "wrap around" : "seize"} ${t.name} (${ab.name}). ${t.name} resists with Strength (${r.text} against ${ab.resist.dc}), ${r.ok ? "and slips free" : "and is caught"}.`, r.ok ? "" : "event");
  if (r.ok) return;
  addCond(state, note, t, "restricted", 1, { by: a.id });
  t.held = { by: a.id, dc: ab.resist.dc, name: ab.name };
}

/** Corra's Hearten (Presence, Rhetoric): a standing ally with AP can add their Charisma tier to this roll. */
function heartener(state, t, kind = "heartenDefense") {
  return state.battle.units.find(o => o.pc && o !== t && standing(state, o) && o.ap > 0 && (memberOf(state, o).abilities || []).includes("Hearten") && reactOf(memberOf(state, o), kind) !== "never");
}
function heartenBonus(state, id) {
  const u = unitById(state.battle, id);
  if (!u || u.ap < 1) return 0;
  u.ap -= 1;
  return tierOf(memberOf(state, u).attributes.charisma);
}

/** Is the ally on the far side of the target from the attacker? (Combat, Flanking) */
function opposite(a, o, t) {
  const side = (u) => [u.x + u.w - 1 < t.x ? -1 : u.x > t.x + t.w - 1 ? 1 : 0, u.y + u.h - 1 < t.y ? -1 : u.y > t.y + t.h - 1 ? 1 : 0];
  const [ax, ay] = side(a), [ox, oy] = side(o);
  return (ax !== 0 && ox === -ax) || (ay !== 0 && oy === -ay);
}
export const flanking = (state, a, t) => state.battle.units.some(o => o.side === a.side && o !== a && standing(state, o) && gap(o, t) <= 1 && opposite(a, o, t));

/* ------------------------------------------------------------------ */
/* Damage                                                               */

function applyHit(state, rng, note, a, t, atk, def, type, ranged) {
  if (immuneToDamage(state, t, type)) { note(`${t.name} is immune to ${type} damage.`); return { defended: false, durabilityDamage: 0, healthDamage: 0 }; }
  if (t.pc) {
    const m = memberOf(state, t);
    // Whether the shield takes the hit is the character's standing choice (Foundry's shieldAbsorbs).
    const shield = usesShield(m, weaponOf(m, t)) && m.shieldAbsorbs !== false ? m.shield.durability : 0;
    const armor = m.armor?.durability || 0;
    const r = resolveDamage({ attackTotal: atk.total, damageType: type, armorResistance: armor > 0 ? (m.armor.resistance[type] || 0) : 0,
      durabilityCurrent: shield + armor, healthCurrent: m.hp, activeDefense: !!def, defenseTotal: def?.total || 0 });
    if (r.defended) { note(`${t.name} turns it aside.`); return r; }
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
    t.dead = true;
    note(`${t.minion ? `The last of the ${t.cname.toLowerCase()}s falls` : `${t.name} falls`}.`, "reward");
    morale(state, rng, note, "fall");
  } else morale(state, rng, note, "hurt", t);
  return r;
}

/** Health damage to a character: 0 health, the dying timer, Fighting On, Traumas (Combat, Death). */
function hurtPC(state, rng, note, u, dmg) {
  const m = memberOf(state, u);
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
    return dropToZero(state, rng, note, u, dmg);
  }
  if (!m.fightingOn) return;
  const tr = traumaFor(rng, m);
  note(`${m.name} takes a Trauma (d100 ${tr.n}): ${tr.row.name}. ${tr.row.none ? "" : tr.row.text}`, "event");
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
  m.down = true; m.fightingOn = false;
  u.ap = 0;
  note(`${m.name} ${how}.`, "event");
}

function die(state, note, u, how = "dies") {
  const m = memberOf(state, u);
  m.dead = true; m.down = true; m.dying = null; m.hp = 0;
  u.dead = true;
  note(`${m.name} ${how}.`, "event");
}

/* ------------------------------------------------------------------ */
/* Morale (design/02-encounters.md)                                     */

function morale(state, rng, note, why, hurt = null) {
  const b = state.battle;
  if (b.temper === "Restless dead") return;
  const foes = b.units.filter(u => !u.pc && onField(u));
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

function aiStep(state, rng, note, u) {
  const b = state.battle;
  const c = CREATURES[u.cname];
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
  if (u.demoralized >= 3 && b.temper === "Guardian") return finishTurn(state, u, rng, note);
  if (u.demoralized >= 3) {
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
  const near = pcs.filter(t => gap(u, t) <= reach).sort((x, y) => memberOf(state, x).hp - memberOf(state, y).hp);

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
  // A Leader's buff (2 AP): when it isn't engaged and has allies near to stir.
  const buff = abs.find(a => a.kind === "buff");
  if (buff && !near.length && u.ap >= 2 && u.attacks === 0) {
    const allies = b.units.filter(o => o !== u && !o.pc && standing(state, o) && buff.who.test(o.cname) && gap(o, u) <= buff.range && cond(o, buff.cond) < 3);
    if (allies.length >= 2) {
      u.ap -= 2;
      note(`${u.name} uses ${buff.name}.`, "event");
      for (const o of allies) addCond(state, note, o, buff.cond, 1, { by: u.id });
      return finishTurn(state, u, rng, note);
    }
  }
  if (near.length && melee) {
    if (!mayAttack) return finishTurn(state, u, rng, note);
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
    const t = near[0];
    const pick = riderFor(state, u, c, t, false);
    u.attack = c.attacks.indexOf(pick?.atk || melee);
    attack(b, u, t, false);
    if (pick) Object.assign(b.queue[b.queue.length - 1], { rider: pick.ab.name, edge: pick.ab.edge || 0, inf: !!pick.ab.inf, forfeitFlank: !!pick.ab.needsFlank });
    return;
  }
  if (cond(u, "restricted")) return finishTurn(state, u, rng, note);
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
  if (ranged && mayAttack && (!melee || !reachable || u.demoralized >= 1)) {
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
  if (cond(u, "tainted") >= 2) steps = Math.min(steps, Math.floor(speed / 2));
  if (steps < best.path.length) {
    if (u.ap < 1) return finishTurn(state, u, rng, note);
    u.ap -= 1;
    steps += cond(u, "tainted") >= 2 ? Math.floor(moveStep(u, speed) / 2) : moveStep(u, speed);
  }
  const go = best.path.slice(0, steps);
  u.moveLeft = steps - go.length;
  u.lastMove = true;
  b.queue.push({ op: "move", id: u.id, path: go, asked: [] });
}

/** Which rider, if any, the creature uses on this attack: one whose effect the target doesn't already carry. */
function riderFor(state, u, c, t, ranged) {
  for (const ab of abilitiesOf(c).filter(a => a.kind === "rider")) {
    const atk = c.attacks.find(a => ab.attack.test(a.name) && !!rangeOf(a) === ranged);
    if (!atk) continue;
    if (ab.needsFlank && !flanking(state, u, t)) continue;
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
  const foes = b.units.filter(u => !u.pc && onField(u));
  const pcs = b.units.filter(u => u.pc && standing(state, u));
  if (!foes.length) return aftermath(state, rng, note, pcs);
  if (!pcs.length) { finish(state, rng, note, "lost"); return true; }
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
    if (spell && m.magan > 0) return { who: m.name, what: spell };
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
  if (u.impaired) bits.push(IMPAIRED[u.impaired]);
  if (u.demoralized) bits.push(DEMORALIZED[u.demoralized]);
  for (const k of Object.keys(COND_LABELS)) if (cond(u, k)) bits.push(COND_LABELS[k][cond(u, k)]);
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
