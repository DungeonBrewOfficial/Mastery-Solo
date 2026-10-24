import { test } from "node:test";
import { playBattle } from "./autoplay.mjs";
import assert from "node:assert/strict";
import { newGame, travelLeg, setTarget, afterEvent, runWithDice, note } from "../game/journey.js";
import { choices, choose, signChoices, chooseSign, aboveBand, partyLevel } from "../game/events.js";
import { ENCOUNTERS } from "../game/data/encounters.js";
import { CREATURES } from "../game/data/creatures.js";
import { makeRng } from "../game/rng.js";

test("every table entry names a known creature or is prey", () => {
  for (const bands of Object.values(ENCOUNTERS)) for (const rows of Object.values(bands)) for (const cell of Object.values(rows)) {
    for (const o of cell.options) {
      if (o.temper === "Prey" || (o.temperBySeason && !o.head)) continue;
      assert.ok(CREATURES[o.head], `unknown head in "${o.text}"`);
    }
  }
});

test("table XP agrees with the head's Division where the table gives one number", () => {
  for (const [t, bands] of Object.entries(ENCOUNTERS)) for (const [b, rows] of Object.entries(bands)) for (const [n, cell] of Object.entries(rows)) {
    const col = cell.xpColumn.trim();
    if (!/^\d+$/.test(col) || cell.options.length !== 1) continue;
    assert.equal(cell.options[0].xp, Number(col), `${t} ${b} ${n}: ${cell.text}`);
  }
});

test("Epic and Legendary creatures are always above band", () => {
  assert.ok(aboveBand("Wolf, Amarok", 30));
  assert.ok(aboveBand("Wolf, Beta", 1));
  assert.ok(!aboveBand("Bandit Leader", 1));
});

test("a long journey resolves every event without getting stuck", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const s = newGame(seed);
    const say = (t, k) => note(s, t, k);
    let guard = 0;
    for (let i = 0; i < 400 && guard < 2000; i++, guard++) {
      if (s.encounter) {
        const ch = choices(s);
        assert.ok(ch.length, "an encounter always offers a choice");
        const pick = ch[(i + seed) % ch.length].id;
        runWithDice(s, (rng) => choose(s, rng, pick === "toll" && s.party.coin < s.encounter.toll ? "fight" : pick, say));
        afterEvent(s);
        if (s.battle) { playBattle(s); afterEvent(s); }
        if (s.over) break;
        continue;
      }
      if (s.sign) {
        const ch = signChoices(s);
        runWithDice(s, (rng) => chooseSign(s, rng, ch[(i + seed) % ch.length].id, say));
        afterEvent(s);
        continue;
      }
      if (s.pending) { travelLeg(s, i % 2 ? "stop" : "push"); continue; }
      if (!s.target) setTarget(s, s.party.x + ((i * 7) % 23) - 11, s.party.y + ((i * 5) % 19) - 9);
      travelLeg(s);
    }
    assert.ok(s.day > 5, `seed ${seed} reached day ${s.day}`);
    assert.ok(s.log.some(l => /Encounter:|In the night/.test(l.text)), `seed ${seed} had an encounter`);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(s)));
  }
});
