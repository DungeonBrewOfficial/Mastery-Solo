/**
 * THE MAP (design/04-the-map.md). A dynasty's world is generated a tile at a
 * time as the party walks into it. A tile is TILE × TILE squares; a square is
 * an hour's travel at Slow pace.
 *
 * Coordinates: squares are global integers (x, y), y growing south. A tile
 * (tx, ty) covers squares tx*TILE .. tx*TILE+TILE-1. Local square (lx, ly)
 * is the square's place inside its tile.
 */
import { roll, total } from "./rng.js";

export const TILE = 6;

export const TERRAINS = {
  plains:    { label: "Plains",    cost: 1 },
  forest:    { label: "Forest",    cost: 2 },
  hills:     { label: "Hills",     cost: 2 },
  mountains: { label: "Mountains", cost: 3 },
  swamp:     { label: "Swamp",     cost: 3 },
  desert:    { label: "Desert",    cost: 2 }
};

/** Terrain, 9–12 on 2d6: roll a d6 on the row for the terrain you came from. */
const NEIGHBOR = {
  plains:    ["forest", "forest", "hills", "hills", "swamp", "desert"],
  forest:    ["plains", "plains", "plains", "hills", "swamp", "swamp"],
  hills:     ["plains", "plains", "forest", "mountains", "mountains", "desert"],
  mountains: ["hills", "hills", "hills", "hills", "forest", "desert"],
  swamp:     ["forest", "forest", "plains", "plains", "plains", "forest"],
  desert:    ["plains", "plains", "plains", "hills", "hills", "mountains"]
};

export const EDGES = ["N", "E", "S", "W"];
export const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };
const STEP = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
/** Turning left or right, for something travelling toward an edge. */
const LEFT = { N: "W", W: "S", S: "E", E: "N" };
const RIGHT = { N: "E", E: "S", S: "W", W: "N" };
/** Where roads and rivers cross each edge, and where they meet inside a tile. */
const ROAD_AT = { N: [3, 0], E: [5, 3], S: [3, 5], W: [0, 3], C: [3, 3] };
const RIVER_AT = { N: [1, 0], E: [5, 1], S: [1, 5], W: [0, 1], C: [1, 1] };

export const SETTLEMENTS = {
  roadhouse: { label: "Roadhouse" },
  hamlet: { label: "Hamlet" },
  village: { label: "Village" },
  town: { label: "Town" },
  city: { label: "City" }
};

export const key = (tx, ty) => `${tx},${ty}`;
export const tileOf = (x, y) => [Math.floor(x / TILE), Math.floor(y / TILE)];
const local = (x, y) => [((x % TILE) + TILE) % TILE, ((y % TILE) + TILE) % TILE];

/* ------------------------------------------------------------------ */

export function newWorld() {
  return { tiles: {}, log: [] };
}

export const getTile = (world, tx, ty) => world.tiles[key(tx, ty)] || null;

function blankTile(tx, ty, terrain) {
  const sq = Array.from({ length: TILE * TILE }, () => ({ road: false, river: false, lake: false }));
  return { tx, ty, terrain, roads: [], rivers: [], settlement: null, deep: false, sq, distHome: Math.max(Math.abs(tx), Math.abs(ty)) };
}

const cell = (tile, lx, ly) => tile.sq[ly * TILE + lx];

/** Mark an L-shaped path between two local points (horizontal first, then vertical). */
function trace(tile, from, to, flag) {
  let [x, y] = from;
  const [x2, y2] = to;
  cell(tile, x, y)[flag] = true;
  while (x !== x2) { x += Math.sign(x2 - x); cell(tile, x, y)[flag] = true; }
  while (y !== y2) { y += Math.sign(y2 - y); cell(tile, x, y)[flag] = true; }
}

function addRoad(tile, edge) {
  if (tile.roads.includes(edge)) return;
  tile.roads.push(edge);
  trace(tile, ROAD_AT[edge], ROAD_AT.C, "road");
}
function addRiver(tile, edge) {
  if (tile.rivers.includes(edge)) return;
  tile.rivers.push(edge);
  trace(tile, RIVER_AT[edge], RIVER_AT.C, "river");
}

function neighbor(world, tile, edge) {
  const [dx, dy] = STEP[edge];
  return getTile(world, tile.tx + dx, tile.ty + dy);
}

/** An exit is allowed if the tile beyond it is blank, or already carries the same thing back. */
function exitOk(world, tile, edge, kind) {
  const n = neighbor(world, tile, edge);
  return !n || n[kind].includes(OPPOSITE[edge]);
}

function placeLake(rng, tile, log) {
  const size = total(rng, "1d3") + 1;
  const cx = rng.d(TILE) - 1, cy = rng.d(TILE) - 1;
  const r = size / 2;
  for (let ly = 0; ly < TILE; ly++) for (let lx = 0; lx < TILE; lx++) {
    const c = cell(tile, lx, ly);
    if (Math.hypot(lx - cx, ly - cy) <= r && !c.road && !(tile.settlement && lx === tile.settlement.lx && ly === tile.settlement.ly)) c.lake = true;
  }
  log.push(`A lake, about ${size} squares across.`);
}

