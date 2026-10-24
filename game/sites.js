/**
 * SITES (design/05-sites.md): lairs, caves, ruins, barrows, and lost places.
 * A site is a chain of areas drawn as the party goes in: each new area rolls
 * its contents (d12) and its ways on (d6). Fights here are ordinary battles
 * built from the guardian's group; the clock brings its residents to see;
 * the heart holds the guardian and the hoard (design/03-treasure.md).
 */
import { roll } from "./rng.js";
import { trial, passes, tierOf, dieOfTier } from "./mastery.js";
import { CREATURES } from "./data/creatures.js";
import { ENCOUNTERS } from "./data/encounters.js";
import { ARMOR, SHIELDS } from "./data/arms.js";
import { alive, living, partyLevel, bandFor, ROMAN, EVEN_DC, HARD_DC, xpFor, aboveBand, rollTable, creatureTrial } from "./events.js";
import { squareAt, countryAt } from "./world.js";
import { count, take, refill } from "./supplies.js";
import { armorResist } from "./combat.js";
import { rollPiece } from "./vendor/foundry/module/helpers/hoard-rules.mjs";
import { clue, fragment } from "./leads.js";

export const SITE_TYPES = ["lair", "cave", "ruin", "barrow", "lost"];
const LABEL = { lair: "lair", cave: "cave", ruin: "ruin", barrow: "barrow", lost: "lost place" };
const MINUTES = 10; // an exploration round (General Rules; Equipment, Torch: 3 rounds is about 30 minutes)

/* ------------------------------------------------------------------ */
/* Guardians (design/05-sites.md, Guardians)                            */

const G = (head, xp, temper, group, text) => ({ head, xp, temper, group, text });
const SKELETONS = G("Skeleton Warrior", 4, "Restless dead", [{ name: "Skeleton Warrior", count: 1 }, { name: "Skeleton", heads: 6 }], "a Skeleton Warrior with a Cluster of Skeletons");
const REVENANT = G("Revenant Soldier", 20, "Restless dead", [{ name: "Revenant Soldier", count: 1 }, { name: "Skeleton", heads: 6 }], "a Revenant Soldier with a Cluster of Skeletons");
const KNIGHT = G("Revenant Knight", 40, "Restless dead", [{ name: "Revenant Knight", count: 1 }, { name: "Revenant Soldier", count: 2 }], "a Revenant Knight with two Revenant Soldiers");
const OGRE = G("Ogre", 30, "Territorial", [{ name: "Ogre", count: 1 }], "an Ogre");
const COURT = G("Shadow-Man", 40, "Strange", [{ name: "Shadow-Man", count: 1 }], "a Shadow-Man's court");
const EARTH = G("Earth Guardian", 30, "Guardian", [{ name: "Earth Guardian", count: 1 }], "an Earth Guardian");
const DAIMON = G("Agathodaimon", 10, "Guardian", [{ name: "Agathodaimon", count: 1 }], "an Agathodaimon, a guardian spirit");

/** By type and band: a list of [highest d6, guardian]. */
const GUARDIANS = {
  barrow: {
    1: [[6, SKELETONS]],
    2: [[4, REVENANT], [6, G("Zombie Brute", 6, "Restless dead", [{ name: "Zombie Brute", count: 3 }], "three Zombie Brutes")]],
    3: [[6, KNIGHT]]
  },
  cave: {
    1: [[3, G("Wolf Spider", 4, "Predator", [{ name: "Wolf Spider", count: 1 }, { name: "Spider Swarm", heads: 6 }], "a Wolf Spider with a Cluster of Spider Swarm")],
      [5, G("Giant Rat", 4, "Predator", [{ name: "Giant Rat", count: 3 }, { name: "Rat Swarm", heads: 6 }], "three Giant Rats with a Rat Swarm")],
      [6, G("Kallikantzaros", 4, "Raider", [{ name: "Kallikantzaros", count: "1d3+1" }], "a band of Kallikantzaroi, at home underground")]],
    2: [[3, G("Monstrous Widow", 20, "Predator", [{ name: "Monstrous Widow", count: 1 }], "a Monstrous Widow, an Ambusher")],
      [5, G("Black Bear", 10, "Territorial", [{ name: "Black Bear", count: 1 }], "a Black Bear's den")],
      [6, G("Living Stone", 6, "Guardian", [{ name: "Living Stone", count: 2 }], "two Living Stones")]],
    3: [[2, G("Brown Bear", 30, "Territorial", [{ name: "Brown Bear", count: 1 }], "a Brown Bear")], [4, OGRE], [5, EARTH],
      [6, G("Cave Bear", 60, "Territorial", [{ name: "Cave Bear", count: 1 }], "a Cave Bear, an apex creature")]]
  },
  ruin: {
    1: [[4, G("Bandit Leader", 6, "Raider", [{ name: "Bandit Leader", count: 1 }, { name: "Bandit Cutthroat", count: 2 }, { name: "Bandit Thug", heads: 6 }], "a Bandit Leader with two Cutthroats and a Cluster of Thugs")],
      [6, SKELETONS]],
    2: [[2, G("Redcap", 6, "Raider", [{ name: "Redcap", count: 3 }], "three Redcaps")],
      [4, G("Ranger Captain", 10, "Raider", [{ name: "Ranger Captain", count: 1 }, { name: "Woodsman", count: 2 }], "a Ranger Captain's outlaws")],
      [5, G("Revenant Soldier", 20, "Restless dead", [{ name: "Revenant Soldier", count: 1 }], "a Revenant Soldier")],
      [6, G("Orc War Chief", 30, "Raider", [{ name: "Orc War Chief", count: 1 }, { name: "Orc Raider", count: 4 }], "an Orc War Chief with four Raiders")]],
    3: [[2, OGRE], [4, G("Warlord", 30, "Raider", [{ name: "Warlord", count: 1 }, { name: "Veteran", count: 2 }, { name: "Footsoldier", heads: 12 }], "a Warlord's free company")],
      [5, G("Revenant Knight", 40, "Restless dead", [{ name: "Revenant Knight", count: 1 }], "a Revenant Knight")], [6, COURT]]
  },
  lost: {
    1: [[4, SKELETONS], [6, DAIMON]],
    2: [[3, DAIMON], [6, REVENANT]],
    3: [[2, G("Cherub", 30, "Guardian", [{ name: "Cherub", count: 1 }], "a Cherub, the threshold keeper")], [4, COURT], [5, EARTH], [6, KNIGHT]]
  }
};

