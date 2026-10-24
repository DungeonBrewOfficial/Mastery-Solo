import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, runWithDice, note } from "../game/journey.js";
import { startBattle, beginRound, retreat, currentPC, pcEndTurn, respond, triageTargets, pcTriage, gap, GRID_W, GRID_H } from "../game/combat.js";
import { pack, unpack } from "../game/storage.js";
import { playBattle } from "./autoplay.mjs";

const BANDITS = [{ name: "Bandit Leader", count: 1 }, { name: "Bandit Cutthroat", count: 2 }, { name: "Bandit Thug", heads: 6 }];

function battle(seed, group = BANDITS, extra = {}) {
  const s = newGame(seed);
  s.encounter = { head: group[0].name, text: "test", temper: "Raider", xp: 6, group, impaired: {}, distance: "Near", terrain: "forest", ...extra };
  runWithDice(s, (rng) => startBattle(s, rng, (t, k) => note(s, t, k)));
  return s;
}

test("a battle sets both sides on the grid without overlap", () => {
  const s = battle(1);
  const us = s.battle.units;
  assert.equal(us.filter(u => u.pc && !u.companion).length, 4);
  assert.deepEqual(us.filter(u => u.companion).map(u => u.name).sort(), ["Clabber", "Tallow"], "the companions come too");
  const thugs = us.find(u => u.minion);
  assert.equal(thugs.heads, 6);
  assert.equal(thugs.w * thugs.h, 6, "a Cluster of six fills six squares");
  for (const a of us) {
    assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= GRID_W && a.y + a.h <= GRID_H, `${a.name} on the grid`);
    for (const b of us) if (a !== b) assert.ok(gap(a, b) >= 1, `${a.name} and ${b.name} don't overlap`);
  }
  assert.equal(s.battle.stage, "declare");
});

test("fights always end, the same way for the same seed", () => {
  const outcomes = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const a = battle(seed), b = battle(seed);
    playBattle(a); playBattle(b);
    assert.equal(a.battle, null);
    assert.deepEqual(a.party.members.map(m => [m.hp, m.dead]), b.party.members.map(m => [m.hp, m.dead]));
    outcomes.push(a.over ? "lost" : "won");
  }
  assert.ok(outcomes.includes("won"));
});

test("a fight saved mid-round picks up where it left off", () => {
  const a = battle(5);
  runWithDice(a, (rng) => beginRound(a, rng, (t, k) => note(a, t, k)));
  const b = unpack(pack(a));
  playBattle(a); playBattle(b);
  assert.deepEqual(a.party.members.map(m => [m.hp, m.dead, m.xp]), b.party.members.map(m => [m.hp, m.dead, m.xp]));
});

test("winning pays the head's XP to every living character", () => {
  for (const seed of [11, 12, 13, 14]) {
    const s = battle(seed, [{ name: "Wild Dog", count: 1 }], { temper: "Predator", xp: 4 });
    playBattle(s);
    if (s.over) continue;
    for (const m of s.party.members.filter(x => !x.dead)) assert.equal(m.xp, 4);
    return;
  }
  assert.fail("the party never beat one wild dog");
});

test("the restless dead never break", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const s = battle(seed, [{ name: "Zombie", count: 2 }], { temper: "Restless dead" });
    const start = s.log.length;
    playBattle(s);
    assert.ok(!s.log.slice(start).some(l => /wavers|flees the field/.test(l.text)));
  }
});

test("a dying character dies when the timer runs out, unless someone stops the bleeding", () => {
  const s = battle(3, [{ name: "Wild Dog", count: 1 }]);
  const gisla = s.party.members.find(m => m.id === "gisla");
  gisla.hp = 0; gisla.dying = 1; gisla.down = true;
  const dog = s.battle.units.find(u => !u.pc);
  dog.x = GRID_W - 1; dog.y = 0;
  const say = (t, k) => note(s, t, k);
  runWithDice(s, (rng) => beginRound(s, rng, say));
  // everyone ends their turn without helping
  for (let i = 0; i < 50 && s.battle && s.battle.round === 1; i++) {
    if (s.battle.prompt) runWithDice(s, (rng) => respond(s, rng, say, false));
    else if (currentPC(s)) runWithDice(s, (rng) => pcEndTurn(s, rng, say));
  }
  assert.ok(gisla.dead, "Gisla died");
});

test("Triage stops the dying timer", () => {
  const s = battle(3, [{ name: "Wild Dog", count: 1 }]);
  const say = (t, k) => note(s, t, k);
  const gisla = s.party.members.find(m => m.id === "gisla");
  gisla.hp = 0; gisla.dying = 1; gisla.down = true;
  const dog = s.battle.units.find(u => !u.pc);
  dog.x = GRID_W - 1; dog.y = 0;
  runWithDice(s, (rng) => beginRound(s, rng, say));
  for (let i = 0; i < 50 && s.battle && s.battle.round === 1; i++) {
    if (s.battle.prompt) { runWithDice(s, (rng) => respond(s, rng, say, false)); continue; }
    const u = currentPC(s);
    if (!u) break;
    const t = triageTargets(s, u)[0];
    if (t && u.ap >= 2) runWithDice(s, (rng) => pcTriage(s, rng, say, t.id));
    else runWithDice(s, (rng) => pcEndTurn(s, rng, say));
  }
  assert.ok(!gisla.dead && gisla.stable, "Gisla is stable");
});

