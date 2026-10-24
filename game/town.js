/**
 * TOWN (milestone 3; design/06-settlements.md): the market and the healer.
 * Whether a market has something is its dice against the item's Social
 * Class DC (Equipment, Availability), rolled once per visit.
 */
import { GEAR } from "./data/gear.js";
import { add, ensureStores } from "./supplies.js";
import { squareAt, tileOf, getTile } from "./world.js";
import { discover, partyLevel, bandFor, EVEN_DC } from "./events.js";
import { trial, passes, tierOf, dieOfTier } from "./mastery.js";
import { treatTrauma } from "./health.js";

/** Market dice by settlement size (design/06-settlements.md; Equipment, Availability). */
export const MARKET_DICE = { roadhouse: 3, hamlet: 4, village: 6, town: 8, city: 10, metropolis: 12 };
export const CLASS_DC = { Serf: 3, Peasant: 4, Knight: 8, Burgher: 10, Magnate: 14, Noble: 18, Royal: 21 };

/**
 * What a market sells for the road, with the Social Class each item is
 * stocked at. The classes are a first guess [N]: everyday food, water, and
 * clothing are Serf; kits and the warmest gear Peasant; surgeons' tools Knight.
 */
export const SHOP = [
  { group: "Food and water", items: { "Rations, Standard": "Serf", "Rations, Dry": "Serf", "Rations, Iron": "Serf", "Waterskin": "Serf" } },
  { group: "Kits", items: { "Adventurer's Pack": "Peasant", "Forager's Kit": "Peasant", "Healer's Kit": "Knight", "Smith's Kit": "Peasant" } },
  { group: "Healing", items: { "Wound Kit": "Serf", "Injury Kit": "Peasant", "Trauma Kit": "Knight", "Physic Kit": "Peasant", "Surgeon's Pocket Set": "Knight", "Surgeon's Chest": "Burgher" } },
  { group: "Tools", items: { "Repair Kit": "Peasant", "Hammer": "Serf", "Iron Pot": "Serf" } },
  { group: "Clothing", items: { "Cold Clothing": "Peasant", "Extreme Cold Clothing": "Knight", "Heat Clothing": "Serf",
    "Cloak, Wool": "Serf", "Hood, Wool": "Serf", "Gloves, Wool": "Serf", "Boots, Hide": "Serf", "Cloak, Pile": "Peasant", "Hat, Fur": "Peasant",
    "Hat, Straw": "Serf", "Head-cloth, Linen": "Serf", "Robe, Common": "Serf" } }
];
const CLASS_OF = Object.fromEntries(SHOP.flatMap(g => Object.entries(g.items)));

/** The settlement the party stands in, if any. */
export function settlementHere(state) {
  const sq = squareAt(state.world, state.party.x, state.party.y);
  return sq?.settlement ? { ...sq.settlement, key: `${state.party.x},${state.party.y}` } : null;
}

/** Roll what this market has today (once per visit and day). */
export function openMarket(state, rng, note) {
  ensureStores(state);
  const s = settlementHere(state);
  if (!s) { state.market = null; return null; }
  if (state.market?.key === s.key && state.market.day === state.day) return state.market;
  const d = MARKET_DICE[s.size] || 6;
  const stock = {};
  for (const [name, cls] of Object.entries(CLASS_OF)) {
    const r = rng.d(d) + rng.d(d);
    stock[name] = r >= CLASS_DC[cls];
  }
  state.market = { key: s.key, day: state.day, size: s.size, die: d, stock };
  const missing = Object.keys(stock).filter(n => !stock[n]);
  note(`The ${s.home ? "home village" : s.size}'s market (2d${d}): ${missing.length ? `no ${missing.map(n => n.toLowerCase()).join(", ")} to be had today` : "everything on your list is for sale"}.`, "place");
  return state.market;
}

export const priceOf = (name) => GEAR[name]?.sp ?? 0;
export const classOf = (name) => CLASS_OF[name];

/** Buy n of something here; clothing goes on the wearer. */
export function buy(state, note, name, n = 1, wearer = null) {
  const m = state.market;
  if (!m || !settlementHere(state) || m.key !== settlementHere(state).key || !m.stock[name]) return false;
  const cost = Math.round(priceOf(name) * n * 4) / 4;
  if (state.party.coin < cost) { note(`Not enough coin for ${n} ${name.toLowerCase()} (${cost} sp).`); return false; }
  state.party.coin = Math.round((state.party.coin - cost) * 4) / 4;
  add(state, name, n, { wearer });
  const who = wearer && GEAR[name]?.weather ? ` for ${state.party.members.find(x => x.id === wearer)?.name}` : "";
  note(`Bought ${n > 1 ? `${n} × ` : ""}${name}${who}: ${cost} sp.`, "reward");
  return true;
}

