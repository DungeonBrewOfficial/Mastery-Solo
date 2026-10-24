# Building Mastery Solo

How the game is put together, what's built, and what's next. Read this before writing code; keep it current after.

## Running it

It's a static site with no build step. Serve the repository root and open it in a browser:

```bash
npm run serve        # python3 -m http.server 8000, then open http://localhost:8000
npm test             # rules and generator tests (Node 22)
npm run sync         # copy Mastery's rules modules from ../Mastery-Foundry
node tools/build-creatures.mjs ../Mastery-Foundry   # creatures from the Foundry pack
node tools/build-encounters.mjs                     # terrain tables from design/02-encounters.md
```

The game saves itself in the browser (localStorage) after every action. **New dynasty** starts over, optionally from a seed.

## How it's organized

| Path | What it is |
|:---|:---|
| `index.html`, `game/style.css` | The page |
| `game/main.js` | Wires the page to the game state; input; saving |
| `game/render.js` | Draws the map on a canvas |
| `game/journey.js` | The turn: the day, legs, the travel and event dice, camp (`design/01-the-turn.md`) |
| `game/events.js` | Signs, Discoveries, Encounters, contact, disposition, choices, the chase, rewards (`design/02-encounters.md`, `design/04-the-map.md`) |
| `game/mastery.js` | Mastery's trial dice: tiers, the Die Progression Chart, Dominance and Impotence |
| `game/data/` | Game data. `encounters.js` and `creatures.js` are generated: never edit them. `party.js` holds the four starting characters from the audio roster. |
| `game/world.js` | Map generation, squares, movement cost, kinds of country, pathfinding (`design/04-the-map.md`) |
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
5. **Combat.** Mastery's combat on a tactical screen, with enemy AI. Until then, fights are resolved by a stand-in that is clearly labeled as one.

## Known gaps

- **Fights are a stand-in.** Choosing Fight, or being caught, wins the fight without harm and pays XP and spoils. Real combat is milestone 5.
- Leaving food doesn't cost rations yet, and conditions from Startle aren't carried into anything.
- Sites (lairs, caves, ruins, barrows) are marked on the map but can't be entered (milestone 4).
- Characters level up in name only; advancement is milestone 3.

## Known gaps in milestone 1

- River crossings cost 2 extra movement instead of the ford and swim procedure, which needs the party (milestone 3).
- Weather and Pushing the Pace trials are noted in the log, not rolled.
- Settlements are places on the map with nothing to do in them yet.
