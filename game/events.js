/**
 * WHAT HAPPENED THERE (design/01-the-turn.md, step 4; design/02-encounters.md;
 * design/04-the-map.md, Discovery). Signs, Discoveries, and Encounters:
 * the terrain tables, contact, disposition, the party's choice, and escape.
 */
import { checkLevels } from "./advance.js";
import { roll } from "./rng.js";
import { trial, passes, tierOf, dieOfTier, RANK_DIE, countsAs } from "./mastery.js";
import { ENCOUNTERS } from "./data/encounters.js";
import { CREATURES } from "./data/creatures.js";
import { squareAt, countryAt, tileOf, getTile, TERRAINS } from "./world.js";
import { CLASS_XP } from "./vendor/foundry/module/data/chargen-data.mjs";
import { FURS } from "./vendor/foundry/module/data/treasure-data.mjs";

/* ------------------------------------------------------------------ */
/* Bands                                                                */

/** Lowest party level each creature Tier serves [Jon's guess, 2026-10-24]. */
const TIER_FROM = { 1: 1, 2: 3, 3: 4, 4: 7, 5: 10, 6: 15, 7: 20 };
/** Conscious characters: the ones who can keep watch, run, or fight. */
export const alive = (state) => state.party.members.filter(m => m.hp > 0 && !m.dead);
/** Everyone not dead, conscious or not. */
export const living = (state) => state.party.members.filter(m => !m.dead);
export function partyLevel(state) {
  const ms = living(state);
  return ms.length ? Math.floor(ms.reduce((n, m) => n + m.level, 0) / ms.length) : 1;
}
export const bandFor = (level) => level <= 2 ? 1 : level <= 5 ? 2 : 3;
export const ROMAN = { 1: "I", 2: "II", 3: "III" };
/** Default DCs by band (design/05-sites.md, from Mastery's Setting DCs). */
export const EVEN_DC = { 1: 4, 2: 5, 3: 7 };
export const HARD_DC = { 1: 6, 2: 6, 3: 9 };
const XP = { 1: 2, 2: 4, 3: 6, 4: 10, 5: 20, 6: 30, 7: 40, 8: 60, 9: 80, 10: 100, 11: 150, 12: 200, 13: 250 };
export const xpFor = (division) => XP[Math.min(13, division)] || 0;

export function aboveBand(name, level) {
  const c = CREATURES[name];
  if (!c) return false;
  return c.rank === "epic" || c.rank === "legendary" || (TIER_FROM[c.tier] ?? 99) > level;
}

/* ------------------------------------------------------------------ */
/* Characters and creatures                                             */

const attrTier = (m, a) => tierOf(m.attributes[a]);
const skill = (m, s) => m.skills?.[s] || 1;
export const speedOf = (m) => 3 + attrTier(m, "agility");
const SIZE_MOD = (sq) => sq < 1 ? -1 : sq < 2 ? 0 : sq < 4 ? 2 : sq < 6 ? 4 : sq < 9 ? 6 : 8;
export function creatureSpeed(c) {
  const agi = c.attributes?.agility?.tier || 2;
  return 3 + agi + SIZE_MOD(c.size.width * c.size.height) + (c.locomotion.includes("quadruped") ? 4 : 0);
}
/** A creature's trial dice: rank die + attribute tier die; minions roll d2 + creature Tier die. */
export function creatureTrial(rng, c, attr, opts = {}) {
  if (c.rank === "minion") return trial(rng, [[1, 2], dieOfTier(c.tier)], opts);
  return trial(rng, [dieOfTier(RANK_DIE[c.rank]), dieOfTier(c.attributes?.[attr]?.tier || 1)], opts);
}
const member = (state, id) => state.party.members.find(m => m.id === id && m.hp > 0);
function spotter(state, night) {
  const r = state.party.roles;
  return night ? member(state, r.watchman) : (member(state, r.scout) || member(state, r.watchman));
}

/* ------------------------------------------------------------------ */
/* Rolling on a terrain table                                           */

