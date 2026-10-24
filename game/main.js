/**
 * The page: wires the map canvas and the side panel to the game state, and
 * saves after every action.
 */
import { maxMagan, newGame, travelLeg, campNow, setTarget, setPace, seasonOf, DAY_HOURS, squaresPerHour, note, afterEvent, runWithDice } from "./journey.js";
import { choices, choose, signChoices, chooseSign, partyLevel, bandFor, ROMAN } from "./events.js";
import { CREATURES } from "./data/creatures.js";
import { squareAt, countryAt, findPath, moveCost, TERRAINS, SETTLEMENTS } from "./world.js";
import { draw, drawBattle, battleLayout } from "./render.js";
import { opportunities, REACTIONS, reactOf, reactionsFor, setReaction, attackModes, setMode, freeTargets, pcBreakFree, pcStand, challengeTargets, beginRound, retreat, runPlan, respond, currentPC, moveCost as stepCost, pcMove, pcAttack, pcEndTurn, triageTargets, pcTriage, canAttack, standing, onField, conditionsOf, memberFor, creatureFor, weaponOf, GUARDS, PHASES } from "./combat.js";
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
  if (state.over) {
    box.hidden = false;
    box.innerHTML = `<h2>The party has fallen</h2><p>${state.over.why}</p><p class="muted">The dynasty's next generation comes with milestone 3. For now, start again.</p>`;
    const row = document.createElement("div");
    row.className = "buttons";
    row.appendChild(button("Start a new dynasty", () => $("new").click()));
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

/* ---------------- battle */

let picks = {};
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
  return { current: u?.id, moves, targets, units, hover: view.hover };
}

function paint() {
  if (state.battle && view.marks) drawBattle(canvas, state.battle, { ...view.marks, hover: view.hover });
  else draw(canvas, state, view);
}

const GOOD = /^(Rallied|Emboldened|Fearless|Energized|Empowered|Tireless|challenging)/;
const condHtml = (conds) => conds.length ? ` ${conds.map(c => `<span class="${GOOD.test(c) ? "good" : "warn"}">${c}</span>`).join(", ")}` : "";
const describeHealth = (u) => u.hp >= u.hpMax ? "unhurt" : u.hp > u.hpMax / 2 ? "hurt" : u.hp > u.hpMax / 4 ? "bloodied" : "near death";

function unitLine(u) {
  const conds = conditionsOf(state, u);
  if (u.pc) {
    const m = memberFor(state, u), w = weaponOf(m, u);
    const gear = [m.armor ? `${m.armor.name} ${m.armor.durability}/${m.armor.max}` : "", m.shield ? `${m.shield.name} ${m.shield.durability}/${m.shield.max}` : ""].filter(Boolean).join(" · ");
    return `<strong>${m.name}</strong> <span>${m.hp}/${m.health} hp</span> <span class="muted">${u.ap} AP · ${u.companion ? m.attack.name : `${w ? w.name : "unarmed"} · ${GUARDS[u.guard].label}`}</span>${condHtml(conds)}${gear ? `<br><span class="muted small">${gear}</span>` : ""}`;
  }
  const c = creatureFor(u);
  if (u.object) return `<strong>${u.name}</strong> <span class="muted">can't defend; ${u.dmgSince} damage since the Dryad's last turn (7 stops her regrowth, 14 her melding)</span>`;
  return `<strong>${u.name}</strong> <span>${u.minion ? `${u.heads} of ${u.headsMax}` : describeHealth(u)}</span> <span class="muted">${c.rank}${u.armorMax ? ` · armor ${u.armorDur > 0 ? "holding" : "broken"}` : ""}</span>${condHtml(conds)}`;
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
    const go = button("Begin the round (Enter)", () => battleAct((rng) => beginRound(state, rng, say, picks)));
    go.className = "primary";
    row.appendChild(go);
    const dying = b.units.some(v => v.pc && onField(v) && memberFor(state, v).dying != null && !memberFor(state, v).stable);
    const run = button("Break away", () => { planningRun = true; carry = {}; render(); });
    run.hidden = !!b.aftermath;
    run.title = dying ? "Anyone with one round left on the dying timer dies during the break-away." : "One round and one trial to get clear, then the chase.";
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
    if (modes.length > 1) {
      const mr = document.createElement("div");
      mr.className = "buttons modes";
      for (const md of modes) {
        const mb = button(md.label, () => { setMode(state, md.id); render(); });
        if ((u.mode || "strike") === md.id) mb.className = "on";
        mr.appendChild(mb);
      }
      box.appendChild(mr);
    }
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

function renderParty() {
  const p = state.party;
  const lvl = partyLevel(state);
  $("party-head").textContent = `Party level ${lvl} · Band ${ROMAN[bandFor(lvl)]} · ${p.coin} sp · ${p.bankedXp} XP banked`;
  const list = $("members");
  list.innerHTML = "";
  for (const m of p.members) {
    const li = document.createElement("li");
    const state_ = m.dead ? "dead" : m.hp <= 0 ? "unconscious" : "";
    const scars = [m.injuries ? `${m.injuries} injur${m.injuries === 1 ? "y" : "ies"}` : "", m.exhausted ? `Exhausted ${m.exhausted}` : "", m.infected ? `Infected ${m.infected}` : "", ...(m.traumas || []).map(t => t.name)].filter(Boolean);
    const pet = m.companion;
    const petText = pet ? ` <span class="muted small">${pet.name} ${pet.dead ? "dead" : `${pet.hp}/${pet.health}`}</span>` : "";
    li.innerHTML = `<strong>${m.name}</strong> <span class="muted">${m.cls} ${m.level}</span> <span>${state_ ? `<span class="warn">${state_}</span>` : `${m.hp}/${m.health} hp`}</span>${m.casting ? ` <span class="muted">${m.mp ?? 0}/${maxMagan(m)} mg</span>` : ""} <span class="muted">${m.xp} XP</span>${petText}${scars.length ? `<span class="muted small">${scars.join(", ")}</span>` : ""}`;
    if (m.dead) li.className = "dead";
    else {
      const rb = button("Reactions", () => openReactions(m.id));
      rb.className = "quiet small-btn";
      rb.title = "What this character does on their own when a reaction comes up";
      li.appendChild(rb);
    }
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
    else if (b.stage === "declare" && ev.key === "Enter") battleAct((rng) => beginRound(state, rng, say, picks));
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