/** The table entry for a creature that heads a group, for lairs placed before their group was kept. */
function entryFor(head) {
  for (const bands of Object.values(ENCOUNTERS)) for (const cells of Object.values(bands)) for (const cell of Object.values(cells))
    for (const o of cell.options) if (o.head === head && o.group) return o;
  return null;
}

/** The guardian's group, with every count rolled, split into the head and its entourage. */
function muster(rng, g) {
  const group = (g.group || [{ name: g.head, count: 1 }]).map(x => ({ ...x }));
  const entourage = [];
  for (const x of group) {
    if (!CREATURES[x.name]) continue;
    if (x.heads) { entourage.push({ name: x.name, heads: Math.max(1, roll(rng, String(x.heads)).total) }); continue; }
    let n = Math.max(1, roll(rng, String(x.count ?? 1)).total);
    if (x.name === g.head) n -= 1; // the head itself waits in the heart
    if (n > 0) entourage.push({ name: x.name, count: n });
  }
  return entourage;
}

/** An outlaws' hideout: a ruin held by bandits or outlaws (design/04-the-map.md, Hidden and lost places), even or odd on a d6. */
const HIDEOUT = (d, band) => band === 1 || d % 2 === 0 ? GUARDIANS.ruin[1][0][1] : GUARDIANS.ruin[2][1][1];

function rollGuardian(rng, state, type, band, place) {
  if (place.hideout) { const d = rng.d(6); return { ...structuredClone(HIDEOUT(d, band)), d6: d }; }
  if (type === "lair") {
    let o = place.creature ? (place.group ? place : entryFor(place.creature)) : null;
    if (!o) {
      const terrain = squareAt(state.world, place.x, place.y).terrain;
      for (let i = 0; i < 20 && (!o || o.temper === "Prey" || !o.head); i++) o = rollTable(rng, state, terrain, band).opt;
    }
    const head = place.creature || o.head;
    return { head, xp: o.xp ?? xpFor(CREATURES[head]?.division || 1), temper: o.temper || "Territorial", group: o.group || [{ name: head, count: 1 }],
      text: (place.text || o.text || head).replace(/\s*\[[^\]]*\]/g, "").replace(/\.\s.*$/, "").replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase()) };
  }
  const d = rng.d(6);
  const row = GUARDIANS[type][band].find(([hi]) => d <= hi)[1];
  return { ...structuredClone(row), d6: GUARDIANS[type][band].length > 1 ? d : null };
}

/* ------------------------------------------------------------------ */
/* Making a site                                                        */

const SIZE = { lair: "1d3+1", barrow: "1d4+1", cave: "1d4+2", ruin: "1d6+2", lost: "2d6+2" };

/** Roll the site at a place on the map the first time the party stands at it. */
export function makeSite(state, rng, place, note) {
  const deep = countryAt(state.world, place.x, place.y) === "deep";
  const band = Math.min(3, bandFor(partyLevel(state)) + (deep ? 1 : 0));
  const type = place.type;
  const size = roll(rng, SIZE[type]).total + (deep ? 2 : 0);
  const guardian = rollGuardian(rng, state, type, band, place);
  const site = {
    type, size, band, deep, guardian, entourage: muster(rng, guardian), headAlive: true,
    hoard: { value: 40 * guardian.xp * (deep ? 2 : 1), taken: false, hidden: !!place.hidden },
    areas: [], heart: null, cleared: false
  };
  place.site = site;
  const above = aboveBand(guardian.head, partyLevel(state));
  note(`The ${LABEL[type]}: ${size} areas to it, Band ${ROMAN[band]}${deep ? ", in Deep country" : ""}.${above ? ` Signs at the entrance: whatever holds it is beyond you (${guardian.head}).` : ""}`, above ? "event" : "place");
  return site;
}

/* ------------------------------------------------------------------ */
/* Reading the party                                                    */

const tier = (m, a) => tierOf(m.attributes[a]);
const skillOf = (m, s) => m.skills?.[s] || 1;
/** The best of the party at a trial: the attribute tier die and the skill's die. */
function best(state, attr, sk) {
  return [...alive(state)].sort((a, b) => (tier(b, attr) + skillOf(b, sk)) - (tier(a, attr) + skillOf(a, sk)))[0];
}
function rollFor(rng, m, attr, sk, opts = {}) {
  return trial(rng, [dieOfTier(tier(m, attr)), sk ? dieOfTier(skillOf(m, sk)) : dieOfTier(tier(m, attr))], opts);
}
export const siteHere = (state) => state.site ? state.world.places[state.site.key]?.site : null;
const placeHere = (state) => state.world.places?.[`${state.party.x},${state.party.y}`];
const dcs = (site) => ({ even: EVEN_DC[site.band] + (site.deep ? 2 : 0), hard: HARD_DC[site.band] + (site.deep ? 2 : 0) });

/* ------------------------------------------------------------------ */
/* Notable pieces and hoards (design/03-treasure.md)                    */

/** Gem grade by party level [Jon, 2026-10-24]: d100 against each band's row. */
const GRADES = [
  [5, [[80, "Ornamental"], [98, "Common"], [100, "Semi-Precious"]]],
  [8, [[45, "Ornamental"], [90, "Common"], [99, "Semi-Precious"], [100, "Precious"]]],
  [12, [[15, "Ornamental"], [70, "Common"], [97, "Semi-Precious"], [100, "Precious"]]],
  [18, [[40, "Common"], [90, "Semi-Precious"], [100, "Precious"]]],
  [99, [[10, "Common"], [60, "Semi-Precious"], [100, "Precious"]]]
];
export function gemGrade(rng, level) {
  const n = rng.d(100);
  return GRADES.find(([hi]) => level <= hi)[1].find(([hi]) => n <= hi)[1];
}
const ART = ["plate", "painting", "statue", "tapestry", "embroidery", "carpet", "glass"];

