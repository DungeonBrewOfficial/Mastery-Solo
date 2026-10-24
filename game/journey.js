/**
 * THE TURN (design/01-the-turn.md): the day, the travel die, moving, the
 * event die, and camp. Everything here works on a plain state object that is
 * saved as JSON, and every roll goes through the state's seeded dice.
 */
import { makeRng, roll, total } from "./rng.js";
import { startDynasty, generateTile, getTile, tileOf, squareAt, moveCost, countryAt, findPath, TILE, TERRAINS } from "./world.js";
import { PACES } from "./vendor/foundry/module/helpers/travel-rules.mjs";
import { WEATHER_TABLES } from "./vendor/foundry/module/data/weather-data.mjs";
import { PREGENS } from "./data/party.js";
import { startSign, startEncounter, discover, alive, living } from "./events.js";
import { startBattle } from "./combat.js";
import { tierOf, dieOfTier } from "./mastery.js";
import { rowFor, weatherFrom, BAND_LABELS } from "./vendor/foundry/module/helpers/weather-rules.mjs";
import { effectiveRest, recoveryFor, exhaustedAfter, classUpgrades, REST_LABELS } from "./vendor/foundry/module/helpers/rest-rules.mjs";
import { ensureAdvancement, checkLevels } from "./advance.js";
import { ensureStores, morningSupplies, eveningSupplies, refill, exhaustFloor, outfit, treatInjuries, treatTraumas, repairGear } from "./supplies.js";
import { restDay, hardToKillDay, ensureTrauma } from "./health.js";
import { rumorAtInn, rumorHere } from "./town.js";
import { atSite, makeSite, enter, siteAct, afterFight, restClock, takeCache } from "./sites.js";
import { leadsHere, search, leadText, arriveGuided } from "./leads.js";
import { maybeHart } from "./hart.js";

export const DAY_HOURS = 8;
export const SEASONS = ["spring", "summer", "autumn", "winter"];
export const seasonOf = (day) => SEASONS[Math.floor((day - 1) / 91) % 4];
/** Squares per hour: a square is an hour at Slow pace, and pace multiplies it. */
export const squaresPerHour = (pace) => PACES[pace].mult * 2;

/* ------------------------------------------------------------------ */

export function newGame(seed = Math.floor(Math.random() * 2 ** 31)) {
  const rng = makeRng(seed);
  const world = startDynasty(rng);
  const state = {
    version: 1, seed, rngState: 0,
    world,
    party: {
      x: 3, y: 3, pace: "normal", carry: 0, quiet: false,
      members: PREGENS.map(p => { const m = { ...structuredClone(p), hp: p.health, mp: p.magan }; if (m.companion) m.companion.hp = m.companion.health; return m; }),
      roles: { scout: "hamon", watchman: "gerberga", forager: "corra", cook: "gisla", healer: "corra", smith: null },
      coin: 450 + 160 + 193 + 284,
      pelts: [],
      bankedXp: 0
    },
    encounter: null, sign: null, following: null, campDue: false, night: false, season: "spring",
    day: 1, hoursUsed: 0, morningDone: false, pushed: false,
    weather: null, target: null, pending: null,
    log: []
  };
  ensureStores(state);
  outfit(state);
  for (const m of state.party.members) ensureAdvancement(m);
  note(state, `A new dynasty begins (seed ${seed}).`, "title");
  for (const line of world.log) note(state, line, "map");
  world.log = [];
  state.rngState = rng.state;
  return state;
}

export function note(state, text, kind = "") {
  state.log.push({ day: state.day, text, kind });
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}

/** Run fn with the state's dice, then store where the dice left off. */
function withDice(state, fn) {
  const rng = makeRng(0);
  rng.state = state.rngState;
  const out = fn(rng);
  state.rngState = rng.state;
  return out;
}

/* ------------------------------------------------------------------ */
/* Morning                                                              */

