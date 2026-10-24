/**
 * Plays whole dynasties with a plain-minded strategy and reports how they go:
 * levels, XP from fights and from exploring, coin and treasure, deaths and
 * their causes, sites, hoards, and leads. For checking the numbers, not for
 * judging play: the strategy is simple on purpose (see `policy` below).
 *
 *   node tools/simulate.mjs [--seeds 8] [--days 365] [--style bold|cautious] [--out reports/simulation] [--json]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { newGame, travelLeg, campNow, stay, setTarget, runWithDice, afterEvent, note, siteAction, searchLeg, DAY_HOURS } from "../game/journey.js";
import { choices, choose, signChoices, chooseSign, partyLevel, bandFor, aboveBand, alive, living } from "../game/events.js";
import { hartChoices, chooseHart } from "../game/hart.js";
import { atSite, siteChoices, siteHere } from "../game/sites.js";
import { leadsHere } from "../game/leads.js";
import { settlementHere, openMarket, buy, saleList, sell, hasHealer, healerTreats, healerTreatsTrauma, hasSage, sageReads, priceOf } from "../game/town.js";
import { needsHealer, recoveryOf } from "../game/health.js";
import { recruitsHere, hire, nextGeneration, spendPoints, PARTY_SIZE } from "../game/recruits.js";
import { meals } from "../game/supplies.js";
import { TILE, countryAt, squareAt, moveCost } from "../game/world.js";
import { CREATURES } from "../game/data/creatures.js";
import { playBattle } from "../tests/autoplay.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const SEEDS = Number(arg("seeds", 8)), DAYS = Number(arg("days", 365));
/** Bold fights anything up to Division 2 × level + 2; cautious only up to its level + 1. */
const STYLE = arg("style", "bold");
const OUT = arg("out", join(here, "..", "reports", "simulation"));

/* ------------------------------------------------------------------ */
/* The strategy                                                         */

const say = (s) => (t, k) => note(s, t, k);
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/** Hurt enough to rest: low health, an Injury, or a Trauma that rest or a healer can mend (a scar never will). */
const hurt = (s) => living(s).some(m => m.hp < m.health * 0.6 || m.injuries > 0 || (m.traumas || []).some(t => !recoveryOf(t.recovery || "None").permanent));
/** What a day in bed mends: health, and Traumas that heal by days of rest. Injuries need kits or a healer. */
const bedHelps = (s) => living(s).some(m => m.hp < m.health * 0.6 || (m.traumas || []).some(t => { const r = recoveryOf(t.recovery || "None"); return !r.permanent && r.days > 0 && (!r.treat || t.treated); }));
const injured = (s) => living(s).reduce((n, m) => n + (m.injuries || 0), 0);
const BIG = ["town", "city", "metropolis"];
const settlements = (s) => Object.values(s.world.tiles).filter(t => t.settlement).map(t => ({ x: t.tx * TILE + t.settlement.lx, y: t.ty * TILE + t.settlement.ly, size: t.settlement.size }));

function nearestSettlement(s, { healer = false } = {}) {
  const list = settlements(s).filter(x => !healer || hasHealer(x.size) || x.size === "village");
  return list.sort((a, b) => dist(s.party, a) - dist(s.party, b))[0];
}
function openSites(s) {
  return Object.values(s.world.places || {}).filter(p => ["lair", "cave", "ruin", "barrow", "lost"].includes(p.type) && !p.site?.cleared && !(p.avoid > s.day));
}

