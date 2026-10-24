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
 *   needs     can't work until the grid has what it needs (why says so); named in the log.
 *
 * Band II adds: heavy (a 2 AP attack with its own dice), multi (one roll
 * against several in reach), line and area (one roll against everyone in a
 * line or a 2 × 2 square), hold (a Restricted hold from range), roar and
 * quake (2 AP, everyone near resists), rush (a move that draws no reprisals,
 * then an attack), stride (moves that draw no reprisals), trample (a straight
 * run; everyone beside the path resists), bolt and feed (a trial in place of
 * an attack roll), regen and heal, meld, quarry and feint, and reactions
 * (intercept, doubleDamage, shed, false, press), plus griefFury, breaker,
 * incorporeal, unflankable, absorb, resistBonus, and mobSelf.
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

  /* ---------------- Band II ---------------- */
  "Morphon (Sora)": { kind: "immune", damage: ["void"], text: "Immune to Void damage." },
  "Behemoth (Stone)": { kind: "immune", damage: ["stone"], text: "Immune to Stone damage." },
  "Incorporeal": { kind: "incorporeal", text: "Attacks that deal mundane damage have Inferiority against it (dice cannot explode). Magical damage, including the magical portion of an enchanted weapon's hit, lands normally." },
  "Three Heads": { kind: "unflankable", startle: 3, text: "The Ettin cannot be flanked. It has awareness in all directions, gains +3 to Startle trials and Perception-based trials, and is immune to Charmed and Controlled." },
  "Iron-Shod": { kind: "resistBonus", conds: ["restricted", "prone"], bonus: 2, text: "The Redcap's heavy iron boots grant it +2 to trials against Restricted and Prone." },

  "Pinning Shot": { kind: "rider", attack: /bow/i, inf: true, gate: "damage", resist: { attr: "strength", dc: 5 }, cond: { name: "restricted", n: 1 },
    text: "On a hit with a bow attack, with Inferiority, if damage is dealt, the target must succeed on a STR trial [5] or advance Restricted by 1 tier. Multiple successful Pinning Shots stack the condition." },
  "Bash": { kind: "rider", attack: /club/i, edge: -1, gate: "damage", resist: { attr: "perception", dc: 9 }, cond: { name: "impaired", n: 1 },
    text: "The Ettin makes a club attack with Impotence. If damage is dealt, the target must succeed on a PER trial [9] or advance Impaired by 1 tier." },
  "Shield Punch": { kind: "rider", attack: /shield/i, special: { name: "Shield Punch", dice: [6, 3], bonus: 0, type: "crushing" }, gate: "damage", resist: { attr: "perception", dc: 6 }, cond: { name: "impaired", n: 1 },
    text: "The knight makes a shield attack: d6 + d3 Crushing (its shield-grip attack dice). On hit, if the knight deals damage, the target must succeed on a PER trial [6] or advance Impaired by 1 tier." },
  "Death Roll": { kind: "rider", attack: /bite/i, special: { name: "Death Roll", dice: [6, 8], bonus: 2, type: "crushing" }, sup: true, needsCond: "restricted", gate: "health", resist: { attr: "endurance", dc: 5 }, attrition: { label: "Bleeding" },
    text: "The crocodile makes a bite attack with Superiority against a Restricted target. d6 (DTD) + d8 (STR) + 2 (2sq) Crushing. On a hit that deals health damage, the target must succeed on an END trial [5] or gain Attrition (Bleeding)." },
  "Pitchforks and Hooks": { kind: "mob", resist: { attr: "strength", dc: "band", plus: 1 }, cond: { name: "restricted", n: 1, max: 2 },
    text: "When the group deals damage, the target must succeed on a STR trial [Cluster 4 / Brood 6 / Swarm 8] or advance Restricted by 1 tier (max Tier 2)." },
  "Blood Up": { kind: "mobSelf", cond: "invigorated", text: "When the group deals damage, it advances Invigorated by 1 tier." },

  "Vicious Bite": { kind: "heavy", special: { name: "Vicious Bite", dice: [12, 8, 8], bonus: 2, type: "piercing" },
    text: "The wolf makes a bite attack: d12 + 2d8 + 2 Piercing, exploding." },
  "Swipe": { kind: "multi", attack: /claw|club|fist|swipe/i, targets: 2, inf: true,
    text: "The bear makes a claw attack targeting up to 2 creatures within reach. Roll one attack with Inferiority and apply to both targets. Cutting." },
  "Timber": { kind: "line", attack: /slam/i, length: 2, push: { resist: { attr: "strength", dc: 6 }, squares: 2 },
    text: "The Treow makes a branch slam attack targeting all creatures in a 10-foot line. Roll one attack and apply to all targets. On a hit, targets must succeed on a STR trial [6] or be pushed 10 feet." },
  "Boulder Throw": { kind: "area", attack: /boulder/i, edge: -1, size: 2,
    text: "The Bergrisar makes a boulder attack with Impotence targeting all creatures in a 2×2 area at the impact point. Roll one attack and apply to all targets." },

  "Root Snare": { kind: "hold", range: 6, resist: { attr: "strength", dc: 6 }, supWhenPinned: true,
    text: "The target must succeed on a STR trial [6] or advance Restricted by 1 tier. Advances on repeated application. No damage. Restricted does not deteriorate while held. While a target is Pinned by Root Snare, the Treow's attacks against it have Superiority." },
  "Ensnare": { kind: "hold", range: 12, resist: { attr: "strength", dc: 8 },
    text: "Roots seize a creature. The target must succeed on a STR trial [8] or advance Restricted by 1 tier. Restricted does not deteriorate while held." },
  "Web": { kind: "hold", range: 6, resist: { attr: "strength", dc: 6 },
    text: "The spider shoots a web at a target within 30 feet. The target must succeed on a STR trial [6] or advance Restricted by 1 tier. Restricted does not deteriorate while held." },

  "Roar": { kind: "roar", range: 6, resist: { attr: "wisdom", dc: 7 }, cond: { name: "demoralized", n: 1 },
    text: "All creatures within 30 feet must succeed on a WIS trial [7] or advance Demoralized by 1 tier." },
  "Stomp": { kind: "roar", range: 4, resist: { attr: "agility", dc: 9 }, prone: true,
    text: "The Bergrisar slams a foot down, fracturing the ground. All creatures within 20 feet must succeed on an AGI trial [9] or be knocked prone." },
  "Presence of the Ideal": { kind: "presence", range: 4, resist: { attr: "wisdom", dc: 6 }, cond: { name: "demoralized", n: 1 }, once: true,
    text: "Creatures that enter the aura (20 ft) must succeed on a WIS trial [6] or advance Demoralized by 1 tier. A creature that succeeds is immune to the aura for the rest of the encounter." },

  "Relentless Chase": { kind: "rush", attack: /bite/i, supIfMoved: true,
    text: "The Eidolon moves up to its full speed and makes a bite attack against a target it moves adjacent to. This movement does not provoke attacks of opportunity. If the target moved during its last turn, the attack has Superiority." },
  "Dive": { kind: "rush", attack: /talon/i, flyBack: true,
    text: "The eagle swoops through a target's space, making a talon attack during movement. Does not provoke attacks of opportunity." },
  "Unyielding Advance": { kind: "stride", text: "The revenant moves up to its speed. This movement does not provoke attacks of opportunity." },
  "Wildfire": { kind: "trample", resist: { attr: "agility", dc: 9 }, attrition: { label: "Burning", type: "fire", amount: 5 },
    text: "The Inferno moves up to full speed in a straight line. This movement does not provoke attacks of opportunity. Each creature in its path must succeed on an AGI trial [9] or gain Attrition (Burning) [5]." },
  "Avalanche": { kind: "trample", resist: { attr: "strength", dc: 9 }, cond: { name: "restricted", n: 1 },
    text: "The Bergrisar moves up to full speed in a straight line. This movement does not provoke attacks of opportunity. Each creature in its path must succeed on a STR trial [9] or advance Restricted by 1 tier." },

  "Thorn Bolt": { kind: "bolt", range: 12, resist: { attr: "agility", dc: 8 }, damage: "1d12+1d8", type: "primal",
    text: "The target must succeed on an AGI trial [8] or take d12 + d8 primal damage." },
  "Consume": { kind: "bolt", ap: 2, range: 8, resist: { attr: "agility", dc: 9 }, damage: "2d6+1d8", type: "fire", cond: { name: "exhausted", n: 1 },
    text: "The target must succeed on an AGI trial [9] or take 2d6 (DTD) + d8 (END) Fire damage and advance Exhausted by 1 tier." },
  "Feed": { kind: "feed", damage: "1d8+1d6", type: "primal", resist: { attr: "endurance", dc: 6 }, cond: { name: "tainted", n: 1 },
    text: "Only usable on a Helpless target. d8 (DTD) + d6 (END) Primal damage. The target must succeed on an END trial [6] or advance Tainted by 1 tier." },
  // Every Dryad met is in her grove.
  "Tree-Bound": { kind: "regen", amount: "1d6", text: "The Dryad regenerates 1d6 health at the start of each turn while within her grove." },
  "Reconstitute": { kind: "heal", amount: "2d8", text: "While standing on stone or earth, the Bergrisar heals END TD (2d8) health." },
  "Woodland Meld": { kind: "meld", text: "The Dryad melds into natural terrain and emerges from another point within 120 ft. Her next start-of-turn regen becomes 2d6. Cannot use while Restricted." },

  "Grief Fury": { kind: "griefFury", who: /orc/i, text: "When an allied orc within 30 feet is killed, the orc advances Invigorated by 1 tier (max Tier 3). Degrades by 1 tier per round if not re-triggered." },
  "Breaker": { kind: "breaker", text: "When the orc makes an attack where at least one damage die explodes, it can add its STR score (16) to the damage total. Immediately advances Exhausted by 3 tiers, which degrades by 1 tier per round." },
  "Double Damage": { kind: "doubleDamage", text: "Before an enemy's melee attack roll targeting the orc, the orc allows the attack to automatically hit with Superiority. After taking damage, the orc immediately makes a labrys attack with Superiority and Dominance." },
  "Shed": { kind: "shed", text: "When an enemy targets the wolf with a melee attack and the wolf successfully defends, it can move the attacker 5 feet to an unoccupied space within range. Cannot use against creatures larger than it." },
  "False": { kind: "false", text: "When the warrior moves out of a threatened space and is attacked, it gains +1 to its defense roll. If the attack misses, the warrior can make a melee attack with Superiority before completing its movement." },
  "Press": { kind: "press", text: "When the revenant's melee attack is defended and deals no damage, it immediately makes two longsword attacks with Inferiority against the same target." },
  "Intercept": { kind: "intercept", text: "When an enemy attacks an ally within 5 feet of the knight, the knight becomes the target of the attack instead. Gains Dominance on the defense roll." },
  "Absorb Flame": { kind: "absorb", type: "fire", text: "When the Inferno takes Fire damage, it heals health equal to the damage dealt instead of taking damage." },
  "Absorb Water": { kind: "absorb", type: "sea", text: "When the Undine takes Sea damage, it heals health equal to the damage dealt instead of taking damage." },

  "Command": { kind: "buff", cond: "inspired", range: 6, who: /./, text: "The sergeant shouts orders, All allied soldiers within 30 feet advance Inspired by 1 tier. Lasts 1 round. Can be reapplied to stack tiers." },
  "Command Shout": { kind: "buff", cond: "inspired", range: 6, who: /./, once: true, lasting: true, text: "All allied infantry within 30 feet advance Inspired by 1 tier. Persists until end of encounter." },
  "Pride Roar": { kind: "buff", cond: "invigorated", range: 6, who: /./, text: "All allied beasts within 30 ft advance Invigorated by 1 tier. Can be reapplied to stack tiers." },
  "Call the Flock": { kind: "buff", cond: "invigorated", range: 12, who: /magpie|crow|raven|corvid/i, text: "Allied corvids within range advance Invigorated by 1 tier. Lasts 1 round. Can be reapplied to stack tiers." },
  "Mark Quarry": { kind: "quarry", range: 12, text: "The ranger captain designates a target within line of sight. All allied hunters and beasts within 60 feet advance Invigorated by 1 tier against that target only. Can be reapplied to stack tiers." },
  "Cunning Feint": { kind: "feint", range: 2, resist: { attr: "perception", dc: 9 }, text: "One head distracts a target within 10 feet. The target must succeed on a PER trial [9] or the Ettin's next attack against that target this round gains Superiority." },

  "Unnatural Strength": { kind: "passive", why: "no one in the party grapples yet" },
  "Deep Roots": { kind: "passive", why: "nothing the party does moves a foe by force yet" },
  "Web Walker": { kind: "passive", why: "webs aren't laid on the ground yet" },
  "Giant's Grip": { kind: "passive", why: "its attack dice are already written for it" },
  "Half-Sword": { kind: "passive", why: "the knight carries a shield, and Half-Sword needs a free hand" },
  "Aquatic": { kind: "needs", why: "water on the grid" }, "Siren's Call": { kind: "needs", why: "water on the grid, and Charmed" },
  "Lure": { kind: "needs", why: "water on the grid" }, "Riptide": { kind: "needs", why: "water on the grid" }, "Drown": { kind: "needs", why: "water on the grid" },
  "Mist Veil": { kind: "needs", why: "Concealed on the grid" }, "Flare": { kind: "needs", why: "Concealed on the grid" },
  "Thornwall": { kind: "needs", why: "walls on the grid" },
  "Name-Taker": { kind: "needs", why: "the Magpie's talk, which comes later" }, "Speak the Name": { kind: "needs", why: "the Magpie's talk, which comes later" },
  "Every Name at Once": { kind: "needs", why: "the Magpie's talk, which comes later" },

  "Ambusher": { kind: "passive", why: "handled when contact is made" },
  "Steadfast": { kind: "passive", why: "nothing moves the party's foes by force yet" },
  "Solstice Bound": { kind: "passive", why: "a matter for the encounter tables" },
  "Fear of Fire and Light": { kind: "passive", why: "the party carries no light or fire into a fight yet" }
};

