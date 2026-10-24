/**
 * The page: wires the map canvas and the side panel to the game state, and
 * saves after every action.
 */
import { stay, maxMagan, newGame, travelLeg, campNow, setTarget, setPace, seasonOf, DAY_HOURS, squaresPerHour, note, afterEvent, runWithDice, siteAction, searchLeg } from "./journey.js";
import { leadsHere, leadText, fragmentsRead, unreadFragments } from "./leads.js";
import { hartChoices, chooseHart } from "./hart.js";
import { atSite, siteHere, siteChoices, areaLabel, inDark } from "./sites.js";
import { choices, choose, signChoices, chooseSign, partyLevel, bandFor, ROMAN, runOdds } from "./events.js";
import { CREATURES } from "./data/creatures.js";
import { squareAt, countryAt, findPath, moveCost, TERRAINS, SETTLEMENTS } from "./world.js";
import { draw, drawBattle, battleLayout } from "./render.js";
import { turnOptions, pcTurn, pcStopTurning, turning, imbueOptions, pcImbue, castOptions, castTargets, pcCast, reapplyOptions, pcReapply, concentrationOf, opportunities, REACTIONS, reactOf, reactionsFor, setReaction, attackModes, setMode, freeTargets, pcBreakFree, pcStand, challengeTargets, beginRound, retreat, canBreakAway, runPlan, respond, currentPC, moveCost as stepCost, pcMove, pcAttack, pcEndTurn, triageTargets, pcTriage, canAttack, standing, onField, conditionsOf, memberFor, creatureFor, weaponOf, GUARDS, PHASES } from "./combat.js";
import { BAND_LABELS } from "./vendor/foundry/module/helpers/weather-rules.mjs";
import { openStorage, pack, unpack } from "./storage.js";
import { count, meals, KEEPS, waterNeed, SKIN_GALLONS } from "./supplies.js";
import { mayUse, armsKind, SHOP, openMarket, buy, priceOf, settlementHere, hasHealer, healerTreats, saleList, sell, townCoin, hasSmith, hireSmith, healerTreatsTrauma, hasSage, sageReads, SAGE_FEE } from "./town.js";
import { needsHealer, recoveryOf } from "./health.js";
import { recruitsHere, hire, build, nextGeneration, recruitCost, PARTY_SIZE, HUMANS, DEMIHUMANS } from "./recruits.js";
import { GEAR } from "./data/gear.js";
import { ATTRIBUTES, MASTERY_NAMES, masteryTargets, masteryLabel, masteryIndex, cannotInvest, invest, raiseAttribute, hasUnspent, nextLevelXp, titleOf } from "./advance.js";
import { pointsHint } from "./vendor/foundry/module/helpers/advancement-rules.mjs";
import { GLOSSARY, explain } from "./data/glossary.js";

const $ = (id) => document.getElementById(id);
const canvas = $("map");

let state = null, storage = null;
const view = { cx: 0, cy: 0, scale: 22, path: null, hover: null };

function persist() {
  storage?.save(state);
}

function refreshPath() {
  view.path = state.target ? findPath(state.world, state.party, state.target) : null;
}

function render() {
  refreshPath();
  view.marks = state.battle ? battleMarks() : null;
  paint();
  const w = state.weather;
  $("day").textContent = `Day ${state.day}`;
  $("season").textContent = seasonOf(state.day);
  $("hours").textContent = `${state.hoursUsed} of ${DAY_HOURS} hours traveled`;
  $("weather").textContent = w && state.morningDone ? `${w.name}, ${w.temp}°F, ${BAND_LABELS[w.band]}` : "Morning: weather not yet rolled";
  $("pace").value = state.party.pace;
  $("pace-note").textContent = `${squaresPerHour(state.party.pace)} squares an hour`;
  const sq = squareAt(state.world, state.party.x, state.party.y);
  $("here").textContent = describe(sq, state.party.x, state.party.y);
  $("seed").textContent = `Seed ${state.seed}`;

  const pending = state.pending?.type === "nightfall";
  const busy = !!(state.encounter || state.sign || state.over);
  document.querySelector(".map-tools").hidden = !!state.battle;
  $("travel").closest(".panel").hidden = !!state.battle;
  $("choice").hidden = !pending;
  $("travel").disabled = pending || busy || !!state.site;
  $("camp").disabled = pending || busy;
  const leads = state.site ? [] : leadsHere(state);
  $("search").hidden = !leads.length;
  $("search").disabled = pending || busy || !!state.site;
  $("search").textContent = leads.length ? `Search for ${leads.map(leadText).join(" or ")} (a leg)` : "Search";
  renderEvent();
  renderFeed();
  renderParty();
  renderSupplies();
  renderTown(busy || pending);
  $("travel").textContent = state.target ? "Travel a leg" : "Click the map to choose a destination";

  const log = $("log");
  log.innerHTML = "";
  for (const e of state.log.slice(-150)) {
    const li = document.createElement("li");
    li.className = e.kind || "";
    li.textContent = e.text;
    log.appendChild(li);
  }
  log.scrollTop = log.scrollHeight;
}

function button(label, onclick) {
  const b = document.createElement("button");
  b.textContent = label;
  b.onclick = onclick;
  return b;
}

function renderEvent() {
  const box = $("event");
  box.innerHTML = "";
  const say = (t, k) => note(state, t, k);
  if (state.over) {
    box.hidden = false;
    const d = state.dynasty;
    box.innerHTML = `<h2>The party has fallen</h2><p>${state.over.why}</p>
      <p class="small muted">The dynasty goes on. The map and what the old heroes found stay; a new party of four sets out from the home village. Choose each class, or roll it (d6: 1–5 human, 6 demihuman).</p>
      ${d?.fallen?.length ? `<p class="small muted">Fallen before: ${d.fallen.map(f => `generation ${f.generation}, day ${f.day}: ${f.heroes.map(h => h.name).join(", ")}`).join("; ")}.</p>` : ""}`;
    const form = document.createElement("div");
    form.className = "declare";
    const picks = [];
    for (let i = 0; i < PARTY_SIZE; i++) {
      const sel = document.createElement("select");
      sel.add(new Option("Roll the class", "roll"));
      for (const c of [...new Set([...HUMANS, ...DEMIHUMANS])].sort()) sel.add(new Option(c, c));
      picks.push(sel);
      form.append(sel);
    }
    box.append(form);
    const row = document.createElement("div");
    row.className = "buttons";
    const go = button("The next generation sets out", () => act(() => runWithDice(state, (rng) => nextGeneration(state, rng, say, picks.map(p => p.value)))));
    go.className = "primary";
    row.append(go, button("Start a new dynasty", () => $("new").click()));
    box.appendChild(row);
  } else if (state.battle) {
    box.hidden = false;
    renderBattle(box);
  } else if (state.encounter) {
    const e = state.encounter, c = CREATURES[e.head];
    box.hidden = false;
    box.innerHTML = `<h2>${e.night ? "In the night" : "Encounter"}</h2>
      <p>${e.text.replace(/\s*\[[^\]]*\]/g, "")}</p>
      <p class="muted">${e.head}: Tier ${c.tier} ${c.rank}, Division ${c.division}, ${e.xp} XP. ${e.temper}.</p>
      <p>${e.distance} · ${e.partyAware ? "you see it" : "you didn't see it"} · ${e.creatureAware ? "it knows you're here" : "it hasn't noticed you"}</p>`;
    const row = document.createElement("div");
    row.className = "buttons";
    for (const ch of choices(state)) {
      const b = button(ch.label, () => act(() => { runWithDice(state, (rng) => choose(state, rng, ch.id, say)); afterEvent(state); }));
      if (ch.disabled) { b.disabled = true; b.title = ch.why || ""; }
      row.appendChild(b);
    }
    box.appendChild(row);
  } else if (state.sign?.hart) {
    const s = state.sign;
    box.hidden = false;
    const charmed = s.charmed.map(id => state.party.members.find(m => m.id === id)?.name).filter(Boolean);
    box.innerHTML = `<h2>The White Hart</h2><p>A hart of pure white at the edge of the deep wood. It walks away slowly, and looks back.</p>${charmed.length ? `<p class="warn">Charmed: ${charmed.join(", ")} will follow it.</p>` : ""}`;
    const row = document.createElement("div");
    row.className = "buttons";
    for (const ch of hartChoices(state)) row.appendChild(button(ch.label, () => act(() => { runWithDice(state, (rng) => chooseHart(state, rng, ch.id, say)); afterEvent(state); })));
    box.appendChild(row);
  } else if (state.sign) {
    const s = state.sign;
    box.hidden = false;
    box.innerHTML = `<h2>Signs</h2><p>${s.read && !s.unread ? s.text.replace(/\s*\[[^\]]*\]/g, "") : "Tracks, a kill, a camp gone cold. Something has passed this way."}</p>${s.above ? '<p class="warn">Whatever left these is beyond you.</p>' : ""}`;
    const row = document.createElement("div");
    row.className = "buttons";
    for (const ch of signChoices(state)) row.appendChild(button(ch.label, () => act(() => { runWithDice(state, (rng) => chooseSign(state, rng, ch.id, say)); afterEvent(state); })));
    box.appendChild(row);
  } else if (state.site || atSite(state)) renderSite(box);
  else box.hidden = true;
}