/** A healer treats one Injury for 8 sp (Equipment, Lodging and Services); villages and larger have one. */
export const hasHealer = (size) => ["village", "town", "city", "metropolis"].includes(size);
export function healerTreats(state, note, id) {
  const s = settlementHere(state);
  const m = state.party.members.find(x => x.id === id);
  if (!s || !hasHealer(s.size) || !m || !(m.injuries > 0) || state.party.coin < 8) return false;
  state.party.coin -= 8;
  m.injuries -= 1;
  note(`The ${s.home ? "village" : s.size} healer treats one of ${m.name}'s Injuries: 8 sp.`, "reward");
  return true;
}

/* ------------------------------------------------------------------ */
/* Selling (design/03-treasure.md, Selling)                             */

/** Coin on hand by settlement size [Jon, 2026-10-24, a ballpark]; it refills a quarter a week. */
export const COIN_ON_HAND = { roadhouse: 50, hamlet: 200, village: 2000, town: 12000, city: 100000, metropolis: 400000 };
/** A buyer's Social Class by the piece's value: the Availability table in reverse. */
export function buyerFor(value) {
  return value <= 60 ? ["Peasant", 4] : value <= 600 ? ["Knight", 8] : value <= 2400 ? ["Burgher", 10] : value <= 12000 ? ["Magnate", 14] : value <= 60000 ? ["Noble", 18] : ["Royal", 21];
}
/** What the settlement can still pay out. */
export function townCoin(state) {
  const s = settlementHere(state);
  if (!s) return 0;
  const full = COIN_ON_HAND[s.size] || 0;
  const t = ((state.world.towns ||= {})[s.key] ||= { coin: full, day: state.day });
  const weeks = Math.floor((state.day - t.day) / 7);
  if (weeks > 0) { t.coin = Math.min(full, t.coin + weeks * full / 4); t.day += weeks * 7; }
  return t.coin;
}
/** What the party can sell here: pelts at their value, spare goods at half (secondhand). */
export function saleList(state) {
  const out = state.party.pelts.map((p, i) => ({ id: `pelt:${i}`, label: `${p.quality} ${p.name.toLowerCase()} pelt`, value: p.value }));
  for (const [name, n] of Object.entries(state.party.stores)) {
    if (!(n > 0) || !GEAR[name]?.sp) continue;
    out.push({ id: `item:${name}`, label: `${name}${n > 1 ? ` (1 of ${n})` : ""}`, value: Math.round(GEAR[name].sp / 2 * 4) / 4 });
  }
  return out;
}
/** Sell one piece: a buyer of its class must turn up on the market dice (once a day per piece), and the town must have the coin. */
export function sell(state, rng, note, id) {
  const m = state.market, s = settlementHere(state);
  const piece = saleList(state).find(x => x.id === id);
  if (!m || !s || !piece) return false;
  const [cls, dc] = buyerFor(piece.value);
  m.buyers ||= {};
  if (m.buyers[id] === undefined) { const r = rng.d(m.die) + rng.d(m.die); m.buyers[id] = r >= dc; note(`Looking for a buyer for the ${piece.label} (${cls}, 2d${m.die} ${r} against ${dc}): ${r >= dc ? "found" : "no one today"}.`); }
  if (!m.buyers[id]) return false;
  if (townCoin(state) < piece.value) { note(`The ${s.size} hasn't the coin for it (${townCoin(state)} sp left this week).`); return false; }
  state.world.towns[s.key].coin -= piece.value;
  state.party.coin = Math.round((state.party.coin + piece.value) * 4) / 4;
  const [kind, key] = id.split(":");
  if (kind === "pelt") state.party.pelts.splice(Number(key), 1);
  else { state.party.stores[key] -= 1; if (!state.party.stores[key]) delete state.party.stores[key]; }
  delete m.buyers[id];
  if (kind === "pelt") for (const k of Object.keys(m.buyers)) if (k.startsWith("pelt:")) delete m.buyers[k];
  note(`Sold the ${piece.label} for ${piece.value} sp.`, "reward");
  return true;
}

/* ------------------------------------------------------------------ */
/* The smith and the healer                                             */

/**
 * A hired smith (Equipment, Lodging and Services: 8 sp a day) works the
 * party's repair kits by the Blacksmith formula, (Trade die + Intelligence
 * tier die) × 4, as a Skilled smith: a d6 and a d4 [Jon, 2026-10-24].
 */