function rollWeather(rng, day) {
  const season = seasonOf(day);
  const tables = WEATHER_TABLES[season];
  const d20 = rng.d(20);
  let row = rowFor(tables.normal, d20), extreme = false, d100 = null;
  if (row?.extreme) { d100 = rng.d(100); row = rowFor(tables.extreme, d100); extreme = true; }
  const temp = roll(rng, row.temp).total;
  const wind = roll(rng, row.wind).total;
  const precipAmount = row.precipRoll ? roll(rng, row.precipRoll).total : null;
  const duration = row.durationRoll ? roll(rng, row.durationRoll).total : null;
  const w = weatherFrom(row, { temp, wind, precipAmount, duration, season, extreme });
  w.roll = extreme ? `d20 ${d20}, extreme d100 ${d100}` : `d20 ${d20}`;
  return w;
}

/** Daily weather trial DC [Jon, 2026-10-24]: 4 for Cold or Hot, 5 for Extreme. */
export const weatherDC = (band) => (band === "cold" || band === "hot") ? 4 : (band === "extremeCold" || band === "extremeHeat") ? 5 : null;

function morning(state, rng) {
  state.season = seasonOf(state.day);
  const w = rollWeather(rng, state.day);
  state.weather = w;
  state.morningDone = true;
  const bits = [`${w.name}, ${w.temp}°F (${BAND_LABELS[w.band]})`];
  if (w.windy) bits.push(`wind ${w.wind} mph`);
  if (w.wet) bits.push(w.precip || "wet");
  note(state, `Day ${state.day}, ${seasonOf(state.day)}. Weather (${w.roll}): ${bits.join(", ")}.`, "day");
  morningSupplies(state, rng, (t, k) => note(state, t, k), state.indoors || state.site ? null : weatherDC(w.band));
}

/* ------------------------------------------------------------------ */
/* Travel                                                               */

export function setTarget(state, x, y) {
  if (x === state.party.x && y === state.party.y) { state.target = null; return; }
  const sq = squareAt(state.world, x, y);
  if (sq && !Number.isFinite(moveCost(sq))) { note(state, "You can't go there."); return; }
  state.target = { x, y };
}

export function setPace(state, pace) {
  if (PACES[pace]) state.party.pace = pace;
}

/**
 * One leg: roll the travel die, move, roll the event die (design/01-the-turn.md).
 * If the die runs past the end of the day, the leg waits for a choice:
 * travelLeg(state, "stop") or travelLeg(state, "push").
 */
export function travelLeg(state, choice = null) {
  if (state.encounter || state.sign || state.over) return state;
  if (state.site) { note(state, "Leave the site first."); return state; }
  if (state.pending?.type === "nightfall" && !choice) return state;
  if (!state.target && !state.pending) { note(state, "Choose where to go: click the map."); return state; }
  const down = state.party.members.filter(m => !m.dead && m.collapsed);
  if (down.length) { note(state, `${down.map(m => m.name).join(" and ")} can't go on. Make camp.`, "event"); return state; }
  withDice(state, (rng) => {
    if (!state.morningDone) morning(state, rng);
    let hours;
    if (state.pending?.type === "nightfall") {
      const p = state.pending;
      state.pending = null;
      if (choice === "push") { hours = p.hours; state.pushed = true; note(state, `You push on into the night: ${hours} hours.`); }
      else { hours = p.remaining; note(state, `You travel the last ${hours} hour${hours === 1 ? "" : "s"} of daylight.`); }
    } else {
      hours = rng.d(6);
      const remaining = DAY_HOURS - state.hoursUsed;
      if (hours > remaining) {
        state.pending = { type: "nightfall", hours, remaining };
        note(state, `Travel die ${hours}, but only ${remaining} hour${remaining === 1 ? "" : "s"} of the day ${remaining === 1 ? "is" : "are"} left. Stop at nightfall, or push on?`, "choice");
        return;
      }
      note(state, `Travel die ${hours}: ${hours} hour${hours === 1 ? "" : "s"} on the road.`);
    }
    move(state, rng, hours);
    afterHours(state, rng, hours);
  });
  return state;
}

/** The hours of a leg are spent: Open Wounds bleed, the pace is counted, the event die, and camp at day's end. */
function afterHours(state, rng, hours) {
  state.hoursUsed += hours;
  // An Open Wound loses 1 health every hour until the bleeding is stopped (Trauma Table).
  for (const m of state.party.members.filter(x => !x.dead && x.hp > 0 && (x.traumas || []).some(t => t.name === "Open Wound" && !t.treated))) {
    const was = m.hp; m.hp = Math.max(0, m.hp - hours);
    note(state, `${m.name}'s open wound bleeds: ${was} → ${m.hp} health.`, "event");
    if (!m.hp) { m.collapsed = true; note(state, `${m.name} collapses from the bleeding.`, "event"); }
  }
  const h = state.party.hours;
  h.total += hours;
  if (state.party.pace === "fast") h.fast += hours;
  if (state.party.pace === "marathon") h.marathon += hours;
  eventDie(state, rng);
  if (state.hoursUsed >= DAY_HOURS) {
    if (state.encounter || state.sign) state.campDue = true;
    else camp(state, rng);
  }
}

