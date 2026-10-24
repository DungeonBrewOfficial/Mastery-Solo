/**
 * COINS (pure, inventory 7d, 2026-10-03). equipment_reference.md:
 *   § Coinage — Coin Conversions (12 coins, CF … GS).
 *   § Encumbrance — coin space (corrected 2026-10-13: 3,200 cf / sp /
 *     ep or 160 gs to a Light object; a handful up to 1 lb is free).
 *   § Starting Wealth — the class table.
 * Jon (2026-10-03): the purse is manual (nothing charges automatically);
 * Spend takes an amount, pays from a stash and makes change in the fewest
 * coins after a preview; coins live in stashes (one Purse to start, Split /
 * Merge for more), each with its own place.
 */

/** Coins, smallest first. far = value in copper farthings (integer math). */
export const COINS = [
  { key: "cf", label: "Copper Farthing", abbr: "CF", far: 1,   metal: "copper" },
  { key: "sh", label: "Silver Halfpenny", abbr: "SH", far: 2,   metal: "silver" },
  { key: "sp", label: "Silver Penny",    abbr: "SP", far: 4,   metal: "silver" },
  { key: "ep", label: "Electrum Penny",  abbr: "EP", far: 8,   metal: "electrum" },
  { key: "sg", label: "Silver Groat",    abbr: "SG", far: 16,  metal: "silver" },
  { key: "st", label: "Silver Tanner",   abbr: "ST", far: 24,  metal: "silver" },
  { key: "ss", label: "Silver Shilling", abbr: "SS", far: 48,  metal: "silver" },
  { key: "sf", label: "Silver Florin",   abbr: "SF", far: 96,  metal: "silver" },
  { key: "sc", label: "Silver Crown",    abbr: "SC", far: 240, metal: "silver" },
  { key: "gn", label: "Gold Noble",      abbr: "GN", far: 320, metal: "gold" },
  { key: "gm", label: "Gold Mark",       abbr: "GM", far: 640, metal: "gold" },
  { key: "gs", label: "Gold Sovereign",  abbr: "GS", far: 960, metal: "gold" }
];
const BY_KEY = Object.fromEntries(COINS.map(c => [c.key, c]));
const n = (v) => Math.max(0, Math.floor(Number(v) || 0));

export const emptyCoins = () => Object.fromEntries(COINS.map(c => [c.key, 0]));
export const cleanCoins = (coins) => Object.fromEntries(COINS.map(c => [c.key, n(coins?.[c.key])]));

/** Value in farthings. */
export const valueFar = (coins) => COINS.reduce((s, c) => s + n(coins?.[c.key]) * c.far, 0);
/** Value in sp (may be fractional: 1 cf = ¼ sp). */
export const valueSp = (coins) => valueFar(coins) / 4;

