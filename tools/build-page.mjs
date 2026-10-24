/**
 * Packs the game into one self-contained page (dist/mastery-solo.html) for
 * publishing as a private playable page. Every module under game/ becomes a
 * function in one script, so nothing has to load from other files.
 *
 *   node tools/build-page.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const order = [], seen = new Map();

function load(file) {
  if (seen.has(file)) return seen.get(file);
  const id = `__m${seen.size}`;
  seen.set(file, id);
  let src = readFileSync(file, "utf8");
  const deps = [];
  src = src.replace(/^import\s+(\*\s+as\s+\w+|\{[^}]*\})\s+from\s+"([^"]+)";?\s*$/gm, (_, what, spec) => {
    const dep = load(resolve(dirname(file), spec));
    deps.push(dep);
    if (what.startsWith("*")) return `const ${what.split(/\s+as\s+/)[1].trim()} = ${dep};`;
    const names = what.slice(1, -1).split(",").map(n => n.trim()).filter(Boolean).map(n => n.replace(/\s+as\s+/, ": "));
    return `const { ${names.join(", ")} } = ${dep};`;
  });
  const exported = [];
  src = src.replace(/^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => { exported.push(name); return `${kind} ${name}`; });
  if (/^\s*export\s/m.test(src)) throw new Error(`${relative(root, file)}: an export form the packer doesn't know`);
  order.push(`// ${relative(root, file)}\nconst ${id} = (() => {\n${src}\nreturn { ${exported.join(", ")} };\n})();`);
  return id;
}

load(join(root, "game", "main.js"));
const html = readFileSync(join(root, "index.html"), "utf8");
const body = html.slice(html.indexOf("<body>") + 6, html.indexOf("<script")).trim();
const css = readFileSync(join(root, "game", "style.css"), "utf8");
const page = `<title>Mastery Solo</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:ital,wght@0,400;0,700;1,400&family=IM+Fell+English&display=swap">
<style>
${css}
</style>
${body}
<script type="module">
${order.join("\n\n")}
</script>
`;
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "mastery-solo.html"), page);
console.log(`dist/mastery-solo.html: ${(page.length / 1024).toFixed(0)} KB, ${order.length} modules`);