/** In a settlement: sell, heal, restock, hire, rest. → true if it used the day. */
function inTown(s, st) {
  const town = settlementHere(s);
  if (!town) return false;
  runWithDice(s, (rng) => openMarket(s, rng, say(s)));
  for (let i = 0; i < 40; i++) {
    const item = saleList(s).find(x => /^(pelt|treasure|spare):/.test(x.id) && !(s.market.buyers?.[x.id] === false));
    if (!item) break;
    const before = s.party.coin;
    runWithDice(s, (rng) => sell(s, rng, say(s), item.id));
    if (s.party.coin > before) st.sold += s.party.coin - before; else if (s.market.buyers?.[item.id] !== false) break;
  }
  for (const m of living(s)) {
    while (m.injuries > 0 && healerTreats(s, say(s), m.id)) {}
    (m.traumas || []).forEach((t, i) => { if (needsHealer(t) && !t.treated && s.party.coin > 60) runWithDice(s, (rng) => healerTreatsTrauma(s, rng, say(s), m.id, i)); });
  }
  if (hasSage(town.size)) for (let i = 0; i < 3; i++) runWithDice(s, (rng) => sageReads(s, rng, say(s)));
  const want = living(s).length * 2 * 10; // ten days' meals
  for (const food of ["Rations, Iron", "Rations, Standard", "Rations, Dry"]) {
    const need = want - meals(s);
    if (need > 0 && s.market.stock[food]) buy(s, say(s), food, Math.min(need, Math.floor(s.party.coin / Math.max(0.25, priceOf(food)))));
  }
  const skins = s.party.skins || 0;
  if (skins < living(s).length * 2 && s.market.stock.Waterskin) buy(s, say(s), "Waterskin", living(s).length * 2 - skins);
  const kits = injured(s) - (s.party.stores["Injury Kit"] || 0);
  if (kits > 0 && s.market.stock["Injury Kit"]) buy(s, say(s), "Injury Kit", kits + 1);
  for (const kit of ["Wound Kit", "Torch"]) if ((s.party.stores[kit] || 0) < 6 && s.market.stock[kit]) buy(s, say(s), kit, 6);
  if (!(s.party.stores["Thieves' Picks"] > 0) && s.party.coin > 100 && s.market.stock["Thieves' Picks"]) buy(s, say(s), "Thieves' Picks", 1);
  if (living(s).length < PARTY_SIZE) {
    const list = runWithDice(s, (rng) => recruitsHere(s, rng));
    for (const r of [...list].sort((a, b) => b.level - a.level)) if (living(s).length < PARTY_SIZE && hire(s, say(s), r.id)) st.hired++;
  }
  if (bedHelps(s) && !s.hoursUsed && s.party.coin > living(s).length * 8) { stay(s, "bed"); st.restDays++; return true; }
  // Treasure no one here can afford goes to a bigger market.
  if ((s.party.treasure || []).some(t => t.value > 60) && !BIG.includes(town.size)) s.wantBig = true;
  return false;
}

/** River squares and the squares beside a lake, on the map so far. */
function waterSquares(s) {
  const out = [];
  for (const t of Object.values(s.world.tiles)) for (let ly = 0; ly < TILE; ly++) for (let lx = 0; lx < TILE; lx++) {
    const x = t.tx * TILE + lx, y = t.ty * TILE + ly, sq = squareAt(s.world, x, y);
    if (sq?.river && !sq.lake) out.push({ x, y });
    else if (sq?.lake) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = squareAt(s.world, x + dx, y + dy); if (o && !o.lake) out.push({ x: x + dx, y: y + dy }); }
  }
  return out;
}
const thirsty = (s) => !s.party.waterToday && s.party.water < living(s).length * 0.75;

/** Head for (x, y), or the nearest square to it that can be entered. */
function goNear(s, x, y) {
  for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const sq = squareAt(s.world, x + dx, y + dy);
    if (sq && !Number.isFinite(moveCost(sq))) continue;
    if (x + dx === s.party.x && y + dy === s.party.y) continue;
    setTarget(s, x + dx, y + dy);
    if (s.target) return;
  }
}

/** Choose where to go next. */
function chooseTarget(s, st) {
  const p = s.party;
  if (thirsty(s)) {
    const w = [...waterSquares(s), ...settlements(s)].sort((a, b) => dist(p, a) - dist(p, b))[0];
    if (w && dist(p, w) > 0) return goNear(s, w.x, w.y);
  }
  const town = nearestSettlement(s);
  const needTown = meals(s) < living(s).length * 2 * 3 || bedHelps(s) || (injured(s) > (s.party.stores["Injury Kit"] || 0)) || p.bankedXp >= 60 || (p.treasure || []).length >= 6 || living(s).length < 2;
  const big = settlements(s).filter(x => BIG.includes(x.size)).sort((a, b) => dist(p, a) - dist(p, b))[0];
  if (s.wantBig && big && dist(p, big) > 0) { s.wantBig = false; return goNear(s, big.x, big.y); }
  if (needTown && town && dist(p, town) > 0) return goNear(s, town.x, town.y);
  const lead = (s.world.leads || []).filter(l => !l.found && !(l.giveUp > s.day)).map(l => ({ l, x: l.tx * TILE + 3, y: l.ty * TILE + 3 })).sort((a, b) => dist(p, a) - dist(p, b))[0];
  const site = openSites(s).filter(x => !aboveBand(x.site?.guardian?.head || "", partyLevel(s))).sort((a, b) => dist(p, a) - dist(p, b))[0];
  if (site && dist(p, site) <= 30) return goNear(s, site.x, site.y);
  if (lead && dist(p, lead) <= 40) return goNear(s, lead.x, lead.y);
  // Wander: a few tiles off, toward the wilder side as the party grows.
  const r = TILE * (2 + bandFor(partyLevel(s)));
  const ang = (st.wander = (st.wander || 0) + 2.4);
  goNear(s, Math.round(p.x + Math.cos(ang) * r), Math.round(p.y + Math.sin(ang) * r));
}

