/**
 * TRAVEL RULES (pure, Rest Phase 2b, 2026-09-30). General Rules § Travel:
 *
 *   Pace      Distance / Day   Travel trials
 *   Marathon  ×2               Penalty −6 (double water and rations)
 *   Fast      ×1.5             Penalty −4
 *   Normal    ×1               Penalty −2
 *   Slow      ×0.5             no penalty
 *
 *   Travel trials: the mastery trials you make for a Traveling Role while
 *   on the move. Attribute trials (Pushing the Pace, Startle, resisting
 *   conditions) never are (Jon 2026-09-30).
 *
 *   Pushing the Pace: after a day faster than Normal or longer than 8
 *   hours, an Endurance attribute trial, DC 2 + 1 per Fast hour + 2 per
 *   Marathon hour + 1 per hour beyond 8; failure advances Exhausted 1, or
 *   2 if any of the day was at Marathon pace.
 *
 *   Movement: a Day covers 18 + Speed miles, a Travel Round a Day ÷ 8; the
 *   pace multiplies it.
 *
 * Foundry pre-ticks the penalty only on a mastery trial in the character's
 * role skills, out of combat (Jon 2026-09-30: roles picker, option B);
 * the table can always tick / untick it.
 */

export const PACES = {
  marathon: { label: "Marathon", mult: 2,   penalty: 6 },
  fast:     { label: "Fast",     mult: 1.5, penalty: 4 },
  normal:   { label: "Normal",   mult: 1,   penalty: 2 },
  slow:     { label: "Slow",     mult: 0.5, penalty: 0 }
};

/**
 * Traveling Roles → the trials that serve them (General Rules § Traveling
 * Roles). Since 2026-10-13 (disciplines tracked, Jon's go) entries name the
 * discipline: "skill:Record"; "lore:@creature" = any Creature Lore; a bare
 * skill = any trial in it (Sage: "Lore (applicable discipline)", "Trade
 * (applicable discipline)"); "trade:<track>" = a Trade discipline.
 */
export const CREATURE_LORES = ["Asura Lore", "Daeva Lore", "Dragon Lore", "Fae Lore", "Morphon Lore", "Primordial Lore"];
export const TRAVEL_ROLES = {
  "":         { label: "—",                skills: [] },
  healer:     { label: "Healer",           skills: ["trade:healer"] },
  helper:     { label: "Helper",           skills: [] },
  hunter:     { label: "Hunter / Forager", skills: ["wilderness:Hunting and Foraging", "wilderness:Beast Lore", "lore:@creature"] },
  navigator:  { label: "Navigator",        skills: ["wilderness:Orienteering", "wilderness:Weather Sense", "lore:Stone Lore"] },
  sage:       { label: "Sage",             skills: ["lore", "trade"] },
  scout:      { label: "Scout",            skills: ["alertness:Danger Sense", "alertness:Stalking", "wilderness:Orienteering", "wilderness:Weather Sense", "wilderness:Beast Lore", "lore:@creature"] },   // spotting ambushes is a Perception attribute trial (no pace penalty)
  teamster:   { label: "Teamster",         skills: ["wilderness:Riding", "wilderness:Beast Lore"] },
  watchman:   { label: "Watchman",         skills: ["lore:@creature"] }   // detection is a Perception attribute trial (General Rules 2026-10-16)
};

export const EMPTY_TRAVEL = { traveling: false, pace: "normal", roles: {}, excluded: {}, hours: { total: 0, fast: 0, marathon: 0 } };

/** Slowest land Speed among the travellers; creatures without one (0) don't count. null if none. */
export function slowestSpeed(speeds) {
  const s = (speeds || []).map(Number).filter(v => v > 0);
  return s.length ? Math.min(...s) : null;
}

/**
 * Does this trial serve the role? record = the skill record fired (its
 * discipline); without one (a generic skill trial) any entry in the skill
 * counts.
 */
export function roleCovers(role, skill, subKey = "", record = "") {
  const list = TRAVEL_ROLES[role]?.skills || [];
  if (list.includes(skill)) return true;
  if (skill === "trade" && !!subKey && list.includes(`trade:${subKey}`)) return true;
  if (!record) return list.some(e => e.split(":")[0] === skill && !e.startsWith("trade:"));
  if (list.includes(`${skill}:${record}`)) return true;
  return skill === "lore" && list.includes("lore:@creature") && CREATURE_LORES.includes(record);
}

/** The penalty field for a mastery trial: null when not traveling (no field). */
export function paceField(travel, role, skill, subKey, inCombat, record = "") {
  if (!travel?.traveling) return null;
  const pace = PACES[travel.pace] || PACES.normal;
  return { penalty: pace.penalty, label: pace.label, checked: !!pace.penalty && !inCombat && roleCovers(role, skill, subKey, record) };
}

/** One more Travel Round at `pace`. */
export function logTravelHour(hours, pace) {
  const h = { total: 0, fast: 0, marathon: 0, ...(hours || {}) };
  return { total: h.total + 1, fast: h.fast + (pace === "fast" ? 1 : 0), marathon: h.marathon + (pace === "marathon" ? 1 : 0) };
}

/** Pushing the Pace: { needed, dc, advance }. */
export function pushingThePace(hours) {
  const h = { total: 0, fast: 0, marathon: 0, ...(hours || {}) };
  const beyond = Math.max(0, h.total - 8);
  const needed = h.fast > 0 || h.marathon > 0 || beyond > 0;
  return { needed, dc: 2 + h.fast + 2 * h.marathon + beyond, advance: h.marathon > 0 ? 2 : 1, beyond };
}

/** Miles per Travel Round (one decimal) at `speed` and `pace`. */
export function milesPerTravelRound(speed, pace = "normal") {
  const s = Math.max(0, Number(speed) || 0);
  const mult = (PACES[pace] || PACES.normal).mult;
  return Math.round(((18 + s) / 8) * mult * 10) / 10;
}
