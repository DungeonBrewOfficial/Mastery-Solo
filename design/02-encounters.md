# Encounters

*Draft 2, 2026-10-24. Tags as in the README. Every [N] stands until corrected.*

This file covers what happens when the event die (see `01-the-turn.md`) comes up Sign or Encounter: what you meet, who sees whom first, what the creature wants, how you get away, and when the creature gives up. The woodland tables are at the end, built from the creatures in Mastery's bestiary as of today.

---

## Questions for Jon

Flagged here so they're easy to find. Each is marked **[?]** where it comes up below. Settled questions move to `DECISIONS.md`.

1. **Epic and Legendary creatures retreat to their lairs** at half health. You called this game-y. The case for it is under Breaking point; the alternative is that they fight on or flee for good.
2. **The chase** stands as drafted until it's tested.
3. **Deep country.** Your "punishment is going where you shouldn't" is now a rule in `01-the-turn.md`: the farther from roads and settlements, the harder the encounters and the better the finds. Deep is now defined by tiles in `04-the-map.md`.
4. **The other five terrains (drafted 2026-10-24).** Plains, hills, mountains, swamp, and desert now have tables, built from the current bestiary. Swamp and desert are thin. They also add a **Patrol** temper, for guards and a lord's riders, who question the party and let it pass unless it gives them cause.

---

## Bands

The encounter tables are divided into **bands** by party level [N], using your Tier guess [Jon, 2026-10-24]:

| Band | Party level | Tiers in band | Tiers above band |
|:---:|:---|:---|:---|
| I | 1–2 | 1 | 2 and up |
| II | 3–5 | 2, and 3 from level 4 | 3 at level 3; 4 and up |
| III | 6–8 | 3, and 4 from level 7 | 4 at level 6; 5 and up |
| IV+ | 9 and up | waiting on creatures | |

**Party level** is the average of the characters' levels, rounded down [Jon, 2026-10-24].

**Above band.** A creature is above the party's band if its Tier serves only levels higher than the party's. Every Epic and Legendary is also treated as above band, whatever its Tier [Jon, 2026-10-24]. Above-band creatures follow the rule in the turn: the result becomes a **Sign**, unless the party is already following that creature's signs or is inside its lair. If the party does meet it, contact begins at **Far**, with the party aware.

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
| **Raider** | **1–2 Toll.** They demand payment, and fight if refused. The toll is the head's XP value × 5 sp for each character [N, from the dry run]. **3–4 Lying in wait.** If they noticed you first, they've set an ambush ahead; if you noticed them first, you've spotted it. **5–6 Attack.** |
| **Prey** | **Any roll: it flees** on contact. Taking it is a hunt, abstracted under Wilderness (Hunting and Foraging) [M], and pays no XP [Jon, 2026-10-24]. |
| **Restless dead** | **No roll.** It attacks anything living that comes into its ground, never breaks, and doesn't pursue beyond its ground. |
| **Guardian** | **No roll.** It is hostile only to trespass or harm (for a Treow, axes and fire), and never pursues beyond its place. |
| **Patrol** | **No roll.** Guards, a lord's riders, a merchant's hired men. They question the party and let it pass. Trouble comes only if the party starts it, or carries something it shouldn't: a poached deer, a dead man's livery, a lord's soldiers' armor [N]. |
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

The red box had morale [S, via the reconstruction record, §4]. Mastery has the condition for it already: **Demoralized**, resisted with Wisdom, whose third tier, Panicked, makes a creature flee "by the safest available route" [M, Conditions]. Morale in solo play is the Demoralized ladder [Jon, 2026-10-24]. Soldiers flee battles; their Wisdom of 4 stays as written.

**Heads hold the group** [Jon, 2026-10-24]. While a Leader or Master stands, its group makes no morale trials. (Mastery's Leaders can also rally: the Leader Buff's Inspired counters Demoralized tier for tier [M, Monster Manual, Leaders; Conditions], which undoes fear the party causes with War Cry and the like.)

