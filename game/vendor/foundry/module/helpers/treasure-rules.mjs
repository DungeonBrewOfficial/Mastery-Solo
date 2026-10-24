/**
 * TREASURE RULES (pure, 2026-10-13). Treasure.md (Furs, Gems, Jewelry, Art)
 * + Classes handoff "Answers to your five treasure questions" and "Coin
 * space corrected" (2026-10-13). Data: module/data/treasure-data.mjs
 * (generated from Treasure.md).
 *
 * Every step can be ROLLED or FIXED: pass a name (or number) in `fix` to
 * build a specific piece; leave it out to roll. Dice come from `d(n)` (1..n)
 * so the rules are testable; the runtime passes a Foundry-backed roller and
 * records every roll.
 *
 * Values in sp, rounded to the nearest farthing, never below 1 cf
 * (Equipment › Coinage). Weights: anything given in pounds is 1 weight
 * point per 10 lb, under 1 lb insignificant; gems carry like coins; jewelry
 * is insignificant unless over 1 lb (then Light); plate and objects Light,
 * a nef Moderate. Carry: Fits / Lashed / Bulky (Carrying Treasure).
 */
import * as T from "../data/treasure-data.mjs";

export const roundSp = (v) => Math.max(0.25, Math.round((Number(v) || 0) * 4) / 4);
const inRange = (row, n) => row.range && n >= row.range[0] && n <= row.range[1];
export const pickRange = (table, n) => table.find(r => inRange(r, n)) || null;
const byName = (table, name) => table.find(r => String(r.name).toLowerCase() === String(name).toLowerCase()) || null;

/** Roll dice text: "2d6", "1d4", "3", "3d10 beads" → { total, rolls }. */
export function rollDice(d, spec) {
  const m = /(\d+)\s*d\s*(\d+)/i.exec(String(spec || ""));
  if (!m) { const n = Number(/(\d+)/.exec(String(spec || ""))?.[1]) || 0; return { total: n, rolls: [] }; }
  const rolls = Array.from({ length: Number(m[1]) }, () => d(Number(m[2])));
  return { total: rolls.reduce((a, b) => a + b, 0), rolls };
}
/** One step: fixed by name, or rolled on `die` (range table). → { row, roll } */
function step(d, table, die, fixName, log, label) {
  if (fixName !== undefined && fixName !== null && fixName !== "") {
    const row = byName(table, fixName);
    if (!row) throw new Error(`${label}: no "${fixName}"`);
    log.push(`${label}: ${row.name} (chosen)`);
    return { row, roll: null };
  }
  const n = die === "2d10" ? d(10) + d(10) : die === "2d6" ? d(6) + d(6) : d(Number(String(die).replace(/^d/, "")));
  const row = pickRange(table, n);
  log.push(`${label}: ${die} ${n} → ${row?.name}`);
  return { row, roll: n };
}

/* ------------------------------------------------------------------ *
 * Gems
 * ------------------------------------------------------------------ */
/**
 * Size, cascading d4 in bands (Classes 2026-10-13, "Gem size, fixed"): the
 * first d4 is 1/4, 1/2, 3/4 ct, or on a 4 "1 or more". Each later die gives
 * 1-3 ct within its band (1-3, 4-6, 7-9, ...); a 4 moves to the next band, so
 * no size is skipped. Setting limits: Narrow stops on the second die (a 4 is
 * 4 ct); Medium stops on the third (a 4 is 7 ct); Broad has no limit.
 */
export function gemCarats(d, setting = "Broad", log = []) {
  const r1 = d(4);
  if (r1 < 4) { const c = r1 / 4; log.push(`size d4 ${r1} → ${c} ct`); return c; }
  const set = String(setting).toLowerCase(), seq = [4];
  for (let band = 0, die = 2; ; band++, die++) {
    const r = d(4); seq.push(r);
    const tag = set === "narrow" ? " (Narrow)" : set === "medium" ? " (Medium)" : "";
    if (r < 4) { const c = band * 3 + r; log.push(`size d4 ${seq.join(", ")} → ${c} ct${tag}`); return c; }
    if (set === "narrow" && die === 2) { log.push(`size d4 ${seq.join(", ")} → 4 ct${tag}`); return 4; }
    if (set === "medium" && die === 3) { log.push(`size d4 ${seq.join(", ")} → 7 ct${tag}`); return 7; }
  }
}
export const gemValue = (base, mult, carats) => roundSp(base * mult * carats * carats);
/** One gem. fix: { grade, gem, quality, carats } */
export function rollGem(d, fix = {}, setting = "Broad", log = []) {
  let grade, gemRow;
  if (fix.gem) {
    for (const [g, list] of Object.entries(T.GEMS)) { const r = byName(list, fix.gem); if (r) { grade = g; gemRow = r; } }
    if (!gemRow) throw new Error(`gem: no "${fix.gem}"`);
    log.push(`gem: ${gemRow.name} (chosen)`);
  } else {
    const g = step(d, T.GEM_GRADES, "d100", fix.grade, log, "grade").row;
    grade = g.name;
    const list = T.GEMS[grade];
    const n = d(list.length);
    gemRow = list.find(x => x.roll === n);
    log.push(`gem: ${g.die} ${n} → ${gemRow.name}`);
  }
  const q = step(d, T.GEM_QUALITY, "2d10", fix.quality, log, "quality").row;
  const carats = fix.carats ? Number(fix.carats) : gemCarats(d, setting, log);
  if (fix.carats) log.push(`size: ${carats} ct (chosen)`);
  return { grade, name: gemRow.name, base: gemRow.base, quality: q.name, mult: q.mult, carats, value: gemValue(gemRow.base, q.mult, carats) };
}
export const gemLabel = (g) => `${g.name}, ${g.quality}, ${g.carats} ct`;