/**
 * Each creature's own numbers. The same ability carries different numbers on
 * different creatures (Grab is DC 4 on a Mountain Lion and 9 on a Cave Bear;
 * Rend rides a claw on a Kallikantzaros and a bite on a Giant War Dog), so
 * the entries above give the mechanics, and this reads the DC, bonus, range,
 * damage, and weapon from the creature's own text.
 */
function tune(spec, text) {
  if (!text) return spec;
  const t = { ...spec };
  const dc = /\[(\d+)\]/.exec(text);
  if (dc && t.resist && typeof t.resist.dc === "number") t.resist = { ...t.resist, dc: Number(dc[1]) };
  if (dc && t.push) t.push = { ...t.push, resist: { ...t.push.resist, dc: Number(dc[1]) } };
  const bonus = /bonus of \+(\d+)/i.exec(text);
  if (bonus && t.kind === "riposte") t.bonus = Number(bonus[1]);
  const reachFeet = /within (\d+) (?:feet|ft)/i.exec(text) || /\((\d+) ft\)/i.exec(text) || /Range(?:d)? (\d+) ft/i.exec(text);
  if (reachFeet && "range" in t) t.range = Math.floor(Number(reachFeet[1]) / 5);
  if (reachFeet && t.kind === "aura") t.radius = Math.floor(Number(reachFeet[1]) / 5);
  const flat = /take(?:s)? (\d+) (\w+) damage/i.exec(text);
  if (flat && (t.kind === "aura" || t.kind === "flame")) t.amount = Number(flat[1]);
  const venom = /inflicts (\d+) (\w+) damage/i.exec(text);
  if (venom && t.extra) t.extra = { amount: Number(venom[1]), type: venom[2].toLowerCase() };
  const big = /fail by (\d+) or more advance \w+ by 2/i.exec(text);
  if (big) t.bigFail = Number(big[1]);
  if (t.kind === "smash") {
    const m = /\b(d\d+) \+ (d\d+) \+ half STR score \((\d+)\)(?: \+ (\d+) \(\d+ ?sq\))?/i.exec(text);
    if (m) { t.dice = [Number(m[1].slice(1)), Number(m[2].slice(1))]; t.bonus = Number(m[3]) + Number(m[4] || 0); }
  }
  // The attack it rides on: "On a hit with a bite attack", "makes a tusk attack", "a bite or claw attack".
  const on = /(?:with an?|makes an?) ([a-z]+(?: or [a-z]+| [a-z]+)?) attack/i.exec(text);
  if (on && t.attack && ["rider", "charge", "rush", "pileOn"].includes(t.kind)) {
    const words = on[1].toLowerCase().split(" or ").map(w => w.replace(/s$/, ""));
    t.attack = new RegExp(words.join("|"), "i");
  }
  return t;
}

export const abilitiesOf = (c) => (c?.abilities || []).map(n => ({ name: n, ...tune(ABILITIES[n] || {}, c.abilityText?.[n]) })).filter(a => a.kind);
export const unbuilt = (c) => (c?.abilities || []).filter(n => !ABILITIES[n] || ABILITIES[n].kind === "needs").map(n => ABILITIES[n] ? `${n} (needs ${ABILITIES[n].why})` : n);