/* ---------------- sites */

const SITE_NAMES = { lair: "lair", cave: "cave", ruin: "ruin", barrow: "barrow", lost: "lost place" };
function renderSite(box) {
  box.hidden = false;
  const place = atSite(state), site = siteHere(state) || place?.site;
  const name = SITE_NAMES[place.type];
  if (!state.site) {
    box.innerHTML = `<h2>At the ${name}</h2><p class="small muted">${site ? `${site.size} areas, Band ${ROMAN[site.band]}${site.deep ? ", Deep country" : ""}.${site.cleared ? " Cleared." : site.areas.length ? ` ${site.areas.length} drawn so far.` : ""}` : ""}</p>`;
    const row = document.createElement("div");
    row.className = "buttons";
    row.appendChild(button(`Go into the ${name}`, () => act(() => siteAction(state, "enter"))));
    box.appendChild(row);
    return;
  }
  const s = state.site, here = site.areas[s.at];
  const lightNote = inDark(state) ? '<span class="warn">no light</span>' : s.torch ? `torch, ${s.torch} round${s.torch > 1 ? "s" : ""} left (${count(state, "Torch")} spare)` : "daylight";
  box.innerHTML = `<h2>In the ${name}</h2>
    <p class="small muted">Band ${ROMAN[site.band]}${site.deep ? ", Deep country" : ""} · ${site.areas.filter(a => !a.secret).length} of ${site.size} areas drawn · ${s.rounds} exploration round${s.rounds === 1 ? "" : "s"} · ${lightNote} · ${state.party.bankedXp} XP banked</p>`;
  const ol = document.createElement("ol");
  ol.className = "small areas";
  for (const a of site.areas) {
    const li = document.createElement("li");
    li.value = a.id + 1;
    const open = a.exits > 0 ? ` · ${a.exits} way${a.exits > 1 ? "s" : ""} on unexplored` : "";
    li.innerHTML = `${a.id === s.at ? "<strong>You are here:</strong> " : ""}${areaLabel(a).replace(/^Area \d+: /, "")}${a.blocked ? ' <span class="warn">(blocks the way)</span>' : ""}${a.kind === "occupied" && a.group ? ' <span class="warn">(occupied)</span>' : ""}${a.kind === "heart" && site.headAlive ? ` <span class="warn">(${site.guardian.head})</span>` : ""}<span class="muted">${open}</span>`;
    ol.appendChild(li);
  }
  box.appendChild(ol);
  const row = document.createElement("div");
  row.className = "buttons";
  for (const ch of siteChoices(state)) {
    const b = button(ch.label, () => act(() => siteAction(state, ch.id, ch.arg)));
    if (ch.disabled) b.disabled = true;
    if (["heart", "fight"].includes(ch.id)) b.className = "primary";
    row.appendChild(b);
  }
  box.appendChild(row);
}

/* ---------------- battle */

let picks = {};
/** Begin the round with the declarations; spells and Hellfire are declared afresh each round. */
function declareRound(rng) {
  beginRound(state, rng, say, picks);
  for (const p of Object.values(picks)) { delete p.spell; delete p.hellfire; delete p.conc; delete p.turn; delete p.attack; }
}
let planningRun = false, carry = {};
const say = (t, k) => note(state, t, k);
const PROMPT_LABELS = { defend: ["Defend", "Take it"], counter: ["Counterattack", "Hold back"], reprisal: ["Strike", "Let them go"] };
const cap = (t) => t[0].toUpperCase() + t.slice(1);

function battleAct(fn) {
  runWithDice(state, fn);
  afterEvent(state);
  if (!state.battle) { picks = {}; planningRun = false; carry = {}; view.cx = state.party.x + 0.5; view.cy = state.party.y + 0.5; }
  persist();
  render();
}

function tokenLabel(u) {
  if (u.pc) return u.name.slice(0, 2);
  if (u.minion) return String(u.heads);
  const words = u.cname.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean);
  const n = /\s(\d+)$/.exec(u.name)?.[1] || "";
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)) + n;
}

function battleMarks() {
  const b = state.battle, u = currentPC(state);
  const moves = new Set(), targets = new Set();
  if (u) {
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (stepCost(state, u, x, y)) moves.add(`${x},${y}`);
    for (const t of b.units) if (canAttack(state, u, t).ok) targets.add(t.id);
  }
  const units = b.units.filter(onField).map(x => {
    const m = x.pc ? memberFor(state, x) : null;
    return { u: x, label: tokenLabel(x), color: x.pc ? "#a8322a" : x.minion ? "#5b4a3c" : "#4b3f5a",
      hpFrac: x.pc ? m.hp / m.health : x.hp / x.hpMax, dim: x.pc ? m.down : x.demoralized >= 3 };
  });
  return { current: u?.id, moves, targets, units, hover: view.hover, last: b.last && b.last.round >= b.round - 1 ? b.last : null };
}

function paint() {
  if (state.battle && view.marks) drawBattle(canvas, state.battle, { ...view.marks, hover: view.hover });
  else draw(canvas, state, view);
}

const GOOD = /^(Rallied|Emboldened|Fearless|Energized|Empowered|Tireless|challenging|casting|holding|Stoneskin|Sacred Ward|imbued|declared)/;
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
/** A word with its explanation on hover, if the glossary has one. */
const term = (word, cls = "") => { const t = explain(word); return t ? `<span class="${cls}" title="${esc(t)}" style="text-decoration: underline dotted">${word}</span>` : cls ? `<span class="${cls}">${word}</span>` : word; };
const condHtml = (conds) => conds.length ? ` ${conds.map(c => term(c, GOOD.test(c) ? "good" : "warn")).join(", ")}` : "";
const describeHealth = (u) => u.hp >= u.hpMax ? "unhurt" : u.hp > u.hpMax / 2 ? "hurt" : u.hp > u.hpMax / 4 ? "bloodied" : "near death";

