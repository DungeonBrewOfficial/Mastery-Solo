/**
 * A plain-minded player for tests: in a fight, it attacks whatever it can
 * reach, walks toward the nearest enemy otherwise, and says yes to every
 * defense, counter, reprisal, and Fighting On.
 */
import { runWithDice, note } from "../game/journey.js";
import { attackModes, setMode, challengeTargets, beginRound, retreat, runPlan, currentPC, canAttack, pcAttack, pcMove, pcEndTurn, respond, triageTargets, pcTriage, gap, standing, moveCost } from "../game/combat.js";

export function playBattle(s, { maxSteps = 5000, picks = {}, run = false, clever = false } = {}) {
  const say = (t, k) => note(s, t, k);
  for (let i = 0; i < maxSteps && s.battle; i++) {
    const b = s.battle;
    runWithDice(s, (rng) => {
      if (b.prompt) return respond(s, rng, say, b.prompt.helper && clever ? "hearten" : true);
      if (b.stage === "declare") {
        if (run && b.round >= run && !b.aftermath) return retreat(s, rng, say, runPlan(s).downed.map(u => u.id));
        if (clever) for (const u of b.units.filter(x => x.pc)) { const f = challengeTargets(s, u)[0]; if (f) picks[u.id] = { ...picks[u.id], challenge: f.id }; }
        return beginRound(s, rng, say, picks);
      }
      const u = currentPC(s);
      if (!u) throw new Error(`battle stuck: stage ${b.stage}, queue ${b.queue.length}, current ${b.current}`);
      const t = triageTargets(s, u)[0];
      if (t && u.ap >= 2) return pcTriage(s, rng, say, t.id);
      const foes = b.units.filter(o => !o.pc && standing(s, o)).sort((x, y) => gap(u, x) - gap(u, y));
      if (clever && attackModes(s, u).some(m => m.id === "opportunist") && foes.some(f => canAttack(s, u, f, "opportunist").ok)) setMode(s, "opportunist");
      const target = foes.find(f => canAttack(s, u, f).ok);
      if (target) return pcAttack(s, rng, say, target.id);
      if (u.ap > 0 && foes.length) {
        // step toward the nearest enemy: try squares beside it
        const f = foes[0];
        const spots = [];
        for (let y = f.y - 1; y <= f.y + f.h; y++) for (let x = f.x - 1; x <= f.x + f.w; x++) spots.push([x, y]);
        spots.sort((p, q) => Math.hypot(p[0] - u.x, p[1] - u.y) - Math.hypot(q[0] - u.x, q[1] - u.y));
        for (const [x, y] of spots) if (moveCost(s, u, x, y)) return pcMove(s, rng, say, x, y);
      }
      return pcEndTurn(s, rng, say);
    });
  }
  if (s.battle) throw new Error("battle didn't end");
}
