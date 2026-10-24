/**
 * THE PARTY'S SUPPLIES (milestone 3): what it carries, what it wears, what
 * it eats and drinks, and what the road and the weather take out of it.
 * General Rules (Resting, Travel, Weather), Skill Mastery (Hunting and
 * Foraging), and Equipment, through Foundry's pure food, rest, and weather
 * rules. Works on the plain state; never imports the journey or combat.
 */
import { GEAR } from "./data/gear.js";
import { trial, passes, tierOf, dieOfTier } from "./mastery.js";
import { RATIONS, MEALS, mealRecovery } from "./vendor/foundry/module/helpers/food-rules.mjs";
import { coldDress, heatDress, WATER_GALLONS, failOutcome, hungerDue, lockedFloor } from "./vendor/foundry/module/helpers/weather-rules.mjs";
import { pushingThePace } from "./vendor/foundry/module/helpers/travel-rules.mjs";
import { PACES } from "./vendor/foundry/module/helpers/travel-rules.mjs";

/** How long food keeps, in days (Equipment: Rations; Skill Mastery: "Foraged meals spoil after 3 days"). */
export const KEEPS = { "Rations, Iron": 14, "Rations, Standard": 3, "Rations, Dry": 90, "Foraged meal": 3 };
const FOOD = { "Rations, Iron": RATIONS["rations, iron"], "Rations, Standard": RATIONS["rations, standard"], "Rations, Dry": RATIONS["rations, dry"], "Foraged meal": MEALS.poor };
export const isFood = (name) => !!FOOD[name];
export const SKIN_GALLONS = 0.5;

const living = (state) => state.party.members.filter(m => !m.dead);
const up = (m) => !m.dead && !m.collapsed && !m.down && (m.hp > 0 || m.fightingOn);
const endTier = (m) => tierOf(m.attributes.endurance);
const castTier = (m) => m.casting ? tierOf(m.attributes[m.casting.attr]) : 0;

/* ------------------------------------------------------------------ */
/* Stores                                                               */

/** Fill in what an older save is missing. */
export function ensureStores(state) {
  const p = state.party;
  p.food ??= [];
  p.stores ??= {};
  p.water ??= 0;
  p.skins ??= 0;
  p.hours ??= { total: 0, fast: 0, marathon: 0 };
  for (const m of p.members) { m.worn ??= []; m.lock ??= {}; m.hungryDays ??= 0; }
}

export const count = (state, name) => isFood(name) ? state.party.food.filter(f => f.name === name).reduce((n, f) => n + f.n, 0) : (state.party.stores[name] || 0);
export const meals = (state) => state.party.food.reduce((n, f) => n + f.n, 0);

/** Take n of something; false if there isn't enough. Food goes oldest first. */
export function take(state, name, n = 1) {
  if (count(state, name) < n) return false;
  if (!isFood(name)) { state.party.stores[name] -= n; if (!state.party.stores[name]) delete state.party.stores[name]; return true; }
  for (const f of state.party.food.filter(x => x.name === name).sort((a, b) => a.spoils - b.spoils)) {
    const k = Math.min(n, f.n); f.n -= k; n -= k;
    if (!n) break;
  }
  state.party.food = state.party.food.filter(f => f.n > 0);
  return true;
}

/**
 * Add something to the party: a kit opens into what it holds, clothing goes
 * on the wearer if the slot is free, a waterskin comes full.
 */
export function add(state, name, n = 1, { wearer = null } = {}) {
  const g = GEAR[name];
  if (g?.kind === "kit") { for (const c of g.contents) add(state, c.name, c.qty * n, { wearer }); return; }
  if (isFood(name)) { state.party.food.push({ name, n, spoils: state.day + KEEPS[name] }); return; }
  if (name === "Waterskin") { state.party.skins += n; state.party.water += n * SKIN_GALLONS; return; }
  if (g?.weather && wearer) {
    const m = state.party.members.find(x => x.id === wearer);
    for (let i = 0; i < n; i++) {
      if (m && !m.worn.some(w => GEAR[w]?.weather?.slot === g.weather.slot)) m.worn.push(name);
      else state.party.stores[name] = (state.party.stores[name] || 0) + 1;
    }
    return;
  }
  state.party.stores[name] = (state.party.stores[name] || 0) + n;
}

/**
 * What the prebuilt party set out with: what each sheet lists (Corra's
 * Healer's Kit), and an Adventurer's Pack apiece paid from the party's coin
 * (Equipment, Kits: 10 iron rations, a waterskin, a winter blanket).
 */