function unitLine(u) {
  const conds = conditionsOf(state, u);
  if (u.pc) {
    const m = memberFor(state, u), w = weaponOf(m, u);
    const gear = [m.armor ? `${m.armor.name} ${m.armor.durability}/${m.armor.max}` : "", m.shield ? `${m.shield.name} ${m.shield.durability}/${m.shield.max}` : ""].filter(Boolean).join(" · ");
    return `<strong>${m.name}</strong> <span>${m.hp}/${m.health} hp</span> <span class="muted">${u.ap} ${term("AP")} · ${u.companion ? m.attack.name : `${w ? w.name : "unarmed"} · ${term(GUARDS[u.guard].label)}`}</span>${condHtml(conds)}${gear ? `<br><span class="muted small">${gear}</span>` : ""}`;
  }
  const c = creatureFor(u);
  if (u.object) return `<strong>${u.name}</strong> <span class="muted">can't defend; ${u.dmgSince} damage since the Dryad's last turn (7 stops her regrowth, 14 her melding)</span>`;
  return `<strong>${u.name}</strong> <span>${u.minion ? `${u.heads} of ${u.headsMax}` : describeHealth(u)}</span> <span class="muted">${term(c.rank)}${u.armorMax ? ` · armor ${u.armorDur > 0 ? "holding" : "broken"}` : ""}</span>${condHtml(conds)}`;
}

/**
 * The fight feed, under the grid: every line of this fight by round, each
 * attack's verdict in color (green when you land one, red when you take one,
 * gold for a miss or nothing through), the dice lines muted beneath.
 */
let feedTerse = false;
function renderFeed() {
  const box = $("feed");
  const b = state.battle;
  if (!b) { box.hidden = true; return; }
  box.hidden = false;
  box.classList.toggle("terse", feedTerse);
  const lines = (b.feed || []).filter(e => e.round >= Math.max(1, b.round - 3) && !/^Round \d+\.$/.test(e.text));
  let html = `<div class="feed-head"><strong>What happened</strong><label class="small muted"><input type="checkbox" id="feed-terse"${feedTerse ? " checked" : ""}> results only</label>
    <details><summary>How to read this</summary>
      <p><span class="verdict good">HIT</span> your side got damage through. <span class="verdict bad">HIT</span> you took damage. <span class="verdict miss">MISS / NO DAMAGE</span> it was defended, went wide, or didn't beat resistance.</p>
      <p>An attack rolls its dice (shown as d8[5]; 4!3 means a 4 exploded and rolled again) plus bonuses. A target that defends rolls too, with its ${term("resistance")} already in the total: if the defense is as high or higher, it's a miss; if not, the difference gets through. A target that doesn't defend takes the attack less its resistance. What gets through goes to armor ${term("Durability")} first, then health.</p>
      <p>${term("Dominance")} · ${term("Impotence")} · ${term("Superiority")} · ${term("Inferiority")} · ${term("phases")} · ${term("flanking")} (hover for each)</p>
    </details></div>`;
  let round = null;
  for (const e of lines) {
    if (e.round !== round) { round = e.round; html += `<div class="round">Round ${round}</div>`; }
    const t = esc(e.text);
    if (/^verdict/.test(e.kind || "")) html += `<div class="verdict ${e.kind.split(" ")[1]}">${t}</div>`;
    else html += `<div class="line ${e.kind === "event" ? "event" : ""}">${t}</div>`;
  }
  box.innerHTML = html;
  $("feed-terse").onchange = (ev) => { feedTerse = ev.target.checked; renderFeed(); };
  box.scrollTop = box.scrollHeight;
}

