/**
 * The starting party: four level 1 characters from Jon's audio roster
 * (mastery repo, audio/characters and audio/episodes). Only what the game
 * uses so far is recorded here; the rest of each sheet lives in those files.
 *
 * Skills, weapon types, and styles are mastery levels: 1 Unskilled,
 * 2 Untrained, 3 Basic, and so on.
 *
 * Weapons follow Equipment › Weapons Reference and Weapon Mastery › Weapon
 * Speed and Attribute by Category: track is the Weapon Mastery Attack Dice
 * column (I–VI). Ranges are in squares (5 ft). Light armor already includes
 * the wearer's Agility tier in each mundane resistance.
 */
const LIGHT_1H = { category: "Light One-Handed", track: 1, speed: "fast", attribute: "physique" };
export const PREGENS = [
  {
    id: "gisla", name: "Gisla", cls: "Cursed", title: "the Wrong", level: 1, xp: 0,
    attributes: { strength: 6, agility: 9, physique: 10, endurance: 10, intelligence: 10, wisdom: 11, charisma: 6, perception: 13 },
    health: 9, magan: 18,
    armor: null,
    weapons: [{ name: "Dagger", ...LIGHT_1H, type: "daggers", damage: "piercing" }],
    weaponSkill: { daggers: 2 }, styles: {},
    skills: { spellcraft: 2, lore: 2 },
    notes: "Possessed. Flame Dart, Demoralize. Agathion: Tallow, a black goat."
  },
  {
    id: "corra", name: "Corra", cls: "Druid", title: "the Seer", level: 1, xp: 0,
    attributes: { strength: 5, agility: 9, physique: 7, endurance: 10, intelligence: 8, wisdom: 13, charisma: 8, perception: 10 },
    health: 7, magan: 19,
    armor: null,
    weapons: [
      { name: "Quarterstaff", category: "Two-Handed", track: 5, speed: "slow", attribute: "strength", type: "bludgeons", damage: "crushing", twoHanded: true },
      { name: "Sickle", ...LIGHT_1H, type: "axes", damage: "piercing" },
      { name: "Sling", category: "Light Thrown", track: 1, speed: "moderate", attribute: "physique", type: "bludgeons", damage: "crushing", ranged: true, range: [60, 120, 180], projectile: true }
    ],
    weaponSkill: { bludgeons: 2, axes: 2 }, styles: {},
    skills: { healer: 2, presence: 2, wilderness: 2 },
    notes: "Stoneskin, Mend Flesh. Puca: Clabber, a boar. Healer's Kit."
  },
  {
    id: "hamon", name: "Hamon", cls: "Thief", title: "the Crank", level: 1, xp: 0,
    attributes: { strength: 5, agility: 8, physique: 15, endurance: 10, intelligence: 11, wisdom: 4, charisma: 9, perception: 7 },
    health: 5, magan: 0,
    armor: { name: "Gambeson", durability: 46, max: 46, resistance: { cutting: 5, crushing: 8, cleaving: 5, piercing: 8, puncturing: 4 } },
    weapons: [
      { name: "Kunai", ...LIGHT_1H, type: "daggers", damage: "piercing" },
      { name: "War darts", category: "Light Thrown", track: 1, speed: "fast", attribute: "physique", type: "daggers", damage: "piercing", ranged: true, range: [5, 10, 15], thrown: true, count: 5 },
      { name: "Blackjack", ...LIGHT_1H, type: "bludgeons", damage: "crushing" }
    ],
    weaponSkill: { daggers: 2, bludgeons: 2 }, styles: { single: 2 },
    skills: { thievery: 2, stealth: 2, presence: 2, alertness: 2, athletics: 2, lore: 2 },
    stealthDC: 6,
    notes: "Kunai, five war darts, a blackjack. Backstab."
  },
  {
    id: "gerberga", name: "Gerberga", cls: "Paladin", title: "the Postulant", level: 1, xp: 0,
    attributes: { strength: 10, agility: 7, physique: 6, endurance: 11, intelligence: 10, wisdom: 7, charisma: 12, perception: 10 },
    health: 5, magan: 6,
    armor: { name: "Jack of plate", durability: 46, max: 46, resistance: { cutting: 9, crushing: 6, cleaving: 6, piercing: 5, puncturing: 4 } },
    shield: { name: "Heater", defense: 4, durability: 18, max: 18 },
    weapons: [{ name: "Swordbreaker", category: "Heavy One-Handed", track: 2, speed: "moderate", attribute: "strength", type: "daggers", damage: "cutting", defense: 1 }],
    weaponSkill: { daggers: 2 }, styles: { shield: 2, single: 2 },
    skills: { athletics: 2, presence: 2 },
    notes: "Swordbreaker (her holy focus), heater shield. Mend, Sacred Ward."
  }
];
