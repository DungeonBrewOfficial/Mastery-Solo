/**
 * HOARD RULES (pure, 2026-10-13). The Treasure generator's result rows, the
 * Hoard-by-value fill, and the coin share. Classes handoff 2026-10-13,
 * "Answers to your generator questions":
 *   - Fur habitats come from Treasure.md › Pelt Reference (Habitat column).
 *   - No tiers yet: by value only (tiers need their own design pass).
 *   - Regional Trade is gone from loot: value belongs to the item; what a
 *     buyer pays happens at the sale. Nothing here shows market prices.
 *   - Coin in hoards: a GM setting, "X% of the hoard's value in coin".
 * Jon (2026-10-13): coin share paid Largest, Random, or a typed Split; 10%
 * tolerance, the card states "over by / under by"; the GM edits the card
 * (remove, reroll, add) before Keep.
 *
 * Hoard fill: real items rolled on the Treasure.md tables, one after another
 * (no hunting for close matches, so the spread stays honest). A roll that
 * would overshoot the target by more than the tolerance is set aside; the
 * fill stops once within the tolerance, or after a fixed number of tries.
 */
import * as T from "../data/treasure-data.mjs";
import * as TR from "./treasure-rules.mjs";
import { COINS, COMMON_COINS, makeChange, emptyCoins, valueFar, coinSpace, coinsLabel } from "./coin-rules.mjs";

export const KINDS = { gems: "Gems", jewelry: "Jewelry", plate: "Plate and Objects", tapestry: "Tapestry", embroidery: "Embroidery", carpet: "Carpet",
  painting: "Painting", glass: "Stained Glass", statue: "Statue", fur: "Furs" };
export const HABITATS = ["Woodland", "Mountain", "Arctic", "Plains", "Desert", "Jungle", "Domestic", "Aquatic"].filter(h => (T.HABITAT_LIST || []).includes(h))
  .concat((T.HABITAT_LIST || []).filter(h => !["Woodland", "Mountain", "Arctic", "Plains", "Desert", "Jungle", "Domestic", "Aquatic"].includes(h)));
export const TOLERANCE = 0.10;
export const MAX_TRIES = 400;
export const MAX_PIECES = 120;

const spTxt = (v) => `${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })} sp`;
const CLOTH = ["tapestry", "embroidery", "carpet", "painting", "glass"];

/** Furs in a habitat ("" = any). */
export const fursIn = (habitat) => (habitat ? T.FURS.filter(f => (f.habitat || []).includes(habitat)) : T.FURS);

export function encSys(enc, lbs) {
  if (enc === "NE") return { category: "treasure", enc: "NE", weightLbs: lbs ?? 0 };
  if (enc && typeof enc === "object") return { category: "treasure", enc: "N", encPoints: enc.points, weightLbs: lbs ?? 0 };
  return { category: "treasure", enc: enc || "L", weightLbs: lbs ?? 0 };
}

/**
 * Roll `count` pieces of one kind. fix = the chosen values (the generator's
 * fields; anything left out is rolled). Each row carries `src` = { kind, fix }
 * so the card can reroll it the same way.
 * → { title, log, results: [{ name, unit, qty, kind, sys, carry, desc, extra, src }] }
 */
