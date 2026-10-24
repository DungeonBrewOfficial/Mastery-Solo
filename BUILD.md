# Building Mastery Solo

How the game is put together, what's built, and what's next. Read this before writing code; keep it current after.

## Running it

It's a static site with no build step. Serve the repository root and open it in a browser:

```bash
npm run serve        # python3 -m http.server 8000, then open http://localhost:8000
npm test             # rules, generator, and combat tests (Node 22)
npm run sync         # copy Mastery's rules modules from ../Mastery-Foundry
node tools/build-creatures.mjs ../Mastery-Foundry   # creatures from the Foundry pack
node tools/build-encounters.mjs                     # terrain tables from design/02-encounters.md
```

The game saves after every action: on the hosted page, to the player's own private space in the page's database (so the save follows their account); opened from the repository, to the browser. **New dynasty** starts over, optionally from a seed.

**The hosted page.** `node tools/build-page.mjs` packs every module into one self-contained page, `dist/mastery-solo.html` (not committed), which is published as Jon's private playable page with the `db` and `user` capabilities.

## How it's organized

| Path | What it is |
|:---|:---|
| `index.html`, `game/style.css` | The page |
| `game/main.js` | Wires the page to the game state; input; saving |
| `game/render.js` | Draws the map, and the battle grid, on a canvas |
| `game/combat.js` | Battles: the grid, rounds and phases, attacks, defense, damage, dying, morale, the enemy AI (Mastery's Combat and Weapon Mastery chapters; `design/02-encounters.md` for morale) |
| `game/journey.js` | The turn: the day, legs, the travel and event dice, camp (`design/01-the-turn.md`) |
| `game/events.js` | Signs, Discoveries, Encounters, contact, disposition, choices, the chase, rewards (`design/02-encounters.md`, `design/04-the-map.md`) |
| `game/mastery.js` | Mastery's trial dice: tiers, the Die Progression Chart, Dominance and Impotence |
| `game/data/` | Game data. `encounters.js` and `creatures.js` are generated: never edit them. `party.js` holds the four starting characters from the audio roster. |
| `game/world.js` | Map generation, squares, movement cost, kinds of country, pathfinding (`design/04-the-map.md`) |
| `game/storage.js` | Saving and loading, compacted; the page database when hosted, the browser otherwise |
| `tools/build-page.mjs` | Packs the game into one page for publishing |
| `game/rng.js` | Seeded dice. Every roll goes through it, and its state is saved, so a dynasty can be replayed |
| `game/vendor/foundry/` | Mastery's pure rules modules, copied from the Foundry system by `tools/sync-foundry.mjs`. **Never edit these here.** Change them in the Foundry repo and sync. |
| `design/` | The rules the game implements. Code cites the design file it follows. |
| `tests/` | `node --test` |

**Conventions.** Game state is one plain object saved as JSON. Rules functions take the state and the dice and change the state; the page only draws it. Anything the rules don't cover yet is marked `TODO(area)` in code and logged in purple in the game, so gaps are visible while playing.

## Milestones

1. **The world and travel.** *Built.* Dynasty start, tile generation (terrain, roads, rivers, lakes, settlements, Deep country), the 2D map, choosing a destination, legs with the travel die and carried-over movement, nightfall choice, the event die by kind of country, daily weather from Mastery's tables, camp.
2. **Events.** *Built.* Signs, Discoveries, and Encounters, rolled on the terrain tables generated from `design/02-encounters.md` (`tools/build-encounters.mjs`) with creatures from the Foundry pack (`tools/build-creatures.mjs`). Contact, Startle, ambushes, disposition by temper, the party's choices (leave, go around, pay the toll, answer a patrol, leave food, throw coin, fight, run), the chase, reading and following signs to a lair, the Discovery table with places marked on the map, combat XP, exploration XP banked until a settlement, purses and pelts.
3. **The party and town.** Characters with real Mastery stats, health, Durability, rations, kits, weather and Pushing the Pace trials, rest, settlements, buying and selling, recruiting.
4. **Sites.** Lairs, caves, ruins, barrows: areas, contents, traps, the clock, the heart and its hoard. Clues and lost lore.
5. **Combat.** Built in stages.
   - *Stage 1, built.* A 16 × 12 grid opens for each fight, with the encounter's whole group (generated from the tables, minion groups as one token whose footprint shrinks as heads fall). Startle carries in as Impaired. Each round: declarations (weapon and the three Untrained guards), the d6 for the first side, then Fast, Moderate, and Slow, winning side first. 2 AP; moves (half again for consecutive moves), melee and ranged attacks with the Aiming Trial, flanking, defense declared before the roll, counterattacks, reprisal attacks for leaving reach. Weapon Mastery Attack Dice by track, Single Weapon and Two-Handed styles, the shield soaking durability and stopping missiles. Damage through Foundry's `resolveDamage`. 0 health: Injury, the dying timer, the Endurance trial, Fighting On and Traumas, Triage. Creatures: written dice, size bonuses, rolled Health from Foundry's health plan, armor durability, Epic and Legendary phase AP. Morale on the Demoralized ladder. Running from a fight is a one-round break-away, then the chase, carrying or leaving the fallen. Winning pays the head's XP and spoils; anyone still dying is saved if the party has a kit or a healing spell, and must be triaged in further rounds if not; the healer tends wounds afterwards. A shield-bearer chooses at declaration whether the shield takes hits.
   - *Stage 2, built for Band I.* The chained conditions: Restricted with holds and breaking free, Tainted, Infected (which carries out of the fight and worsens rest), Inspired against Demoralized, and Invigorated. Also Prone and Attrition. Creature abilities live in `game/data/abilities.js`, written from each stat block with its text alongside:
     - attack riders (Venomous Bite, Rend, Low Cut, Clamp, Gore, Hamstring, Hook, Diseased Bite, Hurl Rock);
     - Mob traits (Cudgel, Venomous Swarm, Grave Rust, Harry, Gnawing, and Death Tick on presence);
     - Pack and Swarm Frenzy, Riposte, and the Leader buffs Rally and Rally Howl;
     - Charge and Stoop, Grab and Constrict with Squeeze, the declared Smash;
     - Fire Aura, Living Flame, Aerial Evasion, and the immunities.
     Abilities not built yet are named in the log at the start of a fight.
     The party gets what a level-1 character can use:
     - Charge and Snap Shot, the Untrained baseline maneuvers;
     - Gerberga's shield bash, Avoid Death, and Challenge;
     - Hamon's Opportunist with Backstab, and Danger Sense against ambushes;
     - Corra's Hearten, offered on an ally's Defend prompt;
     - Gisla's immunity to Profane damage.
   - *Synergies on the page.* A "Right now" list on each turn names what's open (Opportunist, Charge, flanking, a prone or winding-up foe, someone bleeding out or held, Hearten on hand); tap a line for its rule (`game/data/rules-text.js`). Each character's Reactions page, opened from the party list, sets Ask, Always, or Never for each reaction.
   - *Stage 2, Band II, built.* About sixty more abilities, with what they needed added to the engine:
     - attacks with one roll against several targets (Swipe, Timber, Boulder Throw) and pushes;
     - holds at range (Web, Root Snare, Ensnare), fear auras (Presence of the Ideal) and Roar and Stomp;
     - moves that draw no reprisals (Relentless Chase, Dive, Unyielding Advance) and trampling runs (Wildfire, Avalanche);
     - trials in place of attack rolls (Thorn Bolt, Consume, Feed);
     - regrowth and healing (Tree-Bound, Reconstitute), Woodland Meld, Mark Quarry, Cunning Feint;
     - reactions (Intercept, Double Damage, Shed, False, Press), Grief Fury, Breaker, Incorporeal, Three Heads, Absorb Flame, Blood Up.
     The Exhausted condition now exists: in fights, carried out of them, and eased by rest. Archers now shoot while no one is beside them. Abilities that need water, fog, walls, or the Magpie's talk are named in the log as waiting on those. The maneuvers and guards past Untrained wait for advancement (milestone 3), since no one can learn them before then.
   - *Stage 3.* Spells (Flame Dart, Stoneskin, Mend, Sacred Ward) and the companions (Tallow, Clabber).

## Known gaps

- **Combat has no spells, class abilities, or companions yet** (stage 3): no Flame Dart, Stoneskin, Mend, or Sacred Ward, no Hard to Kill or Turn, no Tallow or Clabber. Band II creatures fight without most of their abilities.
- The battlefield is open ground: no terrain, cover, or light yet.
- **Healing is a stopgap until milestone 3.** Camp gives a Wilderness Rest (a Dungeon Rest in Deep country, one step worse if the night die brings something), and a night in a settlement gives a Good Night's Rest, free. After a fight the healer Heals each wounded character once without spending Wound Kits. Injuries and Traumas are recorded but nothing treats them yet.
- When the whole party is down, the dynasty run ends; the next generation is milestone 3.
- Leaving food doesn't cost rations yet.
- Sites (lairs, caves, ruins, barrows) are marked on the map but can't be entered (milestone 4).
- Characters level up in name only; advancement is milestone 3.

## Known gaps in milestone 1

- River crossings cost 2 extra movement instead of the ford and swim procedure, which needs the party (milestone 3).
- Weather and Pushing the Pace trials are noted in the log, not rolled.
- Settlements are places on the map with nothing to do in them yet.