function renderBattle(box) {
  const b = state.battle;
  const u = currentPC(state);
  const phase = b.stage === "declare" ? "Declarations" : `${cap(PHASES[b.phaseIdx])} phase`;
  box.innerHTML = `<h2>Battle · Round ${b.round}</h2><p class="muted">${phase}${b.stage === "phase" ? ` · ${b.order[0] === "party" ? "your side" : "their side"} first` : ""}</p>`;
  const row = document.createElement("div");
  row.className = "buttons";
  if (b.prompt) {
    const p = b.prompt;
    const [yes, no] = PROMPT_LABELS[p.kind] || [p.yes || "Yes", p.no || "No"];
    box.insertAdjacentHTML("beforeend", `<p class="prompt">${p.text}</p>`);
    row.appendChild(button(`${yes} (Y)`, () => battleAct((rng) => respond(state, rng, say, true))));
    if (p.kind === "defend" && p.helper) row.appendChild(button(`Defend, ${p.helperName} heartens (H)`, () => battleAct((rng) => respond(state, rng, say, "hearten"))));
    row.appendChild(button(`${no} (N)`, () => battleAct((rng) => respond(state, rng, say, false))));
    row.firstChild.className = "primary";
  } else if (b.stage === "declare" && planningRun) {
    const plan = runPlan(state);
    box.insertAdjacentHTML("beforeend", `<p class="prompt">Break away?</p><p class="small muted">It takes the round. Enemies beside you strike as you go, then one trial to get clear, at Impotence if you carry anyone. Clear of them, you stop the bleeding of anyone with more than a round left. Then they chase you.</p>`);
    const form = document.createElement("div");
    form.className = "declare";
    for (const x of plan.downed) {
      carry[x.id] ??= true;
      const m = memberFor(state, x);
      const line = document.createElement("div");
      line.className = "declare-row";
      line.innerHTML = `<strong>${m.name}</strong> <span class="muted small">unconscious${m.dying != null && !m.stable ? `, dying (${m.dying})` : ""}</span>`;
      const sel = document.createElement("select");
      sel.add(new Option("Carry", "carry")); sel.add(new Option("Leave behind", "leave"));
      sel.value = carry[x.id] ? "carry" : "leave";
      sel.onchange = () => { carry[x.id] = sel.value === "carry"; render(); };
      line.append(sel);
      form.appendChild(line);
    }
    for (const x of plan.lame) form.insertAdjacentHTML("beforeend", `<div class="declare-row"><strong>${x.name}</strong> <span class="muted small">can't run, and is carried</span></div>`);
    box.appendChild(form);
    const carried = plan.lame.length + plan.downed.filter(x => carry[x.id]).length;
    if (carried > plan.runners.length) box.insertAdjacentHTML("beforeend", `<p class="small warn">${plan.runners.length} can run, and each carries one. Whoever doesn't fit is left behind.</p>`);
    const odds = runOdds(b.head, plan.runners.filter(u => !u.companion).map(u => memberFor(state, u)), { carrying: carried > 0 });
    if (odds) box.insertAdjacentHTML("beforeend", `<p class="small ${odds.possible ? "muted" : "warn"}">${odds.text}</p>`);
    const go = button("Break away", () => { planningRun = false; const ids = plan.downed.filter(x => carry[x.id]).map(x => x.id); battleAct((rng) => retreat(state, rng, say, ids)); });
    go.className = "primary";
    row.append(go, button("Stay and fight", () => { planningRun = false; render(); }));
  } else if (b.stage === "declare") {
    box.insertAdjacentHTML("beforeend", `<p class="small muted">Choose each weapon and guard for the round. Changing weapons drops the old one and costs 1 AP.</p>`);
    const form = document.createElement("div");
    form.className = "declare";
    for (const x of b.units.filter(v => v.pc && standing(state, v))) {
      const m = memberFor(state, x);
      picks[x.id] ??= { weapon: x.weapon, guard: x.guard, shieldAbsorbs: m.shieldAbsorbs !== false };
      const line = document.createElement("div");
      line.className = "declare-row";
      line.innerHTML = `<strong>${m.name}</strong>${x.ap ? "" : ' <span class="warn">no AP</span>'}`;
      if (x.companion) {
        const owner = state.party.members.find(o => o.id === x.owner);
        if (m.ability === "Hellfire") {
          const lab = document.createElement("label");
          lab.className = "small";
          lab.title = "Declared: Tallow acts in the Fast phase and can breathe a 15-foot cone of fire (2 AP, 2 of the caster's magan). Agility trial or d2 + d4 fire, friend or foe. On a 1 on the control die, the Daeva aims it.";
          const cb = document.createElement("input");
          cb.type = "checkbox"; cb.checked = !!picks[x.id].hellfire; cb.disabled = (owner.mp || 0) < 2;
          cb.onchange = () => { picks[x.id].hellfire = cb.checked; };
          lab.append(cb, ` Hellfire (${owner.name} ${owner.mp || 0} magan)`);
          line.append(lab);
        } else line.insertAdjacentHTML("beforeend", ` <span class="muted small">${m.attack.name}, Moderate phase</span>`);
        form.appendChild(line);
        continue;
      }
      const ws = document.createElement("select");
      m.weapons.forEach((w, i) => ws.add(new Option(`${w.name} (${w.speed})`, i)));
      ws.value = picks[x.id].weapon;
      ws.onchange = () => { picks[x.id].weapon = Number(ws.value); };
      const gs = document.createElement("select");
      for (const [k, g] of Object.entries(GUARDS)) gs.add(new Option(g.label, k));
      gs.value = picks[x.id].guard;
      gs.title = GUARDS[gs.value].text;
      gs.onchange = () => { picks[x.id].guard = gs.value; gs.title = GUARDS[gs.value].text; };
      line.append(ws, gs);
      const foes = challengeTargets(state, x);
      if (foes.length) {
        const cs = document.createElement("select");
        cs.title = "Challenge (once per encounter): the killing blow on this foe inspires you by its rank.";
        cs.add(new Option("No challenge", ""));
        for (const f of foes) cs.add(new Option(`Challenge ${f.name}`, f.id));
        cs.value = picks[x.id].challenge || "";
        cs.onchange = () => { picks[x.id].challenge = cs.value || null; };
        line.append(cs);
      }
      const spells = castOptions(state, x);
      if (spells.length) {
        const ss = document.createElement("select");
        ss.title = "A declared spell draws its magan now and sets your phase by its cost: 1-3 Fast, 4-6 Moderate, 7-11 Slow. Release it on your turn for 1 AP.";
        ss.add(new Option(`No spell (${m.mp ?? 0} magan)`, ""));
        for (const o of spells) ss.add(new Option(`${o.label}: ${o.cost} magan, ${o.phase}${o.miscast ? `, miscast ${o.miscast}` : ""}${o.cost > (m.mp ?? 0) ? " (overcast: Exhausted)" : ""}`, o.key));
        ss.value = picks[x.id].spell || "";
        ss.onchange = () => { picks[x.id].spell = ss.value || null; render(); };
        line.append(ss);
      }
      const turns = turnOptions(state, x);
      if (turns.length) {
        const ts = document.createElement("select");
        ts.title = "Turn (Fast, once per encounter): Charisma die + Lore die against Division × 2; roll ÷ Division are turned and flee while you concentrate. Destroy Daeva (Slow): roll ÷ DC are destroyed. Declaring either takes the place of a spell this round.";
        ts.add(new Option("No Turn", ""));
        for (const o of turns) ts.add(new Option(o.label, o.key));
        ts.value = picks[x.id].turn || "";
        ts.onchange = () => { picks[x.id].turn = ts.value || null; render(); };
        line.append(ts);
      }
      if (picks[x.id].spell || picks[x.id].turn) {
        const w = m.weapons[picks[x.id].weapon];
        const lab = document.createElement("label");
        lab.className = "small";
        lab.title = "You act in the slowest phase of what you declare. Declare the attack and your spell goes off in the weapon's phase too; leave it out and you act in the spell's phase, defending with the weapon but not attacking.";
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.checked = !!picks[x.id].attack;
        cb.onchange = () => { picks[x.id].attack = cb.checked; };
        lab.append(cb, ` attack too${w ? ` (${w.name.toLowerCase()}, ${w.speed})` : ""}`);
        line.append(lab);
      }
      for (const e of concentrationOf(x)) {
        const cs = document.createElement("select");
        cs.title = "Concentration: one free slot, two paid slots at 1 AP a round, and passive, which breaks on any damage to your health or armor.";
        const cur = e.slot.startsWith("paid") ? "paid" : e.slot;
        for (const [v, l] of [["free", "free slot"], ["paid", "paid slot, 1 AP"], ...(e.kind === "imbue" ? [] : [["passive", "passive"]]), ["drop", "let it go"]]) cs.add(new Option(`${e.name}: ${l}`, v));
        cs.value = picks[x.id].conc?.[e.id] || cur;
        cs.onchange = () => { (picks[x.id].conc ||= {})[e.id] = cs.value; };
        line.append(cs);
      }
      if (m.shield) {
        const lab = document.createElement("label");
        lab.className = "small";
        lab.title = "Durability damage goes to the shield before the armor. A broken shield gives no Defense and can't stop missiles.";
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.checked = picks[x.id].shieldAbsorbs;
        cb.onchange = () => { picks[x.id].shieldAbsorbs = cb.checked; };
        lab.append(cb, ` ${m.shield.name} takes hits`);
        line.append(lab);
      }
      form.appendChild(line);
    }
    box.appendChild(form);
    const go = button("Begin the round (Enter)", () => battleAct(declareRound));
    go.className = "primary";
    row.appendChild(go);
    const dying = b.units.some(v => v.pc && onField(v) && memberFor(state, v).dying != null && !memberFor(state, v).stable);
    const run = button("Break away", () => { planningRun = true; carry = {}; render(); });
    run.hidden = !!b.aftermath;
    run.title = dying ? "Anyone with one round left on the dying timer dies during the break-away." : "One round and one trial to get clear, then the chase.";
    if (!canBreakAway(state)) { run.disabled = true; run.title = "No one can run: everyone on their feet is lame or a companion. Fight on."; }
    row.appendChild(run);
  } else if (u) {
    const m = memberFor(state, u), w = weaponOf(m, u);
    box.insertAdjacentHTML("beforeend", `<p><strong>${m.name}</strong>'s turn · ${u.ap} AP · ${u.companion ? m.attack.name : w ? w.name : "unarmed"}${u.moveLeft ? ` · ${u.moveLeft} squares of movement left` : ""}</p><p class="small muted">Click a lit square to move, a ringed enemy to attack. A ringed enemy 3 or more squares off in a straight line is a Charge (2 AP, Dominance). AP you keep can defend, counter, and strike at enemies who leave your reach.</p>`);
    const hints = opportunities(state, u);
    if (hints.length) {
      const hl = document.createElement("ul");
      hl.className = "hints";
      hl.setAttribute("aria-label", "Right now");
      for (const h of hints) {
        const li = document.createElement("li");
        li.textContent = h.text;
        li.title = h.rule;
        const rule = document.createElement("p");
        rule.className = "rule"; rule.hidden = true; rule.textContent = h.rule;
        li.appendChild(rule);
        li.onclick = () => { rule.hidden = !rule.hidden; };
        hl.appendChild(li);
      }
      box.insertAdjacentHTML("beforeend", `<p class="small muted hints-head">Right now (tap a line for its rule)</p>`);
      box.appendChild(hl);
    }
    const modes = attackModes(state, u);
    if (modes.length > 1 && !turning(u)) {
      const mr = document.createElement("div");
      mr.className = "buttons modes";
      for (const md of modes) {
        const mb = button(md.label, () => { setMode(state, md.id); render(); });
        if ((u.mode || "strike") === md.id) mb.className = "on";
        mr.appendChild(mb);
      }
      box.appendChild(mr);
    }
    if (u.theurgy) {
      const tb = button(`${u.theurgy.mode === "destroy" ? "Destroy" : "Turn"} the ${u.theurgy.spirit === "daeva" ? "Daeva" : "Asura"} (1 AP)`, () => battleAct((rng) => pcTurn(state, rng, say)));
      tb.className = "primary"; tb.disabled = u.ap < 1;
      row.appendChild(tb);
    }
    if (turning(u)) row.appendChild(button("Release the Turn", () => battleAct((rng) => pcStopTurning(state, rng, say))));
    for (const f of imbueOptions(state, u)) row.appendChild(button(`${u.imbue ? "Change imbuing to" : "Imbue:"} ${f} (1 AP${u.imbue ? "" : ", 1 magan"})`, () => battleAct((rng) => pcImbue(state, rng, say, f))));
    if (u.casting) {
      const ts = castTargets(state, u);
      if (!ts.length) box.insertAdjacentHTML("beforeend", `<p class="small warn">${u.casting.label}: no one in reach${u.ap < 1 ? " (no AP)" : ""}.</p>`);
      for (const t of ts) {
        const cb = button(`${u.casting.label} → ${t.id === u.id ? "yourself" : t.name} (1 AP)`, () => battleAct((rng) => pcCast(state, rng, say, t.id)));
        cb.className = "primary";
        row.appendChild(cb);
      }
    }
    for (const o of reapplyOptions(state, u)) for (const t of o.targets) row.appendChild(button(`${o.e.name} again → ${t.name} (1 AP)`, () => battleAct((rng) => pcReapply(state, rng, say, o.e.id, t.id))));
    if (u.prone) row.appendChild(button("Get up (1 AP)", () => battleAct((rng) => pcStand(state, rng, say))));
    for (const t of freeTargets(state, u)) {
      const fb = button(t === u ? `Break free (1 AP)` : `Help ${t.name} break free (1 AP)`, () => battleAct((rng) => pcBreakFree(state, rng, say, t.id)));
      fb.disabled = u.ap < 1 || (t === u ? u.brokeFree : (t.helpedBy || []).includes(u.id));
      row.appendChild(fb);
    }
    for (const t of triageTargets(state, u)) {
      const tb = button(`Stop ${t.name}'s bleeding (2 AP)`, () => battleAct((rng) => pcTriage(state, rng, say, t.id)));
      tb.disabled = u.ap < 2;
      row.appendChild(tb);
    }
    row.appendChild(button(`End turn${u.ap ? `, keep ${u.ap} AP` : ""} (E)`, () => battleAct((rng) => pcEndTurn(state, rng, say))));
  }
  box.appendChild(row);
  const list = document.createElement("ul");
  list.className = "units";
  for (const side of ["party", "enemy"]) for (const x of b.units.filter(v => v.side === side && !v.fled && !(v.dead && !v.pc))) {
    const li = document.createElement("li");
    if (x.id === b.current) li.className = "now";
    li.innerHTML = unitLine(x);
    list.appendChild(li);
  }
  box.appendChild(list);
}