**Morale trials** [N]. Each creature makes a Wisdom trial with its trial dice [M, Monster Manual, Trials] against DC 5 [Jon, for now, 2026-10-24]:

- when its Leader or Master falls, and
- each time another creature on its side falls, once no Leader or Master is standing.

On a failure, advance Demoralized by 1 tier. On a failure by 3 or more, advance it by 2. A creature that reaches Tier 3 (Panicked) flees.

**Numbers matter** [N]. Compare the creatures still standing with the characters still standing. A side that outnumbers the party rolls with Dominance; a side the party outnumbers rolls with Impotence; an even count rolls as normal.

**The fear lasts.** Demoralized persists while its source is in sight [M, Conditions], and the source is the party, so in a fight it doesn't fade. Each tier also makes the creature worse at fighting before it ever runs: Shaken has Inferiority on attacks, and Frightened on attacks and defense [M]. The rout is gradual: a group comes apart over several deaths instead of all at once.

**It stacks with the party's own fear.** Death Knell and War Cry (Presence, Intimidation), the Fili's Song of Shame, and other abilities that advance Demoralized add their tiers to the morale ladder [M, Conditions, Stacking]. A party with an intimidator routs enemies faster, which those abilities now earn in solo play.

**Exceptions.** A lone creature makes a morale trial at half its health and again at a quarter. **Restless dead** make none. **Guardians** make none until a quarter of their health, and never leave their place. Creatures immune to Demoralized are immune to morale.

**Paper shortcut.** Identical creatures in the same group can share one roll and one Demoralized track. A minion group is a single creature in Mastery and always has one track [M, Monster Manual, Minions].

**Ending the fight.** A creature that flees out of sight is gone for the rest of the encounter [N]. When every enemy left has fled, the fight is over, the party holds the field, and the head's XP is earned.

### Example

Six Warriors and a Captain meet four characters. The Captain falls in the second round. Each Warrior makes a morale trial with Dominance, since six outnumber four: d4 + d3 against 5, a coin flip. About half come out Shaken. Each Warrior that falls after that sets off another round of trials. Once three Warriors are down, the last three are outnumbered and roll with Impotence, which they can barely pass (d2 + d3 makes 5 one time in six). The survivors climb to Panicked and run within a death or two. If the party has lost two characters by then, it's three Warriors against two, and they keep their Dominance and probably fight on.

**Epic and Legendary creatures go home** [N, ?1]. At half health, an apex creature breaks off and retreats to its lair, and heals there over days. The lair becomes a site the party can find by following its signs. You called this game-y, and it can be. Here's the case for it anyway. Your Dryad already works this way: beaten in a fight, she reforms at her tree, and ending her for good means going to the tree [M, Creatures - Fae]. A wounded bear going back to its den is ordinary animal behavior. And it turns the apex fight into exactly the decision you want the game to be about: you've hurt the dragon, and now you can go home and brag, or follow it into the dark while it's weak, which is the greedy choice and the dangerous one. The alternative is simpler: apex creatures fight to the death or flee for good, like anything else.

---

## Escape

Mastery has a reprisal attack for leaving reach, but no procedure for getting away [M]. And most beasts outrun people: a wolf has Speed 10, a mountain lion 10, a boar 9, against a human's 5. Bandits run at 5 or 6, and the dead at 4 or 5. Escape can't rely on speed alone, so it comes in three forms [N].

**Withdraw before the fight.** At Far contact, if the creature isn't attacking, the party leaves. No roll.

**Pay the price.** A creature that wants something stops when it gets it. A hungry predator takes food instead of you: a fresh carcass, or a day's rations for each creature hunting. Raiders take the purse. A territorial creature takes the square. A price can be paid at any point, including mid-fight, and it ends the encounter. The creature's head still pays no XP, because you didn't defeat it.

**The chase** [N, ?2]. When you run from a pursuer that wants to catch you:

1. The party's leader makes a group trial each exchange, with one Helper [M, Group Trials]. Choose the skill to fit how you run: Wilderness (Orienteering) to lose it in the terrain, Stealth to hide, or Athletics to outpace it. The DC is the pursuer's Division + 1 [M, Creature Skills].
2. If the pursuer's Speed is higher than the slowest character's, the trial has Impotence. If it's lower, Dominance.
3. Three successes before two failures, and you're away. Two failures first, and it catches you. Combat begins at Close, and the party isn't Startled; they know it's coming.
4. Dropping something it wants (see Pay the price) ends the chase.

Some creatures make running a mistake. The Eidolon of the Hunt gains Superiority against anything that moved [M, Creatures - Morphon]. The chase fails against it automatically, and its signs say so to anyone who reads them. That stands as written [Jon, 2026-10-24].

---

## Spoils

What the defeated carried [N]:

- **Beasts** leave their pelts, by animal, quality, and weight [M, Treasure, Furs]. A fresh pelt weighs about three times its dressed weight until it's cured, and it has to be hauled home [M, Treasure, Pelt Reference].
- **Folk** carry purses and gear. Their armor keeps its current Durability and can be repaired [M, Monster Manual, Armored Health]. Purses are small [Jon, 2026-10-24]. How much they hold is set with the treasure-by-Division table for sites.
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
| 7 | 1d4 Deer [Prey]. A hunt, not a fight. | — |
| 8 | Two Bandit Cutthroats with a Cluster of Bandit Thugs [Raider] | 4 |
| 9 | A Bandit Leader with two Cutthroats and a Cluster of Thugs [Raider] | 6 |
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
| 7 | An Elk bull with 1d4 cows. In autumn the bull is [Territorial] and a fight with him pays XP; otherwise all are [Prey], a hunt. | 6 / — |
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

## Plains

### Band I (levels 1–2)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | Two Zombies on an old battlefield [Restless dead] | 4 |
| 3 | A Viper [Territorial] | 4 |
| 4 | 1d2 + 1 Wild Dogs [Predator] | 4 |
| 5 | A herd of 1d4 + 2 wild Rounceys [Prey] | — |
| 6 | Two Bandit Cutthroats with a Cluster of Bandit Thugs [Raider] | 4 |
| 7 | 1d4 Deer or antelope [Prey] | — |
| 8 | A Bandit Leader with two Cutthroats and a Cluster of Thugs [Raider] | 6 |
| 9 | A merchant's two hired Thugs, guarding a cart [Patrol] | 4 |
| 10 | Two Large Hunting Dogs, run off from some lord's hunt [Predator] | 10 |
| 11 | **Sign first:** three Orc Raiders [Raider] | 6 |
| 12 | **Sign first:** a Wolf Beta with two Gammas and a Cluster of Runts [Predator] | 10 |

### Band II (levels 3–5)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | **Strange:** d6, 1–3 a Magpie on a gibbet; 4–6 an Eidolon of the Hunt, at dusk or in fog only (otherwise, Sign) | 30 / 20 |
| 3 | A Sergeant with a Cluster of Militia, riding the bounds [Patrol] | 10 |
| 4 | 1d2 Boars [Territorial] | 6 |
| 5 | A Wolf Beta with two Gammas and a Cluster of Runts [Predator] | 10 |
| 6 | Three Orc Raiders [Raider] | 6 |
| 7 | d6: 1–3 a herd of wild Rounceys [Prey]; 4–6 an Aurochs bull with his herd [Territorial] | — / 10 |
| 8 | A Captain with two Warriors and a Cluster of Footsoldiers, a war band between masters [Raider] | 10 |
| 9 | A Bandit Leader with two Cutthroats and a Brood of Thugs [Raider] | 6 |
| 10 | A Knight-Servile with a Sergeant and a Cluster of Militia: a lord's riders [Patrol] | 20 |
| 11 | d6: 1–3 a Lion [Predator]; 4–6 an Orc War Chief with four Raiders [Raider] | 20 / 30 |
| 12 | **Apex, Sign first:** d6, 1–3 a Dire Wolf; 4–5 an Ettin; 6 the Amarok | 40–60 |

