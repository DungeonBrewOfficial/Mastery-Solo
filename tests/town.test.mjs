import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, campNow, stay, runWithDice, note } from "../game/journey.js";
import { add, count } from "../game/supplies.js";
import { openMarket, sell, saleList, townCoin, hireSmith, rumorAtInn, rumorHere, healerTreatsTrauma } from "../game/town.js";
import { recoveryOf, restDay, needsHealer, hardToKillDay, tollDays, treatTrauma } from "../game/health.js";
import { TRAUMA_TABLE } from "../game/vendor/foundry/module/data/trauma-table.mjs";
import { tileOf } from "../game/world.js";

const say = (s) => (t, k) => note(s, t, k);
const logOf = (s, from = 0) => s.log.slice(from).map(l => l.text).join("\n");
const member = (s, id) => s.party.members.find(m => m.id === id);
const trauma = (name) => { const r = TRAUMA_TABLE.find(x => x.name === name); return { name: r.name, tier: r.tier, text: r.text, recovery: r.recovery, restDays: 0, done: 0, treated: false }; };

test("a Trauma's recovery is read from the table", () => {
  assert.deepEqual(recoveryOf("Set (Healer) + 30 days' rest"), { days: 30, successes: 0, treat: "Set", permanent: false });
  assert.deepEqual(recoveryOf("Tend daily (Healer), 10 successes"), { days: 0, successes: 10, treat: "Tend", permanent: false });
  assert.equal(recoveryOf("None").permanent, true);
  assert.deepEqual(recoveryOf("3 days' rest"), { days: 3, successes: 0, treat: null, permanent: false });
});

test("days of rest heal a Trauma; a broken bone waits on a Healer first", () => {
  const s = newGame(1);
  const h = member(s, "hamon");
  h.traumas = [trauma("Blurred Vision"), trauma("Break your left arm")];
  for (let i = 0; i < 3; i++) restDay(h, say(s));
  assert.equal(h.traumas.length, 1, "blurred vision healed in 3 days");
  assert.ok(needsHealer(h.traumas[0]));
  for (let i = 0; i < 40; i++) restDay(h, say(s));
  assert.equal(h.traumas.length, 1, "the arm needs setting before rest counts");
  h.traumas[0].treated = true;
  for (let i = 0; i < 30; i++) restDay(h, say(s));
  assert.equal(h.traumas.length, 0);
});

test("a camp day without travel counts as a day's rest", () => {
  const s = newGame(2);
  const h = member(s, "hamon");
  h.traumas = [trauma("Ringing Ears")];
  for (let i = 0; i < 3; i++) campNow(s);
  assert.equal(h.traumas.length, 0);
});

test("Treat Trauma rolls against the tier; without a surgeon's chest a Severe treatment has Impotence", () => {
  const s = newGame(3);
  const t = trauma("Break your left arm");
  const corra = member(s, "corra");
  const r = runWithDice(s, (rng) => treatTrauma(rng, corra, t, { pocket: true }));
  assert.equal(r.dc, 7);
  assert.match(r.roll.text, /Impotence/);
});

test("Hard to Kill heals Injuries and Traumas on its own once the toll's time is up", () => {
  const s = newGame(4);
  const g = member(s, "gisla");
  g.injuries = 1; g.traumas = [trauma("Break your left arm")];
  assert.equal(tollDays(4), 7);
  hardToKillDay(g, 10, say(s));
  hardToKillDay(g, 16, say(s));
  assert.equal(g.injuries, 1);
  hardToKillDay(g, 17, say(s));
  assert.equal(g.injuries, 0);
  assert.equal(g.traumas.length, 0);
});

test("selling: a buyer of the piece's class, and the town's coin, which refills a quarter a week", () => {
  const s = newGame(5);
  s.party.pelts.push({ name: "Wolf", quality: "Average", value: 10 });
  runWithDice(s, (rng) => openMarket(s, rng, say(s)));
  const coin = s.party.coin, town = townCoin(s);
  s.market.buyers = { "pelt:0": true };
  assert.ok(runWithDice(s, (rng) => sell(s, rng, say(s), "pelt:0")));
  assert.equal(s.party.coin, coin + 10);
  assert.equal(townCoin(s), town - 10);
  s.day += 7;
  assert.equal(townCoin(s), town);
  assert.ok(saleList(s).some(x => x.id === "item:Wound Kit" && x.value === 2), "spare goods at half price");
});

test("a hired smith works the party's repair kits for 8 sp", () => {
  const s = newGame(6);
  const g = member(s, "gerberga");
  g.armor.durability = 6;
  add(s, "Repair Kit", 2);
  const coin = s.party.coin;
  assert.ok(runWithDice(s, (rng) => hireSmith(s, rng, say(s))));
  assert.equal(s.party.coin, coin - 8);
  assert.ok(g.armor.durability > 6);
  assert.ok(count(s, "Repair Kit") < 2);
});

test("a Civilized Rest needs a town; Bed Rest takes Exhausted away entirely", () => {
  const s = newGame(7);
  const from = s.log.length;
  stay(s, "civilized");
  assert.match(logOf(s, from), /needs a town or a city/);
  const h = member(s, "hamon");
  h.exhausted = 3;
  stay(s, "bed");
  assert.equal(h.exhausted, 0);
  assert.match(logOf(s, from), /Bed Rest/);
});

test("a rumor heard at an inn marks a tile, and reaching it makes the Discovery", () => {
  let heard = null;
  for (let seed = 1; seed <= 30 && !heard; seed++) {
    const s = newGame(seed);
    runWithDice(s, (rng) => rumorAtInn(s, rng, say(s)));
    if (s.world.rumors?.length) heard = s;
  }
  assert.ok(heard);
  const s = heard, r = s.world.rumors[0];
  s.world.tiles[`${r.tx},${r.ty}`] ||= structuredClone(Object.values(s.world.tiles)[0]);
  const t = s.world.tiles[`${r.tx},${r.ty}`]; t.tx = r.tx; t.ty = r.ty;
  s.party.x = r.tx * 6 + 2; s.party.y = r.ty * 6 + 2;
  assert.deepEqual(tileOf(s.party.x, s.party.y), [r.tx, r.ty]);
  const banked = s.party.bankedXp;
  runWithDice(s, (rng) => rumorHere(s, rng, say(s)));
  assert.ok(r.found);
  assert.ok(s.party.bankedXp > banked, "a discovery banks its XP");
});