function battleHover(sq) {
  const b = state.battle;
  const u = b.units.find(x => onField(x) && sq.x >= x.x && sq.x < x.x + x.w && sq.y >= x.y && sq.y < x.y + x.h);
  if (u) {
    const conds = conditionsOf(state, u);
    if (u.pc) { const m = memberFor(state, u); return `${m.name} · ${m.hp}/${m.health} hp · ${u.ap} AP${conds.length ? " · " + conds.join(", ") : ""}`; }
    const c = creatureFor(u), me = currentPC(state);
    const can = me ? canAttack(state, me, u) : null;
    return `${u.name} · Tier ${c.tier} ${c.rank} · ${u.minion ? `${u.heads} heads` : describeHealth(u)}${conds.length ? " · " + conds.join(", ") : ""}${can ? (can.ok ? ` · click to ${can.hellfire ? "breathe Hellfire at" : can.trample ? `trample (${can.trample.hit.map(x => x.name).join(", ")})` : can.charge ? "charge" : can.ranged ? "shoot" : "attack"} (${can.cost} AP)` : can.why ? ` · ${can.why}` : "") : ""}`;
  }
  const me = currentPC(state);
  const cost = me && stepCost(state, me, sq.x, sq.y);
  return cost ? `Move here: ${cost.ap ? `${cost.ap} AP` : "no AP (movement left over)"}` : "";
}

function battleClick(sq) {
  const b = state.battle, me = currentPC(state);
  if (!me) return;
  const u = b.units.find(x => onField(x) && sq.x >= x.x && sq.x < x.x + x.w && sq.y >= x.y && sq.y < x.y + x.h);
  if (u && u.side !== "party") { battleAct((rng) => pcAttack(state, rng, say, u.id)); return; }
  if (!u && view.marks?.moves.has(`${sq.x},${sq.y}`)) battleAct((rng) => pcMove(state, rng, say, sq.x, sq.y));
}

/** A Trauma and where its healing stands. */
function traumaNote(t) {
  const r = recoveryOf(t.recovery);
  if (!t.tier) return t.name;
  if (r.permanent) return `${t.name} (lasting)`;
  const bits = [];
  if (r.treat && !t.treated) bits.push(`needs a Healer to ${r.treat.toLowerCase()}`);
  if (r.successes) bits.push(`tended ${t.done || 0}/${r.successes}`);
  if (r.days) bits.push(`${t.restDays || 0}/${r.days} days' rest`);
  return `${t.name} (${bits.join(", ")})`;
}

function renderParty() {
  const p = state.party;
  const lvl = partyLevel(state);
  $("party-head").textContent = `Party level ${lvl} · Band ${ROMAN[bandFor(lvl)]} · ${p.coin} sp · ${p.bankedXp} XP banked`;
  const list = $("members");
  list.innerHTML = "";
  for (const m of p.members) {
    const li = document.createElement("li");
    const state_ = m.dead ? "dead" : m.hp <= 0 ? "unconscious" : "";
    const scars = [m.injuries ? `${m.injuries} injur${m.injuries === 1 ? "y" : "ies"}` : "", m.exhausted ? `Exhausted ${m.exhausted}` : "", m.infected ? `Infected ${m.infected}` : "", ...(m.traumas || []).map(traumaNote)].filter(Boolean);
    const pet = m.companion;
    const petText = pet ? ` <span class="muted small">${pet.name} ${pet.dead ? "dead" : `${pet.hp}/${pet.health}`}</span>` : "";
    li.innerHTML = `<strong>${m.name}</strong> <span class="muted">${m.cls} ${m.level}</span> <span>${state_ ? `<span class="warn">${state_}</span>` : `${m.hp}/${m.health} hp`}</span>${m.casting ? ` <span class="muted">${m.mp ?? 0}/${maxMagan(m)} mg</span>` : ""} <span class="muted">${m.xp} XP</span>${petText}${scars.length ? `<span class="muted small">${scars.join(", ")}</span>` : ""}`;
    if (m.dead) li.className = "dead";
    else {
      if (hasUnspent(m)) {
        const lb = button("Level up", () => openAdvance(m.id));
        lb.className = "primary small-btn";
        lb.title = "Points to spend from a new level";
        li.appendChild(lb);
      }
      const rb = button("Reactions", () => openReactions(m.id));
      rb.className = "quiet small-btn";
      rb.title = "What this character does on their own when a reaction comes up";
      li.appendChild(rb);
    }
    list.appendChild(li);
  }
  for (const role of ["scout", "watchman", "forager", "cook", "healer", "smith"]) {
    const sel = $(role);
    sel.innerHTML = "";
    if (!["scout", "watchman"].includes(role)) sel.add(new Option("No one", ""));
    for (const m of p.members.filter(x => !x.dead)) sel.add(new Option(m.name, m.id));
    sel.value = p.roles[role] || "";
  }
  $("forage").value = p.forage || "meals";
  $("quiet").checked = !!p.quiet;
  if (p.pelts.length) $("pelts").textContent = `Pelts: ${p.pelts.map(x => `${x.quality} ${x.name.toLowerCase()} (${x.value} sp)`).join(", ")}`;
  else $("pelts").textContent = "";
  const lore = fragmentsRead(state.world), unread = unreadFragments(state.world).length, open = (state.world.leads || []).filter(l => !l.found);
  if (lore || unread || open.length) $("pelts").textContent += `${$("pelts").textContent ? " · " : ""}${lore || unread ? `Lost lore: ${lore % 3} of 3 read toward the next lost place${unread ? `, ${unread} unread` : ""}. ` : ""}${open.length ? `Leads: ${open.map(l => `${leadText(l)}, ${l.far} tile${l.far > 1 ? "s" : ""} ${l.dir}`).join("; ")}.` : ""}`;
  if (p.treasure?.length) $("pelts").textContent += `${p.pelts.length ? " · " : ""}Treasure: ${p.treasure.map(x => `${x.name} (${x.value} sp)`).join(", ")}`;
}