At party level 3, Tier 3 results (the Aurochs, the Lion) are above band and arrive as Signs first.

### Band III (levels 6–8)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | **Strange:** a Shadow-Man's court, at night only (otherwise, Sign) | 40 |
| 3 | A Revenant Soldier with a Cluster of Skeletons, on an old battlefield [Restless dead] | 20 |
| 4 | 1d3 Aurochs [Territorial] | 10 |
| 5 | A Lion [Predator] | 20 |
| 6 | A Wolf Alpha with a Sigma, a Beta, two Gammas, and a Brood of Runts [Predator] | 30 |
| 7 | An Orc War Chief with four Raiders [Raider] | 30 |
| 8 | A Warlord with two Veterans and a Brood of Footsoldiers: a free company [Raider] | 30 |
| 9 | An Ogre [Raider] | 30 |
| 10 | A Knight-Servile with a Veteran and a Brood of Militia: a lord's riders [Patrol] | 20 |
| 11 | A Revenant Knight with two Revenant Soldiers [Restless dead] | 40 |
| 12 | **Apex, Sign first:** d6, 1–2 an Ettin; 3–4 the Amarok; 5–6 a Bergrisar, come down from the mountains | 60 |

---

## Hills

### Band I (levels 1–2)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | A Skeleton Warrior with a Cluster of Skeletons, near a barrow [Restless dead]. The barrow is a site. | 4 |
| 3 | A Viper [Territorial] | 4 |
| 4 | A Wolf Spider with a Cluster of Spider Swarm, an Ambusher [Predator] | 4 |
| 5 | 1d2 + 1 Wild Dogs [Predator] | 4 |
| 6 | Two Bandit Cutthroats with a Cluster of Bandit Thugs [Raider] | 4 |
| 7 | 1d4 Deer [Prey] | — |
| 8 | A Bandit Leader with two Cutthroats and a Cluster of Thugs [Raider] | 6 |
| 9 | 1d3 + 1 Kallikantzaroi, out of a cave mouth [Raider] | 4 |
| 10 | Two Large Hunting Dogs, run off from some lord's hunt [Predator] | 10 |
| 11 | **Sign first:** a Mountain Lion [Predator] | 6 |
| 12 | **Sign first:** a Wolf Beta with two Gammas and a Cluster of Runts [Predator] | 10 |

### Band II (levels 3–5)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | **Strange:** d6, 1–3 a Magpie; 4–6 an Eidolon of the Hunt, at twilight only (otherwise, Sign) | 30 / 20 |
| 3 | 1d2 + 1 Redcaps [Raider], near a ruin only (otherwise, a Sign that leads to the ruin) | 6 |
| 4 | A Mountain Lion, an Ambusher [Predator] | 6 |
| 5 | 1d2 Boars [Territorial] | 6 |
| 6 | A Wolf Beta with two Gammas and a Cluster of Runts [Predator] | 10 |
| 7 | Three Orc Raiders [Raider] | 6 |
| 8 | Two Living Stones [Guardian] | 6 |
| 9 | A Ranger Captain with two Woodsmen: outlaws [Raider] | 10 |
| 10 | A Black Bear [Territorial] | 10 |
| 11 | d6: 1–3 a Wolf Alpha's pack, as Band III's 6 [Predator]; 4–6 an Orc War Chief with four Raiders [Raider] | 30 |
| 12 | **Apex, Sign first:** d6, 1–2 a Dire Wolf; 3–4 an Ettin; 5 a Cave Bear; 6 the Amarok | 40–60 |

At party level 3, Tier 3 results (the Black Bear) are above band and arrive as Signs first.

