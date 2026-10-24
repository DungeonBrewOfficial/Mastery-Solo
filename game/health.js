/**
 * TRAUMAS AND THEIR HEALING (Combat, Trauma Table; Skill Mastery, Healer
 * Discipline, Treat Trauma). Each Trauma carries its recovery as the table
 * words it: days of rest, a Healer's treatment first (set, reset, tend,
 * stop the bleeding), daily tending to a count of successes, or nothing,
 * which is permanent. Hard to Kill heals everything on its own toll.
 */
import { TRAUMA_TABLE } from "./vendor/foundry/module/data/trauma-table.mjs";
import { trial, passes, tierOf, dieOfTier } from "./mastery.js";

/** What a Trauma needs, read from its recovery line. */
export function recoveryOf(recovery = "") {
  const r = String(recovery);
  const days = Number(/(\d+) days' rest/.exec(r)?.[1] || 0);
  const successes = Number(/(\d+) successes/.exec(r)?.[1] || 0);
  const treat = /\(Healer\)/.test(r) ? (/^(\w+)/.exec(r)?.[1] || "Treat") : null;
  return { days, successes, treat, permanent: /^(None|Prosthesis)$/.test(r) || /same day only/.test(r) };
}
/** Fill in a Trauma recorded before recovery was tracked. */
export function ensureTrauma(t) {
  if (t.recovery === undefined) t.recovery = TRAUMA_TABLE.find(r => r.name === t.name)?.recovery || "";
  t.restDays ??= 0; t.done ??= 0; t.treated ??= false;
  return t;
}
/** Is this Trauma still waiting on a Healer? */
export const needsHealer = (t) => { const r = recoveryOf(t.recovery); return !!r.treat && !t.treated || (r.successes > 0 && t.done < r.successes); };
export const TREAT_DC = { Minor: 5, Severe: 7, Grievous: 9 };

/**
 * Treat Trauma (Healer Discipline): a Trauma Kit, a roll of Trade mastery
 * die + Intelligence tier die against the Trauma's tier. Minor treatments
 * need a pocket set, Severe and Grievous a surgeon's chest; without the tools
 * the roll has Impotence. A bone set badly (missed by 5 or more) still heals,
 * but leaves a Minor Trauma when it does.
 */
export function treatTrauma(rng, healer, t, { pocket = false, chest = false, edge = 0 } = {}) {
  ensureTrauma(t);
  const tools = t.tier === "Minor" ? pocket || chest : chest;
  const dc = TREAT_DC[t.tier] || 7;
  const roll = trial(rng, [dieOfTier(healer.skills?.healer || 1), dieOfTier(tierOf(healer.attributes.intelligence))], { edge: edge + (tools ? 0 : -1) });
  const ok = passes(roll, dc);
  const r = recoveryOf(t.recovery);
  if (ok) {
    if (r.successes) t.done += 1; else t.treated = true;
  } else if (r.treat === "Set" && dc - roll.total >= 5) { t.treated = true; t.badSet = true; }
  return { ok, roll, dc, badSet: !!t.badSet && !ok };
}

/**
 * A full day of downtime: no travel, combat, or work. Every Trauma that
 * can heal by rest (its treatment done, if it needs one) counts the day,
 * and heals when its days are in.
 */
export function restDay(m, note) {
  for (const t of (m.traumas || []).map(ensureTrauma)) {
    const r = recoveryOf(t.recovery);
    if (r.permanent || !r.days || needsHealer(t)) continue;
    t.restDays += 1;
  }
  heal(m, note);
}
/** Traumas whose treatment and rest are complete heal; a badly set bone leaves a limp or a bruise. */
export function heal(m, note) {
  const keep = [];
  for (const t of (m.traumas || []).map(ensureTrauma)) {
    const r = recoveryOf(t.recovery);
    const doneByRest = r.days ? t.restDays >= r.days : true;
    if (!r.permanent && t.tier && !needsHealer(t) && doneByRest && (r.days || r.treat || r.successes)) {
      note(`${m.name} has healed: ${t.name}.`, "reward");
      if (t.badSet) {
        const leg = /leg/i.test(t.name);
        const row = TRAUMA_TABLE.find(x => x.name === (leg ? "Limp" : "Left Arm Bruised to the Bone"));
        keep.push(ensureTrauma({ name: row.name, tier: row.tier, text: row.text, recovery: "None" }));
        note(`The bone was set badly: ${m.name} is left with a ${row.name.toLowerCase()}.`, "event");
      }
      continue;
    }
    keep.push(t);
  }
  m.traumas = keep;
}

/**
 * Hard to Kill: "Your Injuries and Traumas heal on their own, without
 * treatment. Add up their toll: 1 for each Injury or Minor Trauma, 3 for
 * each Severe, and 5 for each Grievous… 5 or less heals in 1 week, 6–10 in
 * 3 weeks, 11–15 in 6 weeks, 16–20 in 12 weeks, and 21 or more in a year and
 * a day. Anything that adds to your toll restarts the count."
 */
export const tollOf = (m) => (m.injuries || 0) + (m.toll || 0) + (m.traumas || []).reduce((n, t) => n + ({ Minor: 1, Severe: 3, Grievous: 5 }[t.tier] || 0), 0);
export const tollDays = (toll) => toll <= 5 ? 7 : toll <= 10 ? 21 : toll <= 15 ? 42 : toll <= 20 ? 84 : 366;
export function hardToKillDay(m, day, note) {
  if (!(m.abilities || []).includes("Hard to Kill")) return;
  const toll = tollOf(m);
  if (!toll) { m.tollSince = null; m.tollSeen = 0; return; }
  if (toll > (m.tollSeen || 0) || m.tollSince == null) { m.tollSince = day; m.tollSeen = toll; }
  if (day - m.tollSince < tollDays(toll)) return;
  m.injuries = 0; m.toll = 0; m.tollSince = null; m.tollSeen = 0;
  m.traumas = (m.traumas || []).filter(t => !t.tier);
  if (m.lock) m.lock.deathless = 0;
  note(`${m.name}'s wounds close on their own, as the curse has it: Injuries and Traumas healed.`, "reward");
}