function wonWithGislaBleeding(seed, strip) {
  const s = battle(seed, [{ name: "Wild Dog", count: 1 }]);
  if (strip) { for (const m of s.party.members) { m.gear = []; m.spells = []; } delete s.party.stores["Wound Kit"]; }
  const gisla = s.party.members.find(m => m.id === "gisla");
  gisla.hp = 0; gisla.dying = 3; gisla.down = true;
  const dog = s.battle.units.find(u => !u.pc);
  dog.dead = true; dog.hp = 0;
  const say = (t, k) => note(s, t, k);
  runWithDice(s, (rng) => beginRound(s, rng, say));
  return { s, gisla, say };
}

test("after a win, the party's healing means save the dying", () => {
  const { s, gisla } = wonWithGislaBleeding(4, false);
  assert.equal(s.battle, null);
  assert.ok(!gisla.dead);
});

test("after a win without the means, the dying must be reached and triaged", () => {
  const { s, gisla, say } = wonWithGislaBleeding(4, true);
  assert.ok(s.battle && s.battle.aftermath, "the rounds go on");
  for (let i = 0; i < 50 && s.battle; i++) {
    const u = currentPC(s);
    if (!u) break;
    const t = triageTargets(s, u)[0];
    if (t && u.ap >= 2) runWithDice(s, (rng) => pcTriage(s, rng, say, t.id));
    else runWithDice(s, (rng) => pcEndTurn(s, rng, say));
    if (s.battle?.stage === "declare") runWithDice(s, (rng) => beginRound(s, rng, say));
  }
  assert.equal(s.battle, null);
  assert.ok(!gisla.dead);
});

test("breaking away: fights end whether the party gets clear or is caught", () => {
  let fled = 0, caught = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const s = battle(seed);
    const start = s.log.length;
    playBattle(s, { run: 2 });
    const lines = s.log.slice(start).map(l => l.text).join("\n");
    if (/No XP for a fight you ran from/.test(lines)) fled++;
    if (/starts again at close quarters|still on you/.test(lines)) caught++;
  }
  assert.ok(fled > 0, "some get away");
  assert.ok(caught > 0, "some are caught");
});

function breakingWithGisla(seed, dying, carryHer) {
  const s = battle(seed, [{ name: "Wild Dog", count: 1 }], { temper: "Predator" });
  const gisla = s.party.members.find(m => m.id === "gisla");
  gisla.hp = 0; gisla.dying = dying; gisla.down = true;
  const say = (t, k) => note(s, t, k);
  const start = s.log.length;
  runWithDice(s, (rng) => retreat(s, rng, say, carryHer ? ["gisla"] : []));
  const lines = () => s.log.slice(start).map(l => l.text).join("\n");
  return { s, gisla, lines };
}

test("carrying anyone puts the break-away at Impotence", () => {
  // A zombie is slower than the party: Dominance running free, cancelled by carrying.
  const run = (carry) => {
    const s = battle(2, [{ name: "Zombie", count: 1 }], { temper: "Restless dead" });
    const gisla = s.party.members.find(m => m.id === "gisla");
    gisla.hp = 0; gisla.dying = 3; gisla.down = true;
    const start = s.log.length;
    runWithDice(s, (rng) => retreat(s, rng, (t, k) => note(s, t, k), carry ? ["gisla"] : []));
    return s.log.slice(start).map(l => l.text).find(t => /You break away/.test(t));
  };
  assert.match(run(false), /\(Dominance\)/);
  assert.doesNotMatch(run(true), /Dominance|Impotence/);
});

test("getting clear: one tick left dies, the abandoned die, the rest are tended", () => {
  let checked = 0;
  for (let seed = 1; seed <= 40 && checked < 2; seed++) {
    const a = breakingWithGisla(seed, 1, true);
    if (/you get clear/.test(a.lines())) { assert.ok(a.gisla.dead, "one tick: dies"); checked++; }
    const b = breakingWithGisla(seed, 3, false);
    if (/you get clear/.test(b.lines())) { assert.ok(b.gisla.dead, "left behind"); assert.match(b.lines(), /left behind/); }
    const c = breakingWithGisla(seed, 3, true);
    if (/you get clear/.test(c.lines())) assert.ok(!c.gisla.dead && !c.gisla.dying, "carried and tended");
  }
  assert.ok(checked, "a break-away succeeded");
});