export function outfit(state) {
  ensureStores(state);
  for (const m of state.party.members) {
    for (const g of m.gear || []) if (GEAR[g]?.kind === "kit") add(state, g, 1, { wearer: m.id });
    add(state, "Adventurer's Pack", 1, { wearer: m.id });
    state.party.coin -= GEAR["Adventurer's Pack"].sp;
  }
}

/** Spoiled food is thrown out each morning. */
function spoil(state, note) {
  const bad = state.party.food.filter(f => f.spoils < state.day);
  if (!bad.length) return;
  state.party.food = state.party.food.filter(f => f.spoils >= state.day);
  note(`Spoiled and thrown out: ${bad.map(f => `${f.n} ${f.name.toLowerCase()}`).join(", ")}.`, "event");
}

/* ------------------------------------------------------------------ */
/* Exhausted, outside a fight                                           */

/** Advance Exhausted; at Tier 3 a failure means falling unconscious instead (General Rules, Weather; Going Hungry). */
function exhaust(state, note, m, n, cause) {
  const out = failOutcome(m.exhausted || 0, endTier(m), cause);
  if (out.unconscious) {
    if (cause === "hunger") { m.starving ??= state.day + endTier(m); m.collapsed = true; note(`${m.name} collapses from hunger: ${endTier(m)} days to live unless fed.`, "event"); }
    else if (cause === "thirst") { m.collapsed = true; note(`${m.name} collapses from thirst and dies within ${endTier(m)} hours without water.`, "event"); m.parched = true; }
    else { m.collapsed = true; note(`${m.name} collapses from the ${cause}. Make camp and warm them, or they die within ${endTier(m)} hours.`, "event"); }
    return;
  }
  const before = m.exhausted || 0;
  m.exhausted = Math.min(3, before + n);
  note(`${m.name} is Exhausted ${m.exhausted} (${cause}).`, "event");
}
/**
 * Death by hunger, thirst, cold, or heat. Hard to Kill's Deathless: "you stay
 * Unconscious instead. Each day past the point where you would have died adds
 * 1 to your toll"; fed or watered, "you wake at Exhausted Tier 3".
 */
function perish(state, note, m, how) {
  if ((m.abilities || []).includes("Hard to Kill")) {
    m.collapsed = true; m.toll = (m.toll || 0) + 1; m.exhausted = 3; m.lock.deathless = 3;
    note(`${m.name} should have died ${how}, but the curse won't let go: unconscious, and 1 more on the toll (${m.toll}).`, "event");
    return;
  }
  m.dead = true; m.hp = 0;
  note(`${m.name} dies ${how}.`, "event");
}

/** Exhausted rest can't take: from hunger or thirst, until they eat or drink. */
export const exhaustFloor = (m) => lockedFloor(m.lock);

/* ------------------------------------------------------------------ */
/* Meals                                                                */

/**
 * One meal each, from the food that spoils first (General Rules, Resting:
 * "Each ration is one meal… up to two meals a day"). Dry rations need a
 * cook and an iron pot. Every meal heals at once [Foundry, Jon 2026-10-03].
 */
export function eat(state, rng, note, { cooked = false, inn = null } = {}) {
  const bits = [];
  for (const m of living(state).filter(x => !x.parched || inn)) {
    if ((m.ate || 0) >= 2) continue;
    let food = null, hot = false, name;
    if (inn) { food = MEALS[inn]; hot = true; name = food.label; }
    else {
      const pick = state.party.food.filter(f => f.n > 0 && (f.name !== "Rations, Dry" || cooked)).sort((a, b) => a.spoils - b.spoils)[0];
      if (!pick) continue;
      take(state, pick.name);
      food = FOOD[pick.name]; name = pick.name;
      hot = cooked && (pick.name === "Rations, Dry" || pick.name === "Foraged meal");
    }
    m.ate = (m.ate || 0) + 1;
    m.hungryDays = 0; m.lock.hunger = 0;
    if (m.starving) { m.starving = null; m.collapsed = false; note(`${m.name} eats and comes round.`, "reward"); }
    if (hot) m.hotMeal = true;
    const r = mealRecovery(food, { endTier: m.hp > 0 ? endTier(m) : 0, castTier: castTier(m) });
    const amount = (part, die) => !part ? 0 : part.flat ?? Array.from({ length: part.dice }, () => rng.d(die)).reduce((a, b) => a + b, 0);
    const hp = Math.min(m.health - m.hp, amount(r.health, dieOfTier(endTier(m))[1]));
    const mp = m.casting ? Math.min((m.magan || 0) - (m.mp || 0), amount(r.magan, dieOfTier(castTier(m))[1])) : 0;
    if (hp > 0) m.hp += hp;
    if (mp > 0) m.mp += mp;
    bits.push(`${m.name} (${name.toLowerCase()}${hp > 0 ? `, +${hp} health` : ""}${mp > 0 ? `, +${mp} magan` : ""})`);
  }
  if (bits.length) note(`${inn ? "Supper at the inn" : cooked ? "A hot supper" : "A meal"}: ${bits.join(", ")}.`, "camp");
  const hungry = living(state).filter(m => !m.ate && !m.collapsed);
  return { hungry };
}

