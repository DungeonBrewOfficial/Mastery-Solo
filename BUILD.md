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
| `game/sites.js` | Sites: making one, its areas, traps, locks, obstacles, features, searching, the clock and the light, fights inside, the heart and its hoard (`design/05-sites.md`, `design/03-treasure.md`) |
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
3. **The party and town.** Characters with real Mastery stats, health, Durability, rations, kits, weather and Pushing the Pace trials, rest, settlements, buying and selling, recruiting. Built in stages.
   - *Stage 1, built: supplies on the road* (`game/supplies.js`, `game/town.js`, gear from Foundry's pack by `tools/build-gear.mjs`; Foundry's food, rest, trade, and weather rules vendored).
     - *Stores.* Each pregen sets out with an Adventurer's Pack bought from the party's coin; Corra's Healer's Kit opens into its kits and pocket set. Food, water, kits, and tools are kept for the party as a whole; clothing is worn by one character.
     - *Food and water.* Two meals a day, from what spoils first, healing as they're eaten. Dry rations need a cook and an iron pot and make a hot meal, which adds to the night's rest. The day's water comes from a river, a lake, or a settlement, or else the waterskins. Hunger and thirst build Exhausted that rest can't take, then collapse.
     - *The road.* Each morning's weather trial counts clothing and armor. Pushing the Pace is rolled at camp. A Forager brings in Poor meals, or healing herbs as Wound Kits.
     - *Rest, healing, repair.* Rest follows Foundry's rest rules. After a fight the Healer spends a Wound Kit per wounded character; Triage with a kit heals by the Healer discipline, and without one stabilizes as the Combat chapter has it. At camp the Healer treats Injuries with Injury Kits and the Smith repairs armor and shields with repair kits and a hammer.
     - *Settlements.* Inns charge for rooms and supper; at home a household takes the party in. The market sells what its dice turn up each day. Villages and larger have a healer for Injuries.
     - Gisla's Deathless keeps her alive through hunger, thirst, and weather, and a foe that can't finish her leaves her.
   - *Stage 2, built: advancement* (`game/advance.js`, class data from Foundry's pack by `tools/build-classes.mjs`). Levels come when the XP does, each with its attribute points and the class's weapon, spell, and skill mastery points; the class's health every third level; free skills (a Druid's Wilderness, a Thief's Stealth and Thievery, a Paladin's Theurgic Lore); titles; and the companion's tier, health, and resistance. A Level up page spends the points: attributes at their score's price (a new Endurance or casting tier adds its die to health or magan), and mastery points one per mastery per level, under the class's weapon cap, with the free combat-style point for martial classes. Spell DCs follow each form's mastery.
     Not yet: rerolling pool dice when a tier rises, discipline picks within a skill, Chantment and Theurgic Lore picks, maneuvers and guards past Untrained, the party classes' higher-level abilities, a Puca's second form, and an Agathion's passives.
   - *Stage 3, built: the town* (`game/town.js`, `game/health.js`).
     - *Traumas heal as the table words them:* days of rest (any day without travel counts), a Healer's set, reset, tending, or stopping the bleeding first with a Trauma Kit (Impotence without the right tools; a bone set badly leaves a limp or a bruise), daily tending to a count, or never. Open Wounds bleed 1 health an hour on the road. The camp Healer treats Traumas each evening and stops Open Wounds right after a fight. Gisla's Hard to Kill heals everything on its toll.
     - *Selling* finds a buyer of the piece's class on the market dice, once a day per piece, and draws on the settlement's coin, which refills a quarter a week. Pelts sell at their value, spare goods at half.
     - *Services.* A hired smith (8 sp a day, village and up) works the party's repair kits as a Skilled smith. The healer treats Injuries (8 sp) and Traumas (8 sp and the Trauma Kit). A day in a town or city is a Civilized Rest; a day in bed anywhere with lodging is Bed Rest; neither allows repairs. A hamlet's household gives a Good Night's Rest.
     - *Rumors.* With "listen for rumors" ticked, an evening at an inn is a Presence trial against the band's Even DC (Dominance at a roadhouse); a success marks a site some tiles away, and reaching it makes the Discovery.
     Not yet: holy sites and libraries as spell sources, which wait on learning spells.
   - *Stage 4, built: recruiting and the next generation* (`game/recruits.js`; arms from Foundry's weapon, armor, and shield packs by `tools/build-arms.mjs`).
     - *Characters of any class* roll up by the class's attribute dice, with the 3 starting points, health and magan as tier dice pools, the class's starting wealth, starting masteries at Untrained, gear bought from the purse, the class's companion (a Druid's Puca, a Cursed's Agathion), and the class abilities the game plays.
     - *Recruits* turn up each visit by settlement size, with the class roll (d6, then d12 or d7) and a level up to what the place offers (towns two below the party, cities one). Level 1 is free; above that, their XP in silver. A character can also be built of a chosen class anywhere there's a settlement. The party holds four.
     - *The next generation*: when the last hero falls, a new party of four (each class chosen or rolled) sets out from the home village; the map and what was found stay, and the fallen are remembered.
     - *Arms and armor* are sold at the market (weapons by price, armor by weight, shields), for the character they're for if the class allows. Old armor goes into the party's spares, which sell at half their value times their condition, or as 5% scrap when broken. Armor's resistance now adds the wearer's Agility at fight time (the tier for light armor, half for medium), so it follows advancement.
     Not yet: most classes' own abilities in play (only those the game already plays carry over), the Magus's familiar, the Cursed curses other than Possessed, ammunition, and choosing a character's dice and gear by hand.
   - *All the spells* come from Foundry's spell pack (`tools/build-spells.mjs`, 104 spells). 55 are playable: single-target damage, bursts (a 3 × 3 area, friend and foe alike), conditions on enemies (Earthbind and Ensnare hold like a grab, broken free against the spell's DC), buffs on allies, wards, contact-aura Shrouds, healing, and Cleanse. The other 49 are known by name with the reason they can't be cast yet: Charmed and the other missing conditions, Trauma restoration, divination, barriers and constructs, summoning, shapeshifting.
