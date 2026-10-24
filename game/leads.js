/**
 * LEADS (design/04-the-map.md, Hidden and lost places): clues found in sites
 * point to hidden places, and three fragments of lost lore, read, point to a
 * lost place. Both lie in Deep country and are found only by searching the
 * marked tile with a lead in hand.
 */
import { roll } from "./rng.js";
import { trial, passes, tierOf, dieOfTier } from "./mastery.js";
import { alive, partyLevel, bandFor, EVEN_DC, HARD_DC, placeOn } from "./events.js";
import { getTile, tileOf, squareAt, TILE } from "./world.js";

export const DIRS = [["north", 0, -1], ["northeast", 1, -1], ["east", 1, 0], ["southeast", 1, 1], ["south", 0, 1], ["southwest", -1, 1], ["west", -1, 0], ["northwest", -1, -1]];
/** What a clue says is hidden there (d6). */
const HIDDEN = { 1: "lair", 2: "cave", 3: "ruin", 4: "barrow", 5: "hideout", 6: "cache" };
const HIDDEN_TEXT = { lair: "a lair", cave: "a cave", ruin: "a ruin", barrow: "a barrow", hideout: "an outlaws' hideout", cache: "a cache", lost: "a lost place" };
export const leadText = (l) => HIDDEN_TEXT[l.kind];

const tier = (m, a) => tierOf(m.attributes[a]);
const skillOf = (m, s) => m.skills?.[s] || 1;
const best = (state, attr, sk) => [...alive(state)].sort((a, b) => (tier(b, attr) + skillOf(b, sk)) - (tier(a, attr) + skillOf(a, sk)))[0];

/**
 * The tile a lead points to: so many tiles in its direction, carried on to
 * the first Deep tile. A tile not yet generated could be anything, so the
 * lead stops there and is carried on when the party reaches it, if it isn't Deep.
 */
function settle(world, lead) {
  for (let i = 0; i < 40; i++) {
    const t = getTile(world, lead.tx, lead.ty);
    if (!t || t.deep) return;
    lead.tx += lead.dx; lead.ty += lead.dy; lead.carried = true;
  }
}

function point(state, rng, from, far) {
  const [dir, dx, dy] = DIRS[rng.d(8) - 1];
  const [tx, ty] = tileOf(from.x, from.y);
  const lead = { dir, dx, dy, far, tx: tx + dx * far, ty: ty + dy * far, day: state.day, found: false };
  settle(state.world, lead);
  return lead;
}

/** A clue to a hidden place: d8 direction, 1d3 tiles, d6 for what's there. */
export function clue(state, rng, note, how) {
  const k = rng.d(6);
  const lead = { ...point(state, rng, state.party, rng.d(3)), kind: HIDDEN[k], how };
  (state.world.leads ||= []).push(lead);
  note(`${how}: a clue to ${HIDDEN_TEXT[lead.kind]} hidden ${lead.far} tile${lead.far > 1 ? "s" : ""} to the ${lead.dir} (d6 ${k})${lead.carried ? ", on into the first Deep country beyond" : ""}. Marked on the map; search there.`, "event");
  return lead;
}

/* ------------------------------------------------------------------ */
/* Lost lore                                                            */

/** A fragment of lost lore turns up; someone tries to read it at once (Lore, Ancient Lore, the band's Hard DC). */
export function fragment(state, rng, note, how) {
  const f = { how, day: state.day, read: false, x: state.party.x, y: state.party.y };
  (state.world.fragments ||= []).push(f);
  note(`${how}: a fragment of lost lore.`, "event");
  readFragment(state, rng, note, f);
  return f;
}

export const fragmentsRead = (world) => (world.fragments || []).filter(f => f.read).length;
export const unreadFragments = (world) => (world.fragments || []).filter(f => !f.read);

export function readFragment(state, rng, note, f, { sage = false } = {}) {
  if (f.read) return true;
  if (!sage) {
    const m = best(state, "intelligence", "lore");
    if (!m) return false;
    const dc = HARD_DC[bandFor(partyLevel(state))];
    const t = trial(rng, [dieOfTier(tier(m, "intelligence")), dieOfTier(skillOf(m, "lore"))]);
    if (!passes(t, dc)) { note(`${m.name} can't read it (Lore ${t.text} against ${dc}). A Sage in a town could.`); return false; }
    note(`${m.name} reads it (Lore ${t.text} against ${dc}).`, "reward");
  }
  f.read = true;
  const n = fragmentsRead(state.world);
  if (n % 3) { note(`Fragments of lost lore read: ${n % 3} of 3.`); return true; }
  const lead = { ...point(state, rng, state.party, roll(rng, "2d6").total), kind: "lost", how: "Three fragments of lost lore" };
  (state.world.leads ||= []).push(lead);
  note(`The third fragment makes sense of the others: a lost place lies ${lead.far} tiles to the ${lead.dir}${lead.carried ? ", on into the first Deep country beyond" : ""}. Marked on the map; search there.`, "event");
  return true;
}