/* ------------------------------------------------------------------ */
/* Water                                                                */

/** The day's water for each character, doubled at Marathon pace (General Rules, Weather; Traveling Speed). */
export const waterNeed = (state) => (WATER_GALLONS[state.weather?.band] ?? 0.5) * (state.party.hours.marathon > 0 ? 2 : 1);
/** Refill the waterskins at a river, a lake, or a settlement. */
export function refill(state, note, where) {
  const p = state.party, cap = p.skins * SKIN_GALLONS;
  if (p.water >= cap) return;
  p.water = cap;
  if (cap) note(`You fill the waterskins at the ${where}.`);
}
/** Each character drinks the day's water, from the source if there is one, else the skins. */
function drink(state, note, atWater) {
  const need = waterNeed(state);
  const dry = [];
  for (const m of living(state)) {
    if (atWater || state.party.water >= need) {
      if (!atWater) state.party.water = Math.round((state.party.water - need) * 100) / 100;
      m.lock.thirst = 0;
      if (m.parched) { m.parched = false; if (!m.starving) { m.collapsed = false; note(`${m.name} drinks and comes round.`, "reward"); } }
      continue;
    }
    dry.push(m);
  }
  for (const m of dry) {
    if (m.parched) { perish(state, note, m, "of thirst"); continue; }
    note(`${m.name} goes without the day's water.`, "event");
    m.lock.thirst = (m.lock.thirst || 0) + 1;
    exhaust(state, note, m, 1, "thirst");
  }
}

/* ------------------------------------------------------------------ */
/* Morning: spoilage, breakfast, the weather                            */

/**
 * The day's weather trial [Jon, 2026-10-24]: one Endurance trial each at
 * the worst band's DC, with clothing and armor as written. Spirit companions
 * make none; the prebuilt party's mortal companion (Tallow) isn't tracked here.
 */
export function morningSupplies(state, rng, note, dc) {
  ensureStores(state);
  for (const m of living(state)) m.ate = 0;
  spoil(state, note);
  eat(state, rng, note);
  const band = state.weather?.band;
  if (!dc) return;
  const hydrated = state.party.water >= waterNeed(state);
  for (const m of living(state).filter(up)) {
    const worn = m.worn.map(n => GEAR[n]?.weather).filter(Boolean);
    const armor = !!(m.armor && m.armor.durability > 0);
    const dress = band === "cold" || band === "extremeCold" ? coldDress(worn, { armor, band }) : heatDress(worn, { armor, hydrated });
    if (dress.mode === "none") continue;
    const e = dieOfTier(endTier(m));
    const t = trial(rng, [e, e], { edge: dress.mode === "dominance" ? 1 : 0 });
    const ok = passes(t, dc);
    note(`${m.name} against the ${band === "cold" || band === "extremeCold" ? "cold" : "heat"}: Endurance ${t.text} against ${dc}${ok ? "" : ", and it tells"}.`);
    if (!ok) exhaust(state, note, m, 1, band === "cold" || band === "extremeCold" ? "cold" : "heat");
  }
}

/* ------------------------------------------------------------------ */
/* Foraging                                                             */

/**
 * Hunting and Foraging (Skill Mastery, Wilderness): a day's travel spent at
 * it, then Perception tier die + Wilderness mastery die, at the pace's travel
 * trial penalty. The result less 2 is points to spend: at Untrained, each buys
 * a Poor meal, or a Wound Kit's worth of healing herbs for a Healer.
 */