function context(state) {
  const w = state.weather;
  const [tx, ty] = tileOf(state.party.x, state.party.y);
  const places = Object.values(state.world.places || {});
  return {
    night: !!state.night,
    dusk: !!state.night || state.hoursUsed >= 6,
    fog: !!w?.lowVisibility,
    winter: (state.season || "") === "winter",
    autumn: (state.season || "") === "autumn",
    ruin: places.some(p => p.type === "ruin" && tileOf(p.x, p.y).join() === [tx, ty].join())
  };
}

/** Roll the terrain's table for a band. → { cell, opt, n, sign (if a condition turned it into a Sign) } */
export function rollTable(rng, state, terrain, band) {
  const n = roll(rng, "2d6").total;
  const cell = ENCOUNTERS[terrain][band][n];
  let opt = cell.options[0], d6 = null;
  if (cell.options.length > 1) { d6 = rng.d(6); opt = cell.options.find(o => d6 >= o.lo && d6 <= o.hi); }
  const ctx = context(state);
  let sign = false;
  if (opt.cond && !Object.keys(opt.cond).some(k => ctx[k])) {
    if (opt.otherwise) opt = opt.otherwise; else sign = true;
  }
  const temper = opt.temperBySeason ? (ctx.autumn ? opt.temperBySeason.autumn : opt.temperBySeason.other) : opt.temper;
  return { cell, opt: { ...opt, temper }, n, d6, sign };
}

const bandHere = (state) => {
  let band = bandFor(partyLevel(state));
  if (countryAt(state.world, state.party.x, state.party.y) === "deep") band = Math.min(3, band + 1);
  return band;
};
const terrainHere = (state) => squareAt(state.world, state.party.x, state.party.y).terrain;

/* ------------------------------------------------------------------ */
/* The event die's results                                              */

export function startSign(state, rng, note) {
  const band = bandHere(state), terrain = terrainHere(state);
  const r = rollTable(rng, state, terrain, band);
  if (r.opt.temper === "Prey" || !r.opt.head) {
    note(`Signs of game: ${r.opt.text}. A hunt, not a fight.`, "event");
    return;
  }
  state.sign = { head: r.opt.head, text: r.opt.text, temper: r.opt.temper, band, terrain, read: false, x: state.party.x, y: state.party.y };
  note(`Sign: something has passed this way (${TERRAINS[terrain].label}, Band ${ROMAN[band]}, 2d6 ${r.n}).`, "event");
}

export function startEncounter(state, rng, note, { night = false } = {}) {
  const band = bandHere(state), terrain = terrainHere(state), level = partyLevel(state);
  const r = rollTable(rng, state, terrain, band);
  const o = r.opt;
  const where = `${TERRAINS[terrain].label}, Band ${ROMAN[band]}, 2d6 ${r.n}${r.d6 ? `, d6 ${r.d6}` : ""}`;
  if (o.temper === "Prey" || !o.head) {
    note(`${night ? "In the night: " : ""}${o.text} (${where}). Prey: they flee. A hunt, not a fight, and no XP.`, "event");
    return;
  }
  const above = r.cell.signFirst || aboveBand(o.head, level);
  const following = state.following === o.head;
  if (r.sign || (above && !following)) {
    note(`${above ? "Something above your band" : "Something"} is near (${where}). It shows itself only as a Sign.`, "event");
    state.sign = { head: o.head, text: o.text, temper: o.temper, band, terrain, read: false, x: state.party.x, y: state.party.y, above };
    return;
  }
  const c = CREATURES[o.head];
  const e = {
    head: o.head, text: o.text, temper: o.temper, xp: o.xp, division: c.division, band, terrain, night, above, apex: r.cell.apex,
    group: o.group, impaired: {}
  };
  state.encounter = e;
  note(`${night ? "In the night: " : "Encounter: "}${o.text.replace(/\s*\[[^\]]*\]/g, "")} (${where}).`, "event");
  contact(state, rng, e, note);
  disposition(state, rng, e, note);
}