function placeSettlement(rng, world, tile, log) {
  const n = rng.d(20);
  let size = n <= 6 ? "hamlet" : n <= 9 ? (tile.roads.length ? "roadhouse" : "hamlet") : n <= 16 ? "village" : n <= 19 ? "town" : "city";
  const [lx, ly] = tile.roads.length ? ROAD_AT.C : [1 + rng.d(TILE - 2), 1 + rng.d(TILE - 2)];
  tile.settlement = { size, lx, ly };
  cell(tile, lx, ly).lake = false;
  log.push(`A ${SETTLEMENTS[size].label.toLowerCase()} (d20 ${n}).`);
  const extra = size === "town" ? total(rng, "1d2") : size === "city" ? total(rng, "1d3") + 1 : 0;
  const free = EDGES.filter(e => !tile.roads.includes(e) && !neighbor(world, tile, e));
  for (let i = 0; i < extra && free.length; i++) {
    const e = free.splice(rng.d(free.length) - 1, 1)[0];
    addRoad(tile, e);
    log.push(`A road leaves toward the ${e}.`);
  }
}

/** Continue a road that enters from `edge`. */
function continueRoad(rng, world, tile, edge, log) {
  addRoad(tile, edge);
  const heading = OPPOSITE[edge];
  const n = rng.d(6);
  let exits = [];
  if (n <= 2) exits = [heading];
  else if (n === 3) exits = [LEFT[heading]];
  else if (n === 4) exits = [RIGHT[heading]];
  else if (n === 5) exits = [heading, rng.d(2) === 1 ? LEFT[heading] : RIGHT[heading]];
  const text = n <= 2 ? "runs straight on" : n === 3 ? "bends left" : n === 4 ? "bends right" : n === 5 ? "forks" : "runs out here";
  log.push(`The road from the ${edge} ${text} (d6 ${n}).`);
  for (const e of exits) if (exitOk(world, tile, e, "roads")) addRoad(tile, e);
}

const UPHILL = (from, to) => (to === "hills" || to === "mountains") && from !== "hills" && from !== "mountains";

/** Continue a river that enters from `edge`. */
function continueRiver(rng, world, tile, edge, log) {
  addRiver(tile, edge);
  const heading = OPPOSITE[edge];
  const n = rng.d(6);
  if (n === 6) {
    log.push(`The river from the ${edge} ends here (d6 6).`);
    placeLake(rng, tile, log);
    return;
  }
  let e = n <= 3 ? heading : n === 4 ? LEFT[heading] : RIGHT[heading];
  const beyond = neighbor(world, tile, e);
  if (beyond && UPHILL(tile.terrain, beyond.terrain)) e = e === LEFT[heading] ? RIGHT[heading] : LEFT[heading];
  if (exitOk(world, tile, e, "rivers")) addRiver(tile, e);
  log.push(`The river from the ${edge} flows on toward the ${e} (d6 ${n}).`);
}

function riseRiver(rng, world, tile, log) {
  const pool = EDGES.filter(e => !neighbor(world, tile, e));
  if (!pool.length) { log.push("A spring rises here."); return; }
  const e = pool[rng.d(pool.length) - 1];
  addRiver(tile, e);
  log.push(`A river rises here and runs toward the ${e}.`);
}

/** Deep: no road or settlement in the tile or any of its eight neighbors (blank counts as none). */
function markDeep(world, tile) {
  const busy = (t) => t && (t.roads.length || t.settlement);
  if (busy(tile)) { tile.deep = false; return; }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (busy(getTile(world, tile.tx + dx, tile.ty + dy))) { tile.deep = false; return; }
  }
  tile.deep = true;
}

/**
 * Generate tile (tx, ty), entered from tile `from` (which decides its terrain).
 * Returns the tile and a log of what was rolled.
 */
