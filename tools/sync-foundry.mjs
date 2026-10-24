/**
 * Copies Mastery's pure rules modules from the Foundry system into
 * game/vendor/foundry, keeping their paths so their own imports still work.
 * The Foundry repo stays the source of truth: never edit the copies here;
 * change them there and run this again.
 *
 *   node tools/sync-foundry.mjs ../Mastery-Foundry
 */
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FILES = [
  "module/helpers/weather-rules.mjs",
  "module/helpers/travel-rules.mjs",
  "module/data/weather-data.mjs",
  "module/data/chargen-data.mjs",
  "module/data/treasure-data.mjs"
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