/* ---------------- supplies and the market */

const fmtSp = (n) => Number.isInteger(n) ? `${n} sp` : `${n.toFixed(2).replace(/0$/, "")} sp`;

function renderSupplies() {
  const p = state.party;
  if (!p.food) return;
  const eaters = p.members.filter(m => !m.dead).length;
  const days = Math.floor(meals(state) / Math.max(1, eaters * 2) * 10) / 10;
  $("supplies-head").textContent = `Supplies · ${meals(state)} meals${eaters ? ` (${days} days)` : ""} · ${p.water} of ${p.skins * SKIN_GALLONS} gal water`;
  const food = Object.entries(p.food.reduce((o, f) => { (o[f.name] ||= []).push(f); return o; }, {}))
    .map(([n, fs]) => `${fs.reduce((a, f) => a + f.n, 0)} ${n.toLowerCase()} (spoil${fs.length > 1 ? " from" : "s"} day ${Math.min(...fs.map(f => f.spoils))})`);
  const kit = Object.entries(p.stores).filter(([, n]) => n > 0).map(([n, k]) => `${k} ${n}`);
  const need = waterNeed(state) * p.members.filter(m => !m.dead).length;
  const worn = p.members.filter(m => !m.dead).map(m => `<li><strong>${m.name}</strong> <span class="muted">${m.worn?.length ? m.worn.join(", ") : "no weather clothing"}${m.armor ? `; ${m.armor.name}` : ""}</span></li>`).join("");
  $("supplies").innerHTML = `<p>${food.join(" · ") || "No food."}</p>
    <p>Water: ${p.water} gallons in ${p.skins} skins; the party drinks ${need} a day in this weather. Rivers, lakes, and settlements refill them.</p>
    <p>${kit.join(" · ") || "No kits or tools."}</p>
    <ul class="members">${worn}</ul>`;
}