function encounter(s, st) {
  const e = s.encounter;
  const ch = choices(s).filter(c => !c.disabled).map(c => c.id);
  const c = CREATURES[e.head];
  const tooMuch = e.above || c.division > (STYLE === "cautious" ? partyLevel(s) + 1 : partyLevel(s) * 2 + 2);
  const pick = tooMuch ? ["avoid", "toll", "answer", "talk", "food", "purse", "flee", "fight"].find(x => ch.includes(x))
    : ["answer", "talk", "fight"].find(x => ch.includes(x)) || ch[0];
  if (pick === "fight") st.fightsChosen++;
  runWithDice(s, (rng) => choose(s, rng, pick, say(s)));
  afterEvent(s);
}

function sign(s) {
  if (s.sign.hart) {
    const ch = hartChoices(s).map(c => c.id);
    runWithDice(s, (rng) => chooseHart(s, rng, ch.includes("follow") ? "follow" : ch.includes("hold") ? "hold" : ch[0], say(s)));
  } else {
    const ch = signChoices(s).map(c => c.id);
    runWithDice(s, (rng) => chooseSign(s, rng, s.sign.above ? "leave" : ch.includes("follow") ? "follow" : "leave", say(s)));
  }
  afterEvent(s);
}

/** Inside a site: press on while healthy, leave when hurt. */
function inSite(s) {
  const site = siteHere(s);
  const ms = alive(s);
  const weak = !ms.length || ms.reduce((n, m) => n + m.hp, 0) < living(s).reduce((n, m) => n + m.health, 0) * 0.45 || living(s).some(m => m.hp <= 0);
  const ch = siteChoices(s).filter(c => !c.disabled);
  const ids = (id) => ch.find(c => c.id === id);
  let pick;
  // Done: the hoard is taken and nothing worth staying for is left (only vermin would come).
  const done = site.cleared && !siteChoices(s).some(c => ["question", "graves", "inscription"].includes(c.id));
  if (weak || done) pick = ids("leave") || ch.find(c => c.id === "goto");
  else pick = ["hoard", "question", "graves", "inscription", "heart", "fight", "onward", "around", "pick", "force", "obstacle", "search"].map(ids).find(Boolean)
    || ids("leave");
  if (pick.id === "force" && site.areas[s.site.at].forced > 2) pick = ids("leave");
  if (pick.id === "force") site.areas[s.site.at].forced = (site.areas[s.site.at].forced || 0) + 1;
  if (pick.id === "leave" && !site.cleared) { const p = s.world.places[s.site.key]; p.avoid = s.day + 3; }
  siteAction(s, pick.id, pick.arg);
}

/* ------------------------------------------------------------------ */
/* Watching                                                             */

const PATTERNS = [
  [/^Each character earns (\d+) XP\./, (st, m) => { st.combatXp += Number(m[1]); st.fightsWon++; }],
  [/^Safe in a settlement: each character earns (\d+) banked/, (st, m) => { st.exploreXp += Number(m[1]); }],
  [/ reaches level (\d+):/, (st, m) => { st.levelUps++; }],
  [/^You go into the /, (st) => st.sitesEntered++],
  [/^The hoard: /, (st) => st.hoards++],
  [/finds it.*Hidden Location|show(ed)? you: .*Hidden Location/, (st) => st.hidden++],
  [/Lost Location: 75 XP/, (st) => st.lost++],
  [/^A white hart/, (st) => st.harts++],
  [/a clue to .* hidden/, (st) => st.clues++],
  [/: a fragment of lost lore\.$/, (st) => st.fragments++],
  [/^You flee|^You get away\.|You break away.*you get clear/, (st) => st.fled++],
  [/^Something new has moved in/, (st) => st.refills++]
];

