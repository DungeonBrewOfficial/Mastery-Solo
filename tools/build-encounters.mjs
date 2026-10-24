/**
 * Builds game/data/encounters.js from the terrain tables in
 * design/02-encounters.md, so the design file stays the one source. Each
 * table cell is read for: whether it's a Sign first or an apex, its d6
 * options, each option's temper, conditions (night, dusk, fog, winter,
 * autumn, near a ruin), and the creatures it names. The head is the
 * strongest creature named, by Division, which is also what sets the XP.
 *
 *   node tools/build-encounters.mjs          (prints anything it couldn't read)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CREATURES } from "../game/data/creatures.js";

const here = dirname(fileURLToPath(import.meta.url));
const md = readFileSync(join(here, "..", "design", "02-encounters.md"), "utf8");

export const TEMPERS = ["Predator", "Territorial", "Raider", "Prey", "Restless dead", "Guardian", "Patrol", "Strange"];
const TERRAIN_HEADINGS = { Woodland: "forest", Plains: "plains", Hills: "hills", Mountains: "mountains", Swamp: "swamp", Desert: "desert" };

/* ---------------- creature names in prose */

const ALIASES = [];
const alias = (text, name) => ALIASES.push([text.toLowerCase(), name]);
for (const name of Object.keys(CREATURES)) {
  const m = /^Wolf, (\w+)$/.exec(name);
  const base = m ? `Wolf ${m[1]}` : name;
  alias(base, name);
  alias(base.endsWith("s") ? base : base + "s", name);
  if (m) { alias(m[1], name); alias(m[1] + "s", name); if (m[1] === "Dire") alias("Dire Wolf", name); }
}
alias("Kallikantzaroi", "Kallikantzaros");
alias("Woodsmen", "Woodsman");
alias("antelope", "Deer");
alias("jackals", "Wild Dog");
alias("Raiders", "Orc Raider");
alias("Bandit Thugs", "Bandit Thug");
alias("Cluster of Thugs", "Bandit Thug");
alias("Brood of Thugs", "Bandit Thug");
alias("Treow", "Treow");
ALIASES.sort((a, b) => b[0].length - a[0].length);

function creaturesIn(text) {
  let t = ` ${text.toLowerCase()} `;
  const found = [];
  for (const [a, name] of ALIASES) {
    const re = new RegExp(`(?<![a-z-])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`, "g");
    if (re.test(t)) { found.push(name); t = t.replace(re, " ".repeat(a.length)); }
  }
  return [...new Set(found)];
}

const XP = { 1: 2, 2: 4, 3: 6, 4: 10, 5: 20, 6: 30, 7: 40, 8: 60, 9: 80, 10: 100, 11: 150, 12: 200, 13: 250 };
export const xpForDivision = (d) => XP[Math.min(13, d)] || 0;

function defaultTemper(head) {
  const c = CREATURES[head];
  if (!c) return "Prey";
  if (c.kingdom === "behemoth") return "Raider";
  if (c.classification === "mortal" && c.kingdom === "beast") return "Predator";
  return "Guardian";
}

/* ---------------- one option of a cell */

