import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, siteAction, travelLeg, runWithDice, afterEvent, note } from "../game/journey.js";
import { placeOn } from "../game/events.js";
import { makeSite, siteChoices, siteHere, gemGrade, notablePiece, inDark } from "../game/sites.js";
import { saleList } from "../game/town.js";
import { count } from "../game/supplies.js";
import { makeRng } from "../game/rng.js";
import { playBattle } from "./autoplay.mjs";

const say = (s) => (t, k) => note(s, t, k);
const logOf = (s, from = 0) => s.log.slice(from).map(l => l.text).join("\n");

function siteAt(seed, type) {
  const s = newGame(seed);
  const p = placeOn(s, s.party.x, s.party.y, { type });
  runWithDice(s, (rng) => makeSite(s, rng, p, say(s)));
  return { s, p };
}

/** Play a site through: onward, fight, take what's there, and leave. */
function crawl(s, { prefer = ["hoard", "graves", "heart", "fight", "onward", "around", "pick", "force", "obstacle"] } = {}) {
  siteAction(s, "enter");
  for (let i = 0; i < 120 && !s.over && s.site; i++) {
    if (s.battle) { playBattle(s); afterEvent(s); continue; }
    const ch = siteChoices(s).filter(c => !c.disabled);
    const pick = prefer.map(id => ch.find(c => c.id === id)).find(Boolean) || ch.find(c => c.id === "leave");
    siteAction(s, pick.id, pick.arg);
  }
}

test("gem grades follow the party's level", () => {
  const rng = makeRng(3);
  const low = Array.from({ length: 2000 }, () => gemGrade(rng, 1));
  const high = Array.from({ length: 2000 }, () => gemGrade(rng, 20));
  assert.ok(!low.includes("Precious"), "no Precious gems at level 1");
  assert.ok(low.filter(g => g === "Ornamental").length > 1400, "mostly Ornamental at level 1");
  assert.ok(!high.includes("Ornamental"), "no Ornamental gems at level 19+");
  const p = notablePiece(rng, 1);
  assert.ok(p.name && p.value > 0);
});

test("a site's size, guardian, and hoard come from its type and band", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { p } = siteAt(seed, "ruin");
    const site = p.site;
    assert.ok(site.size >= 3 && site.size <= 8, `ruin of ${site.size} areas`);
    assert.equal(site.hoard.value, 40 * site.guardian.xp);
    assert.ok(["Bandit Leader", "Skeleton Warrior"].includes(site.guardian.head), "Band I ruin guardians");
  }
  const { p } = siteAt(4, "barrow");
  assert.equal(p.site.guardian.head, "Skeleton Warrior");
  assert.ok(p.site.entourage.some(x => x.name === "Skeleton" && x.heads > 0), "the Cluster waits in the barrow");
});

test("a lair keeps the group of the creature that made it", () => {
  const s = newGame(5);
  const p = placeOn(s, s.party.x, s.party.y, { type: "lair", creature: "Wolf", text: "A pack of 1d4 + 2 Wolves [Predator]" });
  runWithDice(s, (rng) => makeSite(s, rng, p, say(s)));
  assert.equal(p.site.guardian.head, "Wolf");
  assert.ok(p.site.guardian.group.length >= 1);
});

test("exploring a site to its heart: the guardian, the hoard, and banked XP", () => {
  let done = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const { s, p } = siteAt(seed, "cave");
    const coin = s.party.coin;
    crawl(s);
    assert.ok(!s.site, "the party came out");
    if (s.over) continue;
    if (!p.site.hoard.taken) continue;
    done++;
    assert.ok(!p.site.headAlive);
    assert.ok(p.site.cleared);
    assert.ok(s.party.bankedXp >= 20, "the hoard's 20 XP is banked");
    const pieces = (s.party.treasure || []).reduce((n, t) => n + t.value, 0);
    assert.ok(s.party.coin + pieces >= coin + p.site.hoard.value - 1, "the hoard is worth at least its value");
    assert.match(logOf(s), /The hoard: \d+ notable piece/);
  }
  assert.ok(done >= 6, `${done} of 12 caves cleared`);
});