/**
 * Gems set in a piece: chance (d100), count, symmetry. Earrings: one matched
 * pair; prayer beads: one gem per bead; otherwise an odd count is a center
 * stone and pairs, an even count all pairs — one roll per pair, the largest
 * stone in the center. → { has, chanceRoll, stones: [{ gem, count, role }], value }
 */
export function gemsInPiece(d, { chance, count, setting, kind = "" } = {}, force = null, log = []) {
  const out = { has: false, chanceRoll: null, stones: [], value: 0 };
  if (!chance || !count) { log.push("gems: never set with gems"); return out; }
  if (force === false) { log.push("gems: none (chosen)"); return out; }
  if (force !== true) {
    const r = d(100); out.chanceRoll = r;
    if (r < chance[0] || r > chance[1]) { log.push(`gems: d100 ${r} vs ${chance[0]}–${chance[1]} → none`); return out; }
    log.push(`gems: d100 ${r} vs ${chance[0]}–${chance[1]} → set with gems`);
  }
  out.has = true;
  if (/per earring/i.test(count)) {
    const g = rollGem(d, {}, setting, log); out.stones.push({ gem: g, count: 2, role: "pair" });
  } else if (/beads/i.test(count)) {
    const n = rollDice(d, count).total; log.push(`beads: ${count} → ${n}`);
    const g = rollGem(d, {}, setting, log); out.stones.push({ gem: g, count: n, role: "beads" });
  } else {
    const n = Math.max(1, rollDice(d, count).total); log.push(`gems: ${count} → ${n}`);
    const pairs = Math.floor(n / 2), center = n % 2;
    const rolled = Array.from({ length: pairs + center }, () => rollGem(d, {}, setting, log));
    if (center) {
      rolled.sort((a, b) => b.carats - a.carats);
      out.stones.push({ gem: rolled[0], count: 1, role: "center" });
      for (const g of rolled.slice(1)) out.stones.push({ gem: g, count: 2, role: "pair" });
    } else for (const g of rolled) out.stones.push({ gem: g, count: 2, role: "pair" });
  }
  out.value = roundSp(out.stones.reduce((s, x) => s + x.gem.value * x.count, 0));
  return out;
}

/* ------------------------------------------------------------------ *
 * Jewelry and Plate
 * ------------------------------------------------------------------ */
export const METALS = ["copper", "bronze", "brass", "pewter", "orichalcum", "hepatizon", "silver", "electrum", "black copper", "red gold", "gold", "platinum", "iron"];
export const NEVER_GILDED = ["gold", "red gold", "platinum"];
/** Density against silver (Classes 2026-10-13; carved materials already × 5). */
export const DENSITY = { gold: 1.84, platinum: 2.04, "red gold": 1.44, electrum: 1.4, silver: 1, copper: 0.85, bronze: 0.85, brass: 0.85, "black copper": 0.85, hepatizon: 0.85,
  orichalcum: 0.8, iron: 0.75, pewter: 0.7, oak: 0.07, walnut: 0.07, cherry: 0.07, hickory: 0.07, boxwood: 0.07, ebony: 0.07, bone: 0.18, horn: 0.18, ivory: 0.18,
  shell: 0.26, "mother-of-pearl": 0.26, tortoiseshell: 0.26, hardstone: 0.25, "rock crystal": 0.25, ceramic: 0.25, glass: 0.25, soapstone: 0.25 };
/** Jewelry weight in lb: Silver Value ÷ 20 = ounces if silver, × density, ÷ 16. */
export const jewelryLbs = (silver, material) => (Number(silver) || 0) / 20 * (DENSITY[String(material).toLowerCase()] ?? 1) / 16;

