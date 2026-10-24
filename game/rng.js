/**
 * Seeded dice. Every roll in the game goes through one generator whose state
 * is saved with the game, so a dynasty can be replayed from its seed and the
 * rules can be tested with known rolls.
 */

/** mulberry32: small, fast, good enough for dice. State is one 32-bit integer. */
export function makeRng(seed = Date.now()) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** 1..n */
    d: (n) => 1 + Math.floor(next() * n),
    get state() { return state; },
    set state(s) { state = s >>> 0; }
  };
}

/**
 * Roll a dice expression: "2d6", "1d3+1", "1d12+1d8", "2d6+1d8+2", "10d6-30",
 * "d20", or a plain number. Returns { total, rolls, expr }.
 */
export function roll(rng, expr) {
  const text = String(expr).replace(/\s+/g, "");
  const terms = text.match(/[+-]?[^+-]+/g) || [];
  if (!terms.length || !terms.every(t => /^[+-]?(\d*d\d+|\d+)$/i.test(t))) {
    const n = Number(expr);
    return { total: Number.isFinite(n) ? n : 0, rolls: [], expr: String(expr) };
  }
  let total = 0;
  const rolls = [];
  for (const t of terms) {
    const sign = t[0] === "-" ? -1 : 1;
    const m = /^[+-]?(\d*)d(\d+)$/i.exec(t);
    if (!m) { total += sign * Number(t.replace(/^[+-]/, "")); continue; }
    for (let i = 0; i < Number(m[1] || 1); i++) { const r = rng.d(Number(m[2])); rolls.push(r); total += sign * r; }
  }
  return { total, rolls, expr: String(expr) };
}

/** Shorthand for a plain total. */
export const total = (rng, expr) => roll(rng, expr).total;