export function rollPiece(d, kind, fix = {}, count = 1) {
  const results = [], log = [];
  const src = { kind, fix: { ...fix } };
  const n = Math.max(1, Number(count) || 1);
  if (kind === "gems") {
    const groups = new Map();
    for (let i = 0; i < n; i++) {
      const g = TR.rollGem(d, { grade: fix.grade, gem: fix.gem, quality: fix.quality, carats: fix.carats }, "Broad", log);
      const key = TR.gemLabel(g);
      if (!groups.has(key)) groups.set(key, { g, count: 0 });
      groups.get(key).count++;
    }
    for (const { g, count: c } of groups.values()) results.push({ name: `${g.name} (${g.quality}, ${g.carats} ct)`, unit: g.value, qty: c, kind: "gem",
      sys: { category: "gem", enc: "NE", weightLbs: 0 }, carry: "Fits", desc: T.GEM_DESCRIPTIONS[g.name] || "", src: { kind: "gems", fix: { ...fix } } });
    return { title: `${n} gem${n === 1 ? "" : "s"}`, log, results };
  }
  if (kind === "jewelry" || kind === "plate") {
    for (let i = 0; i < n; i++) {
      const p = TR.workedPiece(d, kind, { type: fix.type, material: fix.material, hardstone: fix.hardstone, craft: fix.craft, craftNum: fix.craftNum,
        embellishment: fix.embellishment, inlay: fix.inlay, gems: fix.gems });
      const gemLines = p.gems.stones.map(s => `${s.role === "center" ? "Center" : s.role === "beads" ? `${s.count} beads` : "Pair"}: ${TR.gemLabel(s.gem)} — ${spTxt(s.gem.value)}${s.count > 1 ? " each" : ""}`);
      const desc = (kind === "plate" ? T.PLATE_DESCRIPTIONS : T.JEWELRY_DESCRIPTIONS)[p.type] || "";
      log.push(...p.log);
      results.push({ name: TR.pieceName(p), unit: p.value, qty: 1, kind, sys: { category: "treasure", enc: p.enc, weightLbs: p.weightLbs ?? 0 }, carry: p.carry, desc, extra: gemLines, src });
    }
    return { title: KINDS[kind], log, results };
  }
  if (CLOTH.includes(kind)) {
    for (let i = 0; i < n; i++) {
      const p = TR.clothPiece(d, kind, { size: fix.size, grade: fix.grade, condition: fix.condition, onFloor: !!fix.onFloor, gems: fix.gems, subject: fix.subject });
      const label = { tapestry: "tapestry", embroidery: "embroidery", carpet: "carpet", painting: "painting", glass: "stained glass panel" }[kind];
      const name = `${p.condition} ${p.size.toLowerCase()} ${p.grade.toLowerCase()} ${label}${p.subject ? ` (${p.subject})` : ""}`;
      const gemLines = p.gems.stones.map(s => `${s.role === "center" ? "Center" : "Pair"}: ${TR.gemLabel(s.gem)} — ${spTxt(s.gem.value)}${s.count > 1 ? " each" : ""}`);
      log.push(...p.log);
      results.push({ name: name.charAt(0).toUpperCase() + name.slice(1), unit: p.value, qty: 1, kind, sys: encSys(p.enc, p.weightLbs), carry: p.carry, extra: gemLines, src });
    }
    return { title: KINDS[kind], log, results };
  }
  if (kind === "statue") {
    for (let i = 0; i < n; i++) {
      const p = TR.statuePiece(d, { size: fix.size, material: fix.material, condition: fix.condition });
      log.push(...p.log);
      results.push({ name: `${p.condition} ${p.size.toLowerCase()} ${p.material.toLowerCase()} statue`.replace(/^./, c => c.toUpperCase()), unit: p.value, qty: 1, kind,
        sys: encSys(p.enc, p.weightLbs), carry: p.carry, src });
    }
    return { title: "Statue", log, results };
  }
  if (kind === "fur") {
    let animal = fix.animal;
    if (!animal) {
      const pool = fursIn(fix.habitat);
      if (!pool.length) throw new Error(`fur: no animal lives in "${fix.habitat}"`);
      const r = d(pool.length); animal = pool[r - 1].name;
      log.push(`animal: 1d${pool.length} ${r} → ${animal}${fix.habitat ? ` (${fix.habitat})` : ""}`);
    }
    const state = fix.state || "dressed";
    const p = TR.pelts(d, animal, n, state, fix.quality || null);
    log.push(...p.log);
    for (const g of p.groups) results.push({ name: `${p.name} pelt (${g.quality}${state !== "dressed" ? `, ${state === "fresh" ? "fresh" : "with skull and paws"}` : ""})`,
      unit: g.value, qty: g.count, kind: "fur", sys: encSys(p.enc, p.weightLbs), carry: p.carry, desc: "", src });
    return { title: `${p.name} pelts`, log, results };
  }
  throw new Error(`treasure: unknown kind "${kind}"`);
}

/** Total value of rows, sp (to the farthing). */
export const rowsValue = (rows) => Math.round((rows || []).reduce((s, r) => s + (Number(r.unit) || 0) * (Number(r.qty) || 0), 0) * 4) / 4;

