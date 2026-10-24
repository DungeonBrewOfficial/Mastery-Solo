/**
 * Copies Mastery's pure rules modules from the Foundry system into
 * game/vendor/foundry, keeping their paths so their own imports still work.
 * The Foundry repo stays the source of truth: never edit the copies here;
 * change them there and run this again.
 *
 *   node tools/sync-foundry.mjs ../Mastery-Foundry
 */
import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FILES = [
  "module/helpers/weather-rules.mjs",
  "module/helpers/travel-rules.mjs",
  "module/data/weather-data.mjs",
  "module/data/chargen-data.mjs",
  "module/data/treasure-data.mjs",
  "module/config.mjs",
  "module/helpers/npc-health.mjs",
  "module/data/trauma-table.mjs",
  "module/helpers/minion-rules.mjs",
  "module/helpers/puca-rules.mjs",
  "module/helpers/agathion-rules.mjs",
  "module/helpers/companion-phase.mjs",
  "module/helpers/food-rules.mjs",
  "module/helpers/rest-rules.mjs",
  "module/helpers/trade-rules.mjs",
  "module/helpers/advancement-rules.mjs"
];

/**
 * Pure functions that live in modules that also talk to Foundry. Each is cut
 * out whole (from "export function name(" to its closing brace) into
 * game/vendor/foundry/extract/<file>, with the imports it needs.
 */
const EXTRACTS = [
  { from: "module/helpers/combat.mjs", fn: "resolveDamage", to: "extract/resolve-damage.mjs",
    header: 'import { damageInteractsWithArmor } from "../module/config.mjs";' }
];

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(process.argv[2] || join(here, "..", "..", "Mastery-Foundry"), "mastery");
const dest = join(here, "..", "game", "vendor", "foundry");
if (!existsSync(src)) { console.error(`No Foundry system at ${src}`); process.exit(1); }
for (const f of FILES) {
  mkdirSync(dirname(join(dest, f)), { recursive: true });
  copyFileSync(join(src, f), join(dest, f));
  console.log(`copied ${f}`);
}

function cut(text, fn) {
  const start = text.indexOf(`export function ${fn}(`);
  if (start < 0) throw new Error(`${fn} not found`);
  let i = text.indexOf("{", text.indexOf(")", start)), depth = 0;
  // skip the parameter list's destructuring braces: find the body brace after the closing paren of the signature
  const sigEnd = (() => { let d = 0, j = text.indexOf("(", start); for (; j < text.length; j++) { if (text[j] === "(") d++; else if (text[j] === ")" && --d === 0) return j; } return -1; })();
  i = text.indexOf("{", sigEnd);
  for (let j = i; j < text.length; j++) {
    if (text[j] === "{") depth++;
    else if (text[j] === "}" && --depth === 0) return text.slice(start, j + 1);
  }
  throw new Error(`${fn}: unbalanced`);
}
for (const x of EXTRACTS) {
  const body = cut(readFileSync(join(src, x.from), "utf8"), x.fn);
  const out = `/**\n * EXTRACTED by tools/sync-foundry.mjs from Foundry ${x.from} (${x.fn}). Do not edit.\n */\n${x.header}\n\n${body}\n`;
  mkdirSync(dirname(join(dest, x.to)), { recursive: true });
  writeFileSync(join(dest, x.to), out);
  console.log(`extracted ${x.fn} from ${x.from}`);
}
