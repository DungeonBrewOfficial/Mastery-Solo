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
import { startSign, startEncounter, discover, checkLevels, alive, living } from "./events.js";
import { startBattle } from "./combat.js";
import { tierOf, dieOfTier } from "./mastery.js";
import { rowFor, weatherFrom, BAND_LABELS } from "./vendor/foundry/module/helpers/weather-rules.mjs";

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
      roles: { scout: "hamon", watchman: "gerberga" },
      coin: 450 + 160 + 193 + 284,
      pelts: [],
      bankedXp: 0
    },
    encounter: null, sign: null, following: null, campDue: false, night: false, season: "spring",
    day: 1, hoursUsed: 0, morningDone: false, pushed: false,
    weather: null, target: null, pending: null,
    log: []
  };
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
  const dc = weatherDC(w.band);
  // TODO(party): roll each character's Endurance trial once characters exist (milestone 3).
  if (dc) note(state, `Each character makes an Endurance trial for the weather, DC ${dc}.`, "todo");
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
  if (state.pending?.type === "nightfall" && !choice) return state;
  if (!state.target && !state.pending) { note(state, "Choose where to go: click the map."); return state; }
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
    state.hoursUsed += hours;
    eventDie(state, rng);
    if (state.hoursUsed >= DAY_HOURS) {
      if (state.encounter || state.sign) state.campDue = true;
      else camp(state, rng);
    }
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
    reachSafety(state);
  }
  const place = state.world.places?.[`${p.x},${p.y}`];
  if (place && ["lair", "cave", "ruin", "barrow"].includes(place.type)) {
    // TODO(sites): exploring sites is milestone 4.
    note(state, `You stand at the ${place.type}${place.creature ? ` of ${place.creature}` : ""}. Exploring sites comes in milestone 4.`, "todo");
  }
}

/** Exploration XP is banked until the party reaches safety (design/01-the-turn.md, Coming Home). */
function reachSafety(state) {
  const xp = state.party.bankedXp;
  if (!xp) return;
  for (const m of living(state)) m.xp += xp;
  state.party.bankedXp = 0;
  note(state, `Safe in a settlement: each character earns ${xp} banked exploration XP.`, "reward");
  checkLevels(state, (t, k) => note(state, t, k));
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
  if (result === "Sign") startSign(state, rng, say);
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
  const country = countryAt(state.world, state.party.x, state.party.y);
  const sq = squareAt(state.world, state.party.x, state.party.y);
  if (sq?.settlement) {
    // TODO(town): settlements are milestone 3, with lodging costs and the healer.
    note(state, `You spend the night in the ${sq.settlement.home ? "home village" : sq.settlement.size}.`, "camp");
    rest(state, rng, "good");
  } else {
    const n = rng.d(6);
    note(state, `You make camp. Night die ${n}${n === 6 ? ": something finds the camp." : ": the night passes."}`, n === 6 ? "event" : "camp");
    // Deep country is never safe: a Dungeon Rest. A night attack spoils the rest one step.
    const safe = country !== "deep";
    rest(state, rng, n === 6 ? (safe ? "dungeon" : "none") : safe ? "wilderness" : "dungeon");
    if (n === 6) {
      state.night = true;
      startEncounter(state, rng, (t, k) => note(state, t, k), { night: true });
      state.night = false;
      state.sign = null; // a Sign at night is only noises in the dark
    }
  }
  if (state.pushed) note(state, `You traveled ${state.hoursUsed} hours today: Pushing the Pace trial, DC ${2 + Math.max(0, state.hoursUsed - DAY_HOURS)} plus pace.`, "todo");
  state.day += 1;
  state.hoursUsed = 0;
  state.morningDone = false;
  state.pushed = false;
  state.party.carry = 0;
  state.campDue = false;
}

/**
 * A night's rest (General Rules, Resting). Druids treat a safe Wilderness
 * Rest as a Good Night's Rest.
 */