/** Rows of the same name and value merge into one (quantity adds). */
export function mergeRows(rows) {
  const out = [];
  for (const r of rows) {
    const m = out.find(x => x.name === r.name && x.unit === r.unit && x.kind === r.kind && !x.extra?.length && !r.extra?.length);
    if (m) m.qty += r.qty; else out.push({ ...r });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Coin share. Modes: "largest" (fewest coins, largest first), "random"
 * (each coin a random share, d100 weights), "split" (typed percentages).
 * Values pass down: whatever a coin can't hold exactly goes to the next
 * smaller coin, and the last remainder is made in change, so nothing is lost.
 * ------------------------------------------------------------------ */
export const coinPool = (common = true) => (common ? COINS.filter(c => COMMON_COINS.includes(c.key)) : COINS);

/** Share `far` by weights { key: w } over the pool, largest coin first. */
function allocate(far, weights, pool, mode) {
  const out = emptyCoins();
  const total = Object.values(weights).reduce((s, w) => s + Math.max(0, Number(w) || 0), 0);
  if (!(total > 0) || far <= 0) return makeChange(far, mode);
  let carry = 0, placed = 0;
  for (const c of [...pool].reverse()) {
    const w = Math.max(0, Number(weights[c.key]) || 0);
    const share = Math.floor(far * w / total) + carry;
    const k = Math.floor(share / c.far);
    out[c.key] += k; carry = share - k * c.far; placed += k * c.far;
  }
  const left = far - placed;
  if (left > 0) { const ch = makeChange(left, mode); for (const k of Object.keys(ch)) out[k] += ch[k]; }
  return out;
}

/**
 * The coin share of a hoard. opts: { far, mode, common, split: { key: % } }.
 * → { ok, coins, far, log, reason }
 */
export function coinShareOf(d, { far, mode = "largest", common = true, split = {} } = {}) {
  far = Math.max(0, Math.round(Number(far) || 0));
  const changeMode = common ? "common" : "fewest";
  const pool = coinPool(common);
  const log = [];
  if (far <= 0) return { ok: true, coins: emptyCoins(), far: 0, log };
  if (mode === "split") {
    const sum = pool.reduce((s, c) => s + Math.max(0, Number(split[c.key]) || 0), 0);
    if (Math.abs(sum - 100) > 0.001) return { ok: false, reason: `The coin split adds up to ${sum}%, not 100%.`, coins: emptyCoins(), far: 0, log };
    const coins = allocate(far, split, pool, changeMode);
    log.push(`coin split: ${pool.filter(c => Number(split[c.key]) > 0).map(c => `${c.abbr} ${split[c.key]}%`).join(", ")}`);
    return { ok: true, coins, far: valueFar(coins), log };
  }
  if (mode === "random") {
    const w = {};
    for (const c of pool) w[c.key] = d(100);
    log.push(`coin shares (d100 each): ${[...pool].reverse().map(c => `${c.abbr} ${w[c.key]}`).join(", ")}`);
    const coins = allocate(far, w, pool, changeMode);
    return { ok: true, coins, far: valueFar(coins), log };
  }
  const coins = makeChange(far, changeMode);
  log.push(`coins: largest first${common ? " (common coins)" : ""}`);
  return { ok: true, coins, far: valueFar(coins), log };
}

/**
 * Hoard by value. opts: { target (sp), kinds: [..], habitat, coinPct,
 * coinMode, common, split }. → { ok, reason, target, rows, coins, coinFar, log, tries }
 */
export function hoardByValue(d, opts = {}) {
  const target = Math.max(0, Number(opts.target) || 0);
  const kinds = (opts.kinds || []).filter(k => KINDS[k]);
  const coinPct = Math.min(100, Math.max(0, Number(opts.coinPct) || 0));
  if (!(target > 0)) return { ok: false, reason: "Enter a target value in sp." };
  if (!kinds.length && coinPct < 100) return { ok: false, reason: "Tick at least one kind of treasure (or set coin to 100%)." };
  const log = [`hoard: target ${spTxt(target)}, ${coinPct}% in coin, kinds: ${kinds.map(k => KINDS[k]).join(", ") || "none"}${opts.habitat ? `, furs from ${opts.habitat}` : ""}`];
  const coin = coinShareOf(d, { far: Math.round(target * coinPct / 100 * 4), mode: opts.coinMode, common: opts.common !== false, split: opts.split });
  if (!coin.ok) return { ok: false, reason: coin.reason };
  log.push(...coin.log);
  const itemsTarget = target - coin.far / 4;
  const slack = target * TOLERANCE;
  let rows = [], sum = 0, tries = 0, pieces = 0;
  while (itemsTarget > 0 && sum < itemsTarget - slack && tries < MAX_TRIES && pieces < MAX_PIECES) {
    tries++;
    const kind = kinds[d(kinds.length) - 1];
    const fix = kind === "fur" ? { habitat: opts.habitat || "" } : {};
    const res = rollPiece(d, kind, fix, 1);
    const v = rowsValue(res.results);
    if (sum + v > itemsTarget + slack) { log.push(`set aside: ${res.results.map(r => r.name).join(", ")} (${spTxt(v)}) would overshoot`); continue; }
    sum += v; pieces++;
    rows.push(...res.results);
    log.push(...res.log, `→ ${res.results.map(r => r.name).join(", ")}: ${spTxt(v)}`);
  }
  if (tries >= MAX_TRIES || pieces >= MAX_PIECES) log.push(`stopped after ${tries} rolls, ${pieces} pieces`);
  rows = mergeRows(rows);
  return { ok: true, target, rows, coins: coin.coins, coinFar: coin.far, log, tries };
}

/** "Target 2,000 sp · rolled 2,140 sp · over by 7%" */
export function targetLine(target, total) {
  if (!(target > 0)) return "";
  const pct = Math.round((total - target) / target * 100);
  const how = pct === 0 ? "on target" : pct > 0 ? `over by ${pct}%` : `under by ${-pct}%`;
  return `Target ${spTxt(target)} · rolled ${spTxt(total)} · ${how}`;
}

/** The coin line: "312 SP, 4 SS — 504 sp · 1 Light object" */
export function coinLine(coins) {
  const far = valueFar(coins);
  if (!far) return "";
  const space = coinSpace(coins);
  return `${coinsLabel(coins)} — ${spTxt(far / 4)} · ${space ? `${space} Light object${space === 1 ? "" : "s"} of space` : "a handful (no space)"}`;
}