/** One notable piece: d6 1–4 a gem, 5 jewelry, 6 art. → { name, value, lbs } */
export function notablePiece(rng, level) {
  const d = (s) => rng.d(s);
  const n = rng.d(6);
  const kind = n <= 4 ? "gems" : n === 5 ? "jewelry" : ART[rng.d(ART.length) - 1];
  const r = rollPiece(d, kind, kind === "gems" ? { grade: gemGrade(rng, level) } : {}, 1).results[0];
  return { name: r.name, value: r.unit, lbs: r.sys?.weightLbs || 0, carry: r.carry };
}
function gain(state, piece, note, why) {
  (state.party.treasure ||= []).push(piece);
  note(`${why}: ${piece.name}, worth ${piece.value} sp${piece.carry && piece.carry !== "Fits" ? ` (${piece.carry.toLowerCase()})` : ""}.`, "reward");
}
const PIECES = { 1: "1d3", 2: "1d4", 3: "1d6" };

function takeHoard(state, rng, note, site) {
  const level = partyLevel(state);
  const n = roll(rng, PIECES[site.band] || "2d4").total;
  let total = 0;
  for (let i = 0; i < n; i++) { const p = notablePiece(rng, level); total += p.value; gain(state, p, note, "In the hoard"); }
  const coin = Math.max(0, Math.round((site.hoard.value - total) * 4) / 4);
  state.party.coin = Math.round((state.party.coin + coin) * 4) / 4;
  site.hoard.taken = true;
  const xp = site.hoard.hidden ? 25 : 20;
  state.party.bankedXp += xp;
  note(`The hoard: ${n} notable piece${n === 1 ? "" : "s"} worth ${Math.round(total * 4) / 4} sp${coin ? `, and ${coin} sp in coin` : ""} (a hoard of ${site.hoard.value} sp). ${site.hoard.hidden ? "Hidden Hoard" : "Hoard"}: ${xp} XP, banked.`, "reward");
  if (coin >= 3200) note(`That much coin is the bulk of a Light object for every 3,200 sp.`);
  // A clue in the hoard on a 6 (5–6 in a Deep site); in a Deep hoard, a 6 is a fragment of lost lore instead.
  const d = rng.d(6);
  if (site.deep && d === 6) fragment(state, rng, note, `In the hoard (d6 ${d})`);
  else if (d === 6 || (site.deep && d === 5)) clue(state, rng, note, `In the hoard (d6 ${d}), a map scrap`);
}

/* ------------------------------------------------------------------ */
/* Areas                                                                */

const KIND = (n) => n <= 3 ? "empty" : n <= 5 ? "occupied" : ["trap", "lock", "obstacle", "cache", "remains", "feature", "heart"][n - 6];
const AREA_XP = { empty: 1, occupied: 2, trap: 3, lock: 3, obstacle: 3, cache: 1, remains: 1, feature: 1 };
const KIND_LABEL = { empty: "empty", occupied: "occupied", trap: "a trap", lock: "a lock", obstacle: "an obstacle", cache: "a cache", remains: "remains", feature: "a feature", heart: "the heart", secret: "a secret room" };

export const areaLabel = (a) => `Area ${a.id + 1}${a.secret ? " (secret)" : ""}: ${a.name}`;

/** Ways on still undrawn across the site, and areas still to come. */
const openWays = (site) => site.areas.reduce((n, a) => n + (a.blocked ? 0 : a.exits), 0);

/** Draw a new area off `from` (null for the entrance). */
function drawArea(state, rng, note, site, from, { secret = false } = {}) {
  const id = site.areas.length;
  let n = rng.d(12);
  if (secret) { const m = rng.d(12); n = Math.max(n, m); }
  let kind = KIND(n);
  if (kind === "heart" && site.heart != null) kind = "cache";
  // The last area is the heart if it hasn't turned up.
  const last = !secret && site.areas.filter(a => !a.secret).length + 1 >= site.size;
  if (last && site.heart == null) kind = "heart";
  const a = { id, n, kind, links: from == null ? [] : [from], exits: 0, blocked: false, searched: false, done: false, secret, name: KIND_LABEL[kind] };
  site.areas.push(a);
  if (from != null) site.areas[from].links.push(id);
  // Ways on (d6): 1–4 one, 5 two, 6 a dead end unless that would strand undrawn areas.
  if (!secret) {
    const p = rng.d(6);
    a.exits = p <= 4 ? 1 : p === 5 ? 2 : 0;
    const remaining = site.size - site.areas.filter(x => !x.secret).length;
    if (remaining <= 0) a.exits = 0;
    else if (!a.exits && openWays(site) === 0) a.exits = 1;
    a.ways = p;
  }
  const told = !secret && site.foretold > 0;
  if (told) { site.foretold -= 1; a.foretold = true; }
  note(`${told ? "As the notes said, " : ""}${secret ? "A secret room" : `Area ${id + 1}`} (d12 ${n}${secret ? ", the better of two" : ""}${a.ways ? `; ways on d6 ${a.ways}: ${a.exits ? `${a.exits} way${a.exits > 1 ? "s" : ""} on` : "no way on"}` : ""}): ${KIND_LABEL[kind]}.`, "place");
  enterArea(state, rng, note, site, a);
  return a;
}

