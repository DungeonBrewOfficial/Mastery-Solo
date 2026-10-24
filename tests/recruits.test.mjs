import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, runWithDice, note } from "../game/journey.js";
import { makeRng } from "../game/rng.js";
import { rollClass, rollCharacter, HUMANS, DEMIHUMANS, recruitCount, recruitCap, recruitCost, hire, build, nextGeneration, recruitsHere, PARTY_SIZE } from "../game/recruits.js";
import { openMarket, buy, mayUse, saleList } from "../game/town.js";
import { CLASSES } from "../game/data/classes.js";
import { count } from "../game/supplies.js";

const say = (s) => (t, k) => note(s, t, k);

test("the class roll: about one in six a demihuman, and Fighter twice as common as any other human class", () => {
  const rng = makeRng(1);
  const n = 12000, seen = {};
  for (let i = 0; i < n; i++) { const c = rollClass(rng); seen[c] = (seen[c] || 0) + 1; }
  const demi = DEMIHUMANS.reduce((a, c) => a + (seen[c] || 0), 0) / n;
  assert.ok(demi > 0.14 && demi < 0.19, `demihumans ${demi}`);
  assert.ok(seen.Fighter > seen.Knight * 1.6);
});

test("every class rolls up a whole character: scores, pools, gear it may use, Untrained masteries", () => {
  const rng = makeRng(2);
  for (const cls of Object.keys(CLASSES)) {
    const m = rollCharacter(rng, cls);
    assert.ok(m.health > 0 && m.weapons.length, cls);
    for (const v of Object.values(m.attributes)) assert.ok(v >= 1 && v <= 30, cls);
    if (m.armor) assert.ok(mayUse(m, m.armor.name), `${cls} may wear ${m.armor.name}`);
    if (m.shield) assert.notEqual(CLASSES[cls].equipment.shield, "None", cls);
    for (const v of [...Object.values(m.weaponSkill), ...Object.values(m.styles), ...Object.values(m.casting?.forms || {})]) assert.ok(v <= 2, `${cls}: nothing past Untrained at level 1`);
    assert.ok(m.purse >= 0, cls);
    if (CLASSES[cls].progression.spell) assert.ok(m.magan > 0 && m.casting, cls);
  }
  assert.ok(rollCharacter(rng, "Druid").companion.kind === "puca");
  assert.ok(rollCharacter(rng, "Cursed").abilities.includes("Hard to Kill"));
});

test("a higher-level recruit comes leveled, with every point spent, and costs their XP in silver", () => {
  const rng = makeRng(3);
  const m = rollCharacter(rng, "Fighter", { level: 4 });
  assert.equal(m.level, 4);
  assert.equal(recruitCost(m), m.xp);
  assert.ok(m.xp > 0);
  assert.equal(m.unspent.attr, 0);
  assert.equal(recruitCost(rollCharacter(rng, "Thief")), 0);
});

test("how many recruits a settlement has, and how seasoned", () => {
  const rng = makeRng(4);
  assert.equal(recruitCount(rng, "hamlet"), 0);
  for (let i = 0; i < 50; i++) { const n = recruitCount(rng, "city"); assert.ok(n >= 2 && n <= 5); }
  assert.equal(recruitCap("village", 6), 1);
  assert.equal(recruitCap("town", 6), 4);
  assert.equal(recruitCap("city", 6), 5);
});

test("hiring fills the party up to four, and a recruit's purse and pack join the party's", () => {
  const s = newGame(5);
  s.party.members[0].dead = true;
  const coin = s.party.coin, rations = count(s, "Rations, Iron");
  const m = runWithDice(s, (rng) => build(s, rng, say(s), "Fighter"));
  assert.ok(m);
  assert.equal(count(s, "Rations, Iron"), rations + 10);
  assert.ok(s.party.coin >= coin);
  assert.equal(runWithDice(s, (rng) => build(s, rng, say(s), "Thief")), null, "the party is full");
  s.party.members[1].dead = true;
  s.recruits = { key: "3,3", visit: s.visitId || 0, list: [runWithDice(s, (rng) => rollCharacter(rng, "Knight", { level: 2 }))] };
  const r = s.recruits.list[0];
  s.party.coin = r.xp - 1;
  assert.equal(hire(s, say(s), r.id), false, "can't afford them");
  s.party.coin = r.xp;
  assert.ok(hire(s, say(s), r.id));
  assert.equal(s.party.members.filter(x => !x.dead).length, PARTY_SIZE);
});

test("the next generation sets out from home after a wipe, and the fallen are remembered", () => {
  const s = newGame(6);
  for (const m of s.party.members) m.dead = true;
  s.over = { day: 9, why: "Fell to wolves on day 9." };
  s.party.x = 20;
  runWithDice(s, (rng) => nextGeneration(s, rng, say(s), ["roll", "Druid", "Thief", "Knight"]));
  assert.equal(s.over, null);
  assert.equal(s.party.members.length, 4);
  assert.equal(s.party.x, 3);
  assert.equal(s.dynasty.generation, 2);
  assert.equal(s.dynasty.fallen[0].heroes.length, 4);
  assert.ok(s.party.roles.scout && s.party.roles.watchman && s.party.roles.scout !== s.party.roles.watchman);
});

test("arms and armor at the market go to the one they're for, if the class allows; the old armor can be sold", () => {
  const s = newGame(7);
  const m = runWithDice(s, (rng) => openMarket(s, rng, say(s)));
  m.stock["Byrnie"] = true; m.stock["Selfbow"] = true;
  s.party.coin = 2000;
  assert.equal(buy(s, say(s), "Byrnie", 1, "corra"), false, "Druids wear no armor");
  assert.ok(buy(s, say(s), "Byrnie", 1, "gerberga"));
  assert.equal(s.party.members.find(x => x.id === "gerberga").armor.name, "Byrnie");
  assert.ok(saleList(s).some(x => x.id === "spare:0" && /Jack of plate/.test(x.label)));
  assert.ok(buy(s, say(s), "Selfbow", 1, "hamon"));
  assert.ok(s.party.members.find(x => x.id === "hamon").weapons.some(w => w.name === "Selfbow"));
});

test("recruits are rolled once a visit", () => {
  const s = newGame(8);
  s.party.x = 3; s.party.y = 3;
  const a = runWithDice(s, (rng) => recruitsHere(s, rng));
  const b = runWithDice(s, (rng) => recruitsHere(s, rng));
  assert.equal(a, b);
  s.visitId = (s.visitId || 0) + 1;
  assert.notEqual(runWithDice(s, (rng) => recruitsHere(s, rng)), a);
});
