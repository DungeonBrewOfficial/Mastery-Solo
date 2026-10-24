# The Map

*Draft 1, 2026-10-24. Tags as in the README. Every [N] stands until corrected.*

A dynasty's world is drawn as it's explored [Jon, 2026-10-24]. This file covers how: the first map, what a new stretch of country holds when the party walks into it, where roads, rivers, and settlements fall, and what the event die's **Discovery** result turns up. Everything is meant for pencil and graph paper. The Solo Game's map was six to nine taped sheets of 1/8-inch paper with about a hundred squares on a long edge [S]. At a mile and a half to the square, a single sheet is about 150 miles across, so a dynasty can grow to the size of the original.

---

## Questions for Jon

Each is marked **[?]** where it comes up.

1. **Tiles.** Country is generated a tile at a time, not a square at a time: a tile is 6 × 6 squares, about 9 miles across, and the whole tile is revealed when the party enters it. Square by square would mean 16 or more rolls a day.
2. **Region size.** A new tile keeps the terrain of the tile you came from on 2–8 on 2d6 (72%). That makes a typical forest a few tiles across, deep enough to get lost in. Bigger or smaller?
3. **Hills.** The original had plains, forest, swamp, desert, and mountains [S]. I've added hills, as the country between plains and mountains. Water (rivers and lakes) is a feature on top of terrain, not a terrain of its own.
4. **Deep country, redefined.** In place of the guessed 8 squares, a tile is Deep when neither it nor any of the eight tiles around it has a road or a settlement. On this map that's 6 to 12 squares from the nearest road. This would settle the open question in the turn file.
5. **Roads and settlements.** Roads run out on a 6 and fork on a 5, so the network keeps branching and fading toward the frontier. Settlements thin out past three tiles from home. Is that the right density, or should the world be emptier?
6. **Spell sources.** Discovery can turn up holy sites, fonts, and sacred sites, which is how your casters find spells [M, Magic Mastery, Spell Sources]. The rules have the GM name a source's forms; I've given that a roll.
7. **Rivers** can be forded or swum. The crossing rule is new.

---

## Tiles

The map is drawn in **tiles** of 6 × 6 squares [N, ?1]. Lightly mark the tile grid on your paper; at 1/8-inch squares, a tile is three-quarters of an inch.

When the party moves into a tile that hasn't been drawn, generate the whole tile before it moves on: its terrain, then any road or river coming in from the tile it entered from, then its features. Draw it in pencil. The tile you came from decides what the new one is likely to be, so country flows into country the way it does on a map someone drew on purpose.

The squares inside a tile are all its terrain, except for what its features put there: a road, a river, a lake, a settlement. You can draw the edges of a region ragged if you like. The map is yours.

---

## Starting a dynasty

1. **Home** is a village on a road [N]. Choose its terrain, or roll 2d6: 2–7 Plains, 8–10 Forest, 11–12 Hills. Put it at the center of a tile, near the middle of your paper.
2. **Roads.** 1d3 + 1 roads leave the village, toward different edges of its tile.
3. **The known lands.** Generate the eight tiles around home now, as if the party had walked into each from the home tile. Everything else is blank.

When strongholds exist, the dynasty's stronghold stands in or near the home tile [Jon, 2026-10-23].

---

## Terrain

When the party enters a blank tile, roll 2d6 for its terrain, using the tile it came from [N, ?2]:

- **2–8:** the same terrain.
- **9–12:** roll a d6 on the row for the terrain you came from.

| From | 1 | 2 | 3 | 4 | 5 | 6 |
|:---|:---|:---|:---|:---|:---|:---|
| **Plains** | Forest | Forest | Hills | Hills | Swamp | Desert |
| **Forest** | Plains | Plains | Plains | Hills | Swamp | Swamp |
| **Hills** | Plains | Plains | Forest | Mountains | Mountains | Desert |
| **Mountains** | Hills | Hills | Hills | Hills | Forest | Desert |
| **Swamp** | Forest | Forest | Plains | Plains | Plains | Forest |
| **Desert** | Plains | Plains | Plains | Hills | Hills | Mountains |

Mountains are only reached through hills, swamps sit in low country among plains and forest, and desert stays at the edges. [?3] Mastery's weather tables are for temperate lands and say deserts need their own [M, General Rules, Climate]; until they exist, treat desert as Hot every day in summer [N].

Movement costs are in `01-the-turn.md`: road and plains 1; forest, hills, and desert 2; swamp and mountains 3.

---

## Roads

A road that reaches the edge of a tile carries on into the next one. When you generate that tile, roll a d6 for the road [N, ?5]:

| d6 | The road |
|:---:|:---|
| 1–2 | Runs straight through, out the far side. |
| 3 | Bends, and leaves by the edge to the left. |
| 4 | Bends, and leaves by the edge to the right. |
| 5 | Forks: it leaves by the far side and by one other edge (left or right, even or odd). |
| 6 | Runs out in this tile. Past here, there's only a track or nothing. |

A road gives every square it crosses a movement cost of 1, and it has a bridge or ford wherever it crosses a river.

---

## Rivers and lakes

**A river** that reaches the edge of a tile carries on into the next one. Roll a d6: 1–3 it runs straight through; 4 it bends left; 5 it bends right; 6 it ends in this tile, in a lake or a swamp. Rivers don't flow into mountains or hills from lower country; if the roll would send one uphill, it bends instead.