function renderTown(busy) {
  const box = $("town");
  const s = settlementHere(state);
  if (!s || busy || state.battle) { box.hidden = true; return; }
  box.hidden = false;
  const m = runWithDice(state, (rng) => openMarket(state, rng, say));
  persist();
  const label = s.home ? "home village" : s.size;
  box.innerHTML = `<h2>The ${label}</h2><p class="small muted">Market dice 2d${m.die}, rolled once a day: what isn't here today may be tomorrow. ${fmtSp(state.party.coin)} in the purse.</p>`;
  const who = document.createElement("label");
  who.className = "small";
  who.textContent = "Clothing, arms, and armor for ";
  const ws = document.createElement("select");
  for (const x of state.party.members.filter(x => !x.dead)) ws.add(new Option(x.name, x.id));
  ws.value = renderTown.wearer || ws.options[0]?.value;
  ws.onchange = () => { renderTown.wearer = ws.value; render(); };
  who.append(ws);
  box.append(who);
  for (const g of SHOP) {
    const det = document.createElement("details");
    det.innerHTML = `<summary>${g.group}</summary>`;
    const ul = document.createElement("ul");
    ul.className = "shop";
    for (const name of Object.keys(g.items)) {
      const li = document.createElement("li");
      const have = name in GEAR && GEAR[name].kind !== "kit" ? count(state, name) : 0;
      li.innerHTML = `<span>${name} <span class="muted">${fmtSp(priceOf(name))}${have ? ` · have ${have}` : ""}</span></span>`;
      const bs = document.createElement("span");
      if (!m.stock[name]) bs.innerHTML = `<span class="muted small">not today</span>`;
      else for (const n of /^Rations|Wound Kit/.test(name) ? [1, 10] : [1]) {
        const b = button(n > 1 ? `×${n}` : "Buy", () => act(() => buy(state, say, name, n, renderTown.wearer || ws.value)));
        b.className = "small-btn";
        const wearer = state.party.members.find(x => x.id === (renderTown.wearer || ws.value));
        b.disabled = state.party.coin < priceOf(name) * n || (armsKind(name) && wearer && !mayUse(wearer, name));
        if (armsKind(name) && wearer && !mayUse(wearer, name)) b.title = `${wearer.name}'s class can't use it`;
        bs.append(" ", b);
      }
      li.append(bs);
      ul.append(li);
    }
    det.append(ul);
    box.append(det);
  }
  // Selling: a buyer of the piece's class on the market dice, and the town's coin.
  const sales = saleList(state);
  if (sales.length) {
    const det = document.createElement("details");
    det.innerHTML = `<summary>Sell · the ${label} can pay ${fmtSp(townCoin(state))} this week</summary>`;
    const ul = document.createElement("ul");
    ul.className = "shop";
    for (const x of sales) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${x.label} <span class="muted">${fmtSp(x.value)}</span></span>`;
      const b = button(m.buyers?.[x.id] === false ? "No buyer today" : "Sell", () => act(() => runWithDice(state, (rng) => sell(state, rng, say, x.id))));
      b.className = "small-btn"; b.disabled = m.buyers?.[x.id] === false;
      li.append(b);
      ul.append(li);
    }
    det.append(ul);
    box.append(det);
  }
  const svc = document.createElement("div");
  svc.className = "buttons";
  if (hasSmith(s.size)) { const b = button("Hire the smith for a day (8 sp)", () => act(() => runWithDice(state, (rng) => hireSmith(state, rng, say)))); b.title = "A Skilled smith works your repair kits: (d6 + d4) × 4 each."; b.disabled = state.party.coin < 8; svc.append(b); }
  if (!state.hoursUsed) {
    if (["town", "city", "metropolis"].includes(s.size)) { const b = button("Stay a day (Civilized Rest)", () => act(() => stay(state, "civilized"))); b.title = "A day in town: two Endurance dice of health, two casting dice of magan, Exhausted down 2. No repairs."; svc.append(b); }
    const b = button("A day in bed (Bed Rest)", () => act(() => stay(state, "bed")));
    b.title = "A day in bed: two dice plus your level, and Exhausted gone. No market, no repairs.";
    svc.append(b);
  }
  if (!s.home && s.size !== "hamlet") {
    const lab = document.createElement("label");
    lab.className = "small";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = !!state.party.listen;
    cb.onchange = () => act(() => { state.party.listen = cb.checked; });
    lab.append(cb, " Listen for rumors at the inn tonight");
    svc.append(lab);
  }
  box.append(svc);
  // Recruits: whoever's here this visit, or build someone of a class you choose.
  const alive = state.party.members.filter(x => !x.dead).length;
  const list = runWithDice(state, (rng) => recruitsHere(state, rng));
  persist();
  const rdet = document.createElement("details");
  rdet.open = alive < PARTY_SIZE;
  rdet.innerHTML = `<summary>Recruits · ${list.length || "no one"} looking for work${alive >= PARTY_SIZE ? " (the party is full)" : ""}</summary>`;
  const rul = document.createElement("ul");
  rul.className = "shop";
  for (const r of list) {
    const li = document.createElement("li");
    const a = r.attributes;
    li.innerHTML = `<span><strong>${r.name}</strong> ${r.cls} ${r.level} <span class="muted small">${r.health} hp${r.magan ? `, ${r.magan} mg` : ""} · STR ${a.strength} AGI ${a.agility} PHY ${a.physique} END ${a.endurance} INT ${a.intelligence} WIS ${a.wisdom} CHA ${a.charisma} PER ${a.perception} · ${r.weapons.map(w => w.name).join(", ")}${r.armor ? `, ${r.armor.name}` : ""}${r.shield ? `, ${r.shield.name}` : ""}${r.companion ? ` · ${r.companion.name}` : ""}</span></span>`;
    const cost = recruitCost(r);
    const b = button(cost ? `Hire (${cost} sp)` : "Hire", () => act(() => hire(state, say, r.id)));
    b.className = "small-btn"; b.disabled = alive >= PARTY_SIZE || state.party.coin < cost;
    li.append(b);
    rul.append(li);
  }
  rdet.append(rul);
  if (alive < PARTY_SIZE) {
    const brow = document.createElement("div");
    brow.className = "buttons";
    const cs = document.createElement("select");
    for (const c of [...new Set([...HUMANS, ...DEMIHUMANS])].sort()) cs.add(new Option(c, c));
    const bb = button("Build a level 1 character", () => act(() => runWithDice(state, (rng) => build(state, rng, say, cs.value))));
    bb.title = "Rolled up by the class's dice; you're assumed to have found someone.";
    brow.append(cs, bb);
    rdet.append(brow);
  }
  box.append(rdet);
  if (hasSage(s.size) && unreadFragments(state.world).length) {
    const row = document.createElement("div");
    row.className = "buttons";
    const b = button(`Have a Sage read a fragment of lost lore (${SAGE_FEE} sp)`, () => act(() => runWithDice(state, (rng) => sageReads(state, rng, say))));
    b.disabled = state.party.coin < SAGE_FEE;
    row.append(b);
    box.append(row);
  }
  if (hasHealer(s.size)) {
    const row = document.createElement("div");
    row.className = "buttons";
    const traumas = state.party.members.filter(x => !x.dead).flatMap(x => (x.traumas || []).map((t, i) => ({ x, t, i }))).filter(({ t }) => needsHealer(t));
    for (const { x, t, i } of traumas) { const b = button(`Treat ${x.name}: ${t.name} (${8 + priceOf("Trauma Kit")} sp)`, () => act(() => runWithDice(state, (rng) => healerTreatsTrauma(state, rng, say, x.id, i)))); b.disabled = state.party.coin < 8 + priceOf("Trauma Kit"); row.append(b); }
    box.append(row);
  }
  if (hasHealer(s.size)) {
    const hurt = state.party.members.filter(x => !x.dead && x.injuries > 0);
    const row = document.createElement("div");
    row.className = "buttons";
    row.innerHTML = `<p class="small">Healer: 8 sp an Injury.${hurt.length ? "" : " No one needs one."}</p>`;
    for (const x of hurt) { const b = button(`Treat ${x.name} (${x.injuries})`, () => act(() => healerTreats(state, say, x.id))); b.disabled = state.party.coin < 8; row.append(b); }
    box.append(row);
  }
}

/* ---------------- advancement */

let undo = [];
/** Spend a new level's points (Mastery Core Classes, Leveling; Mastery System, Mastery Points). */
function openAdvance(id) {
  const m = state.party.members.find(x => x.id === id);
  const box = $("reactions");
  const nx = nextLevelXp(m);
  const u = m.unspent;
  box.innerHTML = `<p><strong>${m.name}</strong>, level ${m.level} ${m.cls}${titleOf(m) ? `, ${titleOf(m)}` : ""} <span class="muted small">${m.xp} XP${nx ? `, ${nx} for level ${m.level + 1}` : ""}</span></p>
    <p class="small muted">One mastery point per weapon type, style, form, or skill each level. Points you keep stay for later.</p>`;
  const step = (fn) => { undo.push({ id, m: JSON.stringify(m), rng: state.rngState }); fn(); persist(); openAdvance(id); renderParty(); };
  const section = (title, left, rows) => {
    const h = document.createElement("h3");
    h.className = "small";
    h.textContent = `${title}${left != null ? ` · ${left} to spend` : ""}`;
    box.append(h);
    const ul = document.createElement("ul");
    ul.className = "shop";
    for (const r of rows) ul.append(r);
    box.append(ul);
  };
  const row = (label, value, can, why, onclick, extra = "") => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${label} <span class="muted">${value}</span>${extra ? ` <span class="muted small">${extra}</span>` : ""}</span>`;
    const b = button("+1", onclick);
    b.className = "small-btn"; b.disabled = !can; if (why) b.title = why;
    li.append(b);
    return li;
  };
  section("Attributes", u.attr, ATTRIBUTES.map(a => row(cap(a), `${m.attributes[a]} (Tier ${1 + Math.min(Math.floor(m.attributes[a] / 5), 12)})`, u.attr > 0, u.attr > 0 ? "" : "no attribute points",
    () => step(() => runWithDice(state, (rng) => raiseAttribute(state, m, a, rng, say))), pointsHint(m.attrPts[a]).split(" — ")[1] || "")));
  const t = masteryTargets(m);
  const mrow = (key, opts = {}) => {
    const why = cannotInvest(m, key, opts);
    return row(masteryLabel(key) + (opts.free ? " (free)" : ""), MASTERY_NAMES[masteryIndex(m, key)], !why, why, () => step(() => invest(m, key, opts)));
  };
  section("Weapon mastery", u.weapon, t.weapon.map(k => mrow(k)));
  if (u.style > 0) section("Free combat style points", u.style, t.weapon.filter(k => k.startsWith("style:")).map(k => mrow(k, { free: true })));
  if (t.spell.length) section("Spell mastery", u.spell, t.spell.map(k => mrow(k)));
  section("Skill mastery", u.skill, t.skill.map(k => mrow(k)));
  const rowb = document.createElement("div");
  rowb.className = "buttons";
  const last = undo.filter(x => x.id === id);
  const ub = button("Undo", () => {
    const x = undo.pop();
    const i = state.party.members.findIndex(y => y.id === x.id);
    state.party.members[i] = JSON.parse(x.m);
    state.rngState = x.rng;
    persist(); openAdvance(x.id); renderParty();
  });
  ub.disabled = !last.length || undo.at(-1)?.id !== id;
  const done = button("Done", () => { box.hidden = true; undo = []; render(); });
  done.className = "primary";
  rowb.append(ub, done);
  box.append(rowb);
  box.hidden = false;
  box.scrollIntoView({ block: "nearest" });
}

