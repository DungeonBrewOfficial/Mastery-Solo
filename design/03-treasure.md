# Treasure

*Draft 1, 2026-10-24. Tags as in the README. Every [N] stands until corrected.*

This file covers where money comes from, how much, and how a party turns it into silver. The goal it's built to: **a character can afford full plate (46 gn, 3,680 sp) by about level 10**, while paying for repair kits, healing supplies, and lodging along the way [Jon, 2026-10-24]. Values are in silver pennies (sp), as in Mastery's Treasure chapter.

---

## Questions for Jon

Each is marked **[?]** where it comes up.

1. **Salvaged armor could break the economy.** Your armored folk wear real armor: a Captain's byrnie lists at 800 sp, a Veteran's brigandine at 1,280, a Warlord's scale mail at 1,120. One Band III free company carries a full plate's worth of armor. I've drafted secondhand armor and weapons to sell at **half value, times their condition** (current Durability over maximum), and they're heavy to haul. Is that enough, or should looted gear sell for less, or carry consequences (stolen arms are recognized)?
2. **The hoard multiplier.** A hoard is worth **40 sp per point of its guardian's XP value**. The number 40 comes from the wealth check at the end, which rests on guesses about how often a party finds a site and what an expedition costs. It's the main knob.
3. **Gem grades by band.** I've turned your "each grade covers about 7 levels, with overlap" into a d100 grade table for each band. The rare rolls keep a small chance of a better grade in every band, so a jackpot is always possible. Check the spread.
4. **Selling.** Does treasure sell at its full value? I've drafted it at full value, with the settlement's size limiting who can afford a big piece, using your Availability table in reverse.
5. **Purses** are drafted at the creature's Division in d6 silver. Small enough?

---

## Where money comes from

| Source | Where | Share of income [N] |
|:---|:---|:---|
| **Purses** | Folk you defeat | Small |
| **Pelts** | Beasts you defeat | Small to moderate, and heavy |
| **Salvage** | Arms and armor from defeated folk | Moderate, and heavy [?1] |
| **Hoards** | Sites: lairs, ruins, barrows, dungeons | Most of it [Jon, 2026-10-23] |

Overland fights pay for the trip. Sites pay for the plate.

---

## Hoards

**A hoard is worth 40 sp per point of its guardian's XP value** [N, ?2]. The guardian is the head of the strongest encounter that holds the site. Tying hoards to the XP table means wealth keeps pace with level without a separate curve, and the same steep climb that makes high-Division XP worth chasing makes their hoards worth chasing too.

| Guardian Division | XP | Hoard value | Deep country (×2) |
|:---:|:---:|:---:|:---:|
| D1 | 2 | 80 sp | 160 sp |
| D2 | 4 | 160 sp | 320 sp |
| D3 | 6 | 240 sp | 480 sp |
| D4 | 10 | 400 sp | 800 sp |
| D5 | 20 | 800 sp | 1,600 sp |
| D6 | 30 | 1,200 sp | 2,400 sp |
| D7 | 40 | 1,600 sp | 3,200 sp |
| D8 | 60 | 2,400 sp | 4,800 sp |
| D9 | 80 | 3,200 sp | 6,400 sp |
| D10 | 100 | 4,000 sp | 8,000 sp |
| D11 | 150 | 6,000 sp | 12,000 sp |
| D12 | 200 | 8,000 sp | 16,000 sp |
| D13 | 250 | 10,000 sp | 20,000 sp |

**Deep country doubles it** [N]. That's what "discoveries are richer" means in `01-the-turn.md`. Greed pays.

**Exploration XP** for the hoard itself comes from Mastery's table: Hoard 20, Hidden Hoard 25 [M, General Rules, Exploration Experience], banked until the party reaches safety.

### Filling a hoard on paper

Filling a hoard to an exact value by rolling gems one at a time is fine in Foundry, which does exactly that, but on paper it can take dozens of rolls. So a paper hoard is a floor of coin with a few rolled valuables on top [N]:

1. **Find the hoard's value** from the guardian's Division.
2. **Roll the notable pieces.** Band I: 1d3. Band II: 1d4. Band III: 1d6. Band IV and up: 2d4. For each piece, roll a d6: 1–4 a gem, 5 a piece of jewelry, 6 a piece of art [M, Treasure; each has its own procedure].
3. **Total the pieces.** If they come to less than the hoard's value, the rest is coin. If they come to more, keep everything: the hoard was richer than it looked.

The coin is heavy in bulk: 3,200 sp of silver takes the space of a Light object [M, Equipment, Encumbrance]. A big hoard has to be carried home, which is one more push-your-luck decision.

### Gem grade by band

Mastery's own grade roll (Ornamental 01–50, Common 51–80, Semi-Precious 81–95, Precious 96–00) is a world average. In solo play, each band rolls on its own row instead, so that each grade covers about seven levels with some overlap [Jon, 2026-10-24; N, ?3]:

| Party level | Ornamental (d20) | Common (d20) | Semi-Precious (d12) | Precious (d12) |
|:---|:---:|:---:|:---:|:---:|
| 1–5 | 01–80 | 81–98 | 99–00 | — |
| 6–8 | 01–45 | 46–90 | 91–99 | 00 |
| 9–12 | 01–15 | 16–70 | 71–97 | 98–00 |
| 13–18 | — | 01–40 | 41–90 | 91–00 |
| 19+ | — | 01–10 | 11–60 | 61–00 |

What a gem is worth varies enormously. A simulation of your tables (200,000 rolls each) gives:

| Grade | Typical (median) | Average | One in ten is worth at least | One in a hundred |
|:---|:---:|:---:|:---:|:---:|
| Ornamental | 2 sp | 24 sp | 40 sp | 440 sp |
| Common | 5 sp | 68 sp | 120 sp | 1,200 sp |
| Semi-Precious | 11 sp | 149 sp | 270 sp | 2,700 sp |
| Precious | 34 sp | 450 sp | 810 sp | 8,200 sp |

Most gems are pocket change and a few are fortunes. The coin floor keeps the curve on schedule; the gems keep the jackpot.

---

## Purses

Purses are small [Jon, 2026-10-24]. Folk carry about their Division in d6 silver [N, ?5]:

| Who | Purse |
|:---|:---|
| A minion group | 1d6 sp for a Cluster, 2d6 for a Brood, 3d6 for a Swarm |
| An Adept or better | (Division)d6 sp: a Bandit Cutthroat (D2) carries 2d6, a Warlord (D6) carries 6d6 |

For scale: a serf earns 1 sp a day, a laborer 2½ [M, Equipment, Wages by Social Class]. A bandit's purse is a few days' wages.

**Beasts** carry nothing but their hides.

---

## Pelts

Every beast in the Furs chapter leaves a pelt, priced by animal and quality [M, Treasure, Furs]. Roll the quality as for found pelts: 1d10, 1–3 Poor (×0.5), 4–9 Average, 10 Pristine (×3) [M].

Some woodland pelts at Average quality: wolf 10 sp, black bear 70, brown bear 120, cougar (the mountain lion) 120. A fresh pelt weighs about three times its dressed weight until it's cured [M, Pelt Reference], so a wolf pack's nine pelts are a load, and a brown bear's hide weighs 88 pounds. What to haul home is the party's choice.

---

## Salvage

Defeated folk leave their arms and armor. Looted armor keeps its current Durability and can be repaired up to its maximum [M, Monster Manual, Armored Health].

**Selling it** [N, ?1]: secondhand arms and armor sell for **half their listed value, times their condition** (current Durability over maximum). A Warlord's scale mail listed at 1,120 sp, found at 40% condition, sells for about 220 sp. Repaired first, it sells for 560.

Armor is heavy: worn, a brigandine counts 3 toward encumbrance, and carried, 5 [M, Equipment, Medium Armor]. Three suits from a free company is a wagon's work.

---

## Selling

Treasure sells at its value [N, ?4]. A small settlement may not have anyone who can pay for a large piece. Use the Availability table in reverse: give the piece a Social Class by its value, and roll the settlement's dice against that class's DC to find a buyer [M, Equipment, Availability]:

| Value | Buyer's class | DC |
|:---|:---|:---:|
| Up to 60 sp | Peasant | 4 |
| Up to 600 sp | Knight | 8 |
| Up to 2,400 sp | Burgher | 10 |
| Up to 12,000 sp | Magnate | 14 |
| Up to 60,000 sp | Noble | 18 |
| More | Royal | 21 |

A hamlet (2d4) can't buy a 700 sp brooch at all. A town (2d8) finds a buyer about four times in ten. Carrying a fortune to the city is a journey in itself.

---

## The wealth check

Whether 40 sp per XP point hits the plate target depends on guesses that play will correct. These are mine [N]:

- About 13 fights per level, from the XP check in the decisions log.
- One site for every five fights.
- A typical guardian's XP of 8 at levels 1–2, 15 at levels 3–5, 30 at levels 6–8, and 50 at levels 9–10.
- Purses, pelts, and salvage of about 15 sp a fight at levels 1–2, 25 at levels 3–5, and 40 after.
- Upkeep for a party of four of about 350 sp an expedition through level 5, and 500 after, at about 1.5 expeditions a level. That covers rations, wound and injury kits (4 and 12 sp each), repair kits (24 sp each, restoring about 16 Durability apiece for an Untrained smith), the odd trauma kit (36 sp), and nights at an inn.

On those numbers, each character saves (after upkeep) about:

| Levels | Saved per level, per character | Running total by the end of the band |
|:---|:---:|:---:|
| 1–2 | 125 sp | 250 sp |
| 3–5 | 340 sp | 1,270 sp |
| 6–8 | 720 sp | 3,430 sp |
| 9 | 1,240 sp | 4,670 sp |

That reaches 3,680 sp for plate during level 9, with about a thousand left for everything else, before counting starting wealth or the swing from gems. Casters spend theirs on grimoires, scribe supplies, and spell sources instead; the totals are what matter.

If play shows parties finding sites more or less often than one in five fights, the multiplier is the thing to move.
