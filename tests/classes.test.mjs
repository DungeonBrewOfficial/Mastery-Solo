import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, runWithDice, note } from "../game/journey.js";
import { startBattle, beginRound, currentPC, pcEndTurn, pcAttack, respond, canAttack, turnOptions, pcTurn, turning, imbueOptions, pcImbue, standing } from "../game/combat.js";

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
function turnOf(s, id, picks = {}, stillFoes = true) {
  if (stillFoes) for (const u of s.battle.units.filter(x => !x.pc)) u.ap = 0;
  runWithDice(s, (rng) => beginRound(s, rng, say(s), picks));
  for (let i = 0; i < 40 && s.battle && currentPC(s)?.id !== id; i++) {
    if (s.battle.prompt) runWithDice(s, (rng) => respond(s, rng, say(s), false));
    else if (currentPC(s)) runWithDice(s, (rng) => pcEndTurn(s, rng, say(s)));
    else break;
  }
  return currentPC(s);
}
function lineUp(s) {
  s.battle.units.filter(u => u.pc).forEach((u, i) => { u.x = 1; u.y = i; });
  const foes = s.battle.units.filter(u => !u.pc);
  foes.forEach((f, i) => { f.x = 6 + i * 2; f.y = 1; });
  return foes;
}

test("Hard to Kill: Gisla at 0 health stays up, with an Injury and no dying timer, and Traumas don't drop her", () => {
  let traumas = 0;
  for (let seed = 1; seed <= 25 && traumas < 2; seed++) {
    const s = battle(seed, [{ name: "Wolf, Dire", count: 1 }]);
    const wolf = s.battle.units.find(u => !u.pc), g = unit(s, "gisla"), gisla = member(s, "gisla");
    for (const u of s.battle.units.filter(x => x.pc && x !== g)) u.x = 20;
    g.x = 3; g.y = 3; wolf.x = 4; wolf.y = 3;
    gisla.hp = 1; gisla.react = { defend: "never" };
    for (let r = 0; r < 3 && s.battle && !gisla.dead; r++) {
      runWithDice(s, (rng) => beginRound(s, rng, say(s), {}));
      for (let i = 0; i < 80 && s.battle?.stage === "phase"; i++) {
        if (s.battle.prompt) runWithDice(s, (rng) => respond(s, rng, say(s), false));
        else if (currentPC(s)) runWithDice(s, (rng) => pcEndTurn(s, rng, say(s)));
        else break;
      }
    }
    if (gisla.hp > 0) continue;
    assert.ok(!gisla.dead);
    assert.equal(gisla.dying, null);
    assert.ok(gisla.injuries >= 1);
    assert.ok(!gisla.down, "always fighting on");
    traumas += (gisla.traumas || []).length;
  }
  assert.ok(traumas >= 1);
});

