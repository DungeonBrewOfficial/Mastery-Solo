/**
 * The page: wires the map canvas and the side panel to the game state, and
 * saves after every action.
 */
import { newGame, travelLeg, campNow, setTarget, setPace, seasonOf, DAY_HOURS, squaresPerHour } from "./journey.js";
import { squareAt, countryAt, findPath, moveCost, TERRAINS, SETTLEMENTS } from "./world.js";
import { draw } from "./render.js";
import { BAND_LABELS } from "./vendor/foundry/module/helpers/weather-rules.mjs";

const SAVE_KEY = "mastery-solo-save-v1";
const $ = (id) => document.getElementById(id);
const canvas = $("map");

let state = loadSaved() || newGame();
const view = { cx: state.party.x + 0.5, cy: state.party.y + 0.5, scale: 22, path: null, hover: null };

function loadSaved() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* private window: play on without saving */ }
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
  $("choice").hidden = !pending;
  $("travel").disabled = pending;
  $("camp").disabled = pending;
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

function describe(sq, x, y) {
  if (!sq) return "Unexplored";
  const bits = [sq.lake ? "Lake" : TERRAINS[sq.terrain].label];
  if (sq.settlement) bits.push(sq.settlement.home ? "Home village" : SETTLEMENTS[sq.settlement.size].label);
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
$("center").onclick = () => { view.cx = state.party.x + 0.5; view.cy = state.party.y + 0.5; render(); };
$("zoom-in").onclick = () => { view.scale = Math.min(48, view.scale * 1.25); render(); };
$("zoom-out").onclick = () => { view.scale = Math.max(6, view.scale / 1.25); render(); };
$("new").onclick = () => {
  if (!confirm("Start a new dynasty? The current world will be lost.")) return;
  const seedText = prompt("Seed (leave blank for a random world):", "");
  const seed = seedText && /^\d+$/.test(seedText.trim()) ? Number(seedText.trim()) : undefined;
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
  if (drag && !drag.moved && !state.pending) {
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
  if (ev.key === " " && !state.pending) { ev.preventDefault(); act(() => travelLeg(state)); }
  if (ev.key === "c" && !state.pending) act(() => campNow(state));
});
window.addEventListener("resize", render);

render();