export function generateTile(rng, world, tx, ty, from) {
  const existing = getTile(world, tx, ty);
  if (existing) return { tile: existing, log: [] };
  const log = [];
  const t2 = roll(rng, "2d6");
  let terrain = from.terrain;
  if (t2.total >= 9) {
    const n = rng.d(6);
    terrain = NEIGHBOR[from.terrain][n - 1];
    log.push(`Terrain: 2d6 ${t2.total}, then d6 ${n}: ${TERRAINS[terrain].label}.`);
  } else log.push(`Terrain: 2d6 ${t2.total}: ${TERRAINS[terrain].label}, like the land before it.`);

  const tile = blankTile(tx, ty, terrain);
  world.tiles[key(tx, ty)] = tile;

  for (const e of EDGES) {
    const n = neighbor(world, tile, e);
    if (!n) continue;
    if (n.roads.includes(OPPOSITE[e])) continueRoad(rng, world, tile, e, log);
    if (n.rivers.includes(OPPOSITE[e])) continueRiver(rng, world, tile, e, log);
  }

  const f = total(rng, "2d6");
  const hasRoad = tile.roads.length > 0;
  if (f === 9) riseRiver(rng, world, tile, log);
  else if (f === 10) {
    if (hasRoad && tile.distHome <= 3) placeSettlement(rng, world, tile, log);
    else placeLake(rng, tile, log);
  } else if (f >= 11 && hasRoad) placeSettlement(rng, world, tile, log);
  else if (f === 12) {
    tile.settlement = { size: "hamlet", lx: 1 + rng.d(TILE - 2), ly: 1 + rng.d(TILE - 2) };
    log.push("A hamlet, off any road.");
  }
  if (f < 9 || (f === 11 && !hasRoad)) log.push(`Features: 2d6 ${f}, nothing more.`);

  markDeep(world, tile);
  if (tile.deep) log.push("Deep country.");
  return { tile, log };
}

/** Start a dynasty: home village, its roads, and the eight known tiles around it. */
export function startDynasty(rng) {
  const world = newWorld();
  const log = [];
  const t = total(rng, "2d6");
  const terrain = t <= 7 ? "plains" : t <= 10 ? "forest" : "hills";
  const home = blankTile(0, 0, terrain);
  world.tiles[key(0, 0)] = home;
  home.settlement = { size: "village", lx: 3, ly: 3, home: true };
  const roads = total(rng, "1d3") + 1;
  const edges = [...EDGES];
  for (let i = 0; i < roads; i++) addRoad(home, edges.splice(rng.d(edges.length) - 1, 1)[0]);
  log.push(`Home is a village in the ${TERRAINS[terrain].label.toLowerCase()} (2d6 ${t}), with roads toward the ${home.roads.join(", ")}.`);
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]]) {
    const r = generateTile(rng, world, dx, dy, home);
    log.push(...r.log.map(s => `(${dx},${dy}) ${s}`));
  }
  world.log = log;
  return world;
}

/* ------------------------------------------------------------------ */
/* Squares                                                              */

/** What's on a square, or null if its tile hasn't been generated. */
export function squareAt(world, x, y) {
  const [tx, ty] = tileOf(x, y);
  const tile = getTile(world, tx, ty);
  if (!tile) return null;
  const [lx, ly] = local(x, y);
  const c = cell(tile, lx, ly);
  const s = tile.settlement && tile.settlement.lx === lx && tile.settlement.ly === ly ? tile.settlement : null;
  return { x, y, tile, terrain: tile.terrain, road: c.road, river: c.river, lake: c.lake, bridge: c.road && c.river, settlement: s, deep: tile.deep };
}

/** Movement cost to enter a square (design/01-the-turn.md). Infinity if it can't be entered. */
export function moveCost(sq) {
  if (!sq) return 1;                       // blank: assume open until it's generated
  if (sq.lake) return Infinity;
  if (sq.road || sq.settlement) return 1;
  // TODO(rivers): crossing a river without a bridge needs the ford / swim procedure;
  // until the party is modelled it costs 2 more.
  return TERRAINS[sq.terrain].cost + (sq.river ? 2 : 0);
}

/** Settled, Wild, or Deep (design/01-the-turn.md, Deep country). */
export function countryAt(world, x, y) {
  const sq = squareAt(world, x, y);
  if (!sq) return "wild";
  if (sq.road) return "settled";
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const o = squareAt(world, x + dx, y + dy);
    if (o && o.settlement) return "settled";
  }
  return sq.deep ? "deep" : "wild";
}

/** Cheapest path by movement cost (A*), through blank squares if needed. */
export function findPath(world, from, to) {
  const k = (x, y) => `${x},${y}`;
  const h = (x, y) => Math.abs(x - to.x) + Math.abs(y - to.y);
  const open = [{ x: from.x, y: from.y, g: 0, f: h(from.x, from.y) }];
  const came = new Map(), best = new Map([[k(from.x, from.y), 0]]);
  let guard = 20000;
  while (open.length && guard-- > 0) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift();
    if (cur.x === to.x && cur.y === to.y) {
      const path = [];
      let c = k(cur.x, cur.y);
      while (came.has(c)) { const [x, y] = c.split(",").map(Number); path.unshift({ x, y }); c = came.get(c); }
      return path;
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      const cost = moveCost(squareAt(world, nx, ny));
      if (!Number.isFinite(cost)) continue;
      const g = cur.g + cost;
      if (g < (best.get(k(nx, ny)) ?? Infinity)) {
        best.set(k(nx, ny), g);
        came.set(k(nx, ny), k(cur.x, cur.y));
        open.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
      }
    }
  }
  return null;
}
