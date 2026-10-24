import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, runWithDice, note, campNow } from "../game/journey.js";
import { startBattle, beginRound, currentPC, pcEndTurn, pcMove, pcAttack, respond, setMode, canAttack, moveCost, gap, GRID_W } from "../game/combat.js";
import { ABILITIES } from "../game/data/abilities.js";
import { CREATURES } from "../game/data/creatures.js";
import { playBattle } from "./autoplay.mjs";

function battle(seed, group, extra = {}) {
  const s = newGame(seed);
  s.encounter = { head: group[0].name, text: "test", temper: "Predator", xp: 4, group, impaired: {}, distance: "Near", terrain: "forest", ...extra };
  runWithDice(s, (rng) => startBattle(s, rng, (t, k) => note(s, t, k)));
  return s;
}
const say = (s) => (t, k) => note(s, t, k);
const logOf = (s, from = 0) => s.log.slice(from).map(l => l.text).join("\n");
const unit = (s, id) => s.battle.units.find(u => u.id === id);

test("every ability the abilities table names is quoted from a real stat block", () => {
  const all = new Set(Object.values(CREATURES).flatMap(c => c.abilities));
  for (const name of Object.keys(ABILITIES)) assert.ok(all.has(name), `${name} is on some creature`);
});

test("fights with every Band I group still end, with the clever player too", () => {
  const groups = [
    [{ name: "Wolf, Beta", count: 1 }, { name: "Wolf, Gamma", count: 2 }, { name: "Wolf, Runt", heads: 6 }],
    [{ name: "Bandit Leader", count: 1 }, { name: "Bandit Cutthroat", count: 2 }, { name: "Bandit Thug", heads: 6 }],
    [{ name: "Mountain Lion", count: 1 }], [{ name: "Constrictor", count: 1 }], [{ name: "Living Stone", count: 2 }],
    [{ name: "Fire Elemental", count: 1 }], [{ name: "Death-Watch", heads: 6 }], [{ name: "Giant Rat", count: 3 }, { name: "Rat Swarm", heads: 6 }]
  ];
  for (const g of groups) for (const seed of [1, 2, 3]) {
    const s = battle(seed, g);
    playBattle(s, { clever: seed % 2 === 1 });
    assert.equal(s.battle, null, `${g[0].name} seed ${seed}`);
  }
});

test("a held character can't move until free; the hold ends when the grabber goes", () => {
  const s = battle(2, [{ name: "Mountain Lion", count: 1 }]);
  const lion = s.battle.units.find(u => !u.pc);
  const gerb = unit(s, "gerberga");
  gerb.cond.restricted = 1; gerb.held = { by: lion.id, dc: 4, name: "Grab" };
  lion.x = gerb.x + 1; lion.y = gerb.y;
  runWithDice(s, (rng) => beginRound(s, rng, say(s)));
  assert.equal(moveCost(s, gerb, gerb.x - 1, gerb.y), null);
  lion.dead = true; lion.hp = 0;
  // end the round: the hold no longer stands
  for (let i = 0; i < 40 && s.battle && s.battle.round === 1; i++) {
    if (s.battle.prompt) runWithDice(s, (rng) => respond(s, rng, say(s), false));
    else if (currentPC(s)) runWithDice(s, (rng) => pcEndTurn(s, rng, say(s)));
    else break;
  }
  assert.ok(!s.battle || !unit(s, "gerberga").held);
});

test("Attrition bleeds at the end of the afflicted character's turn, then expires", () => {
  const s = battle(4, [{ name: "Boar", count: 1 }]);
  const boar = s.battle.units.find(u => !u.pc); boar.x = GRID_W - 2; boar.y = 0;
  const gisla = s.party.members.find(m => m.id === "gisla");
  unit(s, "gisla").attrition.push({ label: "Bleeding", type: null, amount: 2 });
  const hp = gisla.hp, from = s.log.length;
  runWithDice(s, (rng) => beginRound(s, rng, say(s)));
  for (let i = 0; i < 20 && s.battle && unit(s, "gisla").attrition.length; i++) {
    if (s.battle.prompt) runWithDice(s, (rng) => respond(s, rng, say(s), false));
    else if (currentPC(s)) runWithDice(s, (rng) => pcEndTurn(s, rng, say(s)));
    else break;
  }
  assert.equal(gisla.hp, hp - 2);
  assert.match(logOf(s, from), /Attrition \(Bleeding\): Gisla takes 2 to health/);
});

