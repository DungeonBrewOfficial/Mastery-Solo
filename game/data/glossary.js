/**
 * Plain explanations of the words the page shows in a fight, as the game
 * plays them (combat.js, mods() and rollPool()). Shown on hover, and in the
 * fight feed's "How to read this".
 */
export const GLOSSARY = {
  // Rolls
  "Dominance": "Every die in the roll is one size bigger (d4 → d6). Cancels against Impotence.",
  "Impotence": "Every die in the roll is one size smaller (d6 → d4). Cancels against Dominance.",
  "Superiority": "Dice explode on their top two faces instead of only the top one. Cancels against Inferiority.",
  "Inferiority": "Dice don't explode at all. Cancels against Superiority.",
  "explode": "A die that rolls its highest face is rolled again and added (shown as 4!3). Attack and defense dice explode; trial dice don't.",
  // Attacks
  "HIT": "The attack beat the defense, or wasn't defended and beat resistance. What gets through goes to armor or shield Durability first, then health (magical damage skips Durability).",
  "MISS": "The target defended and rolled at least as high as the attack, or a shot went wide on its aim.",
  "NO DAMAGE": "The attack wasn't defended but was no bigger than the target's resistance, so nothing got through.",
  "resistance": "Protection against a damage type. When the target defends, it's already added into the defense total; when it doesn't, it's subtracted from the attack. Armor adds to it while its Durability lasts.",
  "Durability": "What armor and shields can soak before they break. Damage goes here before health while it lasts.",
  "AP": "Action points: 2 a round. Moving, attacking, defending, casting, and most actions cost 1.",
  "phases": "Each round runs Fast, then Moderate, then Slow. You act in the phase of the slowest thing you declared (weapon or spell).",
  "flanking": "An ally directly opposite you across the target: +2 to your attack.",
  // Guards
  "Mutable": "Guard: no change to attack or defense.",
  "Stable": "Guard: defense with Dominance, attacks with Impotence.",
  "Striking": "Guard: attacks with Dominance, defense with Impotence.",
  // Creature ranks
  "minion": "A group fought as one token. Its number is its heads; it rolls a d2 for each head, so it weakens as heads fall.",
  "adept": "An ordinary creature: one turn, 2 AP.",
  "leader": "Leads others; often has an ability that lifts its allies.",
  "champion": "A dangerous single foe.",
  "master": "A very dangerous single foe.",
  "epic": "Acts in every phase, 2 AP in each.",
  "Cluster": "A minion group of up to 6 heads.",
  "Brood": "A minion group of 7 to 12 heads.",
  "Swarm": "A minion group of more than 12 heads.",
  // Conditions (tiers 1, 2, 3)
  "Dazed": "Impaired 1: −1 on rolls. Eases a tier each round when it came from Startle.",
  "Stunned": "Impaired 2: −2 on rolls, and Inferiority on attacks and defense.",
  "Paralyzed": "Impaired 3: no AP at all.",
  "Shaken": "Demoralized 1: attacks have Inferiority.",
  "Frightened": "Demoralized 2: attacks and defense have Inferiority.",
  "Panicked": "Demoralized 3: it breaks and runs.",
  "Grappled": "Restricted 1: −1 on physical rolls.",
  "Pinned": "Restricted 2: −2 on physical rolls, Inferiority on attacks and defense.",
  "Restrained": "Restricted 3: held fast; −2 on physical rolls, Inferiority on attacks and defense.",
  "Dosed": "Tainted 1: −1 on everything.",
  "Blighted": "Tainted 2: −2 on everything, and Impotence.",
  "Corrupted": "Tainted 3: −3 on everything, and Impotence.",
  "Weary": "Exhausted 1: Impotence on rolls.",
  "Fatigued": "Exhausted 2: Impotence, and Inferiority on attacks and defense.",
  "Depleted": "Exhausted 3: Impotence, Inferiority in a fight, and only 1 AP a round.",
  "Afflicted": "Infected 1: each night's rest counts one stage worse.",
  "Sickened": "Infected 2: rest counts two stages worse.",
  "Diseased": "Infected 3: rest counts three stages worse.",
  "Rallied": "Inspired 1: Dominance on mental rolls (Wisdom, Charisma, Intelligence, Perception).",
  "Emboldened": "Inspired 2: as Rallied, and +1 on trials outside attack and defense.",
  "Fearless": "Inspired 3: as Rallied, +2 on trials outside attack and defense, and Superiority on attacks and defense.",
  "Energized": "Invigorated 1: Dominance on physical rolls.",
  "Empowered": "Invigorated 2: Dominance and +1 on physical rolls.",
  "Tireless": "Invigorated 3: Dominance and +2 on everything.",
  "prone": "On the ground: melee attacks against it have Superiority, ranged attacks Inferiority, and its own attacks and defense Inferiority. Standing costs 1 AP.",
  "fighting on": "At 0 health and still up: every hit is another Trauma.",
  "dying": "Unconscious at 0 health; the number is rounds left before death. Triage (2 AP, adjacent) stops it.",
  "held": "Grabbed or snared: break free with a Strength trial against the hold.",
  "winding up": "Declared a Smash: it acts in the Slow phase, and attacks against it have Superiority until it lands."
};

/** The explanation for a label as the page shows it ("Rallied", "Bandit Thugs (6)" → none, "dying (2)" → dying). */
export function explain(label) {
  if (GLOSSARY[label]) return GLOSSARY[label];
  const head = String(label).replace(/\s*\(.*$/, "").trim();
  return GLOSSARY[head] || GLOSSARY[head.toLowerCase()] || "";
}