test("Demon Trigger: Gisla's own kills can wake her Fire Aura, which burns allies at the end of their turns", () => {
  let woke = false;
  for (let seed = 1; seed <= 60 && !woke; seed++) {
    const s = battle(seed, [{ name: "Bandit Cutthroat", count: 2 }]);
    const [foe, other] = s.battle.units.filter(u => !u.pc);
    const g = unit(s, "gisla");
    s.battle.units.filter(u => u.pc).forEach((u, i) => { u.x = 1; u.y = 2 * i; });
    g.x = 5; g.y = 5; foe.x = 6; foe.y = 5; foe.hp = 1; foe.armorDur = 0; other.x = 15; other.y = 0;
    member(s, "hamon"); const ham = unit(s, "hamon");
    if (turnOf(s, "gisla")?.id !== "gisla") continue;
    const from = s.log.length;
    runWithDice(s, (rng) => pcAttack(s, rng, say(s), foe.id));
    settle(s);
    if (!/the demon wakes/.test(logOf(s, from))) continue;
    woke = true;
    assert.equal(g.fireAura, 1 + Math.floor(member(s, "gisla").attributes.wisdom / 5));
    ham.x = 6; ham.y = 6;
    const hp = member(s, "hamon").hp, mark = s.log.length;
    for (let i = 0; i < 40 && s.battle && s.battle.round === 1; i++) {
      if (s.battle.prompt) runWithDice(s, (rng) => respond(s, rng, say(s), false));
      else if (currentPC(s)) runWithDice(s, (rng) => pcEndTurn(s, rng, say(s)));
      else break;
    }
    assert.match(logOf(s, mark), /Gisla's Fire Aura: Hamon takes/);
    assert.ok(member(s, "hamon").hp < hp || member(s, "hamon").armor);
  }
  assert.ok(woke);
});

test("Turn: Gerberga's Charisma and Lore against Division × 2 sends the skeletons running, and holds her to defense and movement", () => {
  let turned = false;
  for (let seed = 1; seed <= 40 && !turned; seed++) {
    const s = battle(seed, [{ name: "Skeleton Warrior", count: 2 }]);
    const foes = lineUp(s);
    const g = unit(s, "gerberga");
    const opts = turnOptions(s, g);
    assert.ok(opts.some(o => o.key === "turn:daeva:2") && opts.some(o => o.key === "destroy:daeva:2"));
    if (turnOf(s, "gerberga", { gerberga: { turn: "turn:daeva:2" } })?.id !== "gerberga") continue;
    assert.equal(g.phase, "fast");
    const from = s.log.length;
    runWithDice(s, (rng) => pcTurn(s, rng, say(s)));
    settle(s);
    assert.match(logOf(s, from), /calls on her numen to turn the daeva/);
    assert.ok(g.turnUsed);
    if (!foes.some(f => f.turnedBy === g.id)) continue;
    turned = true;
    assert.ok(turning(g));
    assert.equal(canAttack(s, g, foes[0]).ok, false);
    assert.deepEqual(turnOptions(s, g), [], "once per encounter");
  }
  assert.ok(turned);
});

test("Destroy Daeva takes heads off a skeleton crowd", () => {
  let destroyed = false;
  for (let seed = 1; seed <= 40 && !destroyed; seed++) {
    const s = battle(seed, [{ name: "Skeleton", heads: 6 }]);
    const [crowd] = lineUp(s);
    const heads = crowd.heads;
    if (turnOf(s, "gerberga", { gerberga: { turn: "destroy:daeva:1" } })?.id !== "gerberga") continue;
    assert.equal(unit(s, "gerberga").phase, "slow");
    runWithDice(s, (rng) => pcTurn(s, rng, say(s)));
    settle(s);
    if (crowd.heads < heads || !standing(s, crowd)) destroyed = true;
  }
  assert.ok(destroyed);
});

test("Imbue: 1 AP and 1 magan, and her blows that land carry the sacred", () => {
  let burned = false;
  for (let seed = 1; seed <= 30 && !burned; seed++) {
    const s = battle(seed, [{ name: "Bandit Cutthroat", count: 1 }]);
    const [foe] = lineUp(s);
    const g = unit(s, "gerberga"), m = member(s, "gerberga");
    foe.x = g.x + 1; foe.y = g.y; foe.hp = foe.hpMax = 99; foe.armorDur = 0;
    if (turnOf(s, "gerberga")?.id !== "gerberga") continue;
    const mp = m.mp;
    assert.deepEqual(imbueOptions(s, g), ["sacred", "sky"]);
    runWithDice(s, (rng) => pcImbue(s, rng, say(s), "sacred"));
    assert.equal(m.mp, mp - 1);
    assert.equal(g.imbue, "sacred");
    const from = s.log.length;
    runWithDice(s, (rng) => pcAttack(s, rng, say(s), foe.id));
    settle(s);
    if (/Imbued sacred \(\d\)/.test(logOf(s, from))) burned = true;
  }
  assert.ok(burned);
});
