/**
 * WEATHER (pure, 2026-10-22). General Rules › Weather, Weather Tables;
 * Equipment › Clothing (Weather column); Resting › Going Hungry / Thirsty.
 *
 *   Bands: "Extreme Cold Below 10°F · Cold 10–40 · Temperate 40–80 · Hot
 *   80–100 · Extreme Heat Above 100". The tables' "Usual band" column puts
 *   40 in Temperate and 80 in Hot, so: <10, 10–39, 40–79, 80–100, >100.
 *   "Windy: wind of 30 mph or more." "Wet: any precipitation."
 */
export const BANDS = ["extremeCold", "cold", "temperate", "hot", "extremeHeat"];
export const BAND_LABELS = { extremeCold: "Extreme Cold", cold: "Cold", temperate: "Temperate", hot: "Hot", extremeHeat: "Extreme Heat" };
export const bandKey = (label) => Object.keys(BAND_LABELS).find(k => BAND_LABELS[k] === label) || "";
export function bandOf(tempF) {
  const t = Number(tempF);
  if (!Number.isFinite(t)) return "temperate";
  return t < 10 ? "extremeCold" : t < 40 ? "cold" : t < 80 ? "temperate" : t <= 100 ? "hot" : "extremeHeat";
}
export const STRONG_WIND = 30;
export const isWindy = (mph) => (Number(mph) || 0) >= STRONG_WIND;

/** Row for a die result on a table (rows carry lo / hi). */
export const rowFor = (rows, n) => (rows || []).find(r => n >= r.lo && n <= r.hi) || null;

/**
 * Today's weather from a table row and its rolled numbers.
 * precipAmount: the rolled inches (null when the cell isn't a roll, e.g. "Minimal").
 */
export function weatherFrom(row, { temp, wind, precipAmount = null, duration = null, shift = 0, season = "", extreme = false } = {}) {
  const t = Number(temp) + (Number(shift) || 0);
  const wet = !!row?.wet && (precipAmount === null || Number(precipAmount) > 0);
  return {
    name: row?.name || "", season, extreme, temp: t, band: bandOf(t), wind: Number(wind) || 0, windy: isWindy(wind),
    wet, precip: row?.precip ? (precipAmount === null ? row.precip : `${precipAmount} inch${Number(precipAmount) === 1 ? "" : "es"}`) : "",
    visibility: row?.visibility || "", lowVisibility: /^Low$/i.test(row?.visibility || ""),
    duration: duration === null ? null : Number(duration), durationUnit: row?.durationUnit || ""
  };
}

/* ------------------------------------------------------------------ *
 * Clothing
 * ------------------------------------------------------------------ */
export const COLD_SLOTS = ["head", "cloak", "hands", "feet"];
/**
 * "Dressed for the Cold. Count the cold-weather pieces you wear: one for your
 * head, one cloak, one for your hands, and one for your feet … Worn body armor
 * counts as 2 pieces. With fewer than 2 pieces, you make the trials as normal.
 * With 2 or 3, you make them with Dominance. With all 4, you make none. In
 * Extreme Cold, pieces made for Cold count toward 2 or 3, but you make no
 * trials only if every piece is made for Extreme Cold."
 * worn = [{ tags, slot }] of worn clothing; armor = body armor worn.
 * Armor isn't "made for Extreme Cold", so in Extreme Cold it never reaches "none".
 */
export function coldDress(worn = [], { armor = false, band = "cold" } = {}) {
  const bySlot = {};
  for (const w of worn || []) {
    const tags = w?.tags || [];
    if (!COLD_SLOTS.includes(w?.slot) || !(tags.includes("cold") || tags.includes("extremeCold"))) continue;
    bySlot[w.slot] = bySlot[w.slot] === "extremeCold" || tags.includes("extremeCold") ? "extremeCold" : "cold";
  }
  const pieces = Object.keys(bySlot).length + (armor ? 2 : 0);
  const allExtreme = !armor && Object.values(bySlot).length === 4 && Object.values(bySlot).every(v => v === "extremeCold");
  const mode = pieces < 2 ? "normal" : pieces < 4 ? "dominance" : (band === "extremeCold" && !allExtreme ? "dominance" : "none");
  return { pieces: Math.min(4, pieces), mode, slots: bySlot };
}
/**
 * "You are Covered if you wear a head piece and a body piece made for heat …
 * Worn body armor counts as one of the two missing. With both [Hydrated and
 * Covered], you make no heat trials. With one, you make them with Dominance."
 */
