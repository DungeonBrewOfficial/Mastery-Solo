# Building Mastery Solo

How the game is put together, what's built, and what's next. Read this before writing code; keep it current after.

## Running it

It's a static site with no build step. Serve the repository root and open it in a browser:

```bash
npm run serve        # python3 -m http.server 8000, then open http://localhost:8000
npm test             # rules and generator tests (Node 22)
npm run sync         # copy Mastery's rules modules from ../Mastery-Foundry
```

The game saves itself in the browser (localStorage) after every action. **New dynasty** starts over, optionally from a seed.

## How it's organized

| Path | What it is |
|:---|:---|
| `index.html`, `game/style.css` | The page |
| `game/main.js` | Wires the page to the game state; input; saving |
| `game/render.js` | Draws the map on a canvas |
| `game/journey.js` | The turn: the day, legs, the travel and event dice, camp (`design/01-the-turn.md`) |
| `game/world.js` | Map generation, squares, movement cost, kinds of country, pathfinding (`design/04-the-map.md`) |
| `game/rng.js` | Seeded dice. Every roll goes through it, and its state is saved, so a dynasty can be replayed |
| `game/vendor/foundry/` | Mastery's pure rules modules, copied from the Foundry system by `tools/sync-foundry.mjs`. **Never edit these here.** Change them in the Foundry repo and sync. |
| `design/` | The rules the game implements. Code cites the design file it follows. |
| `tests/` | `node --test` |

**Conventions.** Game state is one plain object saved as JSON. Rules functions take the state and the dice and change the state; the page only draws it. Anything the rules don't cover yet is marked `TODO(area)` in code and logged in purple in the game, so gaps are visible while playing.

## Milestones

1. **The world and travel.** *Built.* Dynasty start, tile generation (terrain, roads, rivers, lakes, settlements, Deep country), the 2D map, choosing a destination, legs with the travel die and carried-over movement, nightfall choice, the event die by kind of country, daily weather from Mastery's tables, camp.
2. **Events.** Signs, Discoveries, and Encounters: the terrain tables, contact, disposition, the party's choice (avoid, parley, pay, fight, flee), reading and following signs.
3. **The party and town.** Characters with real Mastery stats, health, Durability, rations, kits, weather and Pushing the Pace trials, rest, settlements, buying and selling, recruiting.
4. **Sites.** Lairs, caves, ruins, barrows: areas, contents, traps, the clock, the heart and its hoard. Clues and lost lore.
5. **Combat.** Mastery's combat on a tactical screen, with enemy AI. Until then, fights are resolved by a stand-in that is clearly labeled as one.

## Known gaps in milestone 1

- River crossings cost 2 extra movement instead of the ford and swim procedure, which needs the party (milestone 3).
- Weather and Pushing the Pace trials are noted in the log, not rolled.
- Settlements are places on the map with nothing to do in them yet.
