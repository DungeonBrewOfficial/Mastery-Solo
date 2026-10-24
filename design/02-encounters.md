# Encounters

*Draft 1, 2026-10-24. Tags as in the README. Every [N] stands until corrected.*

This file covers what happens when the event die (see `01-the-turn.md`) comes up Sign or Encounter: what you meet, who sees whom first, what the creature wants, how you get away, and when the creature gives up. The woodland tables are at the end, built from the creatures in Mastery's bestiary as of today.

---

## Questions for Jon

Flagged here so they're easy to find. Each one is marked **[?]** where it comes up below.

1. **Party level for a mixed roster.** After a death, a level 1 recruit can join level 5 veterans. Which level picks the band: the highest, the average, or the lowest? I've drafted it as the **average, rounded down**.
2. **Apex creatures.** I've treated every Epic and Legendary as an apex that always arrives as a Sign first, whatever its Tier, along with anything from a Tier above the party's band. Is that the right line?
3. **Entourage sizes are guesses.** I don't know what a fair fight for four characters looks like in Mastery yet. Is a Bandit Leader with two Cutthroats and a Cluster of six Thugs a fair Band I fight, or a massacre?
4. **Breaking point.** Mastery has no morale rule; creatures stop according to their Motivation. I've written fixed breaking points by temper (the head falls, half the group is down, a lone creature is at half health). The alternative is a B/X-style morale roll, which the red box had. Which?
5. **The chase.** Escape is a race: three successes before two failures. A faster pursuer gives the party Impotence. Too harsh, too soft, or the wrong shape?
6. **The Eidolon of the Hunt** can't be outrun by design: running is what it punishes. Does that break "room to escape," or does it pass because its signs and its stat block both tell you to stand your ground?
7. **Hunting.** Does bringing down a deer or an elk pay combat XP?
8. **Purses.** Folk carry coin. How much, by Division, belongs with the treasure-by-Division table for sites. Should both be built together?
9. **Bestiary gaps** for your monster work are listed at the end.

---

## Bands

The encounter tables are divided into **bands** by party level [N], using your Tier guess [Jon, 2026-10-24]:

| Band | Party level | Tiers in band | Tiers above band |
|:---:|:---|:---|:---|
| I | 1–2 | 1 | 2 and up |
| II | 3–5 | 2, and 3 from level 4 | 3 at level 3; 4 and up |
| III | 6–8 | 3, and 4 from level 7 | 4 at level 6; 5 and up |
| IV+ | 9 and up | waiting on creatures | |

**Party level** is the average of the characters' levels, rounded down [N, ?1].

**Above band.** A creature is above the party's band if its Tier serves only levels higher than the party's. Every Epic and Legendary is also treated as above band, whatever its Tier [N, ?2]. Above-band creatures follow the rule in the turn: the result becomes a **Sign**, unless the party is already following that creature's signs or is inside its lair. If the party does meet it, contact begins at **Far**, with the party aware.

Each table has a row for the apex creatures of that terrain. They are the "dragons" [S]: real, rare, announced, and avoidable.

## Reading a table entry

Each entry is an encounter: a **head** and its **entourage** [N]. The head sets the XP; each character receives it in full when the fight ends [Jon, 2026-10-23, 2026-10-24]. The entourage adds danger and no XP. A minion group is worth its Division [Jon, 2026-10-23].

Each entry also has a **temper**, which picks the row you roll on for disposition. Most creatures' temper follows from what they are, and a few creatures follow the Behavior written in their stat block instead.

---

## Contact

Before anything else, settle who notices whom [N, built on M].

**Does the party notice it?** The Scout, if one is ranging ahead, or else the Watchman rolls a Perception trial against the head's Division + 1 [M, General Rules, Traveling Roles; Monster Manual, Creature Skills and Ambushes]. A character whose Alertness (Danger Sense) is at least the creature's Stealth has Dominance [M]. The floor of a dense wood is ambient light, so creatures there are Concealed (Tier 1) [M, General Rules, Light and Visibility].

**Does it notice the party?** The head rolls its trial dice (rank die + Perception tier die) against **4** if the party is traveling normally [N]. A party moving at Slow pace can choose to move quietly instead, and then the DC is the leader's Stealth Mastery DC, as a group trial with one Helper [M, General Rules, Group Trials].

| Party noticed it | It noticed the party | Result |
|:---:|:---:|:---|
| Yes | Yes | **Far.** Both sides are aware. Roll disposition; then the party chooses. |
| Yes | No | **The party has the choice.** Withdraw unseen (automatic), watch it (Lore trials to identify it, free), approach to parley, or lay an ambush [M, Combat, Ambush]. |
| No | Yes | **It acts first.** Roll disposition. If it attacks, it ambushes: the DC is its Division + 1 [M], or the value in its Ambusher trait [M]. The party makes Startle trials; a Watchman's warning spares Active roles the −4 [M]. |
| No | No | **Near.** You walk into each other. Both sides make Startle trials at DC 6 [M, Combat, Startle]. Then roll disposition. |