function watch(s, st, from) {
  for (const l of s.log.slice(from)) for (const [re, fn] of PATTERNS) { const m = re.exec(l.text); if (m) fn(st, m); }
}

function snapshot(s, st) {
  const ms = living(s);
  return { day: s.day, generation: s.dynasty?.generation || 1, party: ms.length, avgLevel: ms.length ? +(ms.reduce((n, m) => n + m.level, 0) / ms.length).toFixed(2) : 0,
    maxLevel: Math.max(0, ...ms.map(m => m.level)), coin: Math.round(s.party.coin), treasure: Math.round((s.party.treasure || []).reduce((n, t) => n + t.value, 0)),
    combatXp: st.combatXp, exploreXp: st.exploreXp, deaths: st.deaths.length, band: bandFor(partyLevel(s)) };
}

/* ------------------------------------------------------------------ */
/* One dynasty                                                          */

export function runDynasty(seed, days = DAYS, { trace = null } = {}) {
  const s = newGame(seed);
  s.log = [];
  const st = { seed, combatXp: 0, exploreXp: 0, fightsWon: 0, fightsChosen: 0, fled: 0, levelUps: 0, sitesEntered: 0, hoards: 0, hidden: 0, lost: 0, harts: 0, clues: 0, fragments: 0,
    refills: 0, hired: 0, sold: 0, restDays: 0, deaths: [], wipes: 0, daily: [], stuck: 0, levelDays: {}, stalled: null, foes: {} };
  let helpless = 0;
  const deadBefore = new Set();
  let lastDay = s.day, actions = 0;
  const recent = [];
  while (s.day <= days) {
    // The game keeps only the last 400 lines; each action starts on a fresh log so nothing is missed.
    recent.push(...s.log.slice(-40)); recent.splice(0, Math.max(0, recent.length - 40));
    s.log = [];
    const from = 0;
    const foe = s.battle?.head || s.encounter?.head || null;
    if (s.battle && !s.battle.counted) {
      s.battle.counted = true;
      const k = `${s.battle.head} (Band ${bandFor(partyLevel(s))})`;
      const f = (st.foes[k] ||= { fights: 0, deaths: 0, wipes: 0, levels: 0 });
      f.fights++; f.levels += partyLevel(s); st.lastFoe = k;
    }
    try {
      if (s.over) {
        st.wipes++;
        if (st.lastFoe && /^Fell to/.test(s.over.why)) st.foes[st.lastFoe].wipes++;
        runWithDice(s, (rng) => nextGeneration(s, rng, say(s), ["roll", "roll", "roll", "roll"]));
        // The new party's roles and gear: the page has the player fill these; the sim takes the defaults recruits come with.
      } else if (s.battle) { playBattle(s, { clever: true, cast: true, run: 12 }); afterEvent(s); }
      else if (s.encounter) encounter(s, st);
      else if (s.sign) sign(s);
      else if (s.pending?.type === "nightfall") travelLeg(s, "stop");
      else if (s.site) inSite(s);
      else {
        for (const m of living(s)) if (m.unspent && Object.values(m.unspent).some(n => n > 0)) runWithDice(s, (rng) => spendPoints(rng, m));
        if (s.party.members.some(m => !m.dead && m.collapsed) || s.hoursUsed >= DAY_HOURS) campNow(s);
        else if (inTown(s, st)) { /* the day went to rest */ }
        else if (atSite(s) && !atSite(s).site?.cleared && !(atSite(s).avoid > s.day) && !aboveBand(atSite(s).site?.guardian?.head || "", partyLevel(s)) && !hurt(s)) siteAction(s, "enter");
        else if (leadsHere(s).length && !hurt(s)) {
          const l = leadsHere(s)[0];
          l.tries = (l.tries || 0) + 1;
          if (l.tries > 6) { l.giveUp = s.day + 30; l.tries = 0; chooseTarget(s, st); travelLeg(s); }
          else { searchLeg(s); afterEvent(s); }
        } else { if (!s.target || (thirsty(s) && !s.goingForWater)) { s.goingForWater = thirsty(s); chooseTarget(s, st); } if (s.target) travelLeg(s); else campNow(s); if (!thirsty(s)) s.goingForWater = false; }
      }
    } catch (err) {
      st.error = `${err.message} (day ${s.day})\n${err.stack.split("\n").slice(1, 4).join("\n")}`;
      st.tail = [...recent, ...s.log].slice(-40).map(l => l.text);
      st.state = s;
      break;
    }
    watch(s, st, from);
    if (trace && s.day >= trace[0] && s.day <= trace[1]) for (const l of s.log) console.log(`[${s.day}] ${l.text}`);
    for (const m of s.party.members) if (m.dead && !deadBefore.has(m.id + m.name)) {
      deadBefore.add(m.id + m.name);
      const why = [...s.log.slice(from)].reverse().find(l => l.text.includes(m.name) && /dies|dead|falls|perish|starv|thirst|bleed/i.test(l.text))?.text || s.over?.why || "unknown";
      if (foe && st.lastFoe) st.foes[st.lastFoe].deaths++;
      st.deaths.push({ day: s.day, name: m.name, cls: m.cls, level: m.level, foe, band: bandFor(partyLevel(s)), why: why.slice(0, 140), context: [...recent, ...s.log].slice(-15).map(l => l.text) });
    }
    for (const m of living(s)) if (!st.levelDays[m.level]) st.levelDays[m.level] = s.day;
    if (s.day !== lastDay) {
      st.daily.push(snapshot(s, st)); lastDay = s.day; actions = 0;
      // A lone Hard to Kill hero with no coin and no one to hire can neither die nor go on.
      helpless = living(s).length === 1 && s.party.coin < 4 && alive(s).length === 0 ? helpless + 1 : 0;
      if (helpless >= 30) { st.stalled = { day: s.day, who: living(s)[0].name, cls: living(s)[0].cls }; break; }
    }
    else if (++actions > 400) { st.stuck++; campNow(s); actions = 0; }
  }
  st.final = snapshot(s, st);
  st.places = Object.values(s.world.places || {}).reduce((o, p) => (o[p.type] = (o[p.type] || 0) + 1, o), {});
  st.cleared = Object.values(s.world.places || {}).filter(p => p.site?.cleared).length;
  return st;
}