/** What happens on first entering an area. */
function enterArea(state, rng, note, site, a) {
  const level = partyLevel(state), { even, hard } = dcs(site);
  const bank = (xp, why) => { if (!xp) return; state.party.bankedXp += xp; note(`${why}: ${xp} exploration XP, banked.`); };
  switch (a.kind) {
    case "empty": a.done = true; bank(1, "Explored"); break;
    case "cache": a.done = true; gain(state, notablePiece(rng, level), note, "A cache"); bank(1, "Explored"); break;
    case "remains": {
      a.done = true;
      salvage(state, rng, note);
      const purse = roll(rng, `${Math.max(1, site.band)}d6`).total;
      state.party.coin += purse;
      note(`Remains of someone who came before. A purse: ${purse} sp.`, "reward");
      const c = rng.d(6);
      const ahead = site.areas.length < site.size;
      if (c <= 4 && ahead) { site.foretold = (site.foretold || 0) + 1; note(`A clue (d6 ${c}): scratched notes on what lies ahead. The next area you go into holds no surprises.`); }
      else if (c <= 4) note(`A clue (d6 ${c}), but nothing here is still unknown.`);
      else clue(state, rng, note, `On the remains (d6 ${c})`);
      bank(1, "Explored");
      break;
    }
    case "feature": feature(state, rng, note, site, a); bank(1, "Explored"); break;
    case "trap": trap(state, rng, note, site, a); break;
    case "lock": {
      a.blocked = true; a.good = rng.d(6) >= 5;
      a.dc = a.good ? hard : even;
      a.name = a.good ? "a good lock" : "a lock";
      note(`A ${a.good ? "well-made " : ""}lock or seal bars the way on (DC ${a.dc}).`, "event");
      break;
    }
    case "obstacle": {
      const OB = [["a sheer climb", "climb it", "strength", "athletics"], ["a flooded passage", "swim it", "endurance", "athletics"],
        ["a riddle carved on a door", "read the riddle", "intelligence", "lore"], ["a collapse", "find a way through", "wisdom", "lore"]];
      const o = OB[rng.d(4) - 1];
      a.blocked = true; a.dc = even; a.obstacle = o; a.name = o[0];
      note(`An obstacle: ${o[0]} (DC ${a.dc}).`, "event");
      break;
    }
    case "occupied": {
      a.group = occupants(rng, site);
      note(`Occupied: ${groupText(a.group)}.`, "event");
      break;
    }
    case "heart": {
      site.heart = a.id;
      note(`The heart of the ${LABEL[site.type]}: ${site.guardian.text}${site.headAlive ? ", and its hoard" : ""}.`, "event");
      break;
    }
  }
}

function salvage(state, rng, note) {
  const pool = [...Object.values(ARMOR).map(x => ({ ...x, kind: "armor" })), ...Object.values(SHIELDS).map(x => ({ ...x, kind: "shield" }))];
  const g = pool[rng.d(pool.length) - 1];
  const pct = rng.d(10) * 10;
  const durability = Math.max(0, Math.round(g.durability * pct / 100));
  (state.party.spare ||= []).push({ name: g.name, kind: g.kind, durability, max: g.durability, ...(g.kind === "armor" ? { weightClass: g.weightClass, resistance: { ...g.resistance } } : { defense: g.defense }) });
  note(`Their gear: ${g.name.toLowerCase()} at ${pct}% (${durability}/${g.durability}), to sell or wear.`, "reward");
}

/** Part of the guardian's group, taken from its entourage: 1d3 creatures, or one minion group cut to a Cluster; vermin if none is left. */
function occupants(rng, site) {
  const singles = site.entourage.find(x => x.count > 0);
  const swarm = site.entourage.find(x => x.heads > 0);
  if (singles && (!swarm || rng.d(2) === 1)) { const n = Math.min(singles.count, rng.d(3)); singles.count -= n; return [{ name: singles.name, count: n }]; }
  if (swarm) { const n = Math.min(6, swarm.heads); swarm.heads -= n; return [{ name: swarm.name, heads: n }]; }
  return [{ name: rng.d(2) === 1 ? "Rat Swarm" : "Spider Swarm", heads: 6 }];
}
/** One entry per creature kind, counts and heads added up. */
function merge(g) {
  const out = [];
  for (const x of g) {
    const y = out.find(o => o.name === x.name && !!o.heads === !!x.heads);
    if (!y) out.push({ ...x });
    else if (x.heads) y.heads += x.heads; else y.count += x.count;
  }
  return out;
}
const groupText = (g) => merge(g).map(x => x.heads ? `${x.name}s (${x.heads})` : `${x.count > 1 ? `${x.count} ` : "a "}${x.name}${x.count > 1 ? "s" : ""}`).join(" and ");