/* ------------------------------------------------------------------ */
/* Searching                                                            */

const tileOfParty = (state) => tileOf(state.party.x, state.party.y);
/** Leads pointing to the tile the party is in (carried on first if it turned out not to be Deep). */
export function leadsHere(state, note = null) {
  const [tx, ty] = tileOfParty(state);
  for (const l of state.world.leads || []) {
    if (l.found || l.tx !== tx || l.ty !== ty) continue;
    settle(state.world, l);
    if (note && (l.tx !== tx || l.ty !== ty)) note(`This isn't Deep country. The lead to ${HIDDEN_TEXT[l.kind]} carries on to the ${l.dir}.`, "event");
  }
  return (state.world.leads || []).filter(l => !l.found && l.tx === tx && l.ty === ty);
}

/**
 * A leg spent searching (the caller rolls the hours and the event die): the
 * Scout's Alertness (Secret Doors) trial against the Even DC for a hidden
 * place or the Hard DC for a lost one, +2 in Deep country, with a Helper's +2. → the place found, or null.
 */
export function search(state, rng, note) {
  const leads = leadsHere(state);
  if (!leads.length) { note("You search, but without a lead there's nothing to find."); return null; }
  const lead = leads.find(l => l.kind !== "lost") || leads[0];
  const scout = alive(state).find(m => m.id === state.party.roles.scout) || best(state, "perception", "alertness");
  const helper = alive(state).find(m => m !== scout && skillOf(m, "alertness") >= 2);
  const deep = getTile(state.world, ...tileOfParty(state))?.deep;
  // Hidden places: the band's Even DC; lost places: its Hard DC; +2 for Deep country either way [Jon, 2026-10-24].
  const band = bandFor(partyLevel(state));
  const dc = (lead.kind === "lost" ? HARD_DC[band] : EVEN_DC[band]) + (deep ? 2 : 0);
  const t = trial(rng, [dieOfTier(tier(scout, "perception")), dieOfTier(skillOf(scout, "alertness"))], { bonus: helper ? 2 : 0 });
  if (!passes(t, dc)) { note(`${scout.name} searches for ${HIDDEN_TEXT[lead.kind]}${helper ? `, ${helper.name} helping` : ""}: Alertness ${t.text} against ${dc}. Not here, not yet.`); return null; }
  return arrive(state, note, lead, `${scout.name} finds it${helper ? `, ${helper.name} helping` : ""} (Alertness ${t.text} against ${dc})`);
}

/** The place a lead points to is found where the party stands. */
function arrive(state, note, lead, how) {
  lead.found = true;
  // On the square searched to, or the nearest free one if something is already marked there.
  let { x, y } = state.party;
  for (let r = 0; state.world.places?.[`${x},${y}`] && r < 4; r++)
    for (let dy = -r; dy <= r && state.world.places?.[`${x},${y}`]; dy++) for (let dx = -r; dx <= r; dx++) {
      const k = `${state.party.x + dx},${state.party.y + dy}`;
      if (!state.world.places?.[k] && !squareAt(state.world, state.party.x + dx, state.party.y + dy)?.settlement) { x = state.party.x + dx; y = state.party.y + dy; break; }
    }
  if (x !== state.party.x || y !== state.party.y) { state.party.x = x; state.party.y = y; }
  const place = placeOn(state, x, y, { type: lead.kind === "hideout" ? "ruin" : lead.kind === "lost" ? "lost" : lead.kind, hidden: true, lost: lead.kind === "lost", hideout: lead.kind === "hideout" });
  const xp = lead.kind === "lost" ? 75 : 50;
  state.party.bankedXp += xp;
  note(`${how}: ${HIDDEN_TEXT[lead.kind]}. ${lead.kind === "lost" ? "Lost" : "Hidden"} Location: ${xp} XP, banked.`, "event");
  return place;
}

/** A lead someone showed the way to (the White Hart): a hidden place (d6) or a lost one, found on arrival without searching. */
export function guide(state, rng, note, kind, how) {
  const k = kind ? null : rng.d(6);
  const lead = { ...point(state, rng, state.party, rng.d(3)), kind: kind || HIDDEN[k], how, guided: true };
  (state.world.leads ||= []).push(lead);
  return lead;
}

/** Reaching a guided lead's tile finds it. → the place, or null. */
export function arriveGuided(state, note) {
  const lead = leadsHere(state).find(l => l.guided);
  return lead ? arrive(state, note, lead, "You find the place the hart showed you") : null;
}

/** Leads drawn on the map: the tile's center, and whether it's for a lost place. */
export const leadMarks = (world) => (world.leads || []).filter(l => !l.found).map(l => ({ x: l.tx * TILE + TILE / 2, y: l.ty * TILE + TILE / 2, lost: l.kind === "lost" }));