### Band III (levels 6–8)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | **Strange:** a Shadow-Man's court, at night only (otherwise, Sign) | 40 |
| 3 | A Revenant Soldier with a Cluster of Skeletons, near a barrow [Restless dead] | 20 |
| 4 | A Brown Bear [Territorial] | 30 |
| 5 | A Wolf Alpha with a Sigma, a Beta, two Gammas, and a Brood of Runts [Predator] | 30 |
| 6 | An Ogre [Raider] | 30 |
| 7 | An Orc War Chief with four Raiders [Raider] | 30 |
| 8 | An Earth Guardian [Guardian] | 30 |
| 9 | A Warlord with two Veterans and a Brood of Footsoldiers: a free company [Raider] | 30 |
| 10 | Two Ogres [Raider] | 30 |
| 11 | A Revenant Knight with two Revenant Soldiers, at a barrow [Restless dead]. The barrow is a site. | 40 |
| 12 | **Apex, Sign first:** d6, 1–2 an Ettin; 3–4 a Bergrisar; 5 a Cave Bear; 6 the Erymanthian Boar | 60–80 |

---

## Mountains

### Band I (levels 1–2)

Mountains are hard country for a new party: a third of this table is above band.

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | A Skeleton Warrior with a Cluster of Skeletons, at a cairn [Restless dead] | 4 |
| 3 | A Viper [Territorial] | 4 |
| 4 | Two Large Raptors over their nest [Territorial] | 4 |
| 5 | 1d3 + 1 Kallikantzaroi, out of a cave mouth [Raider] | 4 |
| 6 | Two Bandit Cutthroats with a Cluster of Bandit Thugs, holding a pass [Raider] | 4 |
| 7 | Wild goats or chamois [Prey] | — |
| 8 | A Bandit Leader with two Cutthroats and a Cluster of Thugs [Raider] | 6 |
| 9 | **Sign first:** a Mountain Lion [Predator] | 6 |
| 10 | **Sign first:** two Living Stones [Guardian] | 6 |
| 11 | **Sign first:** a Wolf Beta with two Gammas and a Cluster of Runts [Predator] | 10 |
| 12 | **Sign first:** three Orc Raiders [Raider] | 6 |

### Band II (levels 3–5)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | **Strange:** an Eidolon of the Hunt, in a pass at twilight only (otherwise, Sign) | 20 |
| 3 | Two Eagles over their eyrie [Territorial] | 6 |
| 4 | A Mountain Lion, an Ambusher [Predator] | 6 |
| 5 | Two Living Stones [Guardian] | 6 |
| 6 | A Wolf Beta with two Gammas and a Cluster of Runts [Predator] | 10 |
| 7 | Three Orc Raiders [Raider] | 6 |
| 8 | 1d2 + 1 Redcaps in a ruined tower [Raider] | 6 |
| 9 | A Black Bear [Territorial] | 10 |
| 10 | An Orc War Chief with four Raiders [Raider] | 30 |
| 11 | A Wolf Alpha with a Sigma, a Beta, two Gammas, and a Brood of Runts [Predator] | 30 |
| 12 | **Apex, Sign first:** d6, 1–2 an Ettin; 3–4 a Bergrisar; 5 a Cave Bear; 6 the Amarok | 60 |

### Band III (levels 6–8)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | **Strange:** a Shadow-Man's court, at night only (otherwise, Sign) | 40 |
| 3 | An Earth Guardian [Guardian] | 30 |
| 4 | A Brown Bear [Territorial] | 30 |
| 5 | An Ogre [Raider] | 30 |
| 6 | A Wolf Alpha's pack [Predator] | 30 |
| 7 | An Orc War Chief with four Raiders [Raider] | 30 |
| 8 | An Earth Guardian with two Living Stones [Guardian] | 30 |
| 9 | A Revenant Knight with two Revenant Soldiers, at a cairn [Restless dead] | 40 |
| 10 | Two Ogres [Raider] | 30 |
| 11 | **Sign first:** a Giant Short-Faced Bear [Predator] | 80 |
| 12 | **Apex, Sign first:** d6, 1–2 a Bergrisar; 3–4 an Ettin; 5 a Giant Short-Faced Bear; 6 Otso | 60–100 |