/**
 * A leg spent searching the tile a lead points to (design/04-the-map.md):
 * the travel die for the hours, no movement, and the event die as usual.
 */
export function searchLeg(state) {
  if (state.encounter || state.sign || state.over || state.site || state.pending || state.battle) return state;
  if (!leadsHere(state).length) { note(state, "Nothing points here. Without a lead there's nothing to search for."); return state; }
  const down = state.party.members.filter(m => !m.dead && m.collapsed);
  if (down.length) { note(state, `${down.map(m => m.name).join(" and ")} can't go on. Make camp.`, "event"); return state; }
  withDice(state, (rng) => {
    const say = (t, k) => note(state, t, k);
    if (!state.morningDone) morning(state, rng);
    const left = DAY_HOURS - state.hoursUsed;
    if (left <= 0) { camp(state, rng); return; }
    const hours = Math.min(rng.d(6), left);
    note(state, `You spend ${hours} hour${hours === 1 ? "" : "s"} searching.`);
    const place = search(state, rng, say);
    if (place?.type === "cache") takeCache(state, rng, say, place);
    else if (place) makeSite(state, rng, place, say);
    afterHours(state, rng, hours);
  });
  return state;
}

function move(state, rng, hours) {
  const p = state.party;
  let mp = hours * squaresPerHour(p.pace) + p.carry;
  let moved = 0;
  let path = findPath(state.world, p, state.target);
  if (!path) { note(state, "There's no way through to there."); state.target = null; p.carry = 0; return; }
  while (path.length) {
    const next = path[0];
    const [tx, ty] = tileOf(next.x, next.y);
    if (!getTile(state.world, tx, ty)) {
      const [fx, fy] = tileOf(p.x, p.y);
      const { tile, log } = generateTile(rng, state.world, tx, ty, getTile(state.world, fx, fy));
      note(state, `You come into new country: ${TERRAINS[tile.terrain].label.toLowerCase()}.`, "map");
      for (const line of log) note(state, line, "map");
      path = findPath(state.world, p, state.target);
      if (!path) { note(state, "There's no way through to there."); state.target = null; break; }
      continue;
    }
    const cost = moveCost(squareAt(state.world, next.x, next.y));
    if (cost > mp) break;
    mp -= cost;
    p.x = next.x; p.y = next.y;
    if (nearWater(state, p.x, p.y)) p.waterToday = true;
    rumorHere(state, rng, (t, k) => note(state, t, k));
    moved++;
    path.shift();
    if (state.target && p.x === state.target.x && p.y === state.target.y) { state.target = null; break; }
  }
  // Movement that can't be spent carries over to the next leg the same day [Jon, 2026-10-24].
  p.carry = mp;
  note(state, moved ? `You cover ${moved} square${moved === 1 ? "" : "s"}${mp ? ` (${mp} movement carried over)` : ""}.` : `The ground is too hard going to gain a square (${mp} movement carried over).`);
  const sq = squareAt(state.world, p.x, p.y);
  if (sq?.settlement) {
    note(state, `You reach a ${sq.settlement.home ? "home village" : sq.settlement.size}.`, "place");
    refill(state, (t, k) => note(state, t, k), sq.settlement.home ? "home village" : sq.settlement.size);
    state.visitId = (state.visitId || 0) + 1; // a new visit: new recruits, a fresh look at the market
    reachSafety(state, rng);
  }
  const guided = arriveGuided(state, (t, k) => note(state, t, k));
  if (guided?.type === "cache") takeCache(state, rng, (t, k) => note(state, t, k), guided);
  else if (guided) makeSite(state, rng, guided, (t, k) => note(state, t, k));
  const leads = leadsHere(state, (t, k) => note(state, t, k));
  if (leads.length) note(state, `You're where a lead points: ${leads.map(leadText).join(" and ")}. Spend a leg searching.`, "place");
  const place = state.world.places?.[`${p.x},${p.y}`];
  if (atSite(state)) {
    const say = (t, k) => note(state, t, k);
    note(state, `You stand at the ${place.type}${place.creature ? ` of ${place.creature}` : ""}${place.site?.cleared ? ", empty now" : ""}.`, "place");
    if (!place.site) makeSite(state, rng, place, say);
  }
}

