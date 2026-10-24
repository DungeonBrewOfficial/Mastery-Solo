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
import { ensureStores, morningSupplies, eveningSupplies, refill, exhaustFloor, outfit, treatInjuries, repairGear } from "./supplies.js";

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
  morningSupplies(state, rng, (t, k) => note(state, t, k), weatherDC(w.band));
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
    state.hoursUsed += hours;
    const h = state.party.hours;
    h.total += hours;
    if (state.party.pace === "fast") h.fast += hours;
    if (state.party.pace === "marathon") h.marathon += hours;
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
    if (nearWater(state, p.x, p.y)) p.waterToday = true;
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
    reachSafety(state, rng);
  }
  const place = state.world.places?.[`${p.x},${p.y}`];
  if (place && ["lair", "cave", "ruin", "barrow"].includes(place.type)) {
    // TODO(sites): exploring sites is milestone 4.
    note(state, `You stand at the ${place.type}${place.creature ? ` of ${place.creature}` : ""}. Exploring sites comes in milestone 4.`, "todo");
  }
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
  const say = (t, k) => note(state, t, k);
  ensureStores(state);
  const country = countryAt(state.world, state.party.x, state.party.y);
  const sq = squareAt(state.world, state.party.x, state.party.y);
  const p = state.party;
  const awake = p.members.filter(m => !m.dead);
  // An inn: Common lodging and supper for everyone (Equipment, Lodging and Services). At home a household takes you in.
  const bill = sq?.settlement && !sq.settlement.home ? awake.length * (3 + 0.5) : 0;
  if (sq?.settlement && p.coin >= bill) {
    if (bill) { p.coin -= bill; note(state, `You take Common rooms and supper at the inn: ${bill} sp for ${awake.length}.`, "camp"); }
    else note(state, "You spend the night at home.", "camp");
    eveningSupplies(state, rng, say, { inn: "common" });
    treatInjuries(state, rng, say);
    repairGear(state, rng, say);
    rest(state, rng, "goodNight");
  } else {
    if (sq?.settlement) note(state, `You can't pay for the inn (${bill} sp), so you sleep rough outside the ${sq.settlement.size}.`, "camp");
    const atWater = !!p.waterToday || nearWater(state, p.x, p.y) || !!sq?.settlement;
    if (atWater) refill(state, say, sq?.settlement ? sq.settlement.size : "water");
    eveningSupplies(state, rng, say, { atWater });
    // The evening's camping roles (General Rules, Camping Roles): the Healer and the Smith at work.
    treatInjuries(state, rng, say);
    repairGear(state, rng, say);
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
  if (state.encounter?.toBattle && !state.battle) withDice(state, (rng) => startBattle(state, rng, (t, k) => note(state, t, k)));
  if (!state.encounter && !state.sign && !state.over && state.campDue) withDice(state, (rng) => camp(state, rng));
  return state;
}

export function runWithDice(state, fn) { return withDice(state, fn); }

export const save = (state) => JSON.stringify(state);
export const load = (json) => JSON.parse(json);
