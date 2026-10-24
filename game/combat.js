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
 * Maneuvers, spells, creature abilities, and companions come in later stages.
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
import { headsLost, groupTokenSize, bandFor as groupBand } from "./vendor/foundry/module/helpers/minion-rules.mjs";
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
function rollPool(rng, dice, { edge = 0, bonus = 0, inferiority = false, extra = -1 } = {}) {
  let total = bonus, kept = 0;
  const parts = [];
  dice.forEach((d, i) => {
    const [c, s] = shift(d, edge);
    if (s === 1) { total += c; parts.push(String(c)); return; }
    const chains = [];
    for (let k = 0; k < c + (i === extra ? 1 : 0); k++) {
      const chain = [rng.d(s)];
      while (s >= 3 && !inferiority && chain[chain.length - 1] === s && chain.length < 20) chain.push(rng.d(s));
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
  const tags = [edge > 0 ? "Dominance" : edge < 0 ? "Impotence" : "", inferiority ? "Inferiority" : ""].filter(Boolean);
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

/** Penalties and Inferiority from conditions and untreated Injuries (Conditions). */
function strain(state, u) {
  const m = u.pc ? memberOf(state, u) : null;
  const pen = (u.impaired === 1 ? 1 : u.impaired === 2 ? 2 : 0) + (m?.injuries || 0);
  return { pen, attackInf: u.impaired === 2 || u.demoralized >= 1, defenseInf: u.impaired === 2 || u.demoralized >= 2 };
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
      guard: "mutable", impaired: e.impaired?.[m.id] || 0, demoralized: 0, phase: "fast", doneIn: [], moveLeft: 0, lastMove: false, attacks: 0 });
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
        ap: 0, phases: [], attack: null, impaired: 0, demoralized: 0, doneIn: [], moveLeft: 0, lastMove: false, attacks: 0, marks: 0
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
      note(`${u.name}: Startle ${t.text}${u.impaired ? `, ${IMPAIRED[u.impaired]}` : ", keeps its head"}.`);
    }
  }
  note(`The fight begins: ${b.units.filter(u => !u.pc).map(u => u.name).join(", ")}, ${e.distance === "Close" ? "close" : e.distance === "Far" ? "far" : "a little way"} off.`, "event");
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
    // Impaired eases one tier at the start of each round after the first.
    if (b.round > 1 && u.impaired > 0) { u.impaired -= 1; }
    u.doneIn = []; u.moveLeft = 0; u.lastMove = false; u.attacks = 0;
    if (u.pc) {
      const m = memberOf(state, u);
      u.ap = m.down || u.impaired >= 3 ? 0 : 2;
    } else {
      const c = CREATURES[u.cname];
      const rank = MASTERY.npcRanks[c.rank];
      const a = meleeAttack(c) || rangedAttack(c);
      u.attack = a ? c.attacks.indexOf(a) : null;
      const base = a?.phase || "fast";
      // Epic and Legendary creatures get 2 AP in each phase they act in.
      u.phases = rank.phasesActive >= 3 ? [...PHASES] : rank.phasesActive === 2 ? (base === "slow" ? ["moderate", "slow"] : [base, "slow"]) : [u.impaired ? "slow" : base];
      u.ap = u.impaired >= 3 ? 0 : rank.phasesActive > 1 ? 0 : rank.ap;
    }
  }
  note(`Round ${b.round}.`, "day");
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
    u.moveLeft = 0; u.lastMove = false; u.attacks = 0;
    if (!u.pc && u.phases.length > 1) u.ap = 2;
    return;
  }
  b.sideIdx += 1;
  if (b.sideIdx > 1) { b.sideIdx = 0; b.phaseIdx += 1; }
  if (b.phaseIdx > 2) endRound(state, rng, note);
}