export function forage(state, rng, note) {
  const id = state.party.roles.forager;
  const m = id && state.party.members.find(x => x.id === id);
  if (!m || !up(m) || !state.hoursUsed) return;
  const lvl = m.skills?.wilderness || 0;
  if (lvl < 2) { note(`${m.name} has no Wilderness training to forage with.`); return; }
  const pen = PACES[state.party.pace]?.penalty || 0;
  const t = trial(rng, [dieOfTier(tierOf(m.attributes.perception)), dieOfTier(lvl)], { bonus: -pen });
  const points = Math.max(0, t.total - 2);
  const herbs = state.party.forage === "herbs" && (m.skills?.healer || 0) >= 2;
  note(`${m.name} forages (Perception + Wilderness ${t.text}${pen ? `, pace −${pen}` : ""}): ${points ? `${points} ${herbs ? `Wound Kit${points === 1 ? "" : "s"} of healing herbs` : `Poor meal${points === 1 ? "" : "s"}`}` : "nothing"}.`, points ? "reward" : "");
  if (points) add(state, herbs ? "Wound Kit" : "Foraged meal", points);
}

/* ------------------------------------------------------------------ */
/* Evening: supper, water, hunger, the day's pace                       */

/**
 * The end of the day's travel: foraging, supper (hot with a cook and an iron
 * pot), the day's water, Going Hungry, and Pushing the Pace.
 */
export function eveningSupplies(state, rng, note, { atWater = false, inn = null } = {}) {
  ensureStores(state);
  forage(state, rng, note);
  const cook = state.party.roles.cook && state.party.members.find(x => x.id === state.party.roles.cook && up(x));
  const cooked = !!cook && count(state, "Iron Pot") > 0;
  eat(state, rng, note, { cooked, inn });
  if (inn) atWater = true;
  drink(state, note, atWater);
  // Going Hungry: each run of days equal to the Endurance tier without a meal advances Exhausted.
  for (const m of living(state)) {
    if (m.ate) continue;
    m.hungryDays = (m.hungryDays || 0) + 1;
    note(`${m.name} goes hungry (${m.hungryDays} day${m.hungryDays === 1 ? "" : "s"}).`, "event");
    if (hungerDue(m.hungryDays, endTier(m))) { m.lock.hunger = (m.lock.hunger || 0) + 1; exhaust(state, note, m, 1, "hunger"); }
    if (m.starving && state.day >= m.starving) perish(state, note, m, "of hunger");
  }
  // Pushing the Pace (General Rules, Traveling Speed).
  const push = pushingThePace(state.party.hours);
  if (push.needed) {
    for (const m of living(state).filter(up)) {
      const e = dieOfTier(endTier(m));
      const t = trial(rng, [e, e]);
      const ok = passes(t, push.dc);
      note(`Pushing the Pace: ${m.name}, Endurance ${t.text} against ${push.dc}${ok ? "" : ", worn down"}.`);
      if (!ok) exhaust(state, note, m, push.advance, "the pace");
    }
  }
  state.party.hours = { total: 0, fast: 0, marathon: 0 };
}

/* ------------------------------------------------------------------ */
/* The Healer and the Smith (Skill Mastery, Trade)                      */

const healerLevel = (m) => m.skills?.healer || 1;
const tradeDie = (lvl) => dieOfTier(lvl || 1); // 1d2 Unskilled, 1d3 Untrained…
/** The best conscious healer: Healer discipline first, then the cleverest pair of hands. */
export function healerOf(state, prefer = null) {
  const ok = state.party.members.filter(up);
  const p = prefer && ok.find(m => m.id === prefer);
  if (p) return p;
  return ok.sort((a, b) => healerLevel(b) - healerLevel(a) || b.attributes.intelligence - a.attributes.intelligence)[0] || null;
}
/** "Without at least Untrained Healer mastery, you roll before using a Wound Kit (against 3) or an Injury Kit (against 4). On a failure, the kit is wasted." */
function untrainedHands(rng, note, h, kit) {
  if (healerLevel(h) >= 2) return true;
  const t = trial(rng, [tradeDie(1), dieOfTier(tierOf(h.attributes.intelligence))]);
  const dc = kit === "Wound Kit" ? 3 : 4;
  if (passes(t, dc)) return true;
  note(`${h.name} fumbles the ${kit.toLowerCase()} (${t.text} against ${dc}); it's wasted.`, "event");
  return false;
}