/**
 * Stay a day in a settlement (General Rules, Resting): a Civilized Rest
 * needs a day in a town or city; Bed Rest a day in bed at an inn or a
 * dwelling. The day costs lodging and two meals, and counts as a day's rest.
 */
export function stay(state, kind) {
  const sq = squareAt(state.world, state.party.x, state.party.y);
  if (state.pending || state.encounter || state.sign || state.over || !sq?.settlement || state.hoursUsed) return state;
  if (kind === "civilized" && !["town", "city", "metropolis"].includes(sq.settlement.size)) { note(state, "A Civilized Rest needs a town or a city."); return state; }
  withDice(state, (rng) => {
    // Indoors all day: no weather trial.
    if (!state.morningDone) { state.indoors = true; morning(state, rng); state.indoors = false; }
    note(state, kind === "bed" ? "You spend the day in bed." : "You spend the day in town, resting and seeing the sights.", "camp");
    state.stayKind = kind;
    camp(state, rng);
    state.stayKind = null;
  });
  return state;
}

/** A river under foot or a lake beside you: water to drink and to fill the skins. */
function nearWater(state, x, y) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const sq = squareAt(state.world, x + dx, y + dy);
    if (sq && (sq.lake || (sq.river && !dx && !dy))) return true;
  }
  return false;
}

/** Exploration XP is banked until the party reaches safety (design/01-the-turn.md, Coming Home). */
function reachSafety(state, rng) {
  const xp = state.party.bankedXp;
  if (!xp) return;
  for (const m of living(state)) m.xp += xp;
  state.party.bankedXp = 0;
  note(state, `Safe in a settlement: each character earns ${xp} banked exploration XP.`, "reward");
  checkLevels(state, (t, k) => note(state, t, k), rng);
}

/** The event die (design/01-the-turn.md, What happened there; Deep country). */
function eventDie(state, rng) {
  const country = countryAt(state.world, state.party.x, state.party.y);
  let n = rng.d(6);
  let result = n <= 2 ? "Quiet" : n === 3 ? "Sign" : n === 4 ? "Discovery" : "Encounter";
  if (country === "settled" && n === 5) result = "Quiet";
  const where = country === "deep" ? "Deep country" : country === "settled" ? "Settled country" : "the wild";
  note(state, `Event die ${n} in ${where}: ${result}.`, result === "Quiet" ? "" : "event");
  const say = (t, k) => note(state, t, k);
  if (result === "Sign") { if (!maybeHart(state, rng, say)) startSign(state, rng, say); }
  else if (result === "Discovery") discover(state, rng, say);
  else if (result === "Encounter") startEncounter(state, rng, say);
}

/* ------------------------------------------------------------------ */
/* Camp                                                                 */

export function campNow(state) {
  if (state.pending || state.encounter || state.sign || state.over) return state;
  withDice(state, (rng) => {
    if (!state.morningDone) morning(state, rng);
    camp(state, rng);
  });
  return state;
}

