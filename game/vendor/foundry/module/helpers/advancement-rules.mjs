/**
 * ADVANCEMENT RULES (pure, 2026-10-11). Mastery Core Classes:
 *   Rolling Attributes — "a pool of dice equal to 36 Tiers"; "roll a minimum
 *     of 3dx per attribute"; "you may choose to EITHER swap any two scores or
 *     re-roll any 1 attribute"; "You gain 3 points to apply to any
 *     attributes: 1 point for being a level 1 character, and 2 starting
 *     points. The points from Leveling begin when you reach level 2."
 *   Leveling — "a number of points equal to your level … until you reach
 *     level 10, at which point you always gain 10 points per level."
 *   Experience tables (CLASS_XP, generated) — "When this number of
 *     Experience Points have been earned, you automatically move up to the
 *     next level of experience."
 *   Beyond Level 30 — "Each level beyond 30 requires 50 more experience
 *     than the level before it, grants 10 attribute points".
 * General Rules › Exploration Experience (Classes 2026-10-11): the table,
 *   no level multiplier; "Each character receives the full experience".
 */
import { CLASS_XP, RECOMMENDED_DICE } from "../data/chargen-data.mjs";

/* ---------------- attribute dice ---------------- */
export const TIER_SETS = { 1: "3d2", 2: "3d3", 3: "3d4", 4: "3d6", 5: "3d8", 6: "3d10", 7: "3d12" };
export const POOL_TIERS = 36;
export const STARTING_POINTS = 3;
export const tierOfSet = (set) => Number(Object.entries(TIER_SETS).find(([, s]) => s === String(set).replace(/\s+/g, ""))?.[0]) || 0;
/** Tiers used by an { attr: "3d6" } assignment, and whether it's legal (every attribute at least 3d2; total ≤ 36). */
export function poolCheck(sets) {
  const vals = Object.values(sets || {});
  const used = vals.reduce((n, s) => n + tierOfSet(s), 0);
  const missing = vals.some(s => !tierOfSet(s));
  return { used, left: POOL_TIERS - used, ok: !missing && used <= POOL_TIERS, over: used > POOL_TIERS, missing };
}
export const recommendedDice = (className) => RECOMMENDED_DICE[className] || null;

/* ---------------- attribute points ---------------- */
/** Leveling points for reaching one level (none at level 1 — the 3 starting points cover it). */
export const levelPoints = (level) => (Number(level) >= 2 ? Math.min(Number(level), 10) : 0);
/** Points earned through a level: 3 at creation + leveling from level 2. */
export function attributePointsEarned(level) {
  let n = STARTING_POINTS;
  for (let l = 2; l <= Math.floor(Number(level) || 1); l++) n += levelPoints(l);
  return n;
}

/* ---------------- experience ---------------- */
/** XP needed to reach a level (level 1 = 0); past 30 each level needs 50 more than the one before. */
export function xpForLevel(className, level) {
  const t = CLASS_XP[className];
  const L = Math.floor(Number(level) || 1);
  if (!t || L <= 1) return 0;
  if (L <= t.length) return t[L - 1];
  let xp = t[t.length - 1], step = t[t.length - 1] - t[t.length - 2];
  for (let l = t.length + 1; l <= L; l++) { step += 50; xp += step; }
  return xp;
}
/** The level a total XP reaches (null when the class has no table). */
export function levelForXp(className, xp) {
  if (!CLASS_XP[className]) return null;
  let L = 1;
  while (xpForLevel(className, L + 1) <= (Number(xp) || 0) && L < 999) L++;
  return L;
}
export const hasXpTable = (className) => !!CLASS_XP[className];

/** What moving from one level to another grants (attribute points; levels gained). */
export function levelUpGains(from, to) {
  let points = 0;
  for (let l = Math.floor(from) + 1; l <= Math.floor(to); l++) points += levelPoints(l);
  return { levels: Math.max(0, Math.floor(to) - Math.floor(from)), points };
}

/* ---------------- exploration experience ---------------- */
export const EXPLORATION_XP = [
  { key: "emptyRoom", label: "Empty Room", xp: 1 },
  { key: "treasure", label: "Treasure", xp: 1 },
  { key: "occupiedRoom", label: "Occupied Room", xp: 2 },
  { key: "trap", label: "Traps/Locks/Puzzle", xp: 3 },
  { key: "hiddenTreasure", label: "Hidden Treasure", xp: 5 },
  { key: "magicTreasure", label: "Magic Treasure", xp: 8 },
  { key: "newLocation", label: "New Location", xp: 10 },
  { key: "hoard", label: "Hoard", xp: 20 },
  { key: "secretRoom", label: "Secret Room", xp: 20 },
  { key: "hiddenHoard", label: "Hidden Hoard", xp: 25 },
  { key: "hiddenLocation", label: "Hidden Location", xp: 50 },
  { key: "lostLocation", label: "Lost Location", xp: 75 },
  { key: "newPlane", label: "New Plane", xp: 100 }
];
/** counts { key: n } + extra → total awarded to EACH character (no split, no multiplier). */
export function explorationTotal(counts = {}, extra = 0) {
  return EXPLORATION_XP.reduce((s, r) => s + r.xp * Math.max(0, Number(counts[r.key]) || 0), 0) + (Number(extra) || 0);
}

/* ---------------- points → score → tier (QoL hints, 2026-10-11) ---------------- */
// Core Classes › Applying Points to Scores: each box costs its tier in points
// (Tier 1 boxes 1 point … Tier 6 boxes 6); a new tier every 5 score; 105
// points = score 30 (Tier 7). Rules math lives in config (pointsToScore).
import { pointsToScore, scoreToTier, tierToTierDie } from "../config.mjs";
export const MAX_ATTR_POINTS = 105;
/** { score, tier, die, nextScoreAt, nextTierAt } for a points total (next… null at the top). */
export function pointsInfo(points) {
  const p = Math.max(0, Math.floor(Number(points) || 0));
  const score = pointsToScore(p), tier = scoreToTier(score);
  let nextScoreAt = null, nextTierAt = null;
  for (let q = p + 1; q <= MAX_ATTR_POINTS; q++) {
    const s = pointsToScore(q);
    if (nextScoreAt === null && s > score) nextScoreAt = q;
    if (scoreToTier(s) > tier) { nextTierAt = q; break; }
  }
  return { points: p, score, tier, die: tierToTierDie(tier), nextScoreAt, nextTierAt };
}
/** One-line hint: "score 10 · T3 (1d4) — next score at 18 (+1), next tier at 30 (+13)". */
export function pointsHint(points) {
  const i = pointsInfo(points);
  const parts = [];
  if (i.nextScoreAt !== null) parts.push(`next score at ${i.nextScoreAt} (+${i.nextScoreAt - i.points})`);
  if (i.nextTierAt !== null) parts.push(`next tier at ${i.nextTierAt} (+${i.nextTierAt - i.points})`);
  return `score ${i.score} · T${i.tier} (${i.die})${parts.length ? ` — ${parts.join(", ")}` : " — maximum"}`;
}
/** What adding points changed: "+1 score, +1 tier" | "no change yet — 1 more for score 11" | "". */
export function pointsDelta(from, to) {
  const a = pointsInfo(from), b = pointsInfo(to);
  if (b.points <= a.points) return "";
  const ds = b.score - a.score, dt = b.tier - a.tier;
  if (ds || dt) return [ds ? `+${ds} score` : "", dt ? `+${dt} tier` : ""].filter(Boolean).join(", ");
  return b.nextScoreAt !== null ? `no change yet — ${b.nextScoreAt - b.points} more for score ${b.score + 1}` : "no change (maximum)";
}