/* ------------------------------------------------------------------ */
/* Contact (design/02-encounters.md)                                    */

function contact(state, rng, e, note) {
  const c = CREATURES[e.head];
  if (e.above) {
    e.distance = "Far"; e.partyAware = true; e.creatureAware = false;
    note("It's beyond you, and you see it first, far off.", "event");
    return;
  }
  const s = spotter(state, e.night);
  let partyAware = false;
  if (s) {
    const per = dieOfTier(attrTier(s, "perception"));
    const edge = skill(s, "alertness") >= countsAs(c.division) ? 1 : 0;
    const t = trial(rng, [per, per], { edge });
    partyAware = passes(t, c.division + 1);
    note(`${s.name} (${e.night ? "Watchman" : s.id === state.party.roles.scout ? "Scout" : "Watchman"}), Perception ${t.text} against ${c.division + 1}: ${partyAware ? "sees it" : "misses it"}.`);
  } else note("No one is keeping watch.");
  const quiet = !e.night && state.party.quiet && state.party.pace === "slow";
  const dc = quiet ? Math.max(...alive(state).map(m => m.stealthDC || 0), 4) : 4;
  const ct = creatureTrial(rng, c, "perception");
  const creatureAware = passes(ct, dc);
  note(`${e.head}, Perception ${ct.text} against ${dc}${quiet ? " (you're moving quietly)" : ""}: ${creatureAware ? "notices you" : "doesn't notice you"}.`);
  e.partyAware = partyAware; e.creatureAware = creatureAware;
  e.distance = partyAware && creatureAware ? "Far" : partyAware ? "Far" : creatureAware ? "Close" : "Near";
  if (!partyAware && !creatureAware) {
    note("You walk into each other. Both sides make Startle trials (DC 6).", "event");
    startle(state, rng, 6, note, e);
    e.enemyStartle = 6;
  }
}

/** Startle trials: Agility tier die + Perception tier die (Combat, Startle and Ambush). */
function startle(state, rng, dc, note, e, { ambush = false } = {}) {
  for (const m of alive(state)) {
    // Danger Sense (Alertness): sensing the ambush as it's sprung means no Startle.
    if (ambush && (m.abilities || []).includes("Danger Sense")) {
      const t = trial(rng, [dieOfTier(attrTier(m, "perception")), dieOfTier(skill(m, "alertness"))]);
      if (passes(t, dc)) { note(`${m.name} senses it coming (Danger Sense, ${t.text} against ${dc}) and isn't Startled.`); e.impaired[m.id] = 0; continue; }
    }
    const t = trial(rng, [dieOfTier(attrTier(m, "agility")), dieOfTier(attrTier(m, "perception"))]);
    const miss = dc - t.total;
    e.impaired[m.id] = passes(t, dc) ? 0 : miss >= 5 ? 3 : miss >= 3 ? 2 : 1;
    const result = passes(t, dc) ? "keeps their head" : miss >= 5 ? "is Paralyzed (Impaired 3)" : miss >= 3 ? "is Stunned (Impaired 2)" : "is Dazed (Impaired 1)";
    note(`${m.name}: Startle ${t.text}, ${result}.`);
  }
}

/* ------------------------------------------------------------------ */
/* Disposition                                                          */

const STRANGE = {
  "Magpie": { mood: "talk", text: "It wants to talk, and to trade. It fights only to keep what it holds." },
  "Eidolon of the Hunt": { mood: "attack", text: "It hunts. Running is what it wants." },
  "Shadow-Man": { mood: "watch", text: "It watches from the dark, waiting for someone to be alone or still." }
};

