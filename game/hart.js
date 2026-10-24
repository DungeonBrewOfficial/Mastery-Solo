/**
 * THE WHITE HART (design/04-the-map.md, Hidden and lost places; Creatures -
 * Fae, White Hart). Seen at the edge of the deep wood, it can be followed
 * instead of fought, as one more way to a hidden or lost place. Each hart
 * has one true story, rolled secretly when it's seen.
 */
import { trial, passes, tierOf, dieOfTier } from "./mastery.js";
import { alive, partyLevel, bandFor, EVEN_DC, startEncounter } from "./events.js";
import { squareAt, getTile, tileOf } from "./world.js";
import { guide, fragmentsRead } from "./leads.js";

const STORIES = [
  "it was sent by someone who wants you",
  "following is simply its nature",
  "it is fairy cattle running home to its herders"
];
const HART_DC = 7; // its aura's WIS trial, and Into the Wood's search DC

const tier = (m, a) => tierOf(m.attributes[a]);
const skillOf = (m, s) => m.skills?.[s] || 1;

/** Forest at the edge of the deep wood: the party's tile, or one beside it, is Deep. */
export function atDeepWoodEdge(state) {
  const sq = squareAt(state.world, state.party.x, state.party.y);
  if (sq?.terrain !== "forest") return false;
  const [tx, ty] = tileOf(state.party.x, state.party.y);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (getTile(state.world, tx + dx, ty + dy)?.deep) return true;
  return false;
}

/** A Sign at the deep wood's edge is the Hart on a 6 [N]. → true if it appeared. */
export function maybeHart(state, rng, note) {
  if (!atDeepWoodEdge(state)) return false;
  const d = rng.d(6);
  if (d !== 6) return false;
  const s = { hart: true, truth: rng.d(3) - 1, charmed: [], read: false, x: state.party.x, y: state.party.y };
  note(`A white hart, larger than any red deer, stands at the edge of the deep wood (d6 ${d}). It looks back at you, and walks away slowly.`, "event");
  // The White Hart's aura: WIS trial [7] or Charmed T1, its implied request to be followed.
  for (const m of alive(state)) {
    const t = trial(rng, [dieOfTier(tier(m, "wisdom")), dieOfTier(tier(m, "wisdom"))]);
    if (!passes(t, HART_DC)) { s.charmed.push(m.id); note(`${m.name}, Wisdom ${t.text} against ${HART_DC}: Charmed. ${m.name} wants to follow it.`, "event"); }
    else note(`${m.name}, Wisdom ${t.text} against ${HART_DC}: keeps their head.`);
  }
  state.sign = s;
  return true;
}

export function hartChoices(state) {
  const s = state.sign;
  if (!s?.hart) return [];
  const list = [];
  if (!s.read) list.push({ id: "stories", label: "What do the stories say? (Lore)" });
  list.push({ id: "follow", label: "Follow the hart" });
  if (s.charmed.length) list.push({ id: "hold", label: `Hold back ${s.charmed.length > 1 ? "the charmed" : alive(state).find(m => m.id === s.charmed[0])?.name} (Wisdom)` });
  else list.push({ id: "leave", label: "Let it go" });
  return list;
}