**Distances** [N]: **Far** is more than 60 feet, out of reach for a round or more. **Near** is 30 to 60 feet. **Close** is within 30 feet, which is where ambushes start.

**Above-band creatures** always begin at Far with the party aware. The party gets its choice before the creature acts.

---

## Disposition

Every creature wants something, and violence follows from that [M, Monster Manual, Motivation]. Roll a d6 on the row for the encounter's temper [N]:

| Temper | d6 |
|:---|:---|
| **Predator** | **1–2 Fed.** It watches, keeps its distance, and leaves if you don't come closer. **3–4 Testing.** It stalks you, and strikes only a lone, wounded, or sleeping target. **5–6 Hungry.** It attacks. |
| **Territorial** | **1–3 Warning.** It makes a display. Leave the square and it lets you go. **4–5 Defending.** It attacks if you approach or stay. **6 Enraged.** It attacks now. |
| **Raider** | **1–2 Toll.** They demand payment, and fight if refused. **3–4 Lying in wait.** If they noticed you first, they've set an ambush ahead; if you noticed them first, you've spotted it. **5–6 Attack.** |
| **Prey** | **Any roll: it flees** on contact. Taking it is a hunt, made with Wilderness (Hunting and Foraging) [M]. |
| **Restless dead** | **No roll.** It attacks anything living that comes into its ground, never breaks, and doesn't pursue beyond its ground. |
| **Guardian** | **No roll.** It is hostile only to trespass or harm (for a Treow, axes and fire), and never pursues beyond its place. |
| **Strange** | **No roll.** Follow the Behavior in its stat block [M]. The Morphon courts are written there already. |

---

## The choice

With contact and disposition settled, the party chooses [N]:

- **Avoid.** If it hasn't noticed you, or its disposition isn't to attack, you leave. No roll.
- **Parley.** Talk, pay the toll, or bargain, with Presence trials where needed [M, Skill Mastery, Presence]. Beasts can't parley, but they can be paid (see below).
- **Fight.** Mastery combat as written [M]. XP is the head's value, to each character in full, at the end of the fight [Jon, 2026-10-24].
- **Flee.** See Escape.

---

## Breaking point

The red box had morale [S, via the reconstruction record, §4]. Mastery has Motivation instead: a creature fights for what it wants and stops when the price gets too high [M]. Solo play needs that stopping point written down [N, ?4]:

- **A group breaks** when its head falls, or when half its number is down.
- **A lone creature breaks** at half its health.
- **Enraged** creatures and **Guardians** break only at a quarter of their health. **Restless dead** never break.

A broken creature flees and doesn't pursue. A broken group scatters, and their XP is still earned: the fight is over, and the party holds the field.

---

## Escape

Mastery has a reprisal attack for leaving reach, but no procedure for getting away [M]. And most beasts outrun people: a wolf has Speed 10, a mountain lion 10, a boar 9, against a human's 5. Bandits run at 5 or 6, and the dead at 4 or 5. Escape can't rely on speed alone, so it comes in three forms [N].

**Withdraw before the fight.** At Far contact, if the creature isn't attacking, the party leaves. No roll.

**Pay the price.** A creature that wants something stops when it gets it. A hungry predator takes food instead of you: a fresh carcass, or a day's rations for each creature hunting. Raiders take the purse. A territorial creature takes the square. A price can be paid at any point, including mid-fight, and it ends the encounter. The creature's head still pays no XP, because you didn't defeat it.

**The chase** [?5]. When you run from a pursuer that wants to catch you:

1. The party's leader makes a group trial each exchange, with one Helper [M, Group Trials]. Choose the skill to fit how you run: Wilderness (Orienteering) to lose it in the terrain, Stealth to hide, or Athletics to outpace it. The DC is the pursuer's Division + 1 [M, Creature Skills].
2. If the pursuer's Speed is higher than the slowest character's, the trial has Impotence. If it's lower, Dominance.
3. Three successes before two failures, and you're away. Two failures first, and it catches you. Combat begins at Close, and the party isn't Startled; they know it's coming.
4. Dropping something it wants (see Pay the price) ends the chase.

Some creatures make running a mistake. The Eidolon of the Hunt gains Superiority against anything that moved [M, Creatures - Morphon]. The chase fails against it automatically, and its signs say so to anyone who reads them [?6].

---

## Spoils

What the defeated carried [N]:

- **Beasts** leave their pelts, by animal, quality, and weight [M, Treasure, Furs]. A fresh pelt weighs about three times its dressed weight until it's cured, and it has to be hauled home [M, Treasure, Pelt Reference].
- **Folk** carry purses and gear. Their armor keeps its current Durability and can be repaired [M, Monster Manual, Armored Health]. How much coin a purse holds waits on the treasure-by-Division table [?8].
- **Hoards** are found only in sites [Jon, 2026-10-23].

---

## Woodland

