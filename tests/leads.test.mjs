import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, searchLeg, siteAction, runWithDice, note } from "../game/journey.js";
import { placeOn } from "../game/events.js";
import { makeSite, siteChoices, canQuestion } from "../game/sites.js";
import { clue, fragment, readFragment, leadsHere, search, fragmentsRead, unreadFragments } from "../game/leads.js";
import { sageReads, openMarket } from "../game/town.js";
import { getTile, generateTile, TILE } from "../game/world.js";

const say = (s) => (t, k) => note(s, t, k);
const logOf = (s, from = 0) => s.log.slice(from).map(l => l.text).join("\n");
/** Put the party in the middle of a tile, making it Deep if it exists. */
function goTo(s, lead) {
  s.party.x = lead.tx * TILE + 3; s.party.y = lead.ty * TILE + 3;
  if (!getTile(s.world, lead.tx, lead.ty)) runWithDice(s, (rng) => generateTile(rng, s.world, lead.tx, lead.ty, { terrain: "forest" }));
  const t = getTile(s.world, lead.tx, lead.ty);
  t.deep = true; t.roads = []; t.settlement = null;
}
/** A party that can find things: the band I party can't (see RULES-GAPS and DECISIONS). */
const keen = (s) => s.party.members.forEach(m => { m.skills.alertness = 5; m.attributes.perception = 25; });

test("a clue points to a Deep tile or one not yet seen, carried on past settled ground", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = newGame(seed);
    const l = runWithDice(s, (rng) => clue(s, rng, say(s), "Test"));
    const t = getTile(s.world, l.tx, l.ty);
    assert.ok(!t || t.deep, "lands on Deep country or the unknown");
    assert.ok(["lair", "cave", "ruin", "barrow", "hideout", "cache"].includes(l.kind));
    assert.ok(l.far >= 1 && l.far <= 3);
  }
});

test("searching finds what a lead points to, and nothing without one", () => {
  const s = newGame(3);
  s.morningDone = true;
  let from = s.log.length;
  searchLeg(s);
  assert.match(logOf(s, from), /Without a lead|Nothing points here/);
  keen(s);
  const l = runWithDice(s, (rng) => clue(s, rng, say(s), "Test"));
  l.kind = "cave";
  goTo(s, l);
  let found = null;
  for (let i = 0; i < 30 && !found; i++) found = runWithDice(s, (rng) => search(s, rng, say(s)));
  assert.ok(found, "found within thirty tries");
  assert.equal(found.type, "cave");
  assert.ok(found.hidden);
  assert.ok(l.found);
  assert.equal(s.party.bankedXp, 50, "Hidden Location");
  assert.match(logOf(s), /against 6\b/, "Even DC 4, +2 Deep");
  runWithDice(s, (rng) => makeSite(s, rng, found, say(s)));
  assert.ok(found.site.hoard.hidden, "its hoard is a Hidden Hoard");
});

test("a searching leg spends hours without moving and rolls the event die", () => {
  const s = newGame(4);
  s.morningDone = true;
  const l = runWithDice(s, (rng) => clue(s, rng, say(s), "Test"));
  l.kind = "cache";
  goTo(s, l);
  const { x, y } = s.party;
  const from = s.log.length;
  searchLeg(s);
  assert.equal(s.party.x, x); assert.equal(s.party.y, y);
  assert.ok(s.hoursUsed > 0 || s.day > 1);
  assert.match(logOf(s, from), /hours? searching/);
  assert.match(logOf(s, from), /Event die/);
});

test("a hidden cache is taken at once: one piece and a purse", () => {
  const s = newGame(5);
  s.morningDone = true;
  keen(s);
  const l = runWithDice(s, (rng) => clue(s, rng, say(s), "Test"));
  l.kind = "cache";
  goTo(s, l);
  const coin = s.party.coin;
  for (let i = 0; i < 40 && !l.found; i++) { s.hoursUsed = 0; s.encounter = null; s.sign = null; s.battle = null; searchLeg(s); }
  assert.ok(l.found);
  assert.equal(s.party.treasure.length, 1);
  assert.ok(s.party.coin > coin - 200, "a purse (less anything spent on the way)");
});

test("an outlaws' hideout is a ruin held by bandits or outlaws", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const s = newGame(seed);
    const p = placeOn(s, s.party.x, s.party.y, { type: "ruin", hidden: true, hideout: true });
    runWithDice(s, (rng) => makeSite(s, rng, p, say(s)));
    assert.ok(["Bandit Leader", "Ranger Captain"].includes(p.site.guardian.head), p.site.guardian.head);
  }
});

test("three fragments read reveal a lost place; an unread one waits for a Sage", () => {
  const s = newGame(6);
  s.party.members.forEach(m => { m.skills.lore = 7; m.attributes.intelligence = 30; });
  for (let i = 0; i < 3; i++) runWithDice(s, (rng) => fragment(s, rng, say(s), "Test"));
  assert.equal(fragmentsRead(s.world), 3);
  const lost = s.world.leads.find(l => l.kind === "lost");
  assert.ok(lost, "the lost place is marked");
  assert.ok(lost.far >= 2 && lost.far <= 12);
  const s2 = newGame(7);
  s2.party.members.forEach(m => { m.skills.lore = 1; m.attributes.intelligence = 0; });
  runWithDice(s2, (rng) => fragment(s2, rng, say(s2), "Test"));
  assert.equal(unreadFragments(s2.world).length, 1, "can't be read in the field");
  assert.equal(runWithDice(s2, (rng) => sageReads(s2, rng, say(s2))), false, "the home village has no Sage");
});

