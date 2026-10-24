/**
 * Creature abilities the battle runs (combat stage 2). Each entry is written
 * by hand from the stat block's own wording (the Foundry creature pack,
 * from Jon's creature chapters), quoted in `text` so the two can be checked
 * against each other. Abilities not listed here are noted in the log as not
 * built yet.
 *
 * Kinds:
 *   rider     an attack variant: attack (by name), edge/inf on the roll, then
 *             on damage (gate "damage", or "health" for health damage only):
 *             extra damage, and a resist trial whose failure applies cond,
 *             attrition, or swap; with no resist, the effect simply lands.
 *   mob       a minion group's trait when it deals damage (dc "band": Creature
 *             Tier + band bonus). Attrition from a mob carries its own amount.
 *   presence  a mob trait that triggers on a creature starting its turn nearby.
 *   pileOn    a reaction: when an ally hits a creature within reach, attack it too.
 *   riposte   a reaction: after taking no damage from a melee attack, counter with a bonus.
 *   buff      a 2 AP action: allies (matching `who`) within range advance cond.
 *   charge    2 AP: a straight move of at least 3 squares, then an attack with Dominance.
 *   grab      an action: in lieu of an attack roll, a resist trial or Restricted, held.
 *   smash     a declared Slow attack with its own dice; attackers have Superiority meanwhile.
 *   aura      damage to enemies that end their turn (or enter) within radius.
 *   flame     extra damage when this creature's damage of a type lands.
 *   evasion   flying: Aiming Trials against it add its Agility tier.
 *   immune    damage types and conditions it ignores.
 *   passive   nothing for the battle to do (why says so).
 */
