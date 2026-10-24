/**
 * The page: wires the map canvas and the side panel to the game state, and
 * saves after every action.
 */
import { newGame, travelLeg, campNow, setTarget, setPace, seasonOf, DAY_HOURS, squaresPerHour, note, afterEvent, runWithDice } from "./journey.js";
import { choices, choose, signChoices, chooseSign, partyLevel, bandFor, ROMAN } from "./events.js";
import { CREATURES } from "./data/creatures.js";
import { squareAt, countryAt, findPath, moveCost, TERRAINS, SETTLEMENTS } from "./world.js";
import { draw } from "./render.js";
import { BAND_LABELS } from "./vendor/foundry/module/helpers/weather-rules.mjs";
import { openStorage, pack, unpack } from "./storage.js";

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
  draw(canvas, state, view);
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
  const busy = !!(state.encounter || state.sign);
  $("choice").hidden = !pending;
  $("travel").disabled = pending || busy;
  $("camp").disabled = pending || busy;
  renderEvent();
  renderParty();
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
  if (state.encounter) {
    const e = state.encounter, c = CREATURES[e.head];
    box.hidden = false;
    box.innerHTML = `<h2>${e.night ? "In the night" : "Encounter"}</h2>
      <p>${e.text.replace(/\s*\[[^\]]*\]/g, "")}</p>
      <p class="muted">${e.head}: Tier ${c.tier} ${c.rank}, Division ${c.division}, ${e.xp} XP. ${e.temper}.</p>
      <p>${e.distance} · ${e.partyAware ? "you see it" : "you didn't see it"} · ${e.creatureAware ? "it knows you're here" : "it hasn't noticed you"}</p>`;
    const row = document.createElement("div");
    row.className = "buttons";
    for (const ch of choices(state)) row.appendChild(button(ch.label, () => act(() => { runWithDice(state, (rng) => choose(state, rng, ch.id, say)); afterEvent(state); })));
    box.appendChild(row);
  } else if (state.sign) {
    const s = state.sign;
    box.hidden = false;
    box.innerHTML = `<h2>Signs</h2><p>${s.read && !s.unread ? s.text.replace(/\s*\[[^\]]*\]/g, "") : "Tracks, a kill, a camp gone cold. Something has passed this way."}</p>${s.above ? '<p class="warn">Whatever left these is beyond you.</p>' : ""}`;
    const row = document.createElement("div");
    row.className = "buttons";
    for (const ch of signChoices(state)) row.appendChild(button(ch.label, () => act(() => { runWithDice(state, (rng) => chooseSign(state, rng, ch.id, say)); afterEvent(state); })));
    box.appendChild(row);
  } else box.hidden = true;
}

function renderParty() {
  const p = state.party;
  const lvl = partyLevel(state);
  $("party-head").textContent = `Party level ${lvl} · Band ${ROMAN[bandFor(lvl)]} · ${p.coin} sp · ${p.bankedXp} XP banked`;
  const list = $("members");
  list.innerHTML = "";
  for (const m of p.members) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${m.name}</strong> <span class="muted">${m.cls} ${m.level}</span> <span>${m.hp}/${m.health} hp</span> <span class="muted">${m.xp} XP</span>`;
    list.appendChild(li);
  }
  for (const role of ["scout", "watchman"]) {
    const sel = $(role);
    if (!sel.options.length) for (const m of p.members) sel.add(new Option(m.name, m.id));
    sel.value = p.roles[role];
  }
  $("quiet").checked = !!p.quiet;
  if (p.pelts.length) $("pelts").textContent = `Pelts: ${p.pelts.map(x => `${x.quality} ${x.name.toLowerCase()} (${x.value} sp)`).join(", ")}`;
  else $("pelts").textContent = "";
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
$("stop").onclick = () => act(() => travelLeg(state, "stop"));
$("push").onclick = () => act(() => travelLeg(state, "push"));
$("pace").onchange = (e) => act(() => setPace(state, e.target.value));
$("scout").onchange = (e) => act(() => { state.party.roles.scout = e.target.value; });
$("watchman").onchange = (e) => act(() => { state.party.roles.watchman = e.target.value; });
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
  act(() => {});
};

const squareUnder = (ev) => {
  const r = canvas.getBoundingClientRect();
  const x = (ev.clientX - r.left - r.width / 2) / view.scale + view.cx;
  const y = (ev.clientY - r.top - r.height / 2) / view.scale + view.cy;
  return { x: Math.floor(x), y: Math.floor(y) };
};

let drag = null;
canvas.addEventListener("pointerdown", (ev) => { drag = { x: ev.clientX, y: ev.clientY, cx: view.cx, cy: view.cy, moved: false }; canvas.setPointerCapture(ev.pointerId); });
canvas.addEventListener("pointermove", (ev) => {
  if (!state) return;
  if (drag) {
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.moved) { view.cx = drag.cx - dx / view.scale; view.cy = drag.cy - dy / view.scale; }
  }
  view.hover = squareUnder(ev);
  const sq = squareAt(state.world, view.hover.x, view.hover.y);
  $("hover").textContent = describe(sq, view.hover.x, view.hover.y);
  draw(canvas, state, view);
});
canvas.addEventListener("pointerup", (ev) => {
  if (drag && !drag.moved && !state.pending && !state.encounter && !state.sign) {
    const { x, y } = squareUnder(ev);
    setTarget(state, x, y);
    persist();
    render();
  }
  drag = null;
});
canvas.addEventListener("pointerleave", () => { view.hover = null; $("hover").textContent = ""; draw(canvas, state, view); });
canvas.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  view.scale = Math.max(6, Math.min(48, view.scale * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)));
  draw(canvas, state, view);
}, { passive: false });

window.addEventListener("keydown", (ev) => {
  if (ev.target.tagName === "SELECT" || ev.target.tagName === "INPUT") return;
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