function disposition(state, rng, e, note) {
  const d = rng.d(6);
  let mood, text;
  switch (e.temper) {
    case "Predator":
      [mood, text] = d <= 2 ? ["watch", "Fed: it watches and keeps its distance."] : d <= 4 ? ["stalk", "Testing: it stalks you, looking for someone alone, wounded, or asleep."] : ["attack", "Hungry: it attacks."];
      break;
    case "Territorial":
      [mood, text] = d <= 3 ? ["warn", "Warning: it makes a display. Leave and it lets you go."] : d <= 5 ? ["defend", "Defending: it attacks if you come closer or stay."] : ["attack", "Enraged: it attacks now."];
      break;
    case "Raider":
      [mood, text] = d <= 2 ? ["toll", "Toll: they demand payment, and will fight if refused."] : d <= 4 ? ["wait", e.creatureAware && !e.partyAware ? "Lying in wait: they've set an ambush ahead." : "Lying in wait: you've spotted their ambush."] : ["attack", "They attack."];
      break;
    case "Restless dead": mood = "attack"; text = "The dead attack anything living on their ground."; break;
    case "Guardian": mood = "guard"; text = "It guards its place, and is hostile only to trespass or harm."; break;
    case "Patrol": mood = "question"; text = "They want to know who you are and what you're carrying."; break;
    default: ({ mood, text } = STRANGE[e.head] || { mood: "watch", text: "It does what its nature says." });
  }
  e.mood = mood;
  note(`Disposition${["Restless dead", "Guardian", "Patrol", "Strange"].includes(e.temper) ? "" : ` (d6 ${d})`}: ${text}`, "event");
  // An ambush: it noticed you first, you didn't notice it, and it means to attack.
  if (["attack", "wait"].includes(mood) && e.creatureAware && !e.partyAware) {
    const c = CREATURES[e.head];
    note(`${c.abilities.includes("Ambusher") ? "An Ambusher in its element" : "They set an ambush"}: Startle trials against ${c.division + 1}.`, "event");
    startle(state, rng, c.division + 1, note, e, { ambush: true });
    e.ambushed = true;
  }
  if (e.temper === "Raider" && mood === "toll") e.toll = e.xp * 5 * alive(state).length;
}

/* ------------------------------------------------------------------ */
/* The party's choice                                                   */

export function choices(state) {
  const e = state.encounter;
  if (!e || e.toBattle || state.battle) return [];
  const list = [];
  const calm = !e.creatureAware || ["watch", "warn", "defend", "guard", "question", "talk", "stalk"].includes(e.mood);
  if (e.mood === "wait" && e.partyAware) list.push({ id: "avoid", label: "Go around their ambush" });
  else if (calm && !e.ambushed) list.push({ id: "avoid", label: "Leave it be" });
  if (e.mood === "toll") list.push({ id: "toll", label: `Pay the toll (${e.toll} sp)` });
  if (e.mood === "question") list.push({ id: "answer", label: "Answer their questions" });
  if (e.mood === "talk") list.push({ id: "talk", label: "Talk" });
  if (e.temper === "Predator" && ["attack", "stalk"].includes(e.mood)) list.push({ id: "food", label: "Leave it food" });
  if (e.temper === "Raider" && ["attack", "wait"].includes(e.mood)) list.push({ id: "purse", label: "Throw them your coin" });
  list.push({ id: "fight", label: "Fight" });
  if (!calm || e.ambushed || e.mood === "toll") list.push({ id: "flee", label: "Run" });
  return list;
}

export function choose(state, rng, id, note) {
  const e = state.encounter;
  if (!e) return;
  switch (id) {
    case "avoid": note("You leave it be and go on your way."); end(state); break;
    case "answer": note("You answer their questions, and they let you pass."); end(state); break;
    case "talk": note("You talk. (Conversation with strange things comes later; for now it lets you go.)", "todo"); end(state); break;
    case "toll":
      if (state.party.coin < e.toll) { note(`You have only ${state.party.coin} sp. They want ${e.toll}.`); return; }
      state.party.coin -= e.toll; note(`You pay ${e.toll} sp, and they let you pass.`); end(state); break;
    case "purse":
      note(`You throw them your coin (${state.party.coin} sp), and they let you go.`); state.party.coin = 0; end(state); break;
    case "food":
      // TODO(party): rations are milestone 3; this should cost a day's rations for each creature hunting.
      note("You leave it food, and it takes that instead of you. (Rations are tracked from milestone 3.)", "todo"); end(state); break;
    case "fight": fight(state, rng, note); break;
    case "flee": flee(state, rng, note); break;
  }
}