export function chooseHart(state, rng, id, note) {
  const s = state.sign;
  if (!s?.hart) return;
  if (id === "stories") {
    s.read = true;
    // Fae Lore identifies the hart: success, success by 2 (one story), success by 4 (all three).
    const m = [...alive(state)].sort((a, b) => (tier(b, "intelligence") + skillOf(b, "lore")) - (tier(a, "intelligence") + skillOf(a, "lore")))[0];
    const dc = EVEN_DC[bandFor(partyLevel(state))];
    const t = trial(rng, [dieOfTier(tier(m, "intelligence")), dieOfTier(skillOf(m, "lore"))]);
    const by = t.total - dc;
    if (!passes(t, dc)) { note(`${m.name} knows no story about it (Lore ${t.text} against ${dc}).`); return; }
    const told = by >= 4 ? `all three stories: ${STORIES.join("; ")}. The stories disagree` : by >= 2 ? `the story ${m.name} heard: ${STORIES[rng.d(3) - 1]}` : "only this";
    note(`${m.name} knows it (Lore ${t.text} against ${dc}): a White Hart, a Fae of the deep wood. Whoever follows it ends up across the boundary. ${by >= 2 ? `And ${told}.` : ""}`.trim(), "event");
    return;
  }
  if (id === "hold") {
    for (const mid of [...s.charmed]) {
      const m = alive(state).find(x => x.id === mid);
      const t = trial(rng, [dieOfTier(tier(m, "wisdom")), dieOfTier(tier(m, "wisdom"))]);
      if (passes(t, HART_DC)) { s.charmed = s.charmed.filter(x => x !== mid); note(`${m.name} shakes it off (Wisdom ${t.text} against ${HART_DC}).`); }
      else note(`${m.name} can't look away (Wisdom ${t.text} against ${HART_DC}). Where the hart goes, ${m.name} goes.`, "event");
    }
    return;
  }
  if (id === "leave") { note("You let it go. It doesn't look back."); state.sign = null; return; }
  if (id === "follow") follow(state, rng, note);
}

/**
 * Following: the best tracker keeps it in sight through the wood, Perception
 * and Wilderness against the band's Even DC (it lets itself be followed),
 * three successes before two failures. Its story
 * decides where it leads [N]: someone who wants you leads to a lost place
 * when the dynasty has read lost lore, its nature to whatever is hidden
 * nearby, and the herders to their land, which waits on the fae court.
 */
function follow(state, rng, note) {
  const s = state.sign;
  // It wants to be followed: the band's Even DC, and the party's best tracker leads.
  const dc = EVEN_DC[bandFor(partyLevel(state))];
  const scout = [...alive(state)].sort((a, b) => (tier(b, "perception") + skillOf(b, "wilderness")) - (tier(a, "perception") + skillOf(a, "wilderness")))[0];
  const helper = alive(state).find(m => m !== scout && (skillOf(m, "wilderness") >= 2 || skillOf(m, "alertness") >= 2));
  note(`You follow the hart into the deep wood. ${scout.name} leads${helper ? `, ${helper.name} helps` : ""}.`, "event");
  let ok = 0, bad = 0;
  while (ok < 3 && bad < 2) {
    const t = trial(rng, [dieOfTier(tier(scout, "perception")), dieOfTier(skillOf(scout, "wilderness"))], { bonus: helper ? 2 : 0 });
    const p = passes(t, dc);
    p ? ok++ : bad++;
    note(`${t.text} against ${dc}: ${p ? "a flash of white ahead" : "the trees close in"}.`);
  }
  state.sign = null;
  // Hours in the wood, whichever way it goes.
  const hours = rng.d(6);
  state.hoursUsed = Math.min(8, state.hoursUsed + hours);
  if (state.hoursUsed >= 8) state.campDue = true;
  if (ok < 3) {
    note(`You lose it in the wood after ${hours} hour${hours > 1 ? "s" : ""}, and the way back is longer than the way in.`, "event");
    // The deep wood's event die: an Encounter on 5–6.
    const d = rng.d(6);
    if (d >= 5) { note(`Event die ${d} in the deep wood: Encounter.`, "event"); startEncounter(state, rng, note); }
    else note(`Event die ${d} in the deep wood: nothing finds you.`);
    return;
  }
  const kind = s.truth === 0 && fragmentsRead(state.world) > 0 ? "lost" : null;
  if (s.truth === 2) note("It runs for the herders' land across the boundary, and leaves you at its edge. (The fae court isn't built yet; what's hidden here is what you find.)", "todo");
  const lead = guide(state, rng, note, kind, "The hart");
  note(`It stops, looks back once, and is gone. You know the way now: ${lead.far} tile${lead.far > 1 ? "s" : ""} to the ${lead.dir}, no searching needed.`, "event");
}