function finishTurn(state, u) {
  const b = state.battle;
  u.doneIn.push(PHASES[b.phaseIdx]);
  u.moveLeft = 0; u.lastMove = false;
  if (!u.pc && u.phases.length > 1) u.ap = 0;
  b.current = null;
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
      if (!able(state, u) || u.ap <= 0) { finishTurn(state, u); continue; }
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
  const path = pathTo(b, u, x, y);
  if (!path || !path.length) return null;
  const speed = speedOf(memberOf(state, u));
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

/** Can the current character attack this target with what's in hand? → { ok, why, ranged } */
export function canAttack(state, u, t) {
  if (!t || t.side === u.side || !onField(t)) return { ok: false };
  if (u.ap < 1) return { ok: false, why: "no AP left" };
  const m = memberOf(state, u), w = weaponOf(m, u);
  const g = gap(u, t);
  if (w?.ranged) {
    const b = state.battle;
    if (w.thrown && (w.count ?? 1) - (b.thrown[`${m.id}:${u.weapon}`] || 0) <= 0) return { ok: false, why: `no ${w.name.toLowerCase()} left` };
    if (w.projectile && b.units.some(o => o.side !== u.side && standing(state, o) && gap(u, o) <= 1)) return { ok: false, why: "an enemy is too close to shoot" };
    if (g > w.range[2]) return { ok: false, why: "out of range" };
    return { ok: true, ranged: true };
  }
  if (g > 1) return { ok: false, why: "out of reach" };
  return { ok: true, ranged: false };
}

export function pcAttack(state, rng, note, targetId) {
  const u = currentPC(state);
  if (!u) return;
  const t = unitById(state.battle, targetId);
  const can = canAttack(state, u, t);
  if (!can.ok) { if (can.why) note(can.why[0].toUpperCase() + can.why.slice(1) + "."); return; }
  u.ap -= 1; u.moveLeft = 0; u.lastMove = false; u.attacks += 1;
  state.battle.queue.push({ op: "attack", by: u.id, target: t.id, ranged: can.ranged });
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
  finishTurn(state, u);
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
    case "defend": head.defend = !!yes; break;
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
    u.x = nx; u.y = ny;
    op.path.shift();
  }
  b.queue.shift();
  if (op.flee && onField(u) && (u.x === 0 || u.y === 0 || u.x + u.w >= b.w || u.y + u.h >= b.h)) {
    u.fled = true;
    note(`${u.name} flees the field.`, "event");
  }
}

function canDefend(state, t, type, ranged) {
  if (!standing(state, t) || t.ap < 1 || t.impaired >= 3) return { can: false };
  return t.pc ? pcDefense(state, t, type, ranged) : creatureDefense(t, CREATURES[t.cname], type, ranged);
}

function attackInfo(state, a) {
  if (a.pc) return pcAttackDice(state, a, weaponOf(memberOf(state, a), a));
  const c = CREATURES[a.cname];
  const atk = c.attacks[a.attack] || meleeAttack(c) || c.attacks[0];
  return creatureAttackDice(a, c, atk);
}

