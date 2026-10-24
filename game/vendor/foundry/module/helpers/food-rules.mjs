/**
 * FOOD (pure, inventory 7e, 2026-10-03). General Rules § Resting:
 *   "You can benefit from up to two meals a day, and only one of them can be
 *   a Banquet. Each ration is one meal. Food restores health based on your
 *   Endurance tier and magan based on your casting tier."
 *   Food table — Rations, Iron: Tier · Rations, Standard: Tier x2 · Rations,
 *   Dry (Cooked): Tier x2 · Meal (Poor): Tier · Meal (Common): Tier x2 ·
 *   Meal (Good): 3 TD · Meal (Banquet): 4 TD (1/day).
 *   "Hot Meals. Cooked Dry rations and meals prepared at an inn are hot meals.
 *   A Poor meal is hot if it is served fresh, at the GM's discretion. If you
 *   eat a hot meal, add your Endurance tier to the health and your casting
 *   tier to the magan you recover during your next rest. The bonus applies
 *   once per rest, no matter how many hot meals you eat."
 *   "Going Hungry. Each time you go a number of days equal to your Endurance
 *   tier without a meal, advance Exhausted by 1 tier." (rewritten 2026-10-22;
 *   counted in meals.mjs endMealDay, applied via weather.mjs weatherFailure)
 * § Traveling Speed — Marathon: "Double water and rations".
 * equipment_reference_2 — Rations, Dry: "requires several hours to prepare
 *   (must cook while camping)".
 * Jon (2026-10-03): every meal heals immediately; a day runs from the GM's
 * End of Day; Going Hungry is applied by hand from the End of Day card.
 */

/** Ration items by name. */
export const RATIONS = {
  "rations, iron":     { label: "Rations, Iron", mult: 1 },
  "rations, standard": { label: "Rations, Standard", mult: 2 },
  "rations, dry":      { label: "Rations, Dry (Cooked)", mult: 2, needsCooking: true }
};
/** Meals bought (inns, taverns). "Meals prepared at an inn are hot meals." */
export const MEALS = {
  poor:    { label: "Meal (Poor)", mult: 1, hot: "fresh" },
  common:  { label: "Meal (Common)", mult: 2, hot: true },
  good:    { label: "Meal (Good)", dice: 3, hot: true },
  banquet: { label: "Meal (Banquet)", dice: 4, hot: true, banquet: true }
};
export const DRY_RATION_TEXT = "requires several hours to prepare (must cook while camping)";
export const MEALS_PER_DAY = 2;

export const rationFor = (name) => RATIONS[String(name || "").trim().toLowerCase()] || null;

/**
 * What a meal restores. food = a RATIONS or MEALS entry.
 *   endTier, castTier  tiers (castTier 0 = no magan)
 * → { health: { flat } | { dice: n, tier }, magan: same | null }
 */
export function mealRecovery(food, { endTier = 0, castTier = 0 } = {}) {
  const part = (tier) => {
    if (!tier) return null;
    if (food.dice) return { dice: food.dice, tier };
    return { flat: tier * (food.mult || 1) };
  };
  return { health: part(endTier), magan: part(castTier) };
}

/** Is this meal hot? cooked = the Dry ration was cooked; fresh = a Poor meal served fresh. */
export function isHot(food, { cooked = false, fresh = false } = {}) {
  if (food?.needsCooking) return !!cooked;
  if (food?.hot === "fresh") return !!fresh;
  return !!food?.hot;
}

/** Meal state for today. state = { day, count, banquets, hot }. */
export function mealsToday(state, day) {
  const s = state || {};
  return s.day === day ? { count: Number(s.count) || 0, banquets: Number(s.banquets) || 0 } : { count: 0, banquets: 0 };
}

/** Warnings before eating (never a block). */
export function mealWarnings(state, day, food) {
  const t = mealsToday(state, day);
  const w = [];
  if (t.count >= MEALS_PER_DAY) w.push(`Already ${t.count} meals today — "You can benefit from up to two meals a day."`);
  if (food?.banquet && t.banquets >= 1) w.push(`Already had a Banquet today — "only one of them can be a Banquet."`);
  return w;
}

/** New state after eating. */
export function afterMeal(state, day, food, hot) {
  const t = mealsToday(state, day);
  return { day, count: t.count + 1, banquets: t.banquets + (food?.banquet ? 1 : 0), hot: !!(state?.hot || hot) };
}

/** Did this creature eat today? */
export const ateToday = (state, day) => mealsToday(state, day).count > 0;
