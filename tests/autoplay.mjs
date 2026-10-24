/**
 * A plain-minded player for tests: in a fight, it attacks whatever it can
 * reach, walks toward the nearest enemy otherwise, and says yes to every
 * defense, counter, reprisal, and Fighting On.
 */
import { runWithDice, note } from "../game/journey.js";
import { SPELLS } from "../game/data/spells.js";
import { runOdds } from "../game/events.js";
import { canBreakAway, castOptions, castTargets, pcCast, memberFor, attackModes, setMode, challengeTargets, beginRound, retreat, runPlan, currentPC, canAttack, pcAttack, pcMove, pcEndTurn, respond, triageTargets, pcTriage, gap, standing, moveCost } from "../game/combat.js";

/**
 * A caster's pick at declarations [cast]: a healing spell when a friend is
 * below half health, else the dearest harmful spell the magan pays for.
 */
function spellPick(s, u) {
  const m = memberFor(s, u);
  const opts = castOptions(s, u).filter(o => o.cost <= (m.mp || 0) && !o.miscast);
  const hurt = s.battle.units.some(x => x.side === "party" && x.pc && !memberFor(s, x).dead && memberFor(s, x).hp < memberFor(s, x).health / 2);
  const kind = (o) => SPELLS[o.name]?.kind;
  const heal = hurt && opts.find(o => kind(o) === "heal");
  if (heal) return heal.key;
  const harm = opts.filter(o => ["damage", "area", "condition"].includes(kind(o))).sort((a, b) => b.cost - a.cost)[0];
  return harm?.key || null;
}
function castNow(s, rng, say, u) {
  const ts = castTargets(s, u);
  if (!ts.length) return false;
  const kind = SPELLS[u.casting.name]?.kind;
  const t = kind === "heal" ? [...ts].sort((a, b) => memberFor(s, a).hp / memberFor(s, a).health - memberFor(s, b).hp / memberFor(s, b).health)[0]
    : ["damage", "area", "condition"].includes(kind) ? [...ts].sort((a, b) => gap(u, a) - gap(u, b))[0] : ts[0];
  pcCast(s, rng, say, t.id);
  return true;
}

/** Can the break-away the autoplayer would try succeed at all? */
function odds(s) {
  const plan = runPlan(s);
  return runOdds(s.battle.head, plan.runners.filter(u => !u.companion).map(u => memberFor(s, u)), { carrying: plan.downed.length + plan.lame.length > 0 });
}

export function playBattle(s, { maxSteps = 20000, picks = {}, run = false, clever = false, cast = false } = {}) {
  const say = (t, k) => note(s, t, k);
  for (let i = 0; i < maxSteps && s.battle; i++) {
    const b = s.battle;
    runWithDice(s, (rng) => {
      if (b.prompt) return respond(s, rng, say, b.prompt.helper && clever ? "hearten" : true);
      if (b.stage === "declare") {
        // A fight that won't end (a Dryad melding and regrowing) is one to walk away from.
        if (((run && b.round >= run) || b.round > 30) && !b.aftermath && canBreakAway(s) && odds(s)?.possible && (b.tries = (b.tries || 0) + 1) <= 3) return retreat(s, rng, say, runPlan(s).downed.map(u => u.id));
        if (clever) for (const u of b.units.filter(x => x.pc)) { const f = challengeTargets(s, u)[0]; if (f) picks[u.id] = { ...picks[u.id], challenge: f.id }; }
        const round = Object.fromEntries(Object.entries(picks).map(([k, v]) => [k, { ...v }]));
        if (cast) for (const u of b.units.filter(x => x.pc && !x.companion)) {
          const key = spellPick(s, u);
          if (key) round[u.id] = { ...round[u.id], spell: key, attack: true };
        }
        return beginRound(s, rng, say, round);
      }
      const u = currentPC(s);
      if (!u) throw new Error(`battle stuck: stage ${b.stage}, queue ${b.queue.length}, current ${b.current}`);
      if (cast && u.casting && u.ap >= 1 && castNow(s, rng, say, u)) return;
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
