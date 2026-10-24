import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, runWithDice, note } from "../game/journey.js";
import { checkLevels, invest, cannotInvest, raiseAttribute, pointsForScore, masteryIndex, hasUnspent } from "../game/advance.js";
import { spellDC } from "../game/combat.js";

const say = (s) => (t, k) => note(s, t, k);
const member = (s, id) => s.party.members.find(m => m.id === id);
const level = (s, id, xp) => { member(s, id).xp = xp; runWithDice(s, (rng) => checkLevels(s, say(s), rng)); return member(s, id); };

test("a level brings its attribute points and each domain's mastery points by the class's progression", () => {
  const s = newGame(1);
  const g = level(s, "gerberga", 100);
  assert.equal(g.level, 2);
  assert.deepEqual(g.unspent, { attr: 2, weapon: 1, spell: 1, skill: 1, style: 0 });
  const h = level(s, "hamon", 100);
  assert.equal(h.unspent.spell, 0, "Thieves have no spell mastery");
  assert.ok(hasUnspent(h));
});

test("one point per mastery per level, nothing past Untrained at level 1, and weapons stop at the class's cap", () => {
  const s = newGame(2);
  const gisla = member(s, "gisla");
  gisla.unspent.weapon = 2;
  assert.match(cannotInvest(gisla, "weapon:daggers"), /one point per mastery per level/, "her starting point is level 1's");
  assert.ok(invest(gisla, "weapon:swords"));
  assert.equal(masteryIndex(gisla, "weapon:swords"), 2);
  assert.match(cannotInvest(gisla, "weapon:swords"), /one point per mastery per level/);
  gisla.level = 30; gisla.invest["weapon:daggers"] = 9; // one short of Expert
  assert.match(cannotInvest(gisla, "weapon:daggers"), /Curseds stop at Skilled/);
});

test("from level 2, a Paladin's point in a weapon type brings a free combat style point", () => {
  const s = newGame(3);
  const g = level(s, "gerberga", 100);
  assert.ok(invest(g, "weapon:swords"));
  assert.equal(g.unspent.style, 1);
  assert.ok(invest(g, "style:shield", { free: true }));
  assert.equal(g.invest["style:shield"], 2, "a second point toward Basic, which takes 3");
  assert.equal(g.weaponSkill.swords, 2);
});

test("attribute points buy scores at their tier's price; a new Endurance tier adds its die to health", () => {
  const s = newGame(4);
  const h = member(s, "hamon");
  assert.equal(h.attrPts.endurance, pointsForScore(10));
  h.unspent.attr = 15;
  const health = h.health;
  for (let i = 0; i < 15; i++) runWithDice(s, (rng) => raiseAttribute(s, h, "endurance", rng, say(s)));
  assert.equal(h.attributes.endurance, 15);
  assert.ok(h.health > health && h.health <= health + 6, "a d6 for Tier 4");
});

test("the class's health every third level, free skills, and a companion's tier at level 4", () => {
  const s = newGame(5);
  const g = level(s, "gerberga", 300);
  assert.equal(g.level, 3);
  assert.equal(g.health, 5 + 3);
  assert.equal(g.theurgy.lore, 3, "Theurgic Lore to Basic at level 3");
  const c = level(s, "corra", 750);
  assert.equal(c.level, 4);
  assert.equal(c.skills.wilderness, 3);
  assert.equal(c.companion.tier, 2);
  assert.ok(c.companion.health > 16);
  assert.equal(c.companion.resistAll, 1);
});

test("a spell's DC follows its form's mastery", () => {
  const s = newGame(6);
  const g = member(s, "gisla");
  assert.equal(spellDC(g, "fire"), 5);
  g.level = 3; g.unspent.spell = 2; g.invest["form:fire"] = 2;
  assert.ok(invest(g, "form:fire"));
  assert.equal(g.casting.forms.fire, 3, "3 points: Basic");
  assert.equal(spellDC(g, "fire"), 6);
});