function camp(state, rng) {
  const say = (t, k) => note(state, t, k);
  ensureStores(state);
  const country = countryAt(state.world, state.party.x, state.party.y);
  const sq = squareAt(state.world, state.party.x, state.party.y);
  const p = state.party;
  const awake = p.members.filter(m => !m.dead);
  // An inn: Common lodging and supper for everyone (Equipment, Lodging and Services). At home, or in a
  // hamlet, which has no inn, a household takes you in: a Good Night's Rest [Jon, 2026-10-24].
  const household = sq?.settlement && (sq.settlement.home || sq.settlement.size === "hamlet");
  const stay = state.stayKind;
  const bill = sq?.settlement && !household ? awake.length * (3 + 0.5 + (stay ? 0.5 : 0)) : 0;
  if (sq?.settlement && p.coin >= bill && !state.site) {
    if (bill) { p.coin -= bill; note(state, `You take Common rooms and ${stay ? "meals" : "supper"} at the ${sq.settlement.size === "roadhouse" ? "roadhouse" : "inn"}: ${bill} sp for ${awake.length}.`, "camp"); }
    else note(state, sq.settlement.home ? "You spend the night at home." : "A household in the hamlet takes you in for the night.", "camp");
    eveningSupplies(state, rng, say, { inn: "common" });
    if (!household && p.listen) rumorAtInn(state, rng, say);
    treatInjuries(state, rng, say);
    treatTraumas(state, rng, say);
    if (!stay) repairGear(state, rng, say); // no strenuous work during a Civilized or Bed Rest
    rest(state, rng, stay || "goodNight");
  } else {
    if (sq?.settlement && !state.site) note(state, `You can't pay for the inn (${bill} sp), so you sleep rough outside the ${sq.settlement.size}.`, "camp");
    const atWater = !state.site && (!!p.waterToday || nearWater(state, p.x, p.y) || !!sq?.settlement);
    if (atWater) refill(state, say, sq?.settlement ? sq.settlement.size : "water");
    eveningSupplies(state, rng, say, { atWater });
    // The evening's camping roles (General Rules, Camping Roles): the Healer and the Smith at work.
    treatInjuries(state, rng, say);
    treatTraumas(state, rng, say);
    repairGear(state, rng, say);
    if (state.site) {
      // Inside a site: a Dungeon Rest at best, and the clock is rolled for it (design/05-sites.md).
      note(state, "You rest where you are, in the dark, with a watch kept.", "camp");
      const came = restClock(state, rng, say);
      rest(state, rng, "dungeon", { danger: true, interrupted: came });
    } else {
    const n = rng.d(6);
    note(state, `You make camp. Night die ${n}${n === 6 ? ": something finds the camp." : ": the night passes."}`, n === 6 ? "event" : "camp");
    // Deep country is never safe: a Dungeon Rest. A night attack spoils the rest one step.
    rest(state, rng, country !== "deep" ? "wilderness" : "dungeon", { danger: country === "deep", interrupted: n === 6 });
    for (const m of p.members) if (m.collapsed && !m.starving && !m.parched) { m.collapsed = false; note(state, `${m.name} is warmed by the fire and comes round.`, "camp"); }
    if (n === 6) {
      state.night = true;
      startEncounter(state, rng, say, { night: true });
      state.night = false;
      state.sign = null; // a Sign at night is only noises in the dark
    }
    }
  }
  // A day with no travel is a day's rest for the Trauma Table; Hard to Kill counts its toll.
  for (const m of p.members.filter(x => !x.dead)) {
    for (const t of m.traumas || []) ensureTrauma(t);
    if (!state.hoursUsed) restDay(m, say);
    hardToKillDay(m, state.day, say);
  }
  if (!p.members.some(m => !m.dead)) {
    note(state, "No one is left.", "event");
    state.over = { day: state.day, why: `Lost to the road on day ${state.day}.` };
  }
  state.day += 1;
  state.hoursUsed = 0;
  state.morningDone = false;
  state.pushed = false;
  p.carry = 0;
  p.waterToday = false;
  state.campDue = false;
}

/** Maximum magan: the pool, less an agathion's bound magan if it has died (Core Classes, Agathion, Bound Magan). */
export const maxMagan = (m) => (m.magan || 0) - (m.companion?.dead ? (m.companion.boundMagan || 0) : 0);

/**
 * A night's rest (General Rules, Resting), through Foundry's rest rules:
 * the rest a character actually gets (Gnomes, Druids, Elves, Orcs, and
 * Rangers treat a safe Wilderness Rest as a Good Night's; Infected drops it
 * a stage a tier), what it restores, and Exhausted after it, never below what
 * hunger and thirst hold. A hot meal adds the Endurance and casting tiers.
 */