/**
 * A worked piece (jewelry or plate). fix: { type, material, hardstone, craft,
 * craftNum, embellishment, inlay, gems: true|false|undefined }.
 * → { kind, type, material, hardstone, craft, embellishment, inlay, sum, base, gems, value, weightLbs, enc, carry, log }
 */
export function workedPiece(d, kind = "jewelry", fix = {}) {
  const log = [];
  const table = kind === "plate" ? T.PLATE : T.JEWELRY_TYPES;
  const type = step(d, table, "d100", fix.type, log, "type").row;
  const material = step(d, T.MATERIALS, "d100", fix.material, log, "material").row;
  let hardstone = null;
  if (material.name === "Hardstone") {
    if (fix.hardstone) { hardstone = byName(T.HARDSTONES, fix.hardstone)?.name; log.push(`hardstone: ${hardstone} (chosen)`); }
    else { const n = d(10); hardstone = T.HARDSTONES.find(h => h.roll === n)?.name; log.push(`hardstone: d10 ${n} → ${hardstone}`); }
  }
  const craft = step(d, T.CRAFT, "2d6", fix.craft, log, "craftsmanship").row;
  let craftNum = typeof craft.num === "number" ? craft.num : null;
  if (craftNum === null) { craftNum = fix.craftNum ? Number(fix.craftNum) : d(4); log.push(`Masterwork: ${fix.craftNum ? "chosen" : "d4"} ${craftNum}`); }
  let emb = step(d, T.EMBELLISH, "d20", fix.embellishment, log, "embellishment").row;
  const mat = material.name.toLowerCase();
  let embName = emb.name, embNum = typeof emb.num === "number" ? emb.num : 0, inlay = null;
  if (embName === "Gilded" && NEVER_GILDED.includes(mat)) { log.push(`${material.name} is never gilded → None`); embName = "None"; embNum = 0; }
  if (embName === "Enamelled" && !METALS.includes(mat)) { log.push(`enamel is fused onto metal → None for ${material.name}`); embName = "None"; embNum = 0; }
  if (embName === "Inlaid") {
    const second = step(d, T.MATERIALS, "d100", fix.inlay, log, "inlay material").row;
    inlay = second.name; embNum = second.mult * 0.25;
  }
  const sum = material.mult + craftNum + embNum;
  const base = type.silver * sum;
  const g = kind === "plate" ? { chance: type.chance, count: type.count, setting: type.setting } : (T.JEWELRY_GEMS[type.name] || {});
  log.push(`${type.silver} × (${material.mult} + ${craftNum} + ${embNum}) = ${roundSp(base)} sp`);
  const gems = gemsInPiece(d, g, fix.gems, log);
  const value = roundSp(base + gems.value);
  let weightLbs = null, enc = "L";
  if (kind === "jewelry") { weightLbs = Math.round(jewelryLbs(type.silver, mat) * 100) / 100; enc = weightLbs > 1 ? "L" : "NE"; }
  else enc = type.name === "Nef" ? "M" : "L";
  return { kind, type: type.name, material: material.name, hardstone, craft: craft.name, craftNum, embellishment: embName, inlay, sum, base: roundSp(base), gems, value,
    weightLbs, enc, carry: "Fits", log };
}
export function pieceName(p) {
  const emb = p.embellishment === "Gilded" ? "gilt " : p.embellishment === "Enamelled" ? "enamelled " : "";
  const mat = p.hardstone ? `${p.hardstone.toLowerCase()} ` : `${p.material.toLowerCase()} `;
  const inl = p.inlay ? `, inlaid with ${p.inlay.toLowerCase()}` : "";
  const n = p.gems?.has ? p.gems.stones.reduce((k, s) => k + s.count, 0) : 0;
  // "Opal, Fire" → "fire opal" in running text.
  const plain = (nm) => { const [a, b] = String(nm).split(/,\s*/); return (b ? `${b} ${a}` : a).toLowerCase(); };
  const one = p.gems?.stones?.length === 1 ? plain(p.gems.stones[0].gem.name) : "";
  const oneName = one;
  const gem = n ? `, set with ${n === 1 ? `a${/^[aeiou]/.test(one) ? "n" : ""} ${one}` : oneName ? `${n} ${oneName}s` : `${n} gems`}` : "";
  const work = p.craft === "Masterwork" ? "masterwork" : `${p.craft.toLowerCase()} work`;
  return `${cap(emb + mat + p.type.toLowerCase())}${inl}${gem} (${work})`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ *
 * Cloth, paintings, glass, statues
 * ------------------------------------------------------------------ */
const CLOTH_KINDS = { tapestry: T.TAPESTRY, embroidery: T.EMBROIDERY, carpet: T.CARPET, painting: T.PAINTING, glass: T.GLASS };
function condition(d, fix, twice, log) {
  if (fix) return step(d, T.CONDITION, "d10", fix, log, "condition").row;
  if (!twice) return step(d, T.CONDITION, "d10", null, log, "condition").row;
  const a = d(10), b = d(10), n = Math.min(a, b);
  const row = pickRange(T.CONDITION, n);
  log.push(`condition (on a floor, the lower of two): d10 ${a}, ${b} → ${n} → ${row.name}`);
  return row;
}
/** Area × Grade × Condition (+ embroidery gems). fix: { size, grade, condition, onFloor, gems, subject } */
export function clothPiece(d, kind, fix = {}) {
  const log = [], K = CLOTH_KINDS[kind];
  const size = step(d, K.size, "d10", fix.size, log, "size").row;
  const grade = step(d, K.grade, kind === "glass" ? "d10" : "d20", fix.grade, log, "grade").row;
  const cond = condition(d, fix.condition, kind === "carpet" && !!fix.onFloor, log);
  const base = size.area * grade.perSqYd * cond.num;
  log.push(`${size.area} sq yd × ${grade.perSqYd} sp × ${cond.num} = ${roundSp(base)} sp`);
  let gems = { has: false, stones: [], value: 0 };
  if (kind === "embroidery") gems = gemsInPiece(d, { chance: K.gemChance, count: size.gems, setting: "Broad" }, fix.gems, log);
  let weightLbs = size.weight ?? null;
  if (kind === "painting") weightLbs = Math.round(size.area * (grade.weightPerSqYd || 0) * 100) / 100;
  let carry = size.carry || "";
  if (kind === "painting") carry = /cloth|canvas/i.test(grade.name) ? size.carryCloth : size.carryOther;
  if (kind === "glass") carry = "Bulky";
  let subject = null;
  if (kind === "painting") {
    if (fix.subject) subject = fix.subject;
    else { const n = d(30); subject = T.PAINTING.subject.find(s => s.roll === n)?.name; log.push(`subject: d30 ${n} → ${subject}`); }
  }
  return { kind, size: size.name, area: size.area, grade: grade.name, condition: cond.name, subject, gems, value: roundSp(base + gems.value), weightLbs, enc: encFor(weightLbs), carry: carry || carryFor(weightLbs), log };
}
/** Statue: flat value by size and material × condition. Always Bulky. */
export function statuePiece(d, fix = {}) {
  const log = [];
  const size = step(d, T.STATUE.sizes, "d10", fix.size, log, "size").row;
  const mat = step(d, T.STATUE.material, "d10", fix.material, log, "material").row;
  const cond = condition(d, fix.condition, false, log);
  const sv = size.name === "Life-size" ? mat.life : mat.half;
  log.push(`${sv.value} sp × ${cond.num} = ${roundSp(sv.value * cond.num)} sp`);
  return { kind: "statue", size: size.name, material: mat.name, condition: cond.name, value: roundSp(sv.value * cond.num), weightLbs: sv.weight, enc: encFor(sv.weight), carry: "Bulky", log };
}

/* ------------------------------------------------------------------ *
 * Furs — the GM picks the animal and count; each pelt's quality is rolled.
 * ------------------------------------------------------------------ */
export function pelts(d, name, count = 1, state = "dressed", fixQuality = null) {
  const fur = byName(T.FURS, name);
  if (!fur) throw new Error(`fur: no "${name}"`);
  const log = [], out = [];
  for (let i = 0; i < Math.max(1, Number(count) || 1); i++) {
    let q;
    if (fixQuality) { q = fixQuality; log.push(`pelt ${i + 1}: ${q} (chosen)`); }
    else { const n = d(10); q = pickRange(T.FUR_QUALITY, n).name; log.push(`pelt ${i + 1}: d10 ${n} → ${q}`); }
    out.push(q);
  }
  const w = fur.weights?.[state] ?? fur.weights?.dressed ?? null;
  const groups = ["Poor", "Average", "Pristine"].map(q => ({ quality: q, count: out.filter(x => x === q).length, value: roundSp(fur[q.toLowerCase()]) })).filter(g => g.count);
  return { kind: "fur", name: fur.name, family: fur.family, state, weightLbs: w, enc: encFor(w), carry: carryFor(w), groups, log };
}

/* ------------------------------------------------------------------ *
 * Weight → encumbrance and carry
 * ------------------------------------------------------------------ */
/** "Every 10 lb is 1 weight point"; under 1 lb insignificant. → "NE" | { enc: "N", points } */
export function encFor(lbs) {
  const w = Number(lbs);
  if (!(w >= 1)) return "NE";
  return { enc: "N", points: Math.ceil(w / 10) };
}
/** Rule of thumb: up to about 2 lb Fits, up to about 20 lb Lashed, heavier Bulky. */
export const carryFor = (lbs) => { const w = Number(lbs) || 0; return w <= 2 ? "Fits" : w <= 20 ? "Lashed" : "Bulky"; };
