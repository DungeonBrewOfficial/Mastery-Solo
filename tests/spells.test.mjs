import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, runWithDice, note } from "../game/journey.js";
import { startBattle, beginRound, currentPC, pcEndTurn, pcAttack, pcCast, respond, castOptions, castTargets, reapplyOptions, concentrationOf } from "../game/combat.js";

function battle(seed, group) {
  const s = newGame(seed);
  s.encounter = { head: group[0].name, text: "test", temper: "Predator", xp: 4, group, impaired: {}, distance: "Near", terrain: "forest" };
  runWithDice(s, (rng) => startBattle(s, rng, (t, k) => note(s, t, k)));
  return s;
}
const say = (s) => (t, k) => note(s, t, k);
const logOf = (s, from = 0) => s.log.slice(from).map(l => l.text).join("\n");
const unit = (s, id) => s.battle.units.find(u => u.id === id);
const member = (s, id) => s.party.members.find(m => m.id === id);
const settle = (s) => { for (let i = 0; i < 20 && s.battle?.prompt; i++) runWithDice(s, (rng) => respond(s, rng, say(s), false)); };
function turnOf(s, id, picks = {}) {
  for (const u of s.battle.units.filter(x => !x.pc)) u.ap = 0;
  runWithDice(s, (rng) => beginRound(s, rng, say(s), picks));
  for (let i = 0; i < 40 && s.battle && currentPC(s)?.id !== id; i++) {
    if (s.battle.prompt) runWithDice(s, (rng) => respond(s, rng, say(s), false));
    else if (currentPC(s)) runWithDice(s, (rng) => pcEndTurn(s, rng, say(s)));
    else break;
  }
  return currentPC(s);
}
/** Put the party in a column on the left and one foe a few squares off. */
function lineUp(s, foeX = 5) {
  const foe = s.battle.units.find(u => !u.pc);
  s.battle.units.filter(u => u.pc).forEach((u, i) => { u.x = 1; u.y = i; });
  foe.x = foeX; foe.y = 1; foe.hp = foe.hpMax = 99; foe.armorDur = 0;
  return foe;
}

test("declaring a spell draws its magan and sets the phase by its cost", () => {
  const s = battle(1, [{ name: "Bandit Cutthroat", count: 1 }]);
  const gisla = member(s, "gisla"), mp = gisla.mp;
  lineUp(s);
  runWithDice(s, (rng) => beginRound(s, rng, say(s), { gisla: { spell: "Demoralize" } }));
  assert.equal(gisla.mp, mp - 6);
  assert.equal(unit(s, "gisla").phase, "moderate");
  assert.equal(unit(s, "gisla").casting.name, "Demoralize");
});

test("Gerberga's Polestar takes 1 off her 2-magan prayers", () => {
  const s = battle(1, [{ name: "Bandit Cutthroat", count: 1 }]);
  const opts = castOptions(s, unit(s, "gerberga"));
  assert.equal(opts.find(o => o.key === "Mend").cost, 1);
  assert.equal(opts.find(o => o.key === "Sacred Ward").cost, 1);
  assert.ok(opts.find(o => o.key === "Mend").noSomatic === undefined);
});

test("Flame Dart: an Agility trial or the fire, on the caster's turn for 1 AP", () => {
  let burned = false;
  for (let seed = 1; seed <= 20 && !burned; seed++) {
    const s = battle(seed, [{ name: "Bandit Cutthroat", count: 1 }]);
    const foe = lineUp(s);
    const g = turnOf(s, "gisla", { gisla: { spell: "Flame Dart" } });
    if (g?.id !== "gisla") continue;
    assert.ok(castTargets(s, g).includes(foe));
    const hp = foe.hp, from = s.log.length;
    runWithDice(s, (rng) => pcCast(s, rng, say(s), foe.id));
    settle(s);
    assert.match(logOf(s, from), /casts Flame Dart at Bandit Cutthroat/);
    assert.equal(g.casting, null);
    if (foe.hp < hp) burned = true;
  }
  assert.ok(burned);
});

test("attacking with a spell in hand loses it, magan and all", () => {
  const s = battle(2, [{ name: "Bandit Cutthroat", count: 1 }]);
  const foe = lineUp(s, 2);
  const g = turnOf(s, "gisla", { gisla: { spell: "Flame Dart" } });
  assert.equal(g?.id, "gisla");
  const from = s.log.length;
  runWithDice(s, (rng) => pcAttack(s, rng, say(s), foe.id));
  settle(s);
  assert.match(logOf(s, from), /Gisla loses Flame Dart \(attacking\)/);
});

test("a spell never released is lost when the turn ends", () => {
  const s = battle(2, [{ name: "Bandit Cutthroat", count: 1 }]);
  lineUp(s);
  assert.equal(turnOf(s, "gisla", { gisla: { spell: "Flame Dart" } })?.id, "gisla");
  const from = s.log.length;
  runWithDice(s, (rng) => pcEndTurn(s, rng, say(s)));
  assert.match(logOf(s, from), /loses Flame Dart/);
});

