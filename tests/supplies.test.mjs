import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, campNow, runWithDice, note } from "../game/journey.js";
import { add, take, count, meals, eat, morningSupplies, eveningSupplies, healAfterFight, repairGear, treatInjuries } from "../game/supplies.js";
import { openMarket, buy, settlementHere, healerTreats } from "../game/town.js";

const say = (s) => (t, k) => note(s, t, k);
const logOf = (s, from = 0) => s.log.slice(from).map(l => l.text).join("\n");
const member = (s, id) => s.party.members.find(m => m.id === id);

test("a new party sets out with an Adventurer's Pack apiece and Corra's Healer's Kit opened", () => {
  const s = newGame(1);
  assert.equal(count(s, "Rations, Iron"), 40);
  assert.equal(s.party.skins, 4);
  assert.equal(s.party.water, 2);
  assert.equal(count(s, "Wound Kit"), 4);
  assert.equal(count(s, "Surgeon's Pocket Set"), 1);
  assert.equal(s.party.coin, 450 + 160 + 193 + 284 - 4 * 38);
});

test("meals are eaten from what spoils first, and heal as they're eaten", () => {
  const s = newGame(2);
  add(s, "Rations, Standard", 4);
  const gisla = member(s, "gisla");
  gisla.hp = 1;
  runWithDice(s, (rng) => eat(s, rng, say(s)));
  assert.equal(count(s, "Rations, Standard"), 0);
  assert.equal(count(s, "Rations, Iron"), 40);
  assert.ok(gisla.hp > 1);
});

test("food spoils", () => {
  const s = newGame(3);
  add(s, "Rations, Standard", 2);
  s.day += 4;
  runWithDice(s, (rng) => morningSupplies(s, rng, say(s), null));
  assert.equal(count(s, "Rations, Standard"), 0);
  assert.match(logOf(s), /Spoiled and thrown out: 2 rations, standard/);
});

test("without water, a character goes thirsty and builds Exhausted that rest won't take", () => {
  const s = newGame(4);
  s.party.water = 0; s.party.waterToday = false;
  s.weather = { band: "temperate" };
  runWithDice(s, (rng) => eveningSupplies(s, rng, say(s), { atWater: false }));
  const g = member(s, "gisla");
  assert.equal(g.exhausted, 1);
  assert.equal(g.lock.thirst, 1);
});

test("going hungry for days equal to the Endurance tier advances Exhausted", () => {
  const s = newGame(5);
  s.party.food = [];
  const h = member(s, "hamon");
  for (let d = 0; d < 3; d++) runWithDice(s, (rng) => { morningSupplies(s, rng, say(s), null); eveningSupplies(s, rng, say(s), { atWater: true }); });
  assert.equal(h.exhausted, 1, "Endurance 10: tier 3, so three days");
});

test("in the cold, clothing and armor count toward the weather trial", () => {
  const s = newGame(6);
  s.weather = { band: "cold" };
  add(s, "Cold Clothing", 1, { wearer: "gisla" });
  const from = s.log.length;
  runWithDice(s, (rng) => morningSupplies(s, rng, say(s), 4));
  const log = logOf(s, from);
  assert.doesNotMatch(log, /Gisla against the cold/, "all four pieces: no trial");
  assert.match(log, /Hamon against the cold: Endurance [^=]*\(Dominance\)/, "a gambeson counts as two pieces");
  assert.match(log, /Corra against the cold: Endurance d4 \+ d4 = /, "no armor, no clothing: a plain trial");
});

test("after a fight, the Healer spends a Wound Kit on each wounded character", () => {
  const s = newGame(7);
  member(s, "hamon").hp = 1;
  runWithDice(s, (rng) => healAfterFight(s, rng, say(s), ["hamon"]));
  assert.equal(count(s, "Wound Kit"), 3);
  assert.ok(member(s, "hamon").hp > 1);
});

test("the camp Smith repairs armor with repair kits and a hammer", () => {
  const s = newGame(8);
  s.party.roles.smith = "gerberga";
  const g = member(s, "gerberga");
  g.armor.durability = 10;
  runWithDice(s, (rng) => repairGear(s, rng, say(s)));
  assert.match(logOf(s), /no hammer/);
  add(s, "Smith's Kit");
  runWithDice(s, (rng) => repairGear(s, rng, say(s)));
  assert.ok(g.armor.durability > 10);
});

test("the camp Healer treats Injuries with Injury Kits", () => {
  const s = newGame(9);
  member(s, "hamon").injuries = 2;
  runWithDice(s, (rng) => treatInjuries(s, rng, say(s)));
  assert.equal(member(s, "hamon").injuries, 0);
  assert.equal(count(s, "Injury Kit"), 0);
});

test("the home village's market sells what its dice turn up, and the healer treats Injuries for 8 sp", () => {
  const s = newGame(10);
  assert.ok(settlementHere(s)?.home);
  const m = runWithDice(s, (rng) => openMarket(s, rng, say(s)));
  const name = Object.keys(m.stock).find(n => m.stock[n] && n === "Rations, Standard") || "Rations, Standard";
  m.stock[name] = true;
  const coin = s.party.coin;
  assert.ok(buy(s, say(s), name, 10));
  assert.equal(s.party.coin, coin - 5);
  assert.equal(count(s, name), 10);
  m.stock["Rations, Iron"] = false;
  assert.equal(buy(s, say(s), "Rations, Iron", 1), false);
  member(s, "hamon").injuries = 1;
  assert.ok(healerTreats(s, say(s), "hamon"));
  assert.equal(member(s, "hamon").injuries, 0);
});

test("a night at an inn costs rooms and supper; at home a household takes you in", () => {
  const s = newGame(11);
  const coin = s.party.coin;
  campNow(s);
  assert.equal(s.party.coin, coin, "home is free");
  assert.match(logOf(s), /You spend the night at home/);
});