/** The fight itself is combat.js; journey.afterEvent opens it. */
function fight(state, rng, note) {
  state.encounter.toBattle = true;
}

/* ------------------------------------------------------------------ */
/* Escape: the chase (design/02-encounters.md)                          */

const CHASE_SKILLS = [
  { skill: "wilderness", attr: "perception", label: "lose it in the country (Wilderness)" },
  { skill: "stealth", attr: "physique", label: "hide (Stealth)" },
  { skill: "athletics", attr: "agility", label: "outrun it (Athletics)" }
];

function flee(state, rng, note) {
  const carrying = living(state).some(m => m.hp <= 0 || cannotRun(m));
  if (chase(state, rng, state.encounter.head, note, alive(state).filter(m => !cannotRun(m)), { carrying })) end(state);
  else caught(state, rng, note);
}

/** Traumas that take away a character's legs (no crutches are tracked yet, so they're carried). */
export const cannotRun = (m) => (m.traumas || []).some(t => /Broken Back|Lose your (left|right) foot|Break your (left|right) leg/.test(t.name));

/** The runner, the Helper, and the edge: speed against the slowest runner, Impotence while carrying anyone. */
function chaseSetup(head, ms, carrying) {
  const c = CREATURES[head];
  const best = CHASE_SKILLS.map(k => {
    const leader = [...ms].sort((a, b) => (skill(b, k.skill) + attrTier(b, k.attr)) - (skill(a, k.skill) + attrTier(a, k.attr)))[0];
    const helper = ms.find(m => m !== leader && skill(m, k.skill) >= 2);
    return { ...k, leader, helper, score: skill(leader, k.skill) + attrTier(leader, k.attr) + (helper ? 2 : 0) };
  }).sort((a, b) => b.score - a.score)[0];
  const slowest = Math.min(...ms.map(speedOf)), theirs = creatureSpeed(c);
  const edge = Math.sign((theirs > slowest ? -1 : theirs < slowest ? 1 : 0) + (carrying ? -1 : 0));
  return { best, slowest, theirs, edge, dc: c.division + 1 };
}
function chaseTrial(rng, k) {
  return trial(rng, [dieOfTier(attrTier(k.best.leader, k.best.attr)), dieOfTier(skill(k.best.leader, k.best.skill))], { edge: k.edge, bonus: k.best.helper ? 2 : 0 });
}
const eidolon = (head, note) => {
  if (head !== "Eidolon of the Hunt") return false;
  note("You run. Running is what the Eidolon of the Hunt is for. It catches you.", "event");
  return true;
};

/** Breaking away from a fight: one trial, one round [Jon, 2026-10-24]. → true if the party gets clear enough to tend its dying. */
export function breakAway(state, rng, head, note, ms, { carrying = false } = {}) {
  if (eidolon(head, note) || !ms.length) return false;
  const k = chaseSetup(head, ms, carrying);
  const t = chaseTrial(rng, k);
  const ok = passes(t, k.dc);
  note(`You break away, trying to ${k.best.label}. ${k.best.leader.name} leads${k.best.helper ? `, ${k.best.helper.name} helps` : ""}${carrying ? ", carrying the fallen" : ""}. Its speed ${k.theirs}, your slowest ${k.slowest}. ${t.text} against ${k.dc}: ${ok ? "you get clear" : "they're still on you"}.`, "event");
  return ok;
}

/** The chase: three successes before two failures. → true if the party gets away. */
export function chase(state, rng, head, note, ms = alive(state), { carrying = false } = {}) {
  if (eidolon(head, note) || !ms.length) return false;
  const k = chaseSetup(head, ms, carrying);
  note(`You run, trying to ${k.best.label}. ${k.best.leader.name} leads${k.best.helper ? `, ${k.best.helper.name} helps` : ""}${carrying ? ", carrying the fallen" : ""}. Its speed ${k.theirs}, your slowest ${k.slowest}.`, "event");
  let ok = 0, bad = 0;
  while (ok < 3 && bad < 2) {
    const t = chaseTrial(rng, k);
    const p = passes(t, k.dc);
    p ? ok++ : bad++;
    note(`${t.text} against ${k.dc}: ${p ? "you gain ground" : "it gains on you"}.`);
  }
  note(ok >= 3 ? "You get away." : "It catches you.", "event");
  return ok >= 3;
}