Roll 2d6 on the table for the party's band. Results marked **Sign first** are above band. The temper is in brackets. XP is per character, from the head.

### Band I (levels 1–2)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | Skeleton Warrior with a Cluster of Skeletons, near a barrow [Restless dead]. The barrow is a site. | 4 |
| 3 | In the weeks around midwinter, 1d3 + 1 Kallikantzaroi [Raider]. Otherwise, a Zombie [Restless dead]. | 4 |
| 4 | A Viper [Territorial] | 4 |
| 5 | A Wolf Spider with a Cluster of Spider Swarm. The spider is an Ambusher [Predator]. | 4 |
| 6 | 1d2 + 1 Wild Dogs [Predator] | 4 |
| 7 | 1d4 Deer [Prey] | 4 [?7] |
| 8 | Two Bandit Cutthroats with a Cluster of Bandit Thugs [Raider] | 4 |
| 9 | A Bandit Leader with two Cutthroats and a Cluster of Thugs [Raider] [?3] | 6 |
| 10 | Two Large Hunting Dogs, run off from some lord's hunt [Predator] | 10 |
| 11 | **Sign first:** a Boar [Territorial] | 6 |
| 12 | **Sign first:** a Wolf Beta with two Gammas and a Cluster of Runts [Predator] | 10 |

### Band II (levels 3–5)

At party level 3, Tier 3 results (the Black Bear) are above band and arrive as Signs first.

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | **Strange:** d6, 1–3 a Magpie, who wants to trade and talk. 4–6 an Eidolon of the Hunt, at dusk or in fog only; otherwise, Sign. | 30 / 20 |
| 3 | 1d2 + 1 Redcaps [Raider], near a ruin only. Otherwise, a Sign that leads to the ruin. | 6 |
| 4 | A Mountain Lion, an Ambusher [Predator] | 6 |
| 5 | 1d2 Boars [Territorial] | 6 |
| 6 | A Wolf Beta with two Gammas and a Cluster of Runts [Predator] | 10 |
| 7 | An Elk bull with 1d4 cows. In autumn the bull is [Territorial]; otherwise all are [Prey]. | 6 |
| 8 | A Ranger Captain with two Woodsmen: foresters [Raider, the toll being questions and a fine for poaching] or outlaws [Raider], even or odd on a d6 | 10 |
| 9 | Three Orc Raiders [Raider] | 6 |
| 10 | d6: 1–3 a Black Bear [Territorial]. 4–6 a Treow [Guardian]. | 10 / 20 |
| 11 | d6: 1–3 a Wolf Alpha with a Sigma, a Beta, two Gammas, and a Brood of Runts [Predator]. 4–6 an Orc War Chief with four Raiders [Raider]. | 30 |
| 12 | **Apex, Sign first:** d6, 1–2 a Dire Wolf; 3–4 a Dryad's grove (the grove is a site); 5 a Cave Bear; 6 the Amarok | 40–60 |

### Band III (levels 6–8)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | **Strange:** a Shadow-Man's court, at night or in the deepest wood: the Shadow-Man, an Eidolon of the Hunt, and a Brood of Ophiuchus [Strange; the court is written in Creatures - Morphon]. Otherwise, Sign. | 40 |
| 3 | A Revenant Soldier with a Cluster of Skeletons [Restless dead] | 20 |
| 4 | 1d3 Aurochs [Territorial] | 10 |
| 5 | A Brown Bear [Territorial] | 30 |
| 6 | A Wolf Alpha's pack, as Band II's 11 [Predator] | 30 |
| 7 | An Orc War Chief with four Raiders [Raider] | 30 |
| 8 | An Ogre [Raider] | 30 |
| 9 | A Warlord with two Veterans and a Brood of Footsoldiers: a free company in the woods [Raider] | 30 |
| 10 | Two Treow [Guardian] | 20 |
| 11 | A Revenant Knight with two Revenant Soldiers, at a barrow [Restless dead]. The barrow is a site. | 40 |
| 12 | **Apex, Sign first:** d6, 1–2 a Cave Bear; 3–4 an Ettin; 5 the Erymanthian Boar; 6 Otso | 60–100 |

---

## What the tables show

Filling these from today's bestiary turned up gaps you may want for your monster work [?9]:

- **Band I woodland is thin at the top.** At Tier 1 the only Leader is the Bandit Leader, and the only Champions are trained dogs and horses. A wild Tier 1 woodland head is missing.
- **Band III leans on Tier 2 creatures in bigger groups.** Woodland Tier 3 has bears, aurochs, the Ogre, and the undead, and little else.
- **Band IV and up can't be built yet.** Woodland has only two Tier 4 creatures, the Giant Short-Faced Bear and Otso, both apex.
- **No dragons.** The Dragon tag exists, and so does Dragon Lore, but no stat block does yet. The apex rows use Legendaries in the meantime.
- **Plains, swamp, desert, and mountains** each need the same pass. Swamp and desert look thinnest: the crocodile is the only swamp creature so far.