/* ------------------------------------------------------------------ */
/* The report                                                           */

const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const r1 = (x) => Math.round(x * 10) / 10;

function report(runs) {
  const at = (d) => runs.map(r => r.daily.find(x => x.day >= d) || r.final);
  const lines = [];
  lines.push(`# Simulation: ${runs.length} dynasties, ${DAYS} days each, ${STYLE} strategy`, "");
  lines.push(`Generated by \`tools/simulate.mjs\`. The strategy is plain on purpose: fight what isn't far above the party, explore the nearest site, go to town when hungry, hurt, or carrying XP or treasure, follow leads and the Hart, hire to four, spend points the way recruits do, and cast the dearest harmful spell (or a heal when someone's below half). Numbers describe the rules under that strategy, not a skilled player.`, "");
  lines.push("## The curve", "", "| Day | Avg level | Max level | Coin | Treasure held | Combat XP (per char, cumulative) | Exploration XP (cumulative) | Deaths so far | Generation |", "|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|");
  for (const d of [7, 30, 60, 90, 180, 270, 365].filter(d => d <= DAYS)) {
    const xs = at(d);
    lines.push(`| ${d} | ${r1(mean(xs.map(x => x.avgLevel)))} | ${r1(mean(xs.map(x => x.maxLevel)))} | ${Math.round(mean(xs.map(x => x.coin)))} | ${Math.round(mean(xs.map(x => x.treasure)))} | ${Math.round(mean(xs.map(x => x.combatXp)))} | ${Math.round(mean(xs.map(x => x.exploreXp)))} | ${r1(mean(xs.map(x => x.deaths)))} | ${r1(mean(xs.map(x => x.generation)))} |`);
  }
  lines.push("", "## First day each level was reached (median across dynasties)", "", "| Level | Day |", "|:-:|:-:|");
  for (let L = 2; L <= 10; L++) {
    const ds = runs.map(r => r.levelDays[L]).filter(Boolean).sort((a, b) => a - b);
    if (ds.length) lines.push(`| ${L} | ${ds[Math.floor(ds.length / 2)]} (${ds.length} of ${runs.length} dynasties) |`);
  }
  const sum = (k) => runs.reduce((n, r) => n + r[k], 0);
  lines.push("", "## Totals across all dynasties", "", "| What | Total | Per dynasty |", "|:---|:-:|:-:|");
  for (const [k, label] of [["fightsWon", "Fights won"], ["fled", "Fled or broke away"], ["sitesEntered", "Times a site was entered"], ["hoards", "Hoards taken"], ["clues", "Clues found"],
    ["hidden", "Hidden places found"], ["fragments", "Fragments of lost lore"], ["lost", "Lost places found"], ["harts", "White Harts seen"], ["refills", "Sites refilled"], ["hired", "Recruits hired"], ["wipes", "Party wipes"], ["restDays", "Days in bed"], ["stuck", "Times the strategy got stuck"]])
    lines.push(`| ${label} | ${sum(k)} | ${r1(sum(k) / runs.length)} |`);
  lines.push(`| Coin from selling | ${Math.round(sum("sold"))} | ${Math.round(sum("sold") / runs.length)} |`);
  const cx = sum("combatXp"), ex = sum("exploreXp");
  lines.push("", `**Where XP came from:** ${Math.round(100 * cx / Math.max(1, cx + ex))}% fights, ${Math.round(100 * ex / Math.max(1, cx + ex))}% exploration (banked and brought home).`);
  const foes = {};
  for (const r of runs) for (const [k, f] of Object.entries(r.foes)) { const g = (foes[k] ||= { fights: 0, deaths: 0, wipes: 0, levels: 0 }); for (const x in f) g[x] += f[x]; }
  lines.push("", "## The deadliest fights", "", "Each group the party fought (as the head and the band), with how often it killed someone and how often it ended the generation.", "",
    "| Foe | Fights | Avg party level | Deaths per fight | Wipes |", "|:---|:-:|:-:|:-:|:-:|");
  for (const [k, f] of Object.entries(foes).filter(([, f]) => f.deaths).sort((a, b) => b[1].deaths - a[1].deaths).slice(0, 15))
    lines.push(`| ${k} | ${f.fights} | ${r1(f.levels / f.fights)} | ${(f.deaths / f.fights).toFixed(2)} | ${f.wipes} |`);
  const deaths = runs.flatMap(r => r.deaths.map(d => ({ ...d, seed: r.seed })));
  const causes = {};
  for (const d of deaths) { const k = d.foe ? `fighting ${d.foe}` : /hunger|starv/i.test(d.why) ? "hunger" : /thirst/i.test(d.why) ? "thirst" : /bleed/i.test(d.why) ? "bled out" : /cold|heat|weather/i.test(d.why) ? "weather" : "other"; causes[k] = (causes[k] || 0) + 1; }
  lines.push("", `## Deaths: ${deaths.length}`, "", Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "none", "");
  const stalls = runs.filter(r => r.stalled);
  if (stalls.length) lines.push(`**Stalled dynasties: ${stalls.length}.** ${stalls.map(r => `Seed ${r.seed}, day ${r.stalled.day}: ${r.stalled.who} (${r.stalled.cls}) alone, broke, and unable to die`).join("; ")}.`, "");
  if (deaths.length) { lines.push("| Seed | Day | Who | Level | Band | Killed by |", "|:-:|:-:|:---|:-:|:-:|:---|"); for (const d of deaths.slice(0, 40)) lines.push(`| ${d.seed} | ${d.day} | ${d.name} (${d.cls}) | ${d.level} | ${d.band} | ${d.foe || d.why.replace(/\|/g, "/")} |`); }
  const errs = runs.filter(r => r.error);
  if (errs.length) { lines.push("", "## Errors", ""); for (const r of errs) lines.push(`Seed ${r.seed}: \`${r.error.split("\n")[0]}\``, "", "```", r.error, "```"); }
  return lines.join("\n") + "\n";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runs = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const t0 = Date.now();
    const r = runDynasty(seed);
    runs.push(r);
    console.log(`seed ${seed}: day ${r.final.day}, level ${r.final.avgLevel}, gen ${r.final.generation}, deaths ${r.deaths.length}, ${((Date.now() - t0) / 1000).toFixed(1)}s${r.error ? ` ERROR ${r.error.split("\n")[0]}` : ""}`);
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(`${OUT}.md`, report(runs));
  if (process.argv.includes("--json")) writeFileSync(`${OUT}.json`, JSON.stringify(runs.map(({ daily, deaths, state, ...r }) => ({ ...r, deaths: deaths.map(({ context, ...d }) => d), daily: daily.filter((_, i) => i % 7 === 0) })), null, 1));
  console.log(`wrote ${OUT}.md`);
}