/**
 * Heal (Healer Discipline): a Wound Kit per patient, once per encounter in
 * which they were wounded. With a Surgeon's Pocket Set the patient regains
 * Trade mastery die + Intelligence tier die; without, the Healer's mastery level.
 */
export function healAfterFight(state, rng, note, wounded) {
  const h = healerOf(state, state.party.roles.healer);
  if (!h) return;
  const pocket = count(state, "Surgeon's Pocket Set") > 0;
  for (const m of state.party.members.filter(x => !x.dead && wounded.includes(x.id) && x.hp < x.health)) {
    if (!take(state, "Wound Kit")) { note(`No Wound Kits left to heal ${m.name}.`, "event"); break; }
    if (!untrainedHands(rng, note, h, "Wound Kit")) continue;
    const t = pocket ? trial(rng, [tradeDie(healerLevel(h)), dieOfTier(tierOf(h.attributes.intelligence))]) : null;
    const gain = t ? t.total : healerLevel(h);
    const before = m.hp;
    m.hp = Math.min(m.health, m.hp + gain);
    if (m.hp > 0) { m.down = false; m.dying = null; }
    note(`Heal (${h.name}, a Wound Kit${t ? `, ${t.text}` : ", no pocket set"}): ${m.name}, ${before} → ${m.hp} health.`, "reward");
  }
}

/** Treat Injury: an Injury Kit clears one Injury, with no roll; without a pocket set, a roll with Impotence against 4. */
export function treatInjuries(state, rng, note) {
  const h = state.party.roles.healer && healerOf(state, state.party.roles.healer);
  if (!h || h.id !== state.party.roles.healer) return;
  const pocket = count(state, "Surgeon's Pocket Set") > 0;
  for (const m of state.party.members.filter(x => !x.dead && x.injuries > 0)) {
    while (m.injuries > 0) {
      if (!take(state, "Injury Kit")) { note(`No Injury Kits left for ${m.name}'s injur${m.injuries === 1 ? "y" : "ies"}.`); return; }
      if (!untrainedHands(rng, note, h, "Injury Kit")) continue;
      if (!pocket) {
        const t = trial(rng, [tradeDie(healerLevel(h)), dieOfTier(tierOf(h.attributes.intelligence))], { edge: -1 });
        if (!passes(t, 4)) { note(`${h.name} can't set ${m.name}'s injury without the pocket set (${t.text} against 4); the kit is wasted.`); continue; }
      }
      m.injuries -= 1;
      note(`${h.name} treats an Injury of ${m.name}'s (an Injury Kit): ${m.injuries ? `${m.injuries} left` : "none left"}.`, "reward");
    }
  }
}

/**
 * Repair (Blacksmith Discipline): (Trade mastery die + Intelligence tier die)
 * × 4 durability per repair kit, one exploration round each, with a hammer.
 * An evening's 8 hours of activity is 48 rounds, so the kits are the limit.
 */
export function repairGear(state, rng, note) {
  const id = state.party.roles.smith;
  const s = id && state.party.members.find(m => m.id === id && up(m));
  if (!s) return;
  if (!count(state, "Hammer")) { note(`${s.name} has no hammer to work with.`); return; }
  const lvl = s.skills?.blacksmith || 1;
  for (const m of state.party.members.filter(x => !x.dead)) {
    for (const piece of [m.armor, m.shield].filter(x => x && x.durability < x.max)) {
      while (piece.durability < piece.max) {
        if (!take(state, "Repair Kit")) { note("No repair kits left."); return; }
        const t = trial(rng, [tradeDie(lvl), dieOfTier(tierOf(s.attributes.intelligence))]);
        const before = piece.durability;
        piece.durability = Math.min(piece.max, piece.durability + t.total * 4);
        note(`${s.name} works on ${m.name}'s ${piece.name.toLowerCase()} (a repair kit, (${t.text}) × 4): ${before} → ${piece.durability}.`, "camp");
      }
    }
  }
}

/** Who can save the dying after a fight, and with what: a Wound Kit, or a healing spell and the magan for it. */
export function healingMeans(state, standing) {
  if (count(state, "Wound Kit") > 0) { const h = healerOf(state, state.party.roles.healer); if (h) return { who: h.name, what: "a Wound Kit", kit: true }; }
  for (const m of standing) {
    const spell = (m.spells || []).find(sp => sp === "Mend" || sp === "Mend Flesh");
    if (spell && (m.mp ?? 0) > 0) return { who: m.name, what: spell };
  }
  return null;
}