test("Gisla is immune to Grave Rust's Profane rot", () => {
  const s = battle(5, [{ name: "Skeleton", heads: 6 }]);
  unit(s, "gisla").attrition.push({ label: "Decaying", type: "profane", amount: 1 });
  const hp = s.party.members.find(m => m.id === "gisla").hp;
  runWithDice(s, (rng) => beginRound(s, rng, say(s)));
  for (let i = 0; i < 20 && s.battle && unit(s, "gisla").attrition.length; i++) {
    if (s.battle.prompt) runWithDice(s, (rng) => respond(s, rng, say(s), false));
    else if (currentPC(s)) runWithDice(s, (rng) => pcEndTurn(s, rng, say(s)));
    else break;
  }
  assert.equal(s.party.members.find(m => m.id === "gisla").hp, hp);
});

test("Avoid Death works once, then waits for a rest", () => {
  let fired = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const s = battle(seed, [{ name: "Bandit Leader", count: 1 }, { name: "Bandit Cutthroat", count: 2 }, { name: "Bandit Thug", heads: 6 }], { temper: "Raider" });
    const from = s.log.length;
    playBattle(s);
    const n = (logOf(s, from).match(/Avoid Death/g) || []).length;
    assert.ok(n <= 1, "at most once a rest");
    fired += n;
  }
  assert.ok(fired > 0, "it fires in some fights");
});

/** Start round 1 and step to the given character's turn, with the board set by place(). */
function turnOf(s, id, place) {
  place();
  for (const u of s.battle.units.filter(x => !x.pc)) u.ap = 0; // keep the enemy still
  runWithDice(s, (rng) => beginRound(s, rng, say(s)));
  for (let i = 0; i < 40 && s.battle && currentPC(s)?.id !== id; i++) {
    if (s.battle.prompt) runWithDice(s, (rng) => respond(s, rng, say(s), false));
    else if (currentPC(s)) runWithDice(s, (rng) => pcEndTurn(s, rng, say(s)));
    else break;
  }
  return currentPC(s);
}

test("Hamon's Opportunist with Backstab adds two Stealth dice, with Dominance and the flanking bonus", () => {
  const s = battle(3, [{ name: "Bandit Cutthroat", count: 1 }], { temper: "Raider" });
  const foe = s.battle.units.find(u => !u.pc);
  const hamon = turnOf(s, "hamon", () => {
    foe.x = 8; foe.y = 5;
    Object.assign(unit(s, "hamon"), { x: 7, y: 5 });
    Object.assign(unit(s, "gerberga"), { x: 9, y: 4 });
    Object.assign(unit(s, "gisla"), { x: 8, y: 6 });
    Object.assign(unit(s, "corra"), { x: 1, y: 1 });
  });
  assert.ok(hamon, "Hamon's turn came");
  assert.ok(canAttack(s, hamon, foe, "opportunist").ok, "two allies on it open Opportunist");
  setMode(s, "opportunist");
  const from = s.log.length;
  runWithDice(s, (rng) => pcAttack(s, rng, say(s), foe.id));
  const line = s.log.slice(from).map(l => l.text).find(t => /^Hamon attacks .*opportunist/i.test(t));
  assert.ok(line, logOf(s, from));
  assert.match(line, /Dominance/);
  assert.match(line, /flanking \(\+2\)/);
  assert.equal((line.match(/d4\[/g) || []).length, 2, "two Stealth dice, d3 stepped up to d4");
});

test("Death Tick shakes characters who start their turn near the swarm", () => {
  let seen = false;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const s = battle(seed, [{ name: "Death-Watch", heads: 12 }], { distance: "Close" });
    const from = s.log.length;
    playBattle(s);
    if (/Death Tick\. .*it gets under the skin/.test(logOf(s, from))) { seen = true; break; }
  }
  assert.ok(seen);
});