function readOption(text, strange = false) {
  const opt = { text: text.replace(/\*\*/g, "").trim() };
  const tempers = [...text.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].split(",")[0].trim()).filter(t => TEMPERS.includes(t));
  const seasonal = /in autumn[^[]*\[([^\]]+)\][^[]*otherwise[^[]*\[([^\]]+)\]/i.exec(text);
  if (seasonal) opt.temperBySeason = { autumn: seasonal[1].trim(), other: seasonal[2].trim() };
  // "near a ruin only (otherwise, ...)", "at night only", "at dusk or in fog only", "at twilight only", "in fog only", "around midwinter"
  const cond = {};
  if (/\bat night\b|deepest wood/i.test(text) && /only|otherwise/i.test(text)) cond.night = true;
  if (/\bdusk\b|\btwilight\b/i.test(text)) cond.dusk = true;
  if (/\bin fog\b|\bor in fog\b/i.test(text)) cond.fog = true;
  if (/midwinter/i.test(text)) cond.winter = true;
  if (/near a ruin only|near a drowned ruin|near a ruin\b/i.test(text) && /only|otherwise/i.test(text)) cond.ruin = true;
  if (Object.keys(cond).length) opt.cond = cond;

  // "X. Otherwise, a Zombie [Restless dead]." — an alternative when the condition fails
  const other = /otherwise,?\s+(?!sign)([^.]*\[[^\]]+\][^.]*)/i.exec(text);
  if (cond.winter && other) opt.otherwise = readOption(other[1]);
  const main = cond.winter && other ? text.slice(0, other.index) : text;

  const names = creaturesIn(main.replace(/\(otherwise[^)]*\)/ig, ""));
  const head = names.sort((a, b) => CREATURES[b].division - CREATURES[a].division)[0] || null;
  opt.creatures = names;
  opt.head = head;
  opt.division = head ? CREATURES[head].division : 0;
  opt.temper = seasonal ? null : (tempers[0] || (strange ? "Strange" : defaultTemper(head)));
  if (tempers.includes("Prey") && !seasonal) opt.temper = "Prey";
  opt.xp = opt.temper === "Prey" ? 0 : xpForDivision(opt.division);
  return opt;
}

/* ---------------- a whole cell */

function readCell(raw) {
  const cell = { text: raw.trim() };
  cell.signFirst = /Sign first/i.test(raw);
  cell.apex = /\bApex\b/i.test(raw);
  cell.strange = /^\s*\*\*Strange/i.test(raw);
  const body = raw.replace(/\*\*[^*]*:\*\*\s*/, "");
  const split = /^\s*d6[,:]\s*(.*)$/i.exec(body);
  if (split) {
    // options are separated by ";" or ". " and each starts with its range: "1–3 a Magpie ...; 4–6 an Eidolon ..."
    const pieces = split[1].split(/\s*[;.]\s+(?=\d(?:–\d)?\s)/);
    cell.options = pieces.map(piece => {
      const m = /^(\d)(?:–(\d))?\s+(.*)$/s.exec(piece.trim());
      return { lo: Number(m[1]), hi: Number(m[2] || m[1]), ...readOption(m[3], cell.strange) };
    });
  } else {
    cell.options = [{ lo: 1, hi: 6, ...readOption(body, cell.strange) }];
  }
  return cell;
}

/* ---------------- the tables */

const out = {};
let terrain = null, band = null;
const problems = [];
for (const line of md.split("\n")) {
  const h2 = /^## (\w+)\s*$/.exec(line);
  if (h2) { terrain = TERRAIN_HEADINGS[h2[1]] || null; band = null; continue; }
  const h3 = /^### Band (I+)\b/.exec(line);
  if (h3 && terrain) { band = h3[1].length; out[terrain] ??= {}; out[terrain][band] = {}; continue; }
  const row = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*([^|]+)\|\s*$/.exec(line);
  if (row && terrain && band) {
    const cell = readCell(row[2]);
    cell.xpColumn = row[3].trim();
    out[terrain][band][Number(row[1])] = cell;
    for (const o of cell.options) {
      if (!o.head && o.temper !== "Prey") problems.push(`${terrain} ${band} ${row[1]}: no creature found in "${o.text}"`);
    }
  }
}

const body = `/**\n * GENERATED by tools/build-encounters.mjs from design/02-encounters.md. Do not edit;\n * change the design file and rebuild.\n */\nexport const ENCOUNTERS = ${JSON.stringify(out, null, 1)};\n`;
writeFileSync(join(here, "..", "game", "data", "encounters.js"), body);
const count = Object.values(out).reduce((n, b) => n + Object.values(b).reduce((m, t) => m + Object.keys(t).length, 0), 0);
console.log(`${count} table entries across ${Object.keys(out).length} terrains`);
for (const p of problems) console.log("CHECK:", p);