/** "1,234.5 sp" style label. */
export function spLabel(sp) {
  const v = Math.round(Number(sp) * 100) / 100;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })} sp`;
}

/** "1 SC, 2 SP" (largest first; empty → "nothing"). */
export function coinsLabel(coins) {
  const parts = [...COINS].reverse().filter(c => n(coins?.[c.key]) > 0).map(c => `${n(coins[c.key])} ${c.abbr}`);
  return parts.length ? parts.join(", ") : "nothing";
}

/**
 * Light objects of container space (Classes 2026-10-13 — SUPERSEDES the
 * 2026-10-03 numbers, which were 16× too small): "One Light object of space
 * holds 3,200 copper farthings, 3,200 sp of silver coins, 3,200 electrum
 * pennies, or 160 gs of gold coins. Work out each metal's share, add them,
 * and round up once. … A handful of coins, up to 1 lb (about 320 sp, or 16
 * gold sovereigns), takes no space." Gems (Treasure.md) are carried like
 * coins: "up to 3,200 gems take the space of one Light object", a handful
 * none — so they share the same calculation (`gems` = a count of stones).
 */
export const LIGHT_HOLDS = { cf: 3200, silverSp: 3200, ep: 3200, goldGs: 160, gems: 3200 };
export const HANDFUL_SHARE = 0.1;      // 1 lb of a 10 lb Light object
/** Unrounded share of one Light object. */
export function coinShare(coins, gems = 0) {
  const c = cleanCoins(coins);
  const silverSp = COINS.filter(x => x.metal === "silver").reduce((s, x) => s + c[x.key] * x.far, 0) / 4;
  const goldGs = COINS.filter(x => x.metal === "gold").reduce((s, x) => s + c[x.key] * x.far, 0) / 960;
  return c.cf / LIGHT_HOLDS.cf + silverSp / LIGHT_HOLDS.silverSp + c.ep / LIGHT_HOLDS.ep + goldGs / LIGHT_HOLDS.goldGs + (Number(gems) || 0) / LIGHT_HOLDS.gems;
}
/** A share → Light objects: a handful is free, otherwise round up once. */
export const shareToSpace = (share) => (share <= HANDFUL_SHARE + 1e-9 ? 0 : Math.ceil(share - 1e-9));
export function coinSpace(coins, gems = 0) { return shareToSpace(coinShare(coins, gems)); }

/** Round a value to the nearest farthing; nothing is worth less than 1 cf (Equipment › Coinage). Values in sp. */
export const roundSp = (sp) => Math.max(0.25, Math.round((Number(sp) || 0) * 4) / 4);

/**
 * "3 ss", "2 gs 4 ss", "12 sp", "1 sc, 5 sp", "7.5 sp" → farthings (null if
 * nothing readable). A bare number means sp.
 */
export function parseAmount(text) {
  const t = String(text || "").toLowerCase().replace(/,(?=\d{3})/g, "");
  let far = 0, hit = false;
  for (const m of t.matchAll(/([\d.]+)\s*([a-z]{2})\b/g)) {
    const c = BY_KEY[m[2]];
    if (!c) continue;
    far += Number(m[1]) * c.far; hit = true;
  }
  if (!hit && /^\s*[\d.]+\s*$/.test(t)) { far = Number(t) * 4; hit = true; }
  return hit && far > 0 ? Math.round(far) : null;
}

/**
 * Change modes (Jon 2026-10-03): "fewest" = any coin, fewest pieces;
 * "common" = CF, SP, SS, SC, GN, GS only (the silver penny is "the most common
 * coin"; farthings for the smallest amounts).
 */
export const COMMON_COINS = ["cf", "sp", "ss", "sc", "gn", "gs"];   // gn added 2026-10-20 (Equipment prices)

/** Change for an amount of farthings, largest first, in the mode's coins. */
export function makeChange(far, mode = "fewest") {
  const out = emptyCoins();
  let left = Math.max(0, Math.round(far));
  const pool = mode === "common" ? COINS.filter(c => COMMON_COINS.includes(c.key)) : COINS;
  for (const c of [...pool].reverse()) {
    const k = Math.floor(left / c.far);
    if (k > 0) { out[c.key] = k; left -= k * c.far; }
  }
  return out;
}

/**
 * Pay `priceFar` from `coins`. Largest coins that fit first; if still short,
 * one coin of the smallest kind bigger than what's left, with change back in
 * the fewest coins. → { ok, pay, change, after, reason }
 */
export function payFrom(coins, priceFar, mode = "fewest") {
  const have = cleanCoins(coins);
  const price = Math.round(Number(priceFar) || 0);
  if (price <= 0) return { ok: false, reason: "Enter an amount to pay." };
  if (valueFar(have) < price) return { ok: false, reason: `Not enough coin: this stash holds ${spLabel(valueFar(have) / 4)}.` };
  const pay = emptyCoins();
  let left = price;
  for (const c of [...COINS].reverse()) {
    const k = Math.min(have[c.key], Math.floor(left / c.far));
    if (k > 0) { pay[c.key] = k; left -= k * c.far; }
  }
  let change = emptyCoins();
  if (left > 0) {
    const big = COINS.find(c => c.far > left && have[c.key] - pay[c.key] > 0);
    if (big) { pay[big.key] += 1; change = makeChange(big.far - left, mode); left = 0; }
  }
  if (left > 0) {
    // Only small coins remain: spend them smallest-first until covered.
    for (const c of COINS) {
      while (left > 0 && have[c.key] - pay[c.key] > 0) { pay[c.key] += 1; left -= c.far; }
    }
    if (left < 0) { change = makeChange(-left, mode); left = 0; }
  }
  const after = emptyCoins();
  for (const c of COINS) after[c.key] = have[c.key] - pay[c.key] + change[c.key];
  return { ok: left === 0, pay, change, after, reason: left === 0 ? "" : "Couldn't make the payment." };
}

/* ------------------------------------------------------------------ *
 * Stashes: [{ id, name, loc, coins }]. loc = { kind: "in", container } |
 * { kind: "none" } | null (needs a place). Missing → one empty Purse.
 * ------------------------------------------------------------------ */
export function normalizeStashes(raw) {
  const list = Array.isArray(raw) ? raw.filter(Boolean) : [];
  if (!list.length) return [{ id: "purse", name: "Purse", loc: null, coins: emptyCoins() }];
  return list.map((s, i) => ({ id: String(s.id || `stash${i}`), name: String(s.name || (i ? `Stash ${i + 1}` : "Purse")),
    loc: s.loc || null, coins: cleanCoins(s.coins) }));
}

/** Move `coins` from stash a to stash b (clamped to what a holds). */
export function moveCoins(stashes, fromId, toId, coins) {
  const out = stashes.map(s => ({ ...s, coins: { ...s.coins } }));
  const a = out.find(s => s.id === fromId), b = out.find(s => s.id === toId);
  if (!a || !b || a === b) return out;
  for (const c of COINS) {
    const k = Math.min(n(coins?.[c.key]), a.coins[c.key]);
    a.coins[c.key] -= k; b.coins[c.key] += k;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Starting Wealth by Class (equipment_reference.md § Starting Wealth).
 * ------------------------------------------------------------------ */
const W = (per, add) => ({ dice: "2d6", per, add, avg: 7 * per + add });
export const STARTING_WEALTH = {
  "Avenger": W(100, 450), "Bahador": W(100, 450), "Cleric": W(50, 200), "Cursed": W(50, 50),
  "Druid": W(50, 50), "Dwarf": W(100, 400), "Fighter": W(100, 400), "Fili": W(50, 50),
  "Gnome": W(50, 200), "Gray Elf": W(50, 50), "Halfling": W(50, 50), "Knight": W(100, 400),
  "Magus": W(50, 50), "Orc": W(50, 50), "Paladin": W(100, 450), "Ranger": W(50, 50),
  "Sylvan Elf": W(50, 50), "Thief": W(50, 50)
};
/** The table line, e.g. "2d6 × 100 + 400 sp (1,100 sp)". */
export const wealthLine = (w) => w ? `${w.dice} × ${w.per} + ${w.add} sp (${w.avg.toLocaleString("en-US")} sp)` : "";
export function startingWealthFor(className) {
  const key = Object.keys(STARTING_WEALTH).find(k => k.toLowerCase() === String(className || "").trim().toLowerCase());
  return key ? { className: key, ...STARTING_WEALTH[key] } : null;
}