function rest(state, rng, kind, { danger = false, interrupted = false } = {}) {
  const bits = [];
  const ORDER = ["nil", "dungeon", "wilderness", "goodNight", "civilized", "bed"];
  const roll = (rec) => rec ? rec.dice.reduce((n, d) => n + Array.from({ length: d.c }, () => rng.d(d.s)).reduce((a, b) => a + b, 0), 0) + rec.flat : 0;
  for (const m of living(state)) {
    const r = effectiveRest({ type: kind, danger, upgrade: classUpgrades(m.cls), interrupted });
    let stage = r.stage, rule = r.exhausted;
    // Infected: rest counts as one stage lower per tier (Conditions).
    if (m.infected && stage !== "nil") { stage = ORDER[Math.max(0, ORDER.indexOf(stage) - m.infected)]; rule = stage === "nil" ? { advance: 1 } : effectiveRest({ type: stage }).exhausted; }
    if (stage !== "nil") m.spent = {};
    const before = m.exhausted || 0;
    m.exhausted = Math.max(exhaustedAfter(before, rule), Math.min(before, exhaustFloor(m)));
    if (m.exhausted !== before) bits.push(`${m.name} Exhausted ${before} → ${m.exhausted}`);
    const hot = m.hotMeal && stage !== "nil";
    m.hotMeal = false;
    const eTier = tierOf(m.attributes.endurance);
    // Magan comes back by the same rest, with the casting tier die.
    const maxMp = maxMagan(m);
    if (m.casting && stage !== "nil" && (m.mp ?? 0) < maxMp) {
      const cTier = tierOf(m.attributes[m.casting.attr]);
      const gain = roll(recoveryFor(stage, { c: 1, s: dieOfTier(cTier)[1] }, m.level)) + (hot ? cTier : 0);
      const was = m.mp ?? 0;
      m.mp = Math.min(maxMp, was + gain);
      bits.push(`${m.name} ${was} → ${m.mp} magan`);
    }
    // A companion rests as a character, with its tier die for the Endurance die; a Puca treats a safe Wilderness Rest as a Good Night's.
    const pet = m.companion;
    if (pet && !pet.dead && pet.hp < pet.health && stage !== "nil") {
      const pr = effectiveRest({ type: kind, danger, upgrade: pet.kind === "puca", interrupted });
      if (pr.stage !== "nil" && !(pr.stage === "dungeon" && pet.hp < 1)) {
        const was = pet.hp;
        pet.hp = Math.min(pet.health, pet.hp + roll(recoveryFor(pr.stage, { c: 1, s: dieOfTier(pet.tier)[1] }, m.level)));
        bits.push(`${pet.name} ${was} → ${pet.hp} health`);
      }
    }
    if (m.hp >= m.health || stage === "nil" || (stage === "dungeon" && m.hp < 1)) continue;
    const gain = roll(recoveryFor(stage, { c: 1, s: dieOfTier(eTier)[1] }, m.level)) + (hot ? eTier : 0);
    const was = m.hp;
    m.hp = Math.min(m.health, m.hp + gain);
    if (m.hp > 0) m.down = false;
    bits.push(`${m.name} ${was} → ${m.hp} health`);
  }
  const label = REST_LABELS[effectiveRest({ type: kind, danger, interrupted }).stage] || REST_LABELS[kind];
  if (bits.length) note(state, `${label}: ${bits.join(", ")}.`, "camp");
}

/* ------------------------------------------------------------------ */

/** After an encounter or sign is settled, finish the day if it was over. */
export function afterEvent(state) {
  if (!state.battle && state.lastFight) withDice(state, (rng) => afterFight(state, rng, (t, k) => note(state, t, k)));
  if (state.encounter?.toBattle && !state.battle) withDice(state, (rng) => startBattle(state, rng, (t, k) => note(state, t, k)));
  if (!state.encounter && !state.sign && !state.over && state.campDue) withDice(state, (rng) => camp(state, rng));
  return state;
}

export function runWithDice(state, fn) { return withDice(state, fn); }

/** Go into the site the party stands at, or act inside it (sites.js). The morning comes first, indoors. */
export function siteAction(state, id, arg) {
  if (state.encounter || state.sign || state.over || state.battle || state.pending) return state;
  if (id === "rest") { campNow(state); return afterEvent(state); }
  withDice(state, (rng) => {
    const say = (t, k) => note(state, t, k);
    if (!state.morningDone) morning(state, rng);
    if (id === "enter") enter(state, rng, say);
    else siteAct(state, rng, say, id, arg);
  });
  return afterEvent(state);
}

export const save = (state) => JSON.stringify(state);
export const load = (json) => JSON.parse(json);
