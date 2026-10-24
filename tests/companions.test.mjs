import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, runWithDice, note } from "../game/journey.js";
import { startBattle, beginRound, currentPC, pcEndTurn, pcAttack, respond, setMode, canAttack, attackModes, coneSquares } from "../game/combat.js";

function battle(seed, group) {
  const s = newGame(seed);
  s.encounter = { head: group[0].name, text: "test", temper: "Predator", xp: 4, group, impaired: {}, distance: "Near", terrain: "forest" };
  runWithDice(s, (rng) => startBattle(s, rng, (t, k) => note(s, t, k)));
  return s;
}
const say = (s) => (t, k) => note(s, t, k);
const logOf = (s, from = 0) => s.log.slice(from).map(l => l.text).join("\n");
const unit = (s, id) => s.battle.units.find(u => u.id === id);
const settle = (s) => { for (let i = 0; i < 20 && s.battle?.prompt; i++) runWithDice(s, (rng) => respond(s, rng, say(s), false)); };
/** Start a round with these declarations and pass turns until it's this unit's. */
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

test("Tallow and Clabber take the field beside their owners", () => {
  const s = battle(1, [{ name: "Boar", count: 1 }]);
  for (const [pet, owner] of [["tallow", "gisla"], ["clabber", "corra"]]) {
    const u = unit(s, pet);
    assert.ok(u && u.companion && u.owner === owner);
  }
  assert.deepEqual(attackModes(s, unit(s, "clabber")).map(m => m.id), ["strike", "gore", "trample"]);
  assert.deepEqual(attackModes(s, unit(s, "tallow")).map(m => m.id), ["strike"]);
});

test("Clabber's Gore has Impotence and can leave the target bleeding", () => {
  let bled = false;
  for (let seed = 1; seed <= 30 && !bled; seed++) {
    const s = battle(seed, [{ name: "Bandit Cutthroat", count: 1 }]);
    const foe = s.battle.units.find(u => !u.pc), pig = unit(s, "clabber");
    foe.x = pig.x + 1; foe.y = pig.y; foe.hp = foe.hpMax = 99; foe.armorDur = 0;
    if (turnOf(s, "clabber")?.id !== "clabber") continue;
    const from = s.log.length;
    setMode(s, "gore");
    runWithDice(s, (rng) => pcAttack(s, rng, say(s), foe.id));
    settle(s);
    const log = logOf(s, from);
    assert.match(log, /\(Gore\).*Impotence/);
    if (/Attrition \(Bleeding\) 1/.test(log)) bled = true;
  }
  assert.ok(bled);
});

test("Clabber's Trample runs a straight line and shares one roll with Inferiority over two foes", () => {
  const s = battle(3, [{ name: "Bandit Cutthroat", count: 2 }]);
  const [a, b] = s.battle.units.filter(u => !u.pc);
  const pig = unit(s, "clabber");
  for (const u of s.battle.units.filter(x => x.pc && x !== pig)) { u.x = 0; u.y = s.battle.units.indexOf(u); }
  pig.x = 4; pig.y = 5;
  a.x = 6; a.y = 4; b.x = 8; b.y = 6;
  for (const u of [a, b]) { u.hp = u.hpMax = 99; u.armorDur = 0; }
  assert.equal(turnOf(s, "clabber")?.id, "clabber");
  setMode(s, "trample");
  const can = canAttack(s, pig, a);
  assert.ok(can.ok && can.trample.hit.length === 2, JSON.stringify(can));
  const from = s.log.length;
  runWithDice(s, (rng) => pcAttack(s, rng, say(s), a.id));
  settle(s);
  const log = logOf(s, from);
  assert.match(log, /tramples through/);
  const rolls = [...log.matchAll(/Clabber attacks .*?\(Trample\): (.*?) = \d+/g)].map(m => m[1]);
  assert.equal(rolls.length, 2);
  assert.equal(rolls[0], rolls[1]);
  assert.match(rolls[0], /Inferiority/);
});

test("Hellfire is declared, costs Gisla 2 magan, and burns everyone in the cone", () => {
  const s = battle(2, [{ name: "Bandit Cutthroat", count: 1 }]);
  const gisla = s.party.members.find(m => m.id === "gisla");
  const foe = s.battle.units.find(u => !u.pc), goat = unit(s, "tallow");
  for (const u of s.battle.units.filter(x => x.pc && x !== goat)) { u.x = 0; u.y = s.battle.units.indexOf(u); }
  goat.x = 5; goat.y = 5; foe.x = 7; foe.y = 5; foe.hp = foe.hpMax = 99; foe.armorDur = 0;
  const ham = unit(s, "hamon"); ham.x = 6; ham.y = 5; // in the line of fire
  const mp = gisla.mp;
  assert.equal(turnOf(s, "tallow", { tallow: { hellfire: true } })?.id, "tallow");
  assert.equal(goat.phase, "fast");
  setMode(s, "hellfire");
  const from = s.log.length;
  runWithDice(s, (rng) => pcAttack(s, rng, say(s), foe.id));
  settle(s);
  assert.equal(gisla.mp, mp - 2);
  const log = logOf(s, from);
  assert.match(log, /Hellfire/);
  if (/goes where it's sent/.test(log)) {
    assert.match(log, /Hamon twists away/);
    assert.match(log, /Bandit Cutthroat twists away/);
  }
  assert.ok(!attackModes(s, goat).some(m => m.id === "hellfire"), "once per declaration");
});

test("the Hellfire cone is 3 squares deep and 90 degrees wide", () => {
  const sq = coneSquares({ x: 10, y: 10 }, [1, 0]);
  const has = (x, y) => sq.some(([a, b]) => a === x && b === y);
  assert.ok(has(11, 10) && has(13, 10) && has(13, 13) && has(12, 8));
  assert.ok(!has(14, 10) && !has(10, 11) && !has(9, 10) && !has(11, 12));
});