function feature(state, rng, note, site, a) {
  const d = rng.d(6), level = partyLevel(state);
  a.done = true;
  switch (site.type) {
    case "lair":
      if (d <= 4) { a.name = "bones and refuse"; note(`Bones and refuse (d6 ${d}): a Throatcutter could harvest parts here. (Harvesting comes later.)`, "todo"); }
      else {
        a.name = "old kills";
        const k = rng.d(3), terrain = squareAt(state.world, state.party.x, state.party.y).terrain;
        const habitat = { forest: "Woodland", swamp: "Woodland", hills: "Mountain", mountains: "Mountain", plains: "Plains", desert: "Desert" }[terrain] || "Woodland";
        const r = rollPiece((s) => rng.d(s), "fur", { habitat, state: "fresh" }, k);
        for (const g of r.results) for (let i = 0; i < g.qty; i++) state.party.pelts.push({ name: g.name.replace(/ pelt.*$/, ""), quality: /\((\w+)/.exec(g.name)[1].toLowerCase(), value: g.unit, weight: g.sys.weightLbs });
        note(`Old kills (d6 ${d}): ${r.results.map(g => `${g.qty} ${g.name.toLowerCase()} worth ${g.unit} sp`).join(", ")}.`, "reward");
      }
      break;
    case "cave":
      if (d <= 2) { a.name = "underground water"; note(`Underground water (d6 ${d}), cold and deep.`); refill(state, note, "underground water"); }
      else if (d <= 4) {
        a.name = "a squeeze";
        const heavy = living(state).filter(m => m.armor?.weightClass === "heavy");
        note(`A squeeze (d6 ${d})${heavy.length ? `: ${heavy.map(m => m.name).join(" and ")} must take off heavy armor to pass, and carry it` : ""}.`);
      } else { a.name = "fungus and cave growth"; a.forage = true; note(`Fungus and cave growth (d6 ${d}): a Forager can gather here.`); }
      break;
    case "ruin":
      if (d <= 2) { a.done = false; a.blocked = true; a.dc = dcs(site).even; a.obstacle = ["an unsound floor", "cross the floor", "agility", "athletics"]; a.name = "an unsound floor"; note(`An unsound floor (d6 ${d}) (DC ${a.dc}).`, "event"); }
      else if (d <= 4) { a.name = "an old chapel"; site.sources = [...(site.sources || []), "holy site"]; note(`An old chapel (d6 ${d}): a holy site.`, "place"); }
      else {
        a.name = "a ruined library"; site.sources = [...(site.sources || []), "occult writings"];
        const f = rng.d(6);
        note(`The remains of a library (d6 ${d}): occult writings, a source for occult casters.`, "place");
        if (f === 6) fragment(state, rng, note, "Among the shelves (d6 6)");
      }
      break;
    case "barrow":
      a.name = "grave goods"; a.done = false; a.graveGoods = true;
      note(`Grave goods (d6 ${d}) lie with the dead. Taking them wakes what guards this place.`, "event");
      break;
    case "lost":
      if (d <= 3) { a.name = "occult writings"; site.sources = [...(site.sources || []), "occult writings"]; note(`Occult writings (d6 ${d}): a source for occult casters.`, "place"); }
      else if (d <= 5) { a.name = "a font"; site.sources = [...(site.sources || []), "font"]; note(`A font (d6 ${d}): a priscan source.`, "place"); }
      else { a.name = "an inscription"; a.inscription = true; a.done = false; note(`An inscription (d6 ${d}) in a script no one uses: a fragment of lost lore. Read, it also shows the way to the heart.`, "place"); }
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Traps (Skill Mastery, Thievery, Set Trap and Breaching)              */

const TRAP_TIERS = [["T2, Threatening", "2d3"], ["T3, Painful", "2d4"], ["T4, Injurious", "3d6"], ["T5, Treacherous", "4d8"]];
const TRAPS = [["a spiked pit", "puncturing", "restricted"], ["swinging blades", "cutting", "bleeding"], ["a poisoned needle", "piercing", "tainted"], ["a falling weight", "crushing", "impaired"]];
const RESIST_ATTR = { restricted: "strength", bleeding: "endurance", tainted: "endurance", impaired: "endurance" };

function trap(state, rng, note, site, a) {
  const [tierName, dmg] = TRAP_TIERS[site.band - 1 + (site.deep ? 1 : 0)];
  const [what, type, cond] = TRAPS[rng.d(4) - 1];
  const dc = dcs(site).hard;
  Object.assign(a, { trap: { what, type, cond, dc, dmg, tierName }, name: what });
  // The Scout leads; Alertness (Danger Sense) counters Set Trap: Dominance.
  const scout = alive(state).find(m => m.id === state.party.roles.scout) || best(state, "perception", "alertness");
  const sense = (scout.abilities || []).includes("Danger Sense") || skillOf(scout, "alertness") >= 2;
  if (a.foretold) {
    a.noticed = true; a.blocked = true;
    note(`A trap: ${what} (${tierName}), where the notes said it would be. Step around it, or disable it.`, "event");
    return;
  }
  const t = trial(rng, [dieOfTier(tier(scout, "perception")), dieOfTier(tier(scout, "perception"))], { edge: sense ? 1 : 0 });
  if (passes(t, dc)) {
    a.noticed = true; a.blocked = true;
    note(`A trap: ${what} (${tierName}). ${scout.name} spots it, Perception ${t.text} against ${dc}. Step around it, or disable it.`, "event");
    return;
  }
  note(`A trap: ${what} (${tierName}). ${scout.name} misses it, Perception ${t.text} against ${dc}.`, "event");
  spring(state, rng, note, a, scout);
}

/** The trap goes off on the first one through. */
function spring(state, rng, note, a, m) {
  const tr = a.trap;
  const raw = roll(rng, tr.dmg).total;
  const res = m.armor?.durability > 0 ? armorResist(m, tr.type) : 0;
  const hurt = Math.max(0, raw - res);
  m.hp = Math.max(0, m.hp - hurt);
  const r = rollFor(rng, m, RESIST_ATTR[tr.cond], null);
  const kept = !passes(r, tr.dc);
  note(`It springs on ${m.name}: ${tr.dmg} ${raw} ${tr.type}${res ? `, ${res} turned by armor` : ""}, ${hurt} damage (${m.hp}/${m.health}). ${cap(RESIST_ATTR[tr.cond])} ${r.text} against ${tr.dc}: ${kept ? `${cap(tr.cond)} 1` : "shrugs it off"}.`, "event");
  // TODO(conditions): Restricted, Bleeding, Tainted, and Impaired don't last outside a fight yet.
  if (kept) note(`(${cap(tr.cond)} outside a fight isn't tracked yet.)`, "todo");
  if (m.hp <= 0) { m.down = true; note(`${m.name} is down, and must be carried until they recover.`, "event"); }
  a.blocked = false; a.done = true; a.noticed = false;
  state.party.bankedXp += 3;
  note("Past the trap: 3 exploration XP, banked.");
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ */
/* The clock and the light (design/05-sites.md, The clock)              */

/** One or more exploration rounds pass. Every third burns a torch and rolls the clock. → false if a fight started. */
function tick(state, rng, note, rounds = 1) {
  const s = state.site;
  for (let i = 0; i < rounds; i++) {
    s.rounds += 1;
    s.minutes += MINUTES;
    if (s.minutes >= 60) { s.minutes -= 60; state.hoursUsed += 1; if (state.hoursUsed === 8) note("Outside, the day is over.", "day"); }
    if (s.torch > 0) { s.torch -= 1; if (!s.torch) light(state, note); }
    if (s.rounds % 3 === 0 && clock(state, rng, note)) return false;
  }
  return true;
}
function light(state, note) {
  const s = state.site;
  if (!siteDark(siteHere(state))) return;
  if (count(state, "Torch") > 0 || count(state, "Torch (Waterproof)") > 0) {
    take(state, count(state, "Torch") > 0 ? "Torch" : "Torch (Waterproof)", 1);
    s.torch = 3;
    note(`A torch is lit (${count(state, "Torch") + count(state, "Torch (Waterproof)")} left).`);
  } else { s.torch = 0; note("The last torch gutters out. You're in the dark.", "event"); }
}
/** Caves, barrows, and lost places are dark; a ruin's inner parts are too [N]. Lairs are dark if the creature's den is a hole. */
const siteDark = (site) => !!site && site.type !== "lair";
export const inDark = (state) => { const site = siteHere(state); return siteDark(site) && !(state.site?.torch > 0); };

/** The clock: on a 6 (5 or 6 after a fight) the residents come to see. → true if a fight started. */
export function clock(state, rng, note, { afterFight = false } = {}) {
  const site = siteHere(state);
  if (!site) return false;
  const d = rng.d(6);
  const come = d === 6 || (afterFight && d === 5);
  note(`The clock (d6 ${d}${afterFight ? ", after a fight" : ""}): ${come ? "something comes to see." : "nothing stirs."}`, come ? "event" : "");
  if (!come) return false;
  const g = residents(rng, site);
  note(`${groupText(g)} ${g.length === 1 && (g[0].count === 1) ? "comes" : "come"} looking.`, "event");
  fightHere(state, site, g, "residents", { distance: "Near" });
  return true;
}
function residents(rng, site) {
  const singles = site.entourage.find(x => x.count > 0);
  if (singles) { const n = Math.min(singles.count, rng.d(3)); singles.count -= n; return [{ name: singles.name, count: n }]; }
  return [{ name: rng.d(2) === 1 ? "Rat Swarm" : "Spider Swarm", heads: 6 }];
}

/* ------------------------------------------------------------------ */
/* Fights                                                               */

/** Open a fight in the site; journey.afterEvent starts the battle. */
function fightHere(state, site, group, kind, { distance = "Near", area = null } = {}) {
  const strongest = group.map(g => CREATURES[g.name]).filter(Boolean).sort((a, b) => b.division - a.division)[0];
  const head = kind === "heart" ? site.guardian.head : group.find(g => CREATURES[g.name] === strongest)?.name;
  const xp = kind === "heart" ? site.guardian.xp : xpFor(strongest?.division || 1);
  state.encounter = {
    head, text: groupText(group), temper: kind === "heart" ? site.guardian.temper : CREATURES[head]?.classification === "daeva" ? "Restless dead" : "Territorial",
    xp, division: strongest?.division || 1, band: site.band, terrain: squareAt(state.world, state.party.x, state.party.y).terrain,
    night: inDark(state), above: false, group, impaired: {}, distance, partyAware: true, creatureAware: true, toBattle: true,
    site: { kind, area, group }
  };
}

/** After a fight in a site: what was fought is gone, and the clock is rolled. */
export function afterFight(state, rng, note) {
  const f = state.lastFight;
  state.lastFight = null;
  const site = siteHere(state);
  if (!f?.site || !site) return;
  if (f.outcome === "won") {
    const a = f.site.area != null ? site.areas[f.site.area] : null;
    if (f.site.kind === "occupied" && a) { a.done = true; a.group = null; state.party.bankedXp += 2; note("The area is clear: 2 exploration XP, banked."); }
    if (f.site.kind === "heart") {
      site.headAlive = false;
      for (const x of site.areas) if (x.kind === "occupied" && x.group) { x.group = null; x.done = true; }
      site.entourage = [];
      note(`${site.guardian.head} is dead. The ${LABEL[site.type]} is yours.`, "reward");
      if (a) a.done = true;
    }
    if (!site.headAlive && site.hoard.taken) clearSite(state, site);
    if (state.party.members.some(m => !m.dead && m.hp > 0)) clock(state, rng, note, { afterFight: true });
  } else if (f.outcome === "fled") {
    note(`You flee the ${LABEL[site.type]}.`, "event");
    state.site = null;
  } else state.site = null;
}

/** The heart's fight: the guardian and every part of its group not yet fought. */
function heartGroup(site) {
  const g = [{ name: site.guardian.head, count: 1 }];
  for (const a of site.areas) if (a.kind === "occupied" && a.group) { g.push(...a.group); a.group = null; a.done = true; }
  for (const x of site.entourage) { if (x.count > 0) g.push({ name: x.name, count: x.count }); if (x.heads > 0) g.push({ name: x.name, heads: x.heads }); }
  site.entourage = [];
  return merge(g);
}

/** A hidden cache: one notable piece and a purse, with no guardian (design/04-the-map.md). */
export function takeCache(state, rng, note, place) {
  gain(state, notablePiece(rng, partyLevel(state)), note, "The cache");
  const purse = roll(rng, `${bandFor(partyLevel(state))}d6`).total;
  state.party.coin += purse;
  note(`And a purse: ${purse} sp.`, "reward");
  place.taken = true;
}

const clearSite = (state, site) => { site.cleared = true; site.clearedDay ??= state.day; };

/**
 * Coming back (design/05-sites.md): a month or more after it was cleared, a
 * d6 on 1–2 means something new has moved in, with a hoard worth half.
 * Rolled once for each month the site has stood empty.
 */
function restock(state, rng, note, site) {
  if (!site.cleared || state.day - (site.checkedDay ?? site.clearedDay) < 30) return;
  site.checkedDay = state.day;
  const d = rng.d(6);
  if (d > 2) { note(`The ${LABEL[site.type]} is as you left it (d6 ${d}).`); return; }
  const place = state.world.places[state.site.key];
  const g = rollGuardian(rng, state, site.type, site.band, { ...place, creature: null, text: null, group: null });
  Object.assign(site, { guardian: g, entourage: muster(rng, g), headAlive: true, cleared: false, clearedDay: null, questioned: false,
    hoard: { value: 20 * g.xp * (site.deep ? 2 : 1), taken: false, hidden: site.hoard.hidden } });
  for (const a of site.areas) if (a.kind === "occupied") { a.group = occupants(rng, site); a.done = false; }
  note(`Something new has moved in (d6 ${d}): ${g.text}. Its hoard is worth half the usual.`, "event");
}

/** A beaten guardian that can talk (no beast, nothing mindless: Intelligence 3 or more) can be made to (Skill Mastery, Presence, Interrogation): it rolls Charisma against the questioner's Presence Mastery DC. */
export const canQuestion = (site) => {
  const c = CREATURES[site.guardian.head];
  return !site.headAlive && !site.questioned && c && c.kingdom !== "beast" && c.rank !== "minion" && (c.attributes?.intelligence?.score || 0) >= 3;
};
function question(state, rng, note, site) {
  site.questioned = true;
  const c = CREATURES[site.guardian.head];
  const m = [...alive(state)].sort((a, b) => (skillOf(b, "presence") + tier(b, "charisma")) - (skillOf(a, "presence") + tier(a, "charisma")))[0];
  const dc = skillOf(m, "presence") + tier(m, "charisma");
  const t = creatureTrial(rng, c, "charisma");
  if (passes(t, dc)) { note(`${m.name} questions the last of them. ${site.guardian.head}, Charisma ${t.text} against ${m.name}'s Presence ${dc}: it tells you nothing.`); return; }
  note(`${m.name} questions the last of them. ${site.guardian.head}, Charisma ${t.text} against ${m.name}'s Presence ${dc}: it talks.`);
  clue(state, rng, note, "Under questioning");
}

/* ------------------------------------------------------------------ */
/* Going in, moving, and leaving                                        */

export function atSite(state) {
  const p = placeHere(state);
  return p && SITE_TYPES.includes(p.type) ? p : null;
}

export function enter(state, rng, note) {
  const place = atSite(state);
  if (!place || state.site) return;
  const site = place.site || makeSite(state, rng, place, note);
  state.site = { key: `${place.x},${place.y}`, at: 0, rounds: 0, minutes: 0, torch: 0 };
  note(`You go into the ${LABEL[site.type]}.`, "place");
  restock(state, rng, note, site);
  if (siteDark(site)) light(state, note);
  if (!site.areas.length) drawArea(state, rng, note, site, null);
  else note(`You know the way: ${site.areas.length} area${site.areas.length > 1 ? "s" : ""} drawn.`);
}

/** Squares between areas, by passages: how many rounds back to the entrance. */
function hops(site, from, to) {
  const seen = new Map([[from, 0]]), q = [from];
  while (q.length) { const x = q.shift(); if (x === to) return seen.get(x); for (const y of site.areas[x].links) if (!seen.has(y)) { seen.set(y, seen.get(x) + 1); q.push(y); } }
  return 0;
}

export function siteChoices(state) {
  const site = siteHere(state);
  if (!site || state.battle || state.encounter || state.over) return [];
  const a = site.areas[state.site.at];
  const list = [];
  const dark = inDark(state);
  if (a.kind === "occupied" && a.group) { list.push({ id: "fight", label: `Fight ${groupText(a.group)}` }); }
  if (a.kind === "heart" && site.headAlive) {
    list.push({ id: "heart", label: `Fight ${site.guardian.head}` });
  }
  if (a.kind === "heart" && !site.headAlive && !site.hoard.taken) list.push({ id: "hoard", label: "Take the hoard" });
  if (a.kind === "heart" && canQuestion(site)) list.push({ id: "question", label: "Question the last of them (Presence)" });
  if (a.graveGoods) list.push({ id: "graves", label: "Take the grave goods" });
  if (a.inscription) list.push({ id: "inscription", label: "Read the inscription (Lore)" });
  if (a.blocked && a.kind === "lock") { if (!a.broken) list.push({ id: "pick", label: "Pick the lock (Thievery)" }); list.push({ id: "force", label: "Force it (Strength; loud)" }); }
  if (a.blocked && a.obstacle) list.push({ id: "obstacle", label: `${cap(a.obstacle[1])} (${cap(a.obstacle[3])})` });
  if (a.blocked && a.noticed) { list.push({ id: "around", label: "Step around the trap" }); list.push({ id: "disarm", label: "Disable the trap (Thievery)" }); }
  const held = a.kind === "occupied" && a.group || (a.kind === "heart" && site.headAlive);
  if (!a.blocked && a.exits > 0 && !held) list.push({ id: "onward", label: dark ? "Go on into the dark (you need light)" : "Go on into the next area", disabled: dark });
  for (const id of a.links) list.push({ id: "goto", arg: id, label: `Go back to ${areaLabel(site.areas[id])}` });
  if (!a.searched && !held) list.push({ id: "search", label: "Search this area (Alertness)" });
  list.push({ id: "rest", label: "Rest here (a Dungeon Rest; the clock is rolled)" });
  list.push({ id: "leave", label: state.site.at === 0 ? "Leave" : `Leave (${hops(site, state.site.at, 0) + 1} rounds back out)` });
  return list;
}

export function siteAct(state, rng, note, id, arg) {
  const site = siteHere(state);
  if (!site) return;
  const s = state.site, a = site.areas[s.at];
  const { even, hard } = dcs(site);
  switch (id) {
    case "onward": {
      if (inDark(state) || a.blocked || !a.exits) return;
      if (!tick(state, rng, note)) return; // the residents got here first
      a.exits -= 1;
      const next = drawArea(state, rng, note, site, s.at);
      s.at = next.id;
      return;
    }
    case "goto": {
      if (!a.links.includes(arg)) return;
      s.at = arg;
      note(`Back to ${areaLabel(site.areas[arg])}.`);
      tick(state, rng, note);
      return;
    }
    case "fight": if (a.group) fightHere(state, site, a.group, "occupied", { area: a.id }); return;
    case "heart": {
      if (!site.headAlive) return;
      const g = heartGroup(site);
      note(`The guardian: ${groupText(g)}.`, "event");
      fightHere(state, site, g, "heart", { area: a.id });
      return;
    }
    case "hoard": if (a.kind === "heart" && !site.headAlive && !site.hoard.taken) { takeHoard(state, rng, note, site); clearSite(state, site); } return;
    case "question": if (canQuestion(site)) question(state, rng, note, site); return;
    case "graves": {
      a.graveGoods = false; a.done = true;
      gain(state, notablePiece(rng, partyLevel(state)), note, "Grave goods");
      if (site.headAlive) {
        note("The dead wake.", "event");
        const g = heartGroup(site);
        fightHere(state, site, g, "heart", { area: site.heart, distance: "Close" });
      }
      return;
    }
    case "inscription": {
      a.inscription = false; a.done = true;
      const f = fragment(state, rng, note, "The inscription, copied");
      if (f.read && site.heart == null) { site.size = site.areas.filter(x => !x.secret).length + 1; note("It also tells the way: the heart lies straight on.", "event"); }
      tick(state, rng, note);
      return;
    }
    case "pick": case "disarm": {
      if (id === "pick" && a.broken) return;
      const m = best(state, "intelligence", "thievery");
      const picks = count(state, "Thieves' Picks") > 0;
      const dc = (id === "pick" ? a.dc : a.trap.dc) + (a.worse || 0);
      const t = rollFor(rng, m, "intelligence", "thievery", { edge: picks ? 0 : -1 });
      const miss = dc - t.total;
      const what = id === "pick" ? "lock" : "trap";
      note(`${m.name} works the ${what}${picks ? "" : " with an improvised tool"}, Breaching ${t.text} against ${dc}.`);
      if (passes(t, dc)) {
        a.blocked = false; a.done = true; a.noticed = false; a.name = id === "pick" ? "an opened lock" : `${a.trap.what}, disabled`;
        state.party.bankedXp += 3;
        // Working Time (Skill Mastery): beating the DC by 0–1 takes 1d3 exploration rounds, by 2 1d2, by more, minutes.
        const by = t.total - dc, rounds = by <= 1 ? rng.d(3) : by === 2 ? rng.d(2) : 1;
        note(`It gives (${rounds} exploration round${rounds > 1 ? "s" : ""} of work). 3 exploration XP, banked.`, "reward");
        tick(state, rng, note, rounds);
        return;
      } else if (miss >= 7) {
        if (id === "pick") { a.broken = true; note("The lock breaks. Only force will open it now.", "event"); }
        else { note("It goes off.", "event"); spring(state, rng, note, a, m); }
      } else if (miss >= 5) { a.worse = (a.worse || 0) + 4; note("Jammed: +4 to the DC on a retry."); }
      else if (miss >= 3) { a.worse = (a.worse || 0) + 2; note("Damaged: +2 to the DC on a retry."); }
      else note("No luck yet.");
      tick(state, rng, note);
      return;
    }
    case "force": {
      const m = best(state, "strength", null);
      const t = rollFor(rng, m, "strength", null);
      note(`${m.name} puts a shoulder to it, Strength ${t.text} against ${hard}: ${passes(t, hard) ? "it bursts open" : "it holds"}. That was loud.`, "event");
      if (passes(t, hard)) { a.blocked = false; a.done = true; a.name = "a forced door"; state.party.bankedXp += 3; note("3 exploration XP, banked.", "reward"); }
      if (tick(state, rng, note)) clock(state, rng, note);
      return;
    }
    case "obstacle": {
      const [name, verb, attr, sk] = a.obstacle;
      const m = best(state, attr, sk);
      const t = rollFor(rng, m, attr, sk);
      const ok = passes(t, a.dc);
      note(`${m.name} tries to ${verb}, ${cap(sk)} ${t.text} against ${a.dc}: ${ok ? "the way is open" : "not this time"}.`, ok ? "reward" : "");
      if (ok) { a.blocked = false; a.done = true; a.name = `${name}, passed`; state.party.bankedXp += 3; note("3 exploration XP, banked."); }
      else if (name === "an unsound floor") {
        const hurt = rng.d(6);
        m.hp = Math.max(0, m.hp - hurt);
        note(`The floor gives under ${m.name}: ${hurt} damage (${m.hp}/${m.health}).`, "event");
        if (m.hp <= 0) m.down = true;
      }
      tick(state, rng, note);
      return;
    }
    case "around": {
      a.blocked = false; a.done = true; a.name = `${a.trap.what} (avoided)`;
      state.party.bankedXp += 3;
      note("You step around it, one at a time. 3 exploration XP, banked.", "reward");
      return;
    }
    case "search": {
      a.searched = true;
      if (!tick(state, rng, note)) return;
      const m = best(state, "perception", "alertness");
      const t = rollFor(rng, m, "perception", "alertness");
      if (!passes(t, hard)) { note(`${m.name} searches, Alertness ${t.text} against ${hard}: nothing.`); return; }
      const d = rng.d(6);
      if (d <= 3) note(`${m.name} searches, Alertness ${t.text} against ${hard}. Nothing hidden here (d6 ${d}).`);
      else if (d <= 5) { gain(state, notablePiece(rng, partyLevel(state)), note, `${m.name} finds hidden treasure (d6 ${d})`); state.party.bankedXp += 5; note("Hidden treasure: 5 exploration XP, banked."); }
      else {
        note(`${m.name} finds a secret door (d6 ${d}). Secret room: 20 exploration XP, banked.`, "reward");
        state.party.bankedXp += 20;
        const r = drawArea(state, rng, note, site, a.id, { secret: true });
        s.at = r.id;
      }
      return;
    }
    case "leave": {
      const back = hops(site, s.at, 0);
      if (back && !tick(state, rng, note, back)) return;
      note(`You come out of the ${LABEL[site.type]}${site.cleared ? ", and leave it empty behind you" : ""}.`, "place");
      state.site = null;
      return;
    }
  }
}

/** A Dungeon Rest inside: roll the clock instead of the night die. → true if residents came. */
export const restClock = (state, rng, note) => clock(state, rng, note);