function caught(state, rng, note) {
  const e = state.encounter;
  note("The fight starts at close quarters. You saw it coming, so no one is Startled.");
  e.impaired = {}; e.enemyStartle = 0; e.distance = "Close";
  fight(state, rng, note);
}

/* ------------------------------------------------------------------ */
/* Rewards                                                              */

export function awardCombatXp(state, xp, note, rng) {
  if (!xp) return;
  for (const m of living(state)) m.xp += xp;
  note(`Each character earns ${xp} XP.`, "reward");
  checkLevels(state, note, rng);
}


const PELTS = { "Wolf": "Wolf", "Bear": null, "Black Bear": "Bear, Black", "Brown Bear": "Bear, Brown", "Cave Bear": "Bear, Brown", "Boar": "Boar / Pig", "War Boar": "Boar / Pig",
  "Mountain Lion": "Cougar", "Lion": "Lion", "Tiger": "Tiger", "Deer": "Deer", "Elk": "Moose / Elk", "Wild Dog": "Dog" };
const peltFor = (name) => PELTS[name] ?? (/^Wolf/.test(name) ? "Wolf" : null);

export function spoils(state, rng, e, note) {
  const c = CREATURES[e.head];
  if (c.classification === "mortal" && c.kingdom === "folk") {
    const n = Math.max(1, c.division);
    const purse = roll(rng, `${n}d6`).total;
    state.party.coin += purse;
    note(`Spoils: the leader's purse, ${purse} sp (${n}d6).`, "reward");
  } else if (peltFor(e.head)) {
    const fur = FURS.find(f => f.name === peltFor(e.head));
    const q = rng.d(10);
    const quality = q <= 3 ? "poor" : q <= 9 ? "average" : "pristine";
    state.party.pelts.push({ name: fur.name, quality, value: fur[quality], weight: fur.weights.fresh });
    note(`Spoils: a ${quality} ${fur.name.toLowerCase()} pelt (d10 ${q}), worth ${fur[quality]} sp, ${fur.weights.fresh} lb fresh.`, "reward");
  }
}

function end(state) {
  state.encounter = null;
}

/* ------------------------------------------------------------------ */
/* Signs                                                                */

export function signChoices(state) {
  const s = state.sign;
  if (!s) return [];
  const list = [];
  if (!s.read) list.push({ id: "read", label: "Read the signs" });
  list.push({ id: "follow", label: "Follow the trail" });
  list.push({ id: "leave", label: "Leave them" });
  return list;
}

export function chooseSign(state, rng, id, note) {
  const s = state.sign;
  if (!s) return;
  const scout = member(state, state.party.roles.scout) || alive(state)[0];
  const dc = EVEN_DC[s.band] + (countryAt(state.world, state.party.x, state.party.y) === "deep" ? 2 : 0);
  const dice = [dieOfTier(attrTier(scout, "perception")), dieOfTier(skill(scout, "alertness"))];
  if (id === "leave") { note("You leave the signs alone."); state.sign = null; return; }
  if (id === "read") {
    const t = trial(rng, dice);
    if (passes(t, dc)) { s.read = true; note(`${scout.name} reads the signs, ${t.text} against ${dc}: ${s.text}.`, "event"); }
    else { s.read = true; s.unread = true; note(`${scout.name} can't make sense of them, ${t.text} against ${dc}.`); }
    return;
  }
  if (id === "follow") {
    const t = trial(rng, dice);
    if (!passes(t, dc)) { note(`${scout.name} loses the trail, ${t.text} against ${dc}.`); state.sign = null; return; }
    const dist = rng.d(6), dir = rng.d(8);
    const [dx, dy] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]][dir - 1];
    const x = state.party.x + dx * dist, y = state.party.y + dy * dist;
    placeOn(state, x, y, { type: "lair", creature: s.head, text: s.text });
    state.target = { x, y };
    state.following = s.head;
    note(`${scout.name} follows the trail, ${t.text} against ${dc}. It leads ${dist} squares ${["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][dir - 1]}, to a lair. It's marked on the map.`, "event");
    state.sign = null;
  }
}