**A lake** fills part of a tile: draw it 1d3 + 1 squares across. Lakes can't be crossed without a boat; go around.

**Crossing a river** without a road's bridge or ford [N, ?7]: the Navigator can look for a ford with a Wilderness (Orienteering) trial against 5, which costs an hour (one square of movement at Slow pace) whether it succeeds or not. Without a ford, each character swims it with an Athletics trial against 4 [M, Skill Mastery, Athletics]; on a failure, they get across but lose something they were carrying (the player's choice), and everyone who swims is wet [M, General Rules, Wet and Cold].

---

## Features

After terrain, roads, and rivers, roll 2d6 for the tile's features [N, ?5]:

| 2d6 | A tile with a road | A tile without one |
|:---:|:---|:---|
| 2–8 | Nothing more | Nothing more |
| 9 | A river rises here | A river rises here |
| 10 | Within three tiles of home, a settlement; farther out, a lake | A lake |
| 11 | A settlement | Nothing more |
| 12 | A settlement | A hamlet, at the end of a track that leads toward the nearest road |

**A river rises** in the tile's highest ground and leaves by an edge away from any hills or mountains.

**A settlement's size**: roll a d20. 1–6 a hamlet; 7–9 a roadhouse (on a road only; otherwise a hamlet); 10–16 a village; 17–19 a town; 20 a city. A town starts 1d2 new roads, and a city 1d3 + 1, toward edges the road doesn't already use. What a settlement offers is in `06-settlements.md`; its coin on hand is in `03-treasure.md`.

---

## Kinds of country

The map decides which kind of country each square is, as `01-the-turn.md` uses them:

- **Settled:** on a road, or within 2 squares of a settlement.
- **Wild:** everywhere else, except Deep country.
- **Deep:** a tile is Deep when neither it nor any of the eight tiles around it has a road or a settlement [N, ?4]. A party in the middle of a big forest, two tiles from the nearest road, is in Deep country. The farther the frontier gets from home, the more of it is Deep.

Decide whether a tile is Deep when it's generated, counting blank neighbors as having no road [N, from the dry run]. So the frontier starts out Deep, and a tile already drawn stays as it was even if a road turns up next to it later. Mark Deep tiles on the map, lightly; it's easy to forget.

---

## Discovery

When the event die comes up **Discovery**, roll a d12 [N]. Every place reached for the first time is worth New Location XP (10), banked until the party reaches safety [M, General Rules, Exploration Experience]. Mark it on the map: it stays for the rest of the dynasty.

| d12 | Discovery |
|:---:|:---|
| 1 | **A landmark.** A standing stone, a great tree, a waterfall, a lone peak. Seen from far off, and from now on the Navigator has Dominance on Orienteering trials within the tile. |
| 2 | **A cold camp.** Someone camped here. Roll the terrain's encounter table: that's who, and it counts as a Sign of them. They left something behind: a purse of their size [`03-treasure.md`, Purses]. |
| 3 | **Good ground.** Game and forage are plentiful here. A Hunter/Forager in this tile has Dominance [M, Skill Mastery, Wilderness]. It recovers between visits. |
| 4 | **A spell source.** See below. |
| 5 | **A lair.** The home of something from the terrain's encounter table: roll it. Its hoard is here, and it may be home. A site. |
| 6 | **A cave.** A site. |
| 7 | **A ruin.** A tower, a hall, a fort, a chapel, gone to ruin. A site. |
| 8 | **A barrow.** An old grave mound or tomb. The dead may be restless. A site. |
| 9 | **A homestead or hamlet** off any road, if the tile has no settlement. Otherwise, a ruin. |
| 10 | **A hidden place.** Roll again on 4–8: it's hidden. The Scout or Investigator must find it with an Alertness trial against the band's Hard DC (see `05-sites.md`, Default DCs); on a failure, it's only a Sign of something here, and the party can come back with time to search. Found, it's a Hidden Location (50 XP), and its hoard is a Hidden Hoard [M]. |
| 11 | **A lost place.** In Wild or Deep country only; in Settled country, a ruin. The ruin of something older than anyone remembers. A Lore (Ancient Lore) trial against the band's Hard DC tells what it was [M, Skill Mastery, Lore]. It's a Lost Location (75 XP), and a site. |
| 12 | **Roll twice** and take both. |

Sites (lairs, caves, ruins, barrows, and lost places), and what guards them, are in `05-sites.md`. Their hoards are drafted in `03-treasure.md`.

### Spell sources

Every caster learns spells at a source of their tradition [M, Magic Mastery, Spell Sources]. A Discovery of a spell source is the kind the terrain favors:

| Terrain | Source |
|:---|:---|
| Forest, Swamp | A **sacred site** (telluric): a grove, a faerie circle, a spring |
| Hills, Mountains | A **font** (priscan): a place where an old numen's power persists |
| Plains, Desert, or on a road | A **holy site** (theurgic): a shrine, a roadside cross, old holy ground |

Occult casters learn from writings, which are found in ruins and lost places, not out in the open. In the rules, the GM names the forms a source holds. Here, roll a d8 for its form; on an 8, the source holds two forms, so roll twice more and keep both [?6]:

| d8 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **Form** | Fire | Sea | Sky | Stone | Primal | Sacred | Void or Profane (even or odd) |

A source is a place worth coming back to: the caster learns there, and some traditions return to a source to encode what they learned [M].