---

## Swamp

The thinnest terrain in the bestiary. Many entries borrow from woodland and the undead.

### Band I (levels 1–2)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | A Skeleton Warrior with a Cluster of Skeletons, at a drowned barrow [Restless dead] | 4 |
| 3 | A Death-Watch Cluster, ticking in the dead wood [Predator] | 2 |
| 4 | A Viper [Territorial] | 4 |
| 5 | A Wolf Spider with a Cluster of Spider Swarm, an Ambusher [Predator] | 4 |
| 6 | Three Giant Rats with a Rat Swarm [Predator] | 4 |
| 7 | Two Zombies, risen from the bog [Restless dead] | 4 |
| 8 | Two Bandit Cutthroats with a Cluster of Thugs, hiding in the reeds [Raider] | 4 |
| 9 | A Bandit Leader with two Cutthroats and a Cluster of Thugs [Raider] | 6 |
| 10 | A Zombie with a Cluster of Rat Swarm feeding on it [Restless dead] | 4 |
| 11 | **Sign first:** three Zombie Brutes [Restless dead] | 6 |
| 12 | **Sign first:** a Constrictor [Predator] | 20 |

### Band II (levels 3–5)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | **Strange:** an Eidolon of the Hunt, in fog only (otherwise, Sign) | 20 |
| 3 | Three Zombie Brutes [Restless dead] | 6 |
| 4 | A Constrictor [Predator] | 20 |
| 5 | 1d2 Boars [Territorial] | 6 |
| 6 | A Monstrous Widow, an Ambusher [Predator] | 20 |
| 7 | A Revenant Soldier with a Cluster of Skeletons [Restless dead] | 20 |
| 8 | A Ranger Captain with two Woodsmen: outlaws [Raider] | 10 |
| 9 | Three Orc Raiders [Raider] | 6 |
| 10 | 1d2 + 1 Redcaps near a drowned ruin [Raider] | 6 |
| 11 | 1d2 Crocodiles, Ambushers in the water [Predator] | 10 |
| 12 | **Apex, Sign first:** d6, 1–3 an Undine, in deep water; 4–6 a Dryad's grove on a hummock (a site) | 40–60 |

At party level 3, Tier 3 results (the Crocodiles) are above band and arrive as Signs first.

### Band III (levels 6–8)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | **Strange:** a Shadow-Man's court, at night only (otherwise, Sign) | 40 |
| 3 | 1d3 Crocodiles [Predator] | 10 |
| 4 | Two Constrictors [Predator] | 20 |
| 5 | Two Monstrous Widows [Predator] | 20 |
| 6 | Two Revenant Soldiers with a Brood of Skeletons [Restless dead] | 20 |
| 7 | An Ogre [Raider] | 30 |
| 8 | A Warlord with two Veterans and a Brood of Footsoldiers, deserters hiding out [Raider] | 30 |
| 9 | An Orc War Chief with four Raiders [Raider] | 30 |
| 10 | Four Zombie Brutes [Restless dead] | 6 |
| 11 | A Revenant Knight with two Revenant Soldiers, at a drowned barrow [Restless dead] | 40 |
| 12 | **Apex, Sign first:** an Undine | 60 |

---

## Desert

Also thin. The fire Primordials give it a character of its own.

