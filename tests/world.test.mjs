import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng } from "../game/rng.js";
import { startDynasty, getTile, squareAt, findPath, EDGES, OPPOSITE, TILE, generateTile } from "../game/world.js";
import { newGame, travelLeg, setTarget, campNow, runWithDice, afterEvent, note } from "../game/journey.js";
import { choices, choose, chooseSign } from "../game/events.js";

test("a dynasty starts with home and eight known tiles", () => {
  const w = startDynasty(makeRng(42));
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.ok(getTile(w, dx, dy), `tile ${dx},${dy}`);
  const home = getTile(w, 0, 0);
  assert.equal(home.settlement.size, "village");
  assert.ok(home.roads.length >= 2 && home.roads.length <= 4);
});

test("the known lands are never Deep (they touch home)", () => {
  for (let s = 1; s < 50; s++) {
    const w = startDynasty(makeRng(s));
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.equal(getTile(w, dx, dy).deep, false);
  }
});

test("roads and rivers match across every shared edge", () => {
  const rng = makeRng(7);
  const w = startDynasty(rng);
  // walk outward to make a bigger map
  for (let r = 2; r <= 4; r++) for (let ty = -r; ty <= r; ty++) for (let tx = -r; tx <= r; tx++) {
    if (getTile(w, tx, ty)) continue;
    const from = [[tx - 1, ty], [tx + 1, ty], [tx, ty - 1], [tx, ty + 1]].map(([a, b]) => getTile(w, a, b)).find(Boolean);
    if (from) generateTile(rng, w, tx, ty, from);
  }
  const step = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  for (const t of Object.values(w.tiles)) for (const e of EDGES) {
    const n = getTile(w, t.tx + step[e][0], t.ty + step[e][1]);
    if (!n) continue;
    for (const kind of ["roads", "rivers"]) {
      assert.equal(t[kind].includes(e), n[kind].includes(OPPOSITE[e]), `${kind} mismatch between ${t.tx},${t.ty} and ${n.tx},${n.ty}`);
    }
  }
});

test("paths avoid lakes", () => {
  const w = startDynasty(makeRng(3));
  const path = findPath(w, { x: 3, y: 3 }, { x: -3, y: -3 });
  assert.ok(path && path.length);
  for (const p of path) { const sq = squareAt(w, p.x, p.y); assert.ok(!sq || !sq.lake); }
});

test("a journey runs for days without breaking", () => {
  const s = newGame(1234);
  setTarget(s, 3, -40);
  const say = (t, k) => note(s, t, k);
  for (let i = 0; i < 60; i++) {
    if (s.encounter) { runWithDice(s, (rng) => choose(s, rng, "fight", say)); afterEvent(s); continue; }
    if (s.sign) { runWithDice(s, (rng) => chooseSign(s, rng, "leave", say)); afterEvent(s); continue; }
    if (s.pending) travelLeg(s, i % 2 ? "stop" : "push");
    else if (!s.target) setTarget(s, s.party.x + 30, s.party.y + (i % 3) * 10);
    else travelLeg(s);
  }
  assert.ok(s.day > 3, `day ${s.day}`);
  assert.ok(Object.keys(s.world.tiles).length > 9);
  const json = JSON.stringify(s);
  assert.deepEqual(JSON.parse(json).party, s.party);
});

test("the same seed makes the same world", () => {
  const a = startDynasty(makeRng(99)), b = startDynasty(makeRng(99));
  assert.equal(JSON.stringify(a.tiles), JSON.stringify(b.tiles));
});