test("parts of the group left unfought join the guardian in the heart", () => {
  const { s, p } = siteAt(9, "ruin");
  const site = p.site;
  site.guardian = { head: "Bandit Leader", xp: 6, temper: "Raider", text: "a Bandit Leader", group: [] };
  site.entourage = [{ name: "Bandit Cutthroat", count: 2 }];
  site.areas = [
    { id: 0, kind: "occupied", links: [1], exits: 0, group: [{ name: "Bandit Cutthroat", count: 1 }], name: "occupied" },
    { id: 1, kind: "heart", links: [0], exits: 0, name: "the heart" }
  ];
  site.heart = 1;
  s.site = { key: `${p.x},${p.y}`, at: 1, rounds: 0, minutes: 0, torch: 3 };
  s.morningDone = true;
  siteAction(s, "heart");
  const g = s.battle ? s.battle.units.filter(u => !u.pc).map(u => u.cname) : [];
  assert.equal(g.filter(n => n === "Bandit Cutthroat").length, 3, "the one left in area 1 and the two in reserve");
  assert.ok(g.includes("Bandit Leader"));
});

test("a broken lock can only be forced; picks spare the Impotence", () => {
  const { s, p } = siteAt(2, "ruin");
  const site = p.site;
  site.areas = [{ id: 0, kind: "lock", links: [], exits: 1, blocked: true, dc: 6, broken: true, name: "a lock" }];
  s.site = { key: `${p.x},${p.y}`, at: 0, rounds: 0, minutes: 0, torch: 3 };
  s.morningDone = true;
  const ids = siteChoices(s).map(c => c.id);
  assert.ok(!ids.includes("pick") && ids.includes("force"));
  assert.ok(!ids.includes("onward"), "the way on is barred");
  site.areas[0].broken = false;
  const from = s.log.length;
  siteAction(s, "pick");
  assert.match(logOf(s, from), /improvised tool/);
  s.party.stores["Thieves' Picks"] = 1;
  const from2 = s.log.length;
  siteAction(s, "pick");
  assert.doesNotMatch(logOf(s, from2), /improvised tool/);
});

test("torches burn three rounds each, and the clock is rolled every third round", () => {
  const { s, p } = siteAt(6, "cave");
  p.site.areas = [];
  p.site.size = 20;
  const torches = count(s, "Torch");
  s.morningDone = true;
  siteAction(s, "enter");
  assert.equal(count(s, "Torch"), torches - 1);
  for (let i = 0; i < 3 && s.site && !s.encounter && !s.battle; i++) { siteHere(s).areas[s.site.at].searched = false; siteAction(s, "search"); }
  const log = logOf(s);
  if (s.site.rounds >= 3) {
    assert.match(log, /The clock \(d6 \d/);
    assert.ok(count(s, "Torch") <= torches - 2, "a second torch is lit");
  }
  s.party.stores.Torch = 0;
  s.site.torch = 0;
  assert.ok(inDark(s));
  const on = siteChoices(s).find(c => c.id === "onward");
  if (on) assert.ok(on.disabled, "no going on in the dark");
});

test("inside a site: no travel, and rest is a Dungeon Rest with the clock", () => {
  const { s } = siteAt(7, "barrow");
  s.morningDone = true;
  siteAction(s, "enter");
  s.target = { x: s.party.x + 3, y: s.party.y };
  const from = s.log.length;
  travelLeg(s);
  assert.match(logOf(s, from), /Leave the site first/);
  if (s.battle || s.encounter) return;
  const day = s.day;
  siteAction(s, "rest");
  assert.equal(s.day, day + 1);
  assert.match(logOf(s, from), /The clock \(d6 \d\)/);
  assert.doesNotMatch(logOf(s, from), /Night die/);
});

test("treasure sells at its value", () => {
  const s = newGame(8);
  s.party.treasure = [{ name: "Silver arm ring", value: 44, lbs: 0.1 }];
  assert.ok(saleList(s).some(x => x.id === "treasure:0" && x.value === 44));
});