### Band I (levels 1–2)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | A Skeleton Warrior with a Cluster of Skeletons, half buried in the sand [Restless dead] | 4 |
| 3 | A Viper [Territorial] | 4 |
| 4 | A Wolf Spider with a Cluster of Spider Swarm, an Ambusher [Predator] | 4 |
| 5 | 1d2 + 1 Wild Dogs, jackals by another name [Predator] | 4 |
| 6 | Two Bandit Cutthroats with a Cluster of Bandit Thugs [Raider] | 4 |
| 7 | 1d4 antelope (Deer) [Prey] | — |
| 8 | A Bandit Leader with two Cutthroats and a Cluster of Thugs [Raider] | 6 |
| 9 | Two Large Raptors [Territorial] | 4 |
| 10 | A caravan's two hired Thugs [Patrol] | 4 |
| 11 | **Sign first:** a Fire Elemental [Guardian] | 6 |
| 12 | **Sign first:** three Orc Raiders [Raider] | 6 |

### Band II (levels 3–5)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | **Strange:** a Magpie | 30 |
| 3 | A Fire Elemental [Guardian] | 6 |
| 4 | Two Living Stones [Guardian] | 6 |
| 5 | Three Orc Raiders [Raider] | 6 |
| 6 | A Bandit Leader with two Cutthroats and a Brood of Thugs [Raider] | 6 |
| 7 | A Captain with two Warriors and a Cluster of Footsoldiers [Raider] | 10 |
| 8 | A Monstrous Widow, an Ambusher [Predator] | 20 |
| 9 | A Revenant Soldier with a Cluster of Skeletons: part of a lost army [Restless dead] | 20 |
| 10 | A Lion [Predator] | 20 |
| 11 | An Orc War Chief with four Raiders [Raider] | 30 |
| 12 | **Apex, Sign first:** d6, 1–3 an Inferno; 4–6 an Ettin | 60 |

At party level 3, Tier 3 results (the Lion) are above band and arrive as Signs first.

### Band III (levels 6–8)

| 2d6 | Encounter | XP |
|:---:|:---|:---:|
| 2 | **Strange:** a Shadow-Man's court, at night only (otherwise, Sign) | 40 |
| 3 | Two Fire Elementals with a Brood of Ember Sprites [Guardian] | 6 |
| 4 | A Lion [Predator] | 20 |
| 5 | An Earth Guardian [Guardian] | 30 |
| 6 | A Warlord with two Veterans and a Brood of Footsoldiers [Raider] | 30 |
| 7 | An Ogre [Raider] | 30 |
| 8 | A Revenant Knight with two Revenant Soldiers: the lost army's officer [Restless dead] | 40 |
| 9 | An Orc War Chief with four Raiders [Raider] | 30 |
| 10 | An Earth Guardian with two Living Stones [Guardian] | 30 |
| 11 | **Sign first:** an Inferno [Guardian] | 60 |
| 12 | **Apex, Sign first:** d6, 1–3 an Inferno; 4–5 a Bergrisar; 6 an Ettin | 60 |

---

## What the tables show

Filling these from today's bestiary turned up gaps you may want for your monster work:

- **Tier 1 is thin at the top everywhere.** The only Tier 1 Leader is the Bandit Leader, and the only Champions are trained dogs and horses. Every terrain's Band I table leans on bandits.
- **Band III leans on Tier 2 creatures in bigger groups.** Tier 3 has bears, aurochs, the Lion, the Ogre, the Earth Guardian, and the undead.
- **Swamp is the thinnest terrain.** It has the Constrictor, the Crocodile, and the Undine of its own; everything else is borrowed from woodland and the undead.
- **Desert is next.** The fire Primordials, the Lion, and the Living Stones give it some character, but Band I is all borrowed.
- **Band IV and up can't be built yet in any terrain.** Tier 4 has only the Giant Short-Faced Bear and Otso, both apex.
- **No dragons.** The Dragon tag exists, and so does Dragon Lore, but no stat block does yet. The apex rows use Epics and Legendaries in the meantime. When dragons exist, the red box's colors by terrain [S] are waiting: black in swamp, green in forest, blue in desert, red in mountains.
- **Folk on the road.** Merchants, pilgrims, and caravans would make Settled country feel lived in. For now, patrols and hired Thugs stand in.