test("searching for a lost place is harder, and finds a Lost Location", () => {
  const s = newGame(8);
  s.party.members.forEach(m => { m.skills.alertness = 7; m.attributes.perception = 30; });
  s.world.leads = [{ kind: "lost", dir: "east", dx: 1, dy: 0, far: 4, tx: 4, ty: 0, found: false }];
  goTo(s, s.world.leads[0]);
  const p = runWithDice(s, (rng) => search(s, rng, say(s)));
  assert.equal(p.type, "lost");
  assert.equal(s.party.bankedXp, 75);
  assert.match(logOf(s), /against 8/, "Hard DC 6, +2 Deep");
});

test("a beaten guardian that can talk can be questioned; a beast can't", () => {
  const s = newGame(9);
  const p = placeOn(s, s.party.x + 1, s.party.y, { type: "ruin" });
  runWithDice(s, (rng) => makeSite(s, rng, p, say(s)));
  p.site.guardian = { head: "Bandit Leader", xp: 6, text: "a Bandit Leader", temper: "Raider", group: [] };
  p.site.headAlive = false;
  assert.ok(canQuestion(p.site));
  p.site.guardian.head = "Giant Rat";
  assert.ok(!canQuestion(p.site), "beasts know nothing");
});

test("a cleared site may have new occupants a month later, with half a hoard", () => {
  let refilled = 0, empty = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const s = newGame(seed);
    s.party.x += 1;
    const p = placeOn(s, s.party.x, s.party.y, { type: "barrow" });
    runWithDice(s, (rng) => makeSite(s, rng, p, say(s)));
    Object.assign(p.site, { cleared: true, clearedDay: 1, headAlive: false, entourage: [] });
    p.site.hoard.taken = true;
    p.site.areas = [{ id: 0, kind: "empty", links: [], exits: 0, done: true, name: "empty" }];
    s.day = 40; s.morningDone = true;
    siteAction(s, "enter");
    if (p.site.headAlive) { refilled++; assert.equal(p.site.hoard.value, 20 * p.site.guardian.xp); assert.ok(!p.site.cleared); }
    else { empty++; assert.match(logOf(s), /as you left it/); }
    // only once a month
    siteAction(s, "leave");
    const from = s.log.length;
    siteAction(s, "enter");
    assert.doesNotMatch(logOf(s, from), /as you left it|moved in/);
  }
  assert.ok(refilled >= 3 && empty >= 8, `${refilled} refilled, ${empty} empty`);
});

import { maybeHart, hartChoices, chooseHart, atDeepWoodEdge } from "../game/hart.js";

/** Stand the party in forest beside Deep country. */
function deepWoodEdge(s) {
  const [tx, ty] = [0, 0];
  runWithDice(s, (rng) => generateTile(rng, s.world, 2, 0, { terrain: "forest" }));
  s.world.tiles["1,0"].deep = true;
  s.world.tiles["0,0"].terrain = "forest";
  return [tx, ty];
}

test("the White Hart shows at the deep wood's edge, charms, and can be followed to a place found without searching", async () => {
  let seen = 0, followed = 0, lost = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const s = newGame(seed);
    deepWoodEdge(s);
    assert.ok(atDeepWoodEdge(s));
    if (!runWithDice(s, (rng) => maybeHart(s, rng, say(s)))) continue;
    seen++;
    assert.ok(s.sign.hart && [0, 1, 2].includes(s.sign.truth));
    const ids = hartChoices(s).map(c => c.id);
    assert.ok(ids.includes("follow"));
    assert.equal(ids.includes("leave"), !s.sign.charmed.length, "the charmed can't just let it go");
    runWithDice(s, (rng) => chooseHart(s, rng, "follow", say(s)));
    assert.ok(!s.sign?.hart);
    const lead = (s.world.leads || []).find(l => l.guided);
    if (!lead) { lost++; continue; }
    followed++;
    s.party.x = lead.tx * TILE + 3; s.party.y = lead.ty * TILE + 3;
    if (!getTile(s.world, lead.tx, lead.ty)) runWithDice(s, (rng) => generateTile(rng, s.world, lead.tx, lead.ty, { terrain: "forest" }));
    getTile(s.world, lead.tx, lead.ty).deep = true;
    const { arriveGuided } = await import("../game/leads.js");
    const place = arriveGuided(s, say(s));
    assert.ok(place?.hidden, "found on arrival");
    assert.ok(s.party.bankedXp >= 50);
  }
  assert.ok(seen >= 6, `seen ${seen} times in 80`);
  assert.ok(followed >= 5, `${followed} followed, ${lost} lost`);
});

test("the Hart never shows away from the deep wood", () => {
  const s = newGame(2);
  s.world.tiles["0,0"].terrain = "plains";
  for (let i = 0; i < 30; i++) assert.equal(runWithDice(s, (rng) => maybeHart(s, rng, say(s))), false);
});