4. **Sites.** Lairs, caves, ruins, barrows: areas, contents, traps, the clock, the heart and its hoard. Clues and lost lore. Built in stages.
   - *Stage 1, built: exploring a site* (`game/sites.js`; Foundry's treasure, hoard, and coin rules vendored).
     - *Making a site.* The first time the party stands at a lair, cave, ruin, or barrow, it rolls its size and its guardian by type and band (a lair is whoever the encounter table put there). Deep country adds 2 areas and takes the guardian from the next band. A guardian above the party's band shows its signs at the entrance.
     - *Areas.* Going on into the dark draws the next area: d12 contents, d6 ways on. Empty areas, caches, remains (salvage, a purse, a clue to what's ahead or to a hidden place), and features by type (a lair's old kills, a cave's water, squeeze, and fungus, a ruin's unsound floor, chapel, and library, a barrow's grave goods that wake the dead, a lost place's writings, font, and inscription). Each area banks its exploration XP.
     - *Traps* by band, T2 to T5. The Scout's Perception trial (Dominance with Alertness) spots one, which can be stepped around or disabled; otherwise it springs on the Scout, with armor resistance, and a trial against the condition.
     - *Locks and obstacles* bar the way on. Breaching is Intelligence and Thievery, at Impotence without Thieves' Picks, with Breaching's table for a miss and Working Time for a success; forcing is a Strength trial at the Hard DC and rolls the clock. Obstacles take the trial that fits (a climb, a swim, a riddle, a collapse).
     - *Searching* an area takes a round: an Alertness trial at the Hard DC, then hidden treasure (5 XP) or a secret room (20 XP) on the d6.
     - *The clock and the light.* Each exploration round is 10 minutes, and six of them an hour of the day. Every third round burns a torch and rolls the clock; a 6 (or 5 after a fight) brings residents: the rest of the guardian's group, or vermin. Caves, ruins, barrows, and lost places are dark; with no torch the party can't go on. A rest inside is a Dungeon Rest with the clock in place of the night die.
     - *Fights.* Occupied areas hold part of the guardian's group; anything not fought joins the guardian in the heart. Fights use the battle grid as any encounter does, and pay the strongest creature's XP.
     - *The heart's hoard* is 40 sp a point of the guardian's XP (doubled in Deep country): 1d3, 1d4, or 1d6 notable pieces by band (gems by party level, jewelry, or art from Foundry's treasure rules), the rest in coin, and 20 XP banked. Treasure sells at its value through the town's buyers.
     Not yet: refilling cleared sites, following clues and lost lore, lost places on the map, conditions from traps outside a fight, harvesting parts, and the squeeze actually holding up heavy armor.
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
   - *Stage 3, built.* Magic, class abilities, and companions:
     - *Spells* (`game/data/spells.js`): declared at the top of the round, which draws the magan (or overcasts into Exhausted) and sets the phase by cost; released on the caster's turn for 1 AP. Lost to attacking or defending (unless recorded without gestures), to a failed Miscast trial on health loss, or to a turn that ends without it. Concentration keeps the newest spell in the free slot; passive spells break on damage. Flame Dart, Demoralize (held, retried for 1 AP when resisted), Stoneskin and Sacred Ward (durability pools through `resolveDamage`'s `wardPool`), Mend and Mend Flesh (this round's wounds, or older ones at ×3 with a miscast and coerced success). Gerberga's Polestar takes 1 off each prayer. Magan shows in the party list and recovers with rest.
     - *Gisla:* Hard to Kill, Possessed (sacred Impotence and Superiority, fire resistance by level), Demon Trigger and the Fire Aura.
     - *Gerberga:* Turn and Destroy Daeva (declared, once per encounter, minion heads one by one), Imbue (sacred or sky).
     - *Companions:* Tallow and Clabber fight beside their owners. Clabber has Gore, Trample, and Spell Conduit (Corra's touch spells through the boar); Tallow's Hellfire is declared, spends Gisla's magan, and burns everything in its cone.
     - *Phases* come from what's declared: the slowest of a spell, an ability, and a weapon attack. A caster can declare the attack too; without it they act in the spell's phase and can't attack with a slower weapon.
     - *Concentration* has the free slot, two paid slots (1 AP a round), and passive, placed at each round's declarations.
     Not yet: reaction casting, Charm Asura, and the Charmed and Concealed conditions, since no party ability uses them.

## Known gaps

- The autoplayer used by the tests doesn't cast spells, Turn, or Imbue, so the balance numbers in the sims leave magic out.
- The battlefield is open ground: no terrain, cover, or light yet.
- Traumas' mechanical effects (the penalties, the lost AP) aren't applied in play yet. Recruiting and the next generation are milestone 3's last stage.
- Encumbrance isn't counted, and companions don't eat, drink, or make weather trials.
- Leaving food doesn't cost rations yet.
- Sites have no measured map: a fight inside opens the usual open-ground battle grid, and darkness changes nothing in it yet.

## Known gaps in milestone 1

- River crossings cost 2 extra movement instead of the ford and swim procedure, which needs the party (milestone 3).
- Weather and Pushing the Pace trials are noted in the log, not rolled.
- Settlements are places on the map with nothing to do in them yet.
