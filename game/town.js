/**
 * TOWN (milestone 3; design/06-settlements.md): the market and the healer.
 * Whether a market has something is its dice against the item's Social
 * Class DC (Equipment, Availability), rolled once per visit.
 */
import { GEAR } from "./data/gear.js";
import { add, ensureStores } from "./supplies.js";
import { squareAt } from "./world.js";

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
  { group: "Healing", items: { "Wound Kit": "Serf", "Injury Kit": "Peasant", "Trauma Kit": "Knight", "Physic Kit": "Peasant", "Surgeon's Pocket Set": "Knight" } },
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