function runAttack(state, rng, note, op) {
  const b = state.battle;
  const a = unitById(b, op.by), t = unitById(b, op.target);
  if (!a || !t || !standing(state, a) || !onField(t) || (t.pc && memberOf(state, t).dead)) { b.queue.shift(); return; }
  if (!op.ranged && gap(a, t) > reachOf(a, CREATURES[a.cname])) { b.queue.shift(); return; }
  const info = attackInfo(state, a);
  // Declare the defense before the roll (Combat, Defense).
  if (op.defend === undefined) {
    const d = canDefend(state, t, info.type, op.ranged);
    if (!d.can) op.defend = false;
    else if (t.pc) {
      b.prompt = { kind: "defend", by: a.id, target: t.id, text: `${a.name} ${op.reaction === "reprisal" ? "lashes out at" : op.reaction === "counter" ? "counters" : "attacks"} ${t.name} (${info.name}${op.ranged ? ", ranged" : ""}). Defend (1 AP, ${t.ap} left)?` };
      return;
    } else op.defend = t.ap > (t.doneIn.length || b.current === t.id ? 0 : 1);
  }
  b.queue.shift();
  if (op.defend) t.ap -= 1;

  // Ranged: the Aiming Trial (Combat, Attack).
  if (op.ranged) {
    const m = a.pc ? memberOf(state, a) : null;
    const w = m ? weaponOf(m, a) : null;
    if (w?.thrown) b.thrown[`${m.id}:${a.weapon}`] = (b.thrown[`${m.id}:${a.weapon}`] || 0) + 1;
    const range = w ? w.range : rangeOf(CREATURES[a.cname].attacks[a.attack]) || [6, 12, 18];
    const g = gap(a, t);
    const friends = b.units.filter(o => o.side === a.side && o !== a && standing(state, o) && gap(o, t) <= 1).length;
    const dc = Math.max(1, 2 + (g > range[1] ? 3 : g > range[0] ? 1 : 0) + friends - (t.minion && t.heads > 1 ? 2 : 0));
    const per = a.pc ? dieOfTier(tierOf(m.attributes.perception)) : dieOfTier(CREATURES[a.cname].rank === "minion" ? CREATURES[a.cname].tier : CREATURES[a.cname].attributes.perception.tier);
    const r = per[1] === 1 ? 1 : rng.d(per[1]);
    const hit = r !== 1 && (r === per[1] || r >= dc);
    note(`${a.name} takes aim at ${t.name}: d${per[1]} ${r} against ${dc}${friends ? ` (${friends} of their own beside it)` : ""}, ${hit ? "on target" : "misses"}.`);
    if (!hit) return;
  }

  const st = strain(state, a);
  const flank = !op.ranged && b.units.some(o => o.side === a.side && o !== a && standing(state, o) && gap(o, t) <= 1 && opposite(a, o, t));
  const edgeA = a.pc ? (a.guard === "striking" ? 1 : a.guard === "stable" ? -1 : 0) : 0;
  const atk = rollPool(rng, info.dice, { edge: edgeA, bonus: info.bonus + (flank ? 2 : 0) - st.pen, inferiority: st.attackInf, extra: info.extra });
  let def = null;
  if (op.defend) {
    const d = canDefend(state, { ...t, ap: 1 }, info.type, op.ranged);
    const ts = strain(state, t);
    const edgeD = t.pc ? (t.guard === "stable" ? 1 : t.guard === "striking" ? -1 : 0) : 0;
    def = rollPool(rng, d.dice, { edge: edgeD, bonus: d.bonus - ts.pen, inferiority: ts.defenseInf || (d.unarmed && !info.unarmed) });
  }
  const verb = op.reaction === "counter" ? "counters" : op.reaction === "reprisal" ? "strikes at" : op.ranged ? "shoots" : "attacks";
  note(`${a.name} ${verb} ${t.name} with ${info.name.toLowerCase()}${flank ? ", flanking (+2)" : ""}: ${atk.text}.${def ? ` ${t.name} defends: ${def.text}.` : ""}`);
  const hit = applyHit(state, rng, note, a, t, atk, def, info.type, op.ranged);
  // A successful defense opens a counterattack (Combat, Triggered Reactions).
  if (def && hit.defended && !op.ranged && !b.prompt && standing(state, t) && t.ap > 0 && gap(t, a) <= reachOf(t, CREATURES[t.cname]) && !(t.pc && weaponOf(memberOf(state, t), t)?.ranged)) {
    if (t.pc) {
      b.queue.unshift({ op: "ask" });
      b.prompt = { kind: "counter", by: t.id, target: a.id, text: `${t.name} turned the blow. Counterattack ${a.name} (1 AP, ${t.ap} left)?` };
    } else if (t.demoralized < 3 && (t.ap >= 2 || t.doneIn.length) && meleeAttack(CREATURES[t.cname])) {
      t.ap -= 1; t.attack = CREATURES[t.cname].attacks.indexOf(meleeAttack(CREATURES[t.cname]));
      b.queue.unshift({ op: "attack", by: t.id, target: a.id, ranged: false, reaction: "counter" });
    }
  }
}

/** Is the ally on the far side of the target from the attacker? (Combat, Flanking) */
function opposite(a, o, t) {
  const side = (u) => [u.x + u.w - 1 < t.x ? -1 : u.x > t.x + t.w - 1 ? 1 : 0, u.y + u.h - 1 < t.y ? -1 : u.y > t.y + t.h - 1 ? 1 : 0];
  const [ax, ay] = side(a), [ox, oy] = side(o);
  return (ax !== 0 && ox === -ax) || (ay !== 0 && oy === -ay);
}

/* ------------------------------------------------------------------ */
/* Damage                                                               */