/** Maximum magan: the pool, less an agathion's bound magan if it has died (Core Classes, Agathion, Bound Magan). */
export const maxMagan = (m) => (m.magan || 0) - (m.companion?.dead ? (m.companion.boundMagan || 0) : 0);
const RESTS = { none: "No Rest", dungeon: "Dungeon Rest", wilderness: "Wilderness Rest", good: "Good Night's Rest" };
function rest(state, rng, kind) {
  const bits = [];
  const ORDER = ["none", "dungeon", "wilderness", "good"];
  for (const m of living(state)) {
    let k = kind === "wilderness" && m.cls === "Druid" ? "good" : kind;
    if (k !== "none") m.spent = {};
    // Infected: rest counts as one stage lower per tier (Conditions).
    if (m.infected) k = m.infected >= 3 ? "none" : ORDER[Math.max(0, ORDER.indexOf(k) - m.infected)];
    // Exhausted (General Rules, Resting): a Wilderness Rest eases it a tier but not below 1, a Good Night's a full tier; No Rest adds one.
    if (m.exhausted || k === "none") {
      const before = m.exhausted || 0;
      m.exhausted = k === "none" ? Math.min(3, before + 1) : k === "wilderness" ? Math.max(Math.min(before, 1), before - 1) : k === "good" ? Math.max(0, before - 1) : before;
      if (m.exhausted !== before) bits.push(`${m.name} Exhausted ${before} → ${m.exhausted}`);
    }
    // Magan comes back by the same rest: 1, 1d3, or the casting tier die (General Rules, Resting).
    const maxMp = maxMagan(m);
    if (m.casting && k !== "none" && (m.mp ?? 0) < maxMp) {
      const gain = k === "dungeon" ? 1 : k === "wilderness" ? rng.d(3) : total(rng, `1d${dieOfTier(tierOf(m.attributes[m.casting.attr]))[1]}`);
      const was = m.mp ?? 0;
      m.mp = Math.min(maxMp, was + gain);
      bits.push(`${m.name} ${was} → ${m.mp} magan`);
    }
    // A companion rests as a character, with its tier die for the Endurance die; a Puca treats a safe Wilderness Rest as a Good Night's.
    const pet = m.companion;
    if (pet && !pet.dead && pet.hp < pet.health && k !== "none") {
      const pk = k === "wilderness" && pet.kind === "puca" ? "good" : k;
      if (!(pk === "dungeon" && pet.hp < 1)) {
        const was = pet.hp;
        pet.hp = Math.min(pet.health, pet.hp + (pk === "dungeon" ? 1 : pk === "wilderness" ? rng.d(3) : rng.d(dieOfTier(pet.tier)[1])));
        bits.push(`${pet.name} ${was} → ${pet.hp} health`);
      }
    }
    if (m.hp >= m.health || k === "none" || (k === "dungeon" && m.hp < 1)) continue;
    const gain = k === "dungeon" ? 1 : k === "wilderness" ? rng.d(3) : total(rng, `1d${dieOfTier(tierOf(m.attributes.endurance))[1]}`);
    const before = m.hp;
    m.hp = Math.min(m.health, m.hp + gain);
    if (m.hp > 0) m.down = false;
    bits.push(`${m.name} ${before} → ${m.hp} health`);
  }
  if (bits.length) note(state, `${RESTS[kind]}: ${bits.join(", ")}.`, "camp");
}

/* ------------------------------------------------------------------ */

/** After an encounter or sign is settled, finish the day if it was over. */
export function afterEvent(state) {
  if (state.encounter?.toBattle && !state.battle) withDice(state, (rng) => startBattle(state, rng, (t, k) => note(state, t, k)));
  if (!state.encounter && !state.sign && !state.over && state.campDue) withDice(state, (rng) => camp(state, rng));
  return state;
}

export function runWithDice(state, fn) { return withDice(state, fn); }

export const save = (state) => JSON.stringify(state);
export const load = (json) => JSON.parse(json);