test("a character three or more squares off in a straight line can Charge for 2 AP", () => {
  const s = battle(6, [{ name: "Boar", count: 1 }], { temper: "Territorial" });
  const boar = s.battle.units.find(u => !u.pc);
  const u = turnOf(s, "gerberga", () => {
    boar.x = 10; boar.y = 5;
    Object.assign(unit(s, "gerberga"), { x: 6, y: 5 });
  });
  assert.ok(u, "Gerberga's turn came");
  const can = canAttack(s, u, boar);
  assert.ok(can.ok && can.charge && can.cost === 2, JSON.stringify(can));
  const from = s.log.length;
  runWithDice(s, (rng) => pcAttack(s, rng, say(s), boar.id));
  assert.match(logOf(s, from), /Gerberga charges Boar with swordbreaker.*Dominance/);
});

test("Infected makes rest a stage worse", () => {
  const s = newGame(9);
  const corra = s.party.members.find(m => m.id === "corra");
  corra.hp = 1; corra.infected = 3;
  campNow(s);
  assert.equal(corra.hp, 1, "Diseased: no rest at all");
});

test("a condition wears off at the end of its source's next turn, not the turn it landed", () => {
  const s = battle(8, [{ name: "Bandit Cutthroat", count: 1 }], { temper: "Raider" });
  const foe = s.battle.units.find(u => !u.pc);
  foe.x = GRID_W - 1; foe.y = 0;
  const gisla = unit(s, "gisla");
  gisla.cond.restricted = 1; gisla.decay = { restricted: { by: foe.id, round: 1 } };
  const step = () => {
    if (s.battle.prompt) runWithDice(s, (rng) => respond(s, rng, say(s), false));
    else if (s.battle.stage === "declare") runWithDice(s, (rng) => beginRound(s, rng, say(s)));
    else if (currentPC(s)) runWithDice(s, (rng) => pcEndTurn(s, rng, say(s)));
  };
  runWithDice(s, (rng) => beginRound(s, rng, say(s)));
  for (let i = 0; i < 40 && s.battle.round === 1; i++) step();
  assert.equal(gisla.cond.restricted, 1, "still Restricted after the round it landed");
  for (let i = 0; i < 40 && s.battle && !foe.doneIn.length; i++) step();
  assert.equal(gisla.cond.restricted || 0, 0, "gone at the end of the bandit's next turn");
});

test("Opportunist opens on Impaired from Startle, not on Impaired from a cudgel", () => {
  const s = battle(3, [{ name: "Bandit Cutthroat", count: 1 }], { temper: "Raider" });
  const foe = s.battle.units.find(u => !u.pc);
  const hamon = turnOf(s, "hamon", () => {
    foe.x = 8; foe.y = 5;
    Object.assign(unit(s, "hamon"), { x: 7, y: 5 });
    for (const id of ["gerberga", "gisla", "corra"]) Object.assign(unit(s, id), { x: 1, y: ["gerberga", "gisla", "corra"].indexOf(id) * 2 });
  });
  assert.ok(hamon);
  foe.impaired = 1; foe.startle = 0; foe.decay.impaired = { by: "e9", round: s.battle.round };
  assert.ok(!canAttack(s, hamon, foe, "opportunist").ok, "a cudgel's daze opens nothing");
  foe.startle = 1;
  assert.ok(canAttack(s, hamon, foe, "opportunist").ok, "a Startle's daze does");
});

test("Epic creatures fight to the death", () => {
  for (const seed of [1, 2, 3]) {
    const s = battle(seed, [{ name: "Wolf, Dire", count: 1 }]);
    const from = s.log.length;
    playBattle(s);
    assert.doesNotMatch(logOf(s, from), /Wolf, Dire (wavers|holds|flees)/);
  }
});