export function heatDress(worn = [], { armor = false, hydrated = false } = {}) {
  const has = (slot) => (worn || []).some(w => w?.slot === slot && (w.tags || []).includes("heat"));
  const head = has("head"), body = has("body");
  const covered = (head && body) || (armor && (head || body));
  const n = (covered ? 1 : 0) + (hydrated ? 1 : 0);
  return { covered, hydrated: !!hydrated, mode: n === 2 ? "none" : n === 1 ? "dominance" : "normal" };
}
/** "Hydrated … ½ gallon in Temperate weather, 1 gallon in Hot, and 2 in Extreme Heat. A waterskin holds ½ gallon." */
export const WATER_GALLONS = { extremeCold: 0.5, cold: 0.5, temperate: 0.5, hot: 1, extremeHeat: 2 };
export const waterskinsFor = (band) => Math.ceil((WATER_GALLONS[band] ?? 0.5) / 0.5);

/* ------------------------------------------------------------------ *
 * When trials fall due
 * ------------------------------------------------------------------ */
/**
 * "Cold … every 2 hours. Extreme Cold … at the end of each Travel Round.
 * Hot … every 2 hours. Extreme Heat … at the end of each Travel Round."
 * hoursOutdoors = hours since the weather started counting (1, 2, 3, …).
 * → { due, dc, label, kind: "cold" | "heat" } or null.
 */
export function weatherTrialDue(band, hoursOutdoors) {
  const h = Number(hoursOutdoors) || 0;
  if (band === "extremeCold") return { due: true, dc: 5, label: "Extreme Cold (Tricky, 5)", kind: "cold" };
  if (band === "extremeHeat") return { due: true, dc: 5, label: "Extreme Heat (Tricky, 5)", kind: "heat" };
  if (band === "cold") return h > 0 && h % 2 === 0 ? { due: true, dc: 4, label: "Cold (Straightforward, 4)", kind: "cold" } : null;
  if (band === "hot") return h > 0 && h % 2 === 0 ? { due: true, dc: 4, label: "Hot (Straightforward, 4)", kind: "heat" } : null;
  return null;
}
/** "Wet and Cold. While you are wet in Cold or Extreme Cold, or in strong wind …" (Tricky, 5) each round. */
export const wetAndColdApplies = (w) => !!w && (w.band === "cold" || w.band === "extremeCold" || !!w.windy);

/* ------------------------------------------------------------------ *
 * Failing, hunger and thirst
 * ------------------------------------------------------------------ */
/**
 * "A creature that fails … advances Exhausted by 1 tier. A creature that is
 * already Exhausted Tier 3 and fails falls Unconscious. It dies in a number of
 * hours equal to its Endurance tier unless it is warmed … or cooled."
 * Going Hungry: days; Going Thirsty: hours.
 */
export function failOutcome(exhaustedTier, endTier, cause) {
  if ((Number(exhaustedTier) || 0) < 3) return { exhausted: 1 };
  const n = Math.max(1, Number(endTier) || 1);
  return { unconscious: true, dies: { n, unit: cause === "hunger" ? "days" : "hours" } };
}
/**
 * "Going Hungry. Each time you go a number of days equal to your Endurance
 * tier without a meal, advance Exhausted by 1 tier."
 * daysWithout = consecutive days without a meal, counting today.
 */
export const hungerDue = (daysWithout, endTier) => { const d = Number(daysWithout) || 0, e = Math.max(1, Number(endTier) || 1); return d > 0 && d % e === 0; };
/** Deathless: "Each day past the point where you would have died adds 1 to your toll." */
export function deathlessDays(diesAt, now) {
  const past = (Number(now) || 0) - (Number(diesAt) || 0);
  return past <= 0 ? 0 : Math.floor(past / 86400) + 0;
}
/**
 * Exhausted that rest can't take: "Exhausted from going hungry or thirsty doesn't
 * recover with rest until you eat or drink"; Deathless holds Tier 3 "until your
 * toll has healed". lock = { hunger, thirst, deathless } tiers → the floor.
 */
export const exhaustFloor = (lock) => Math.min(3, Object.values(lock || {}).reduce((n, v) => n + (Number(v) || 0), 0));
export const lockedFloor = (lock) => Math.max(Math.min(3, Number(lock?.deathless) || 0), exhaustFloor({ hunger: lock?.hunger, thirst: lock?.thirst }));