/* ------------------------------------------------------------------ */
/* Discovery (design/04-the-map.md)                                     */

const SOURCE = { forest: "sacred site", swamp: "sacred site", hills: "font", mountains: "font", plains: "holy site", desert: "holy site" };
const FORMS = ["Fire", "Sea", "Sky", "Stone", "Primal", "Sacred"];

export function placeOn(state, x, y, place) {
  state.world.places ??= {};
  const k = `${x},${y}`;
  if (state.world.places[k]) return state.world.places[k];
  state.world.places[k] = { ...place, x, y, day: state.day };
  return state.world.places[k];
}

export function discover(state, rng, note, forced = null) {
  const n = forced ?? rng.d(12);
  if (n === 12) { note("Discovery (d12 12): two things."); discover(state, rng, note, rng.d(11)); discover(state, rng, note, rng.d(11)); return; }
  const sq = squareAt(state.world, state.party.x, state.party.y);
  const terrain = sq.terrain;
  const at = (type, extra = {}) => placeOn(state, state.party.x, state.party.y, { type, ...extra });
  let text;
  switch (n) {
    case 1: at("landmark"); text = "a landmark: a standing stone, a great tree, a lone height. From now on the Navigator has Dominance on Orienteering in this tile"; break;
    case 2: {
      const r = rollTable(rng, state, terrain, bandHere(state));
      at("camp", { creature: r.opt.head });
      text = `a cold camp, left by ${r.opt.text.replace(/\s*\[[^\]]*\]/g, "")}. They left a few coins behind`;
      if (r.opt.head) { const p = roll(rng, `${Math.max(1, CREATURES[r.opt.head].division)}d6`).total; state.party.coin += p; text += ` (${p} sp)`; }
      break;
    }
    case 3: at("ground"); text = "good ground: game and forage are plentiful here"; break;
    case 4: {
      const f = rng.d(8);
      const forms = f === 8 ? [FORMS[rng.d(6) - 1], ["Void", "Profane"][rng.d(2) - 1]] : f === 7 ? [["Void", "Profane"][rng.d(2) - 1]] : [FORMS[f - 1]];
      at("source", { kind: SOURCE[terrain], forms });
      text = `a spell source: a ${SOURCE[terrain]} of ${forms.join(" and ")}`;
      break;
    }
    case 5: {
      const r = rollTable(rng, state, terrain, bandHere(state));
      at("lair", { creature: r.opt.head, text: r.opt.text });
      text = `a lair: the home of ${r.opt.text.replace(/\s*\[[^\]]*\]/g, "")}`;
      break;
    }
    case 6: at("cave"); text = "a cave"; break;
    case 7: at("ruin"); text = "a ruin"; break;
    case 8: at("barrow"); text = "a barrow, an old grave mound"; break;
    case 9: {
      const [tx, ty] = tileOf(state.party.x, state.party.y);
      const tile = getTile(state.world, tx, ty);
      if (!tile.settlement && !sq.road) {
        const lx = ((state.party.x % 6) + 6) % 6, ly = ((state.party.y % 6) + 6) % 6;
        tile.settlement = { size: "hamlet", lx, ly };
        text = "a hamlet, off any road";
      } else { at("ruin"); text = "a ruin"; }
      break;
    }
    default: return discover(state, rng, note, 4 + rng.d(4));
  }
  state.party.bankedXp += 10;
  note(`Discovery (d12 ${n}): ${text}. New Location: 10 XP, banked until you reach safety.`, "event");
}
