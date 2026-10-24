/**
 * The spells the party knows, from the spell chapters (Spells - Fire, Void,
 * Stone, Primal, Sacred), as each character recorded them in their build
 * episode. Cost is the recorded magan cost before material reductions, which
 * sets the spell's speed (Magic Mastery, Spell Speed).
 *
 * kind: damage (a trial or the damage), condition (a trial or the condition,
 * held by concentration), ward (a durability pool against a damage type),
 * heal (ATD + MD, cheapest for this round's wounds).
 * reach: squares (Close is 30 feet); 0 is touch or self.
 */
export const SPELLS = {
  "Flame Dart": { form: "fire", cost: 2, kind: "damage", reach: 6, resist: "agility", type: "fire",
    text: "You hurl a dart of fire at a creature within line of sight, 30 feet. The target makes an Agility trial; on failure, it takes full fire damage. (2 Magan: Obliterate Fire, Fast.)" },
  "Demoralize": { form: "void", cost: 6, kind: "condition", reach: 6, resist: "wisdom", cond: "demoralized", concentration: true,
    text: "You reach into a creature's consciousness within 30 feet and suppress its resolve for the encounter. The target makes a Wisdom trial; on failure, it advances Demoralized by 1 tier. (6 Magan: Enchant Void, Moderate, concentration.)" },
  // Corra: "Stoneskin (Self/Touch, per Jon's ruling)."
  "Stoneskin": { form: "stone", cost: 3, kind: "ward", reach: 0, against: "mundane", duration: 3, concentration: true, touch: true,
    text: "You harden your skin to the consistency of stone for the encounter. You gain a durability pool against mundane damage: Mastery Level × 5 × 3. When the pool is depleted, the spell ends. (3 Magan: Preservate Stone, Fast, concentration.)" },
  "Mend Flesh": { form: "primal", cost: 1, kind: "heal", reach: 0, touch: true,
    text: "You touch a creature and channel primal energy through its wounds. The creature recovers health equal to your ATD + MD. As an instantaneous spell, Mend Flesh heals damage taken this round. (1 Magan: Transmute Primal, Fast.)" },
  // Gerberga recorded hers without gestures, so she can cast with her shield up: 2 magan.
  "Mend": { form: "sacred", cost: 1, kind: "heal", reach: 0, touch: true,
    text: "You touch a creature and channel sacred energy through its wounds. The creature recovers health equal to your ATD + MD. As an instantaneous spell, Mend heals damage taken this round. (1 Magan: Transmute Sacred, Fast.)" },
  "Sacred Ward": { form: "sacred", cost: 3, kind: "ward", reach: 0, against: "sacred", duration: 3, concentration: true, touch: true,
    text: "You touch a creature and ward it against sacred damage for the encounter. The ward produces a durability pool: Mastery Level × 5 × 3. When the pool is depleted, the spell ends. (3 Magan: Preservate Sacred, Fast, concentration.)" }
};

/** Damage age multipliers for healing (Magic Mastery, Healing and Repair). */
export const DAMAGE_AGE = { round: 1, encounter: 3, half: 5, previous: 8 };

const MUNDANE = ["cutting", "cleaving", "crushing", "piercing", "puncturing"];
export const wardCovers = (against, type) => against === type || (against === "mundane" && MUNDANE.includes(type));