export const ABILITIES = {
  "Venomous Bite": { kind: "rider", attack: /bite/i, edge: -1, gate: "damage", extra: { amount: 1, type: "primal" }, resist: { attr: "endurance", dc: 3 }, cond: { name: "tainted", n: 1 },
    text: "On a hit with a bite attack, with Impotence, if damage is dealt, the venom inflicts 1 Primal damage (END Tier). The target must succeed on an END trial [3] or advance Tainted by 1 tier." },
  "Rend": { kind: "rider", attack: /claw/i, edge: -1, gate: "damage", resist: { attr: "endurance", dc: 3 }, attrition: { label: "Bleeding" },
    text: "On a hit with a claw attack, with Impotence, if damage is dealt the target must succeed on an END trial [3] or gain Attrition (Bleeding)." },
  "Low Cut": { kind: "rider", attack: /great knife/i, inf: true, gate: "damage", resist: { attr: "strength", dc: 3 }, cond: { name: "restricted", n: 1 },
    text: "On a hit with a great knife attack, with Inferiority, the target must succeed on a STR trial [3] or advance Restricted by 1 tier." },
  "Clamp": { kind: "rider", attack: /bite/i, gate: "damage", resist: { attr: "strength", dc: 5 }, cond: { name: "restricted", n: 1 },
    text: "On a hit with a bite attack, the target must succeed on a STR trial [5] or advance Restricted by 1 tier." },
  "Gore": { kind: "rider", attack: /tusk/i, edge: -1, gate: "damage", resist: { attr: "endurance", dc: 4 }, attrition: { label: "Bleeding" },
    text: "On a hit with a tusk attack, with Impotence, if damage is dealt the target must succeed on an END trial [4] or gain Attrition (Bleeding)." },
  "Hamstring": { kind: "rider", attack: /bite/i, needsFlank: true, gate: "damage", resist: { attr: "strength", dc: 5 }, cond: { name: "restricted", n: 1 },
    text: "On a hit with a bite attack from behind or flanking, forfeiting the flanking bonus, the target must succeed on a STR trial [5] or advance Restricted by 1 tier." },
  "Hook": { kind: "rider", attack: /axe/i, edge: -1, gate: "damage", resist: { attr: "physique", dc: 4 }, swap: true,
    text: "On a hit with an axe attack, with Impotence, the target must succeed on a PHY trial [4] or swap positions with the orc." },
  "Diseased Bite": { kind: "rider", attack: /bite/i, edge: -1, gate: "health", resist: { attr: "endurance", dc: 3 }, cond: { name: "infected", n: 1 },
    text: "On a hit with a bite attack, with Impotence, if health damage is dealt, the target must succeed on an END trial [3] or advance Infected by 1 tier." },
  "Hurl Rock": { kind: "rider", attack: /hurl rock/i, inf: true, gate: "damage", cond: { name: "impaired", n: 1 },
    text: "The living stone makes a hurl rock attack with Inferiority. On a hit, the target advances Impaired by 1 tier." },

  "Cudgel": { kind: "mob", resist: { attr: "perception", dc: "band" }, cond: { name: "impaired", n: 1, max: 1 },
    text: "When the group deals damage, the target must succeed on a PER trial [Cluster 3 / Brood 5 / Swarm 7] or advance Impaired by 1 tier (max Tier 1)." },
  "Venomous Swarm": { kind: "mob", resist: { attr: "endurance", dc: "band" }, cond: { name: "tainted", n: 1, max: 1 },
    text: "When the swarm deals damage, the target must succeed on an END trial [Cluster 3 / Brood 5 / Swarm 7] or advance Tainted by 1 tier (max Tier 1)." },
  "Grave Rust": { kind: "mob", attrition: { label: "Decaying", type: "profane", amount: 1 },
    text: "When the group deals damage, the target suffers Attrition (Decaying) 1." },
  "Harry": { kind: "mob", attrition: { label: "Bleeding", amount: 2 },
    text: "When the pack deals damage, the target suffers Attrition (Bleeding) 2." },
  "Gnawing": { kind: "mob", attrition: { label: "Bleeding", amount: 1 },
    text: "When the swarm deals damage, the target suffers Attrition (Bleeding) 1." },
  "Death Tick": { kind: "presence", range: 6, resist: { attr: "wisdom", dc: "band" }, cond: { name: "demoralized", n: 1, max: 1 },
    text: "A creature that starts its turn within 30 feet of the swarm and can hear it must succeed on a WIS trial [Cluster 3 / Brood 5 / Swarm 7] or advance Demoralized by 1 tier (max Tier 1)." },

  "Pack": { kind: "pileOn", attack: /bite/i,
    text: "When an allied dog hits a creature within 5 feet, this dog can make a bite attack against the same target." },
  "Swarm Frenzy": { kind: "pileOn", attack: /claw/i,
    text: "When an allied Kallikantzaros within 5 feet hits a creature, this Kallikantzaros can make a claw attack against the same target." },
  "Riposte": { kind: "riposte", bonus: 3,
    text: "When the bandit leader takes no damage from a melee attack, it can counter-attack with a bonus of +3 to the attack roll." },

  "Rally": { kind: "buff", cond: "inspired", range: 6, who: /bandit/i,
    text: "The bandit leader shouts encouragement, All allied bandits within 30 feet advance Inspired by 1 tier. Lasts 1 round. Can be reapplied to stack tiers." },
  "Rally Howl": { kind: "buff", cond: "invigorated", range: 6, who: /wolf/i,
    text: "The wolf howls. All allied wolves within 30 feet advance Invigorated by 1 tier. Can be reapplied to stack tiers." },

  "Charge": { kind: "charge", attack: /tusk|bite|claw|horn|gore|slam/i,
    text: "The boar moves at least 15 feet in a straight line and makes a tusk attack with Dominance." },
  "Charge (Bite)": { kind: "charge", attack: /bite/i, text: "The cat moves at least 15 feet in a straight line and makes a bite or claw attack with Dominance." },
  "Charge (Claw)": { kind: "charge", attack: /claw/i, text: "The cat moves at least 15 feet in a straight line and makes a bite or claw attack with Dominance." },
  // Every flier is taken to be aloft, so it can always stoop.
  "Stoop": { kind: "charge", attack: /talon/i, text: "The raptor moves up to full speed in a straight line from above and makes a talon attack with Dominance. Must start at least 15 ft above the target." },

  "Grab": { kind: "grab", attack: /claw/i, resist: { attr: "strength", dc: 4 },
    text: "The cat makes a claw attack. In lieu of an attack roll, the target must succeed on a STR trial [4] or advance Restricted by 1 tier. Restricted does not deteriorate while held." },
  "Constrict": { kind: "grab", resist: { attr: "strength", dc: 6 }, squeeze: { name: "Squeeze", dice: [8, 10], bonus: 2, type: "crushing" },
    text: "The constrictor attempts to wrap around a target within reach. The target must succeed on a STR trial [6] or advance Restricted by 1 tier. Squeeze (1 AP, Attack). Only usable on a target the constrictor has Restricted. d8 (DTD) + d10 (STR) + 2 (2sq) Crushing." },
  "Smash": { kind: "smash", attack: /slam/i, dice: [4, 6], bonus: 7, type: "crushing",
    text: "The living stone makes a slam attack. d4 + d6 + half STR score (7) Crushing. Must act in Slow phase. While preparing, enemies attacking it gain Superiority." },

  "Fire Aura": { kind: "aura", radius: 1, amount: 2, type: "fire",
    text: "Creatures within 5 feet that enter the aura on their turn or end their turn within it take 2 Fire damage (flat, END Tier, no trial)." },
  "Living Flame": { kind: "flame", whenType: "crushing", amount: 2, type: "fire",
    text: "If the fire elemental's Crushing damage deals damage to durability or health, the target takes 2 Fire damage (flat, END Tier)." },
  "Aerial Evasion": { kind: "evasion", text: "While the raptor is flying, ranged attacks against it add the raptor's Agility tier to the Aiming Trial DC." },

  "Gestalt (Undead)": { kind: "immune", damage: ["profane"], text: "Immune to Profane damage." },
  "Undead Resilience": { kind: "immune", conds: ["tainted", "infected", "exhausted"], text: "Immune to Tainted, Infected, and Exhausted." },
  "Autochthon (Stone)": { kind: "immune", damage: ["stone"], text: "Immune to Stone damage." },
  "Autochthon (Fire)": { kind: "immune", damage: ["fire"], text: "Immune to Fire damage." },
  "Autochthon (Sea)": { kind: "immune", damage: ["sea"], text: "Immune to Sea damage." },

  "Ambusher": { kind: "passive", why: "handled when contact is made" },
  "Steadfast": { kind: "passive", why: "nothing moves the party's foes by force yet" },
  "Solstice Bound": { kind: "passive", why: "a matter for the encounter tables" },
  "Fear of Fire and Light": { kind: "passive", why: "the party carries no light or fire into a fight yet" }
};

export const abilitiesOf = (c) => (c?.abilities || []).map(n => ({ name: n, ...ABILITIES[n] })).filter(a => a.kind);
export const unbuilt = (c) => (c?.abilities || []).filter(n => !ABILITIES[n]);