/** Each character's standing choice for each reaction: Ask, Always, Never. */
function openReactions(id) {
  const m = state.party.members.find(x => x.id === id);
  const box = $("reactions");
  box.innerHTML = `<p><strong>${m.name}'s reactions</strong> <span class="muted small">Ask stops for you each time; Always and Never decide on their own.</span></p>`;
  for (const k of reactionsFor(m)) {
    const r = REACTIONS[k];
    const row = document.createElement("div");
    row.className = "react-row";
    const lab = document.createElement("label");
    lab.textContent = r.label;
    const sel = document.createElement("select");
    for (const v of r.noAsk ? ["always", "never"] : ["ask", "always", "never"]) sel.add(new Option(v[0].toUpperCase() + v.slice(1), v));
    sel.value = reactOf(m, k);
    sel.onchange = () => { setReaction(m, k, sel.value); persist(); };
    lab.appendChild(sel);
    const rule = document.createElement("p");
    rule.className = "small muted";
    rule.textContent = r.text;
    row.append(lab, rule);
    box.appendChild(row);
  }
  const row = document.createElement("div");
  row.className = "buttons";
  const done = button("Done", () => { box.hidden = true; render(); });
  done.className = "primary";
  row.appendChild(done);
  box.appendChild(row);
  box.hidden = false;
  box.scrollIntoView({ block: "nearest" });
}

function describe(sq, x, y) {
  if (!sq) return "Unexplored";
  const bits = [sq.lake ? "Lake" : TERRAINS[sq.terrain].label];
  if (sq.settlement) bits.push(sq.settlement.home ? "Home village" : SETTLEMENTS[sq.settlement.size].label);
  const pl = state.world.places?.[`${x},${y}`];
  if (pl) bits.push(pl.type === "source" ? `${pl.kind} (${pl.forms.join(", ")})` : pl.creature ? `${pl.type} of ${pl.creature}` : pl.type);
  if (sq.bridge) bits.push("bridge"); else { if (sq.road) bits.push("road"); if (sq.river) bits.push("river"); }
  const country = countryAt(state.world, x, y);
  bits.push(country === "deep" ? "Deep country" : country === "settled" ? "Settled" : "Wild");
  const c = moveCost(sq);
  if (Number.isFinite(c)) bits.push(`cost ${c}`);
  return bits.join(" · ");
}

function act(fn) {
  fn();
  persist();
  view.cx = state.party.x + 0.5; view.cy = state.party.y + 0.5;
  render();
}

/* ---------------- input */

$("travel").onclick = () => act(() => travelLeg(state));
$("camp").onclick = () => act(() => campNow(state));
$("search").onclick = () => act(() => { searchLeg(state); afterEvent(state); });
$("stop").onclick = () => act(() => travelLeg(state, "stop"));
$("push").onclick = () => act(() => travelLeg(state, "push"));
$("pace").onchange = (e) => act(() => setPace(state, e.target.value));
$("scout").onchange = (e) => act(() => { state.party.roles.scout = e.target.value; });
$("watchman").onchange = (e) => act(() => { state.party.roles.watchman = e.target.value; });
for (const role of ["forager", "cook", "healer", "smith"]) $(role).onchange = (e) => act(() => { state.party.roles[role] = e.target.value || null; });
$("forage").onchange = (e) => act(() => { state.party.forage = e.target.value; });
$("quiet").onchange = (e) => act(() => { state.party.quiet = e.target.checked; });
$("center").onclick = () => { view.cx = state.party.x + 0.5; view.cy = state.party.y + 0.5; render(); };
$("zoom-in").onclick = () => { view.scale = Math.min(48, view.scale * 1.25); render(); };
$("zoom-out").onclick = () => { view.scale = Math.max(6, view.scale / 1.25); render(); };
$("new").onclick = () => { $("newgame").hidden = false; $("seed-input").value = ""; $("seed-input").focus(); };
$("cancel-new").onclick = () => { $("newgame").hidden = true; };
$("start-new").onclick = () => {
  const text = $("seed-input").value.trim();
  const seed = /^\d+$/.test(text) ? Number(text) : undefined;
  $("newgame").hidden = true;
  state = newGame(seed);
  picks = {};
  act(() => {});
};

const squareUnder = (ev) => {
  const r = canvas.getBoundingClientRect();
  if (state.battle) {
    const { cell, ox, oy } = battleLayout(canvas, state.battle);
    return { x: Math.floor((ev.clientX - r.left - ox) / cell), y: Math.floor((ev.clientY - r.top - oy) / cell) };
  }
  const x = (ev.clientX - r.left - r.width / 2) / view.scale + view.cx;
  const y = (ev.clientY - r.top - r.height / 2) / view.scale + view.cy;
  return { x: Math.floor(x), y: Math.floor(y) };
};

let drag = null;
canvas.addEventListener("pointerdown", (ev) => { if (state.battle) return; drag = { x: ev.clientX, y: ev.clientY, cx: view.cx, cy: view.cy, moved: false }; canvas.setPointerCapture(ev.pointerId); });
canvas.addEventListener("pointermove", (ev) => {
  if (!state) return;
  if (drag) {
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.moved) { view.cx = drag.cx - dx / view.scale; view.cy = drag.cy - dy / view.scale; }
  }
  view.hover = squareUnder(ev);
  if (state.battle) { $("hover").textContent = battleHover(view.hover); paint(); return; }
  const sq = squareAt(state.world, view.hover.x, view.hover.y);
  $("hover").textContent = describe(sq, view.hover.x, view.hover.y);
  draw(canvas, state, view);
});
canvas.addEventListener("pointerup", (ev) => {
  if (state.battle) { battleClick(squareUnder(ev)); return; }
  if (drag && !drag.moved && !state.pending && !state.encounter && !state.sign) {
    const { x, y } = squareUnder(ev);
    setTarget(state, x, y);
    persist();
    render();
  }
  drag = null;
});
canvas.addEventListener("pointerleave", () => { view.hover = null; $("hover").textContent = ""; paint(); });
canvas.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  if (state.battle) return;
  view.scale = Math.max(6, Math.min(48, view.scale * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)));
  draw(canvas, state, view);
}, { passive: false });

window.addEventListener("keydown", (ev) => {
  if (ev.target.tagName === "SELECT" || ev.target.tagName === "INPUT") return;
  if (state.battle) {
    const b = state.battle;
    if (b.prompt && (ev.key === "y" || ev.key === "n")) battleAct((rng) => respond(state, rng, say, ev.key === "y"));
    else if (b.prompt?.helper && ev.key === "h") battleAct((rng) => respond(state, rng, say, "hearten"));
    else if (b.stage === "declare" && ev.key === "Enter") battleAct(declareRound);
    else if (currentPC(state) && ev.key === "e") battleAct((rng) => pcEndTurn(state, rng, say));
    return;
  }
  const free = !state.pending && !state.encounter && !state.sign;
  if (ev.key === " " && free) { ev.preventDefault(); act(() => travelLeg(state)); }
  if (ev.key === "c" && free) act(() => campNow(state));
});
window.addEventListener("resize", () => state && render());

/* ---------------- start */

async function start(data = {}) {
  storage = await openStorage();
  state = (data.state && unpack(data.state)) || (await storage.load()) || newGame();
  view.cx = state.party.x + 0.5; view.cy = state.party.y + 0.5;
  $("saves").textContent = `Saved to ${storage.where}`;
  render();
  // Keep the game going if the page is updated while it's open.
  window.claude?.hot?.snapshot?.(() => ({ state: pack(state) }));
}
const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start); else start(hot?.data ?? {});
