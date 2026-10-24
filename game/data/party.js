/**
 * The starting party: four level 1 characters from Jon's audio roster
 * (mastery repo, audio/characters and audio/episodes). Only what the game
 * uses so far is recorded here; the rest of each sheet lives in those files.
 *
 * Skills are mastery levels: 1 Unskilled, 2 Untrained, 3 Basic, and so on.
 */
export const PREGENS = [
  {
    id: "gisla", name: "Gisla", cls: "Cursed", title: "the Wrong", level: 1, xp: 0,
    attributes: { strength: 6, agility: 9, physique: 10, endurance: 10, intelligence: 10, wisdom: 11, charisma: 6, perception: 13 },
    health: 9, magan: 18,
    armor: null,
    skills: { spellcraft: 2, lore: 2 },
    notes: "Possessed. Flame Dart, Demoralize. Agathion: Tallow, a black goat."
  },
  {
    id: "corra", name: "Corra", cls: "Druid", title: "the Seer", level: 1, xp: 0,
    attributes: { strength: 5, agility: 9, physique: 7, endurance: 10, intelligence: 8, wisdom: 13, charisma: 8, perception: 10 },
    health: 7, magan: 19,
    armor: null,
    skills: { healer: 2, presence: 2, wilderness: 2 },
    notes: "Stoneskin, Mend Flesh. Puca: Clabber, a boar. Healer's Kit."
  },
  {
    id: "hamon", name: "Hamon", cls: "Thief", title: "the Crank", level: 1, xp: 0,
    attributes: { strength: 5, agility: 8, physique: 15, endurance: 10, intelligence: 11, wisdom: 4, charisma: 9, perception: 7 },
    health: 5, magan: 0,
    armor: { name: "Gambeson", durability: 46 },
    skills: { thievery: 2, stealth: 2, presence: 2, alertness: 2, athletics: 2, lore: 2 },
    stealthDC: 6,
    notes: "Kunai, five war darts, a blackjack. Backstab."
  },
  {
    id: "gerberga", name: "Gerberga", cls: "Paladin", title: "the Postulant", level: 1, xp: 0,
    attributes: { strength: 10, agility: 7, physique: 6, endurance: 11, intelligence: 10, wisdom: 7, charisma: 12, perception: 10 },
    health: 5, magan: 6,
    armor: { name: "Jack of plate", durability: 46 },
    skills: { athletics: 2, presence: 2 },
    notes: "Swordbreaker (her holy focus), heater shield. Mend, Sacred Ward."
  }
];
