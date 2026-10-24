# What the simulation found (2026-10-24)

Twelve dynasties, a year each, under two strategies (`simulation-bold.md`, `simulation-cautious.md`; `tools/simulate.mjs` makes both). The autoplayer is plain: it fights with weapons and its casters' dearest harmful spell, uses no maneuvers or guards past Untrained, and spends level-up points the way recruits do. So what follows is the rules under a simple player, not a skilled one.

## The curve

Level 2 comes on day 6 and level 3 by day 15–17. Then it stops. The average level after a year is 2.7 (bold) or 2.3 (cautious); level 5 came in 3 of 12 dynasties, level 6 in none. Each dynasty went through 4 to 5 generations and lost 17 to 21 characters a year.

## Why it stops: Band II at level 3

Band II starts at party level 3, and its groups kill parties at that level. Deaths per fight, at an average party level of about 3:

| Foe (Band II) | Deaths per fight |
|:---|:-:|
| Orc War Chief and four Raiders | 2.0–2.4 |
| Wolf pack (Beta) | 0.5 |
| Captain | 0.5 |
| Bandit Leader's band | 0.5–0.7 |

For comparison, the Band I Bandit Leader's band kills about 0.2 a fight at level 1.6. A level-3 party hasn't much more than a level-1 party yet, because the picks levels buy (disciplines, maneuvers, guards, class abilities past the pregens') aren't built. So part of this wall is the hollow middle of advancement, which is the next milestone, and part may be the band boundary itself. The next run, after advancement, will tell which.

**Caution doesn't help.** The cautious strategy (fighting only up to Division = level + 1) died more, not less: fights come anyway, from ambushes, site guardians, and the clock.

## XP

About 70% of XP comes from exploration (areas, hoards, locations, banked and brought home), 30% from fights.

## Treasure

Treasure piles up unsold: 10,000 to 19,000 sp held at the year's end. Most pieces need a Knight or Magnate buyer, and hamlets and villages rarely roll one. The coin floor of each hoard keeps cash flowing; the notable pieces mostly sit in packs.

## Leads

About 12 clues a dynasty a year, 1 hidden place found, no fragments of lost lore, no lost places. Lost places are out of reach in a year.

## Problems found and fixed in the game

- A hidden place found on a square that already held a landmark tried to build a "landmark" site and crashed. It now goes on the nearest free square.
- A Sign or the White Hart with everyone unconscious crashed. Now no one follows.
- Breaking away with no one able to run (only the lame and companions on their feet) failed every round, forever. The button is now disabled with the reason, and the break-away screen shows the best possible roll against the DC, saying so when it can't succeed.
- A toll the party can't pay was still a button. It's disabled now, with what's in the purse.
- Stalemates: a fighter who can't beat a swarm's defense, and a swarm that can't beat his, fought for thousands of rounds. Placeholder: after 10 rounds with no health or Durability lost by anyone, both sides give it up (no XP).

## For Jon

- **Vermin farming.** The clock brings "vermin of the band" when a site's group is gone, without limit, so a party can sit in a cleared site and grind 2 XP fights.
- **A lone Hard to Kill hero with no coin stalls the dynasty.** Gisla, alone and broke, lay starving in a village for 72 days: Deathless won't let her die, she can't buy food, and no recruits come while she stays. The generation never ends.
- **Injuries and magical healing.** "Treating an Injury requires a healer's Injury Kit (Exploration Round) or magical healing" (`combat_revised.md:265`). How much magical healing treats one Injury isn't said; the game's healing spells don't treat any yet.
- **Thirst** still killed 8 characters in the bold runs: one waterskin each is a day's water, and two dry days kill.