test("Stoneskin is a ward of 30 against mundane damage that soaks hits before health", () => {
  let soaked = false;
  for (let seed = 1; seed <= 30 && !soaked; seed++) {
    const s = battle(seed, [{ name: "Bandit Cutthroat", count: 1 }]);
    const foe = lineUp(s, 9);
    const c = turnOf(s, "corra", { corra: { spell: "Stoneskin" } });
    if (c?.id !== "corra") continue;
    runWithDice(s, (rng) => pcCast(s, rng, say(s), c.id));
    assert.equal(c.wards[0].pool, 30);
    assert.equal(concentrationOf(c)[0].slot, "free");
    member(s, "corra").react = { defend: "never" };
    for (const u of s.battle.units.filter(x => x.pc && x !== c)) u.x = 20;
    foe.x = c.x + 1; foe.y = c.y;
    const hp = member(s, "corra").hp, from = s.log.length;
    for (let i = 0; i < 2 && s.battle; i++) {
      runWithDice(s, (rng) => beginRound(s, rng, say(s), {}));
      for (let j = 0; j < 60 && s.battle?.stage === "phase"; j++) {
        if (s.battle.prompt) runWithDice(s, (rng) => respond(s, rng, say(s), false));
        else if (currentPC(s)) runWithDice(s, (rng) => pcEndTurn(s, rng, say(s)));
        else break;
      }
    }
    const log = logOf(s, from);
    const m = log.match(/Stoneskin on Corra takes (\d+)/);
    if (m) { soaked = true; if (!/and fails/.test(log)) assert.equal(member(s, "corra").hp, hp); }
  }
  assert.ok(soaked);
});

test("Spell Conduit: Corra's touch spells reach through Clabber within 30 feet", () => {
  const s = battle(4, [{ name: "Bandit Cutthroat", count: 1 }]);
  lineUp(s);
  const c = unit(s, "corra"), pig = unit(s, "clabber"), ham = unit(s, "hamon");
  c.x = 1; c.y = 5; pig.x = 6; pig.y = 5; ham.x = 7; ham.y = 5;
  for (const id of ["gisla", "gerberga", "tallow"]) { unit(s, id).x = 0; }
  assert.equal(turnOf(s, "corra", { corra: { spell: "Stoneskin" } })?.id, "corra");
  const ts = castTargets(s, c).map(t => t.id);
  assert.ok(ts.includes("hamon") && ts.includes("clabber") && ts.includes("corra"));
  pig.x = 12; ham.x = 13;
  assert.ok(!castTargets(s, c).map(t => t.id).includes("hamon"));
});

test("Demoralize holds by concentration; resisted, it stays held for a 1 AP retry", () => {
  let held = false, retried = false;
  for (let seed = 1; seed <= 30 && !(held && retried); seed++) {
    const s = battle(seed, [{ name: "Bandit Cutthroat", count: 1 }]);
    const foe = lineUp(s);
    const g = turnOf(s, "gisla", { gisla: { spell: "Demoralize" } });
    if (g?.id !== "gisla") continue;
    runWithDice(s, (rng) => pcCast(s, rng, say(s), foe.id));
    settle(s);
    const e = concentrationOf(g)[0];
    assert.ok(e && e.name === "Demoralize");
    if (e.target) { held = true; assert.ok(foe.demoralized >= 1 || foe.cond?.demoralized >= 1); assert.ok(!foe.decay?.demoralized); }
    else if (g.ap >= 1) { retried = true; assert.equal(reapplyOptions(s, g)[0].targets[0], foe); }
  }
  assert.ok(held && retried);
});

test("Mend Flesh at the this-round price only heals this round's wounds", () => {
  const s = battle(5, [{ name: "Bandit Cutthroat", count: 1 }]);
  lineUp(s);
  const c = turnOf(s, "corra", { corra: { spell: "Mend Flesh" } });
  assert.equal(c?.id, "corra");
  const ham = unit(s, "hamon"); ham.x = c.x; ham.y = c.y + 1;
  member(s, "hamon").hp = 1; // hurt before this round
  assert.ok(!castTargets(s, c).includes(ham));
  ham.lostThisRound = 2;
  assert.ok(castTargets(s, c).includes(ham));
  runWithDice(s, (rng) => pcCast(s, rng, say(s), ham.id));
  assert.ok(member(s, "hamon").hp <= 3 && member(s, "hamon").hp > 1);
});

test("the older-wounds Mend Flesh costs 3 and makes a miscast trial", () => {
  const s = battle(5, [{ name: "Bandit Cutthroat", count: 1 }]);
  const o = castOptions(s, unit(s, "corra")).find(x => x.key === "Mend Flesh:older");
  assert.equal(o.cost, 3);
  assert.equal(o.miscast, 2);
  assert.equal(o.phase, "fast");
});
