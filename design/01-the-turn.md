# The Turn

*Draft 1, 2026-10-24. Every claim is tagged; see the README. Anything marked [N] is a proposal waiting for correction.*

This is the game at floor level: what you do, in order, while your party is out on the map. It keeps the Solo Game's shape, a roll to move and a roll for what happened there [S], and hangs Mastery's travel, rest, and survival rules on it. Encounters, sites, settlements, and map generation each get their own file. This page only says when they happen.

---

## The Map

**A square is the distance a party covers in one hour at Slow pace,** about a mile and a half [N]. Squares per hour by pace [N, from Mastery's pace multipliers]:

| Pace | Squares per hour | Travel trial penalty |
|:---|:---:|:---:|
| Slow | 1 | none |
| Normal | 2 | −2 |
| Fast | 3 | −4 |
| Marathon | 4 | −6, and double water and rations |

At Normal pace an 8-hour day covers 16 squares, about 24 miles, which matches Mastery's day of 18 + Speed miles for most parties [M, General Rules, Movement]. The map ignores the few miles a day that separate a Speed 4 party from a Speed 7 one; the party moves at the pace it chooses.

**Terrain costs movement** [N]. Mastery describes terrain as making travel "exceptionally quick, or unbearably slow" but gives no table, so this one is new:

| Terrain | Cost to enter |
|:---|:---:|
| Road, through any terrain | 1 |
| Plains | 1 |
| Forest, Hills, Desert | 2 |
| Swamp, Mountains | 3 |

You spend your movement square by square. If you can't afford the next square, you stop where you are.

Mark your trail as you go. The Solo Game erased its Xs behind the traveler [S]; here the terrain you reveal stays drawn for the rest of the dynasty, and the trail is yours to keep or erase.

---

## The Day

A travel day is 8 hours [M, General Rules, Traveling Roles]. It runs in this order.

### 1. Morning

Roll the day's weather on the season's table [M, General Rules, Weather Tables]. Choose your pace and assign a Traveling Role to each character: Scout, Watchman, Navigator, Hunter/Forager, Healer, Helper, Sage, or Teamster [M]. Eat, if you're eating.

### 2. Roll the travel die

Roll a d6. That many hours pass on this leg of the journey [S, reinterpreted: the original die counted squares; here it counts hours, and pace turns hours into squares].

If the roll is more than the hours left in the day, you have a choice. You can stop when the day runs out: no event happens, and you go to Camp. Or you can push on and finish the leg, which takes you past 8 hours and calls for a Pushing the Pace trial at day's end [M, General Rules, Traveling Speed].

### 3. Move

Move up to (hours × squares per hour) along your route, paying terrain costs. If you enter a blank square, it is generated as you arrive [N; see the map generation file, to come].

### 4. What happened there

Roll a d6 on the square where you stopped [S: "one die to determine what happened there"]:

| d6 | Result |
|:---:|:---|
| 1–2 | **Quiet.** The hours pass without incident. |
| 3 | **Sign.** Roll on the terrain's encounter table, but you find traces of the result instead of the creature itself: tracks, a kill, a camp gone cold. A Scout can read the signs to learn what made them and how many (Alertness, Stalking; Wilderness, Beast Lore or the right Creature Lore) [M]. You may follow the signs toward the creature or its lair, or steer clear. |
| 4 | **Discovery.** A landmark, ruin, lair, or settlement, rolled on the terrain's discovery table. A place reached for the first time is a New Location [M, General Rules, Exploration Experience]. |
| 5–6 | **Encounter.** Roll on the terrain's encounter table, then follow the encounter procedure. |

[N] These frequencies are the main tuning knob for how dangerous travel feels. At an average of a little over two legs a day, they produce about one encounter a day before camp.

**Nothing above your band arrives unannounced** [N]. Every encounter table is divided into bands by party level. If an encounter result comes from a band above the party's, it becomes a **Sign** instead, unless the party is already following that creature's signs or is inside its lair. If the party then meets it, contact begins at a distance with the party aware. This is how the game keeps its promise: the dangerous thing is out there, and you get to decide whether to go and find it.

### 5. Encounter

The encounter procedure gets its own file. In outline:

1. **What.** Roll on the terrain's encounter table for the party's band. Each entry is a head and its entourage, such as a Bandit Leader with a Cluster of Thugs [N].
2. **Contact.** Settle who notices whom, and at what distance, before anything else happens. The Watchman and Scout roll Perception against the creature's Stealth DC of Division + 1, and creatures roll their trial dice against the party [M, Monster Manual, Creature Skills and Ambushes]. Unaware creatures make Startle trials [M, Combat, Startle and Ambush]. A true ambush needs a creature with Ambusher, or a party that set no watch [M + N].
3. **Disposition.** Every creature wants something [M, Monster Manual, Motivation]. A disposition die says what this one wants right now: to hunt, to hold its ground, to watch, to bargain, or to be left alone [N].
4. **Choice.** Avoid, parley, fight, or flee. Fighting uses Mastery combat as written [M]. Fleeing uses the escape procedure [?, not yet written].
5. **Reward.** Each character receives the XP of the highest-value enemy, in full [Jon, 2026-10-23]. Spoils are what the creatures carried: pelts from beasts [M, Treasure, Furs], purses and gear from folk. Hoards are found only in sites [Jon, 2026-10-23].

### 6. Continue or camp

If hours remain, go back to step 2. When the day's hours are spent, make camp.

---

## Camp

Assign each character a Camping Role [M, General Rules, Camping Roles]. Eat, and set watches through the night. Without a Watchman, a night encounter comes with no warning [M].

Roll the d6 once for the night [N]. On a 6, something finds the camp: roll on the terrain's encounter table and run the encounter, with the Watchman's trial deciding how much warning the camp gets. Camp Camouflage makes the camp harder to find [M], and a cooking fire's smell can draw attention [M, General Rules, Cooking]; [N] a cooked meal turns a 5 into an encounter as well.

Then rest. In the wild, that is a Wilderness Rest if the camp is safe and a Dungeon Rest if it isn't [M, General Rules, Resting]. Gnomes, Druids, Elves, Orcs, and Rangers treat a safe Wilderness Rest as a Good Night's Rest [M].

---

## Coming Home

Out in the wild, everything runs down. Health returns 1 or 1d3 a night. Armor loses Durability with every hit, and only a Blacksmith with repair kits restores it. Rations run out, and Exhausted builds up from weather, hunger, and hard marching [M]. A Severe Trauma needs a Healer and weeks of rest [M, Combat, Trauma Table]. Town is where you recover:

- **Rest.** A Good Night's Rest at an inn, a Civilized Rest after a day in town, or Bed Rest for a day in bed [M, General Rules, Resting].
- **Repair.** Hire a smith, or use the party's own Blacksmith in a workshop [M, Skill Mastery, Trade].
- **Buy.** Whether a settlement sells something is an Availability roll by its size, from a roadhouse's 2d3 to a metropolis's 2d12 [M, Equipment, Availability]. The city stocks what the hamlet can't.
- **Sell.** Pelts, gear, and treasure.
- **Recruit.** Replace the dead from the settlement's recruits, or build a new character [Jon, 2026-10-23; procedure to come].

**Experience comes home with you.** Mastery awards exploration XP "when you are done traveling between locations," not along the way [M, General Rules, Exploration Experience]. Read strictly, the XP for every place a party found on an expedition is banked only when they reach safety. A party that dies on the way back loses it. That puts a push-your-luck decision into the rules as written: one more ruin, or home while you still can. [?] Whether combat XP banks the same way or lands at the end of each fight is Jon's ruling.

---

## Ending a Run

A run ends when the last of its heroes dies, or when the player retires them [Jon, 2026-10-23]. Retirement founds or joins the dynasty's stronghold, and the next hero starts out from it [Jon, 2026-10-23; strongholds wait on Mastery's stronghold chapter]. The map, the stronghold, and whatever the old heroes left behind stay for the next run. A new world comes only with a new dynasty.

---

## What's Missing

These pages are referred to above and not yet written:

- **Encounters:** terrain tables by band, contact, the disposition die, and escape.
- **Sites:** a small paper generator for lairs, ruins, and dungeons, with treasure by Division.
- **Settlements:** what each size of settlement offers, and recruiting.
- **Map generation:** terrain at the frontier, and the discovery tables.