function applyHit(state, rng, note, a, t, atk, def, type, ranged) {
  const b = state.battle;
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
      const fp = groupTokenSize(Math.max(1, t.heads), c.size.width * c.size.height);
      t.w = fp.width; t.h = fp.height;
      t.name = `${t.cname}s (${t.heads})`;
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
    m.injuries = (m.injuries || 0) + 1;
    m.dying = tierOf(m.attributes.endurance);
    m.stable = false;
    const t = endure();
    note(`${m.name} drops to 0 health: an Injury, and ${m.dying} rounds to live unless someone stops the bleeding. Endurance ${t.text} against ${dmg}: ${passes(t, dmg) ? "still conscious" : "falls unconscious"}.`, "event");
    if (passes(t, dmg)) {
      state.battle.queue.unshift({ op: "ask" });
      state.battle.prompt = { kind: "fightOn", id: u.id, text: `${m.name} is still on their feet at 0 health and dying. Fight on (every wound now is a Trauma) or go down?` , yes: "Fight on", no: "Go down" };
    } else knockOut(state, note, u);
    return;
  }
  if (!m.fightingOn) return;
  const tr = traumaFor(rng, m);
  note(`${m.name} takes a Trauma (d100 ${tr.n}): ${tr.row.name}. ${tr.row.none ? "" : tr.row.text}`, "event");
  const t = endure();
  if (!passes(t, dmg)) { note(`Endurance ${t.text} against ${dmg}: ${m.name} goes down.`); knockOut(state, note, u); }
  else note(`Endurance ${t.text} against ${dmg}: ${m.name} stays up.`);
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
  for (const u of rolling) {
    if (u.demoralized >= 3) continue;
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
  const pcs = b.units.filter(t => t.pc && standing(state, t));
  if (u.ap <= 0 || !pcs.length) return finishTurn(state, u);
  const speed = creatureSpeed(c);
  // Panicked: away from the party by the safest route, off the field.
  // Guardians never leave their place: cornered, they only defend.
  if (u.demoralized >= 3 && b.temper === "Guardian") return finishTurn(state, u);
  if (u.demoralized >= 3) {
    const edge = (x, y) => x === 0 || y === 0 || x + u.w >= b.w || y + u.h >= b.h;
    const path = search(b, u, (x) => x + u.w >= b.w) || search(b, u, edge);
    if (!path?.length) return finishTurn(state, u);
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
  if (near.length && melee) {
    if (!mayAttack) return finishTurn(state, u);
    u.attack = c.attacks.indexOf(melee);
    attack(b, u, near[0], false);
    return;
  }
  // Out of reach: close in, or throw if it can't get there.
  const routes = pcs.map(t => ({ t, path: pathToReach(b, u, t, reach) })).filter(r => r.path).sort((x, y) => x.path.length - y.path.length);
  const best = routes[0];
  const reachable = best && best.path.length <= u.moveLeft + speed + (u.ap > 1 ? speed + Math.floor(speed / 2) : 0);
  if (ranged && mayAttack && (!melee || !reachable || u.demoralized >= 1)) {
    const rr = rangeOf(ranged);
    const shot = pcs.filter(t => gap(u, t) <= rr[2]).sort((x, y) => gap(u, x) - gap(u, y))[0];
    if (shot) { u.attack = c.attacks.indexOf(ranged); attack(b, u, shot, true); return; }
  }
  if (!best || u.demoralized >= 1 || !melee) return finishTurn(state, u);
  // Don't spend the last AP walking when that leaves nothing to fight or defend with, unless it gets there.
  let steps = u.moveLeft;
  if (steps < best.path.length) {
    if (u.ap < 1) return finishTurn(state, u);
    u.ap -= 1;
    steps += moveStep(u, speed);
  }
  const go = best.path.slice(0, steps);
  u.moveLeft = steps - go.length;
  u.lastMove = true;
  b.queue.push({ op: "move", id: u.id, path: go, asked: [] });
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
  if (u.pc) {
    const m = memberOf(state, u);
    if (m.dead) bits.push("dead");
    else if (m.dying != null) bits.push(`dying (${m.dying})`);
    else if (m.stable) bits.push("stable");
    if (m.down && !m.dead) bits.push("unconscious");
    if (m.fightingOn) bits.push("fighting on");
  }
  if (u.minion) bits.push(groupBand(u.heads).label);
  return bits;
}
export const memberFor = memberOf;
export const creatureFor = (u) => CREATURES[u.cname];