export const hasSmith = (size) => ["village", "town", "city", "metropolis"].includes(size);
export function hireSmith(state, rng, note) {
  const s = settlementHere(state);
  if (!s || !hasSmith(s.size) || state.party.coin < 8) return false;
  const work = state.party.members.filter(m => !m.dead).flatMap(m => [m.armor, m.shield].filter(x => x && x.durability < x.max).map(x => ({ m, x })));
  if (!work.length) { note("Nothing needs the smith."); return false; }
  if (!(state.party.stores["Repair Kit"] > 0)) { note("The smith needs repair kits, and you have none."); return false; }
  state.party.coin -= 8;
  const bits = [];
  for (const { m, x } of work) {
    const before = x.durability;
    while (x.durability < x.max && state.party.stores["Repair Kit"] > 0) {
      state.party.stores["Repair Kit"] -= 1;
      x.durability = Math.min(x.max, x.durability + (rng.d(6) + rng.d(4)) * 4);
    }
    bits.push(`${m.name}'s ${x.name.toLowerCase()} ${before} → ${x.durability}`);
  }
  if (!state.party.stores["Repair Kit"]) delete state.party.stores["Repair Kit"];
  note(`The smith works a day (8 sp): ${bits.join(", ")}.`, "reward");
  return true;
}

/**
 * The settlement's healer treats a Trauma: 8 sp and the Trauma Kit it uses
 * (Equipment, Lodging and Services: "Healer will also charge for the cost of
 * medicinal supplies"). A Skilled healer with a surgeon's chest, and in a
 * city's infirmary, Dominance; a failed treatment wastes the kit, and you pay again.
 */
export function healerTreatsTrauma(state, rng, note, id, i) {
  const s = settlementHere(state);
  const m = state.party.members.find(x => x.id === id);
  const t = m?.traumas?.[i];
  const cost = 8 + (GEAR["Trauma Kit"]?.sp || 36);
  if (!s || !hasHealer(s.size) || !t || state.party.coin < cost) return false;
  state.party.coin -= cost;
  const healer = { skills: { healer: 4 }, attributes: { intelligence: 10 } };
  const r = treatTrauma(rng, healer, t, { chest: true, edge: ["city", "metropolis"].includes(s.size) ? 1 : 0 });
  note(`The healer treats ${m.name} (${t.name}; ${cost} sp, ${r.roll.text} against ${r.dc}): ${r.ok ? "done" : "it doesn't take; the kit is spent"}.`, r.ok ? "reward" : "event");
  return r.ok;
}

/* ------------------------------------------------------------------ */
/* Rumors (design/06-settlements.md, Rumors)                            */

const DIRS = [["north", 0, -1], ["northeast", 1, -1], ["east", 1, 0], ["southeast", 1, 1], ["south", 0, 1], ["southwest", -1, 1], ["west", -1, 0], ["northwest", -1, -1]];
const RUMORED = { 1: "a landmark", 4: "a spell source", 5: "a lair", 6: "a cave", 7: "a ruin", 8: "a barrow" };
/**
 * An evening at an inn or alehouse: one character's Presence trial against
 * the band's Even DC (a roadhouse, full of travelers, gives Dominance). On a
 * success, a rumor: a Discovery result, a d8 for its direction, and 1d6
 * tiles for how far. It's a destination, not a discovery, and pays no XP
 * until the party gets there [Jon, 2026-10-24].
 */
export function rumorAtInn(state, rng, note) {
  const s = settlementHere(state);
  if (!s) return;
  const who = state.party.members.filter(m => !m.dead && m.hp > 0).sort((a, b) => (b.skills?.presence || 1) - (a.skills?.presence || 1) || b.attributes.charisma - a.attributes.charisma)[0];
  if (!who) return;
  const dc = EVEN_DC[bandFor(partyLevel(state))];
  const t = trial(rng, [dieOfTier(tierOf(who.attributes.charisma)), dieOfTier(who.skills?.presence || 1)], { edge: s.size === "roadhouse" ? 1 : 0 });
  if (!passes(t, dc)) { note(`${who.name} listens for rumors (Presence ${t.text} against ${dc}): nothing worth the ale.`); return; }
  const keys = Object.keys(RUMORED).map(Number);
  const n = keys[rng.d(keys.length) - 1];
  const [dir, dx, dy] = DIRS[rng.d(8) - 1];
  const far = rng.d(6);
  const [tx, ty] = tileOf(state.party.x, state.party.y);
  const r = { tx: tx + dx * far, ty: ty + dy * far, n, dir, far, text: RUMORED[n], day: state.day };
  (state.world.rumors ||= []).push(r);
  note(`${who.name} hears a rumor (Presence ${t.text} against ${dc}): ${r.text}, ${far} tile${far === 1 ? "" : "s"} to the ${dir}. Marked on the map.`, "reward");
}
/** Reaching a rumored tile turns the rumor into the Discovery it spoke of. */
export function rumorHere(state, rng, note) {
  const [tx, ty] = tileOf(state.party.x, state.party.y);
  const r = (state.world.rumors || []).find(x => !x.found && x.tx === tx && x.ty === ty);
  if (!r || !getTile(state.world, tx, ty)) return;
  r.found = true;
  note(`The rumor was true: ${r.text} is here.`, "event");
  discover(state, rng, note, r.n);
}
