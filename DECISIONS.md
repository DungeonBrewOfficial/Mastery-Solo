# Decisions

Rulings Jon has made for this design, newest last within each section. Each line says what was decided and when. Open questions are at the bottom.

## Settled

**Shape of the game**
- One player runs a party; this is a solo TTRPG, not a game about one character. Mastery combat runs as written, and no creature is rebalanced for solo play. (2026-10-23)
- Baseline balance assumes a party of four. (2026-10-23)
- The game is a roguelike: explore until the party dies or the player is done, then go again. (2026-10-23)
- It's a computer game: a standalone single-player roguelike, not something that lives inside Foundry. (2026-10-23, corrected 2026-10-24; Claude had misread "outside of the VTT" as pencil and paper, and the design files were drafted for paper.)

**Experience**
- Combat XP comes from the single highest-value enemy in the encounter, and each character receives it in full. Other enemies add nothing. (2026-10-23)
- Values by Division: D1 2, D2 4, D3 6, D4 10, D5 20, D6 30, D7 40, D8 60, D9 80, D10 100, D11 150, D12 200, D13 250. (2026-10-23)
- A minion group is worth its Division only, whatever its band. (2026-10-23)
- Combat XP lands at the end of each fight. Exploration XP is banked until the party reaches safety, per Mastery's rule that it is awarded when you are done traveling between locations. (2026-10-24)
- Exploration XP follows Mastery's Exploration Experience table, in full to each character. (Mastery, General Rules)

**Roster and runs**
- Dead characters are replaced by recruits during a run. New characters can be built from scratch or recruited as pregens; both are supported. (2026-10-23)
- The stronghold persists between runs. Following the B/X tradition, a hero can found a stronghold and retire, and a new hero starts out from it. Strongholds wait on Mastery's stronghold chapter. (2026-10-23)
- Dungeons and other sites exist as places worth reaching. Real treasure (hoards) lives in them; overland fights pay what the creatures carry. (2026-10-23)

**The turn**
- A leg cut short by the end of the day still rolls the event die. (2026-10-24)
- Movement a party can't spend carries over to the next leg within the same day. (2026-10-24)
- Weather trials are made once a day per character, at the worst conditions of the day. (2026-10-24)

**World**
- A dynasty is one world. Within it, the map is generated at the frontier as heroes explore. A new dynasty starts a new world. Carrying things between dynasties may come later. (2026-10-24)

**Danger**
- No set goal for a run. Apex threats (the odd "dragon") belong in the game as long as there is room to escape. (2026-10-23)
- Death should come from the player's choices. Doing something stupid can be punished. Death that is random and outside the player's control should not happen. (2026-10-23)

**Encounters**
- Party level for choosing an encounter band is the average of the characters' levels, rounded down. (2026-10-24)
- Every Epic and Legendary, and anything from a Tier above the party's band, arrives as a Sign before it can be met. (2026-10-24)
- The drafted entourage sizes are good enough to start with. (2026-10-24)
- Leaders and Masters hold their groups together. When they fall, the rest may break; other groups have a chance of breaking once half are defeated. (2026-10-24)
- Morale uses Wisdom and the Demoralized ladder: losses advance it, and creatures flee at Tier 3 (Panicked). Soldiers keep their low Wisdom; soldiers flee battles. (2026-10-24)
- The morale trial is DC 5, and a failure by 3 or more advances Demoralized 2 tiers. Accepted for now, pending play. (2026-10-24)
- The Eidolon of the Hunt works as written: running from it is the mistake. (2026-10-24)
- Hunting with the Wilderness skill is abstracted and pays no XP. Only a real encounter, a fight, pays combat XP. (2026-10-24)
- Deep sites stacking a bigger guardian and a doubled hoard is fine: a party that takes the risk and survives earns the loot, and it makes them greedier next time. (2026-10-24)
- Hidden and Lost Locations shouldn't be stumbled on. They're found through real exploration, so they need to be seeded differently from ordinary discoveries. (2026-10-24)
- Deep country can start as close as two tiles from home wherever no road runs. It's meant to be dangerous, and going too deep too early is a mistake the game should punish. (2026-10-24)
- The clue chain works: clues lead to hidden places, three fragments of lost lore to a lost place. The clues are found in hard-to-reach places (sites), and hidden and lost places are always in Deep country. (2026-10-24)
- The measure of danger is greed: break points where the party decides to go on or turn back, and punishment for going off the beaten path. (2026-10-24)

**Treasure and money**
- Purses are small. (2026-10-24)
- Target: a character can afford plate armor (full plate is 46 gn, 3,680 sp) by about level 10. (2026-10-24)
- Along the way, characters need enough for repair kits, healing supplies, and the like, while still saving to improve their gear. (2026-10-24)
- Baseline for treasure by level: the four gem grades (Ornamental, Common, Semi-Precious, Precious) each cover roughly 7 levels, with some overlap. (2026-10-24)
- The gem grade table by band in `design/03-treasure.md` is approved. (2026-10-24)
- Purses at about the creature's Division in d6 silver are in the right range. (2026-10-24)
- Selling: treasure sells at its value only if the settlement has a buyer who can afford it, found with the Availability table in reverse. The same goes for salvage. Small settlements won't want broken armor and lack the coin. (2026-10-24)
- Salvaged armor is usually worn to begin with and often broken by the end of a fight. The party can leave it, lug it home and sell it for a fraction, or spend time and effort repairing it to get more. (2026-10-24)
- Broken armor of any kind sells as scrap at 5% of its listed value; secondhand gear sells at half value times condition. Repairing loot is profitable on purpose: a character who invests in the Blacksmith discipline gives up advancing something else, and low-level parties can carry back only a couple of suits. (2026-10-24)
- Settlement coin on hand (about 4 sp per resident, 8 in cities, refilling a quarter each week) is accepted as a ballpark. (2026-10-24)

**Combat (2026-10-24)**
- A full defeat is a wipe: when the whole party is down, the run ends and everyone dies. Other outcomes may come later as a difficulty setting.
- When the party wins with someone still dying, saving them is all but automatic if the party has the means (a Healer's Kit, or a healing spell and the magan for it). Without the means, the rounds go on until each dying character is reached and triaged, or dies.
- A minion group counts each head as a body for morale numbers. That's the mob mentality working as intended.
- Enemies show their health as words (unhurt, hurt, bloodied, near death), and minion groups show the heads left.
- Running from a fight is a one-round break-away (one chase trial), then the chase as a scene. The break-away is the bar for "safe enough to tend the dying." Carrying anyone gives the chase trials Impotence. The unconscious are carried or abandoned by choice, and the abandoned die. Details are in `design/02-encounters.md`, Running from a fight.
- A condition's tiers that no source holds drop one tier at the end of the turn of the creature that last advanced it, starting with its next turn, not the turn it advanced them. A bandit's Low Cut lasts until the end of that bandit's next turn. (Impaired keeps the Startle rule, easing at the start of each round; Demoralized holds while its source is in sight.)
- Impaired from a failed Startle trial is its own thing: it eases one tier at the start of each round, and it's what Opportunist and Backstab key off. Impaired from any other source wears off like any condition. A creature can carry both at once.
- Fliers are always aloft for now: they can always Stoop, and Aerial Evasion always applies.
- Avoid Death fires automatically the first time it applies between rests. It's a choice, not a reaction, and costs no AP. (Jon: the rules text calling it a reaction is an error.)
- Unnumbered Attrition from a rider deals the creature's attack attribute tier, the higher of Strength or Physique.
- Epic and Legendary creatures fight to the death. They make no morale trials, because lairs and retreats are a process for later.
- Synergies are surfaced two ways [Jon, 2026-10-24]. First, a "Right now" list on each character's turn names the openings, charges, allies to save or free, and help on hand, each with its rule word for word. Second, each character has a Reactions page with Ask, Always, or Never for defense, counterattacks, reprisals, Snap Shot, Avoid Death, and Hearten on an ally's defense, attack, or trial. Every reaction defaults to Ask except Avoid Death (Always), so nothing is hidden from a new player. A prompt appears only when the reaction is possible (for Hearten, Corra standing with AP left). Hearten on a trial asks for trials against an enemy's attack; other trials take it only on Always.
- Root Snare reaches 30 feet for now. False costs 1 AP, which also pays for the defense; the strike with Superiority is free. The enemy-AI calls (Double Damage above half health; Intercept costs 1 AP plus the defense, and needs the attacker able to reach the knight) stand for now. Missing weapon ranges come from the equipment entry.
- The Dryad fights beside her bonded tree, as her stat block describes. The tree can't defend and can't be destroyed in a fight. Damage to it between her turns stops her regrowth and steps up her spells (7+), and stops her Woodland Meld and wakes the tree (14+).
- Rules gaps found while building are listed in `RULES-GAPS.md` and raised in chat when found.
- The White Hart is a narrative pull more than a fight: tracking it can lead to a hidden or lost place. It stays off the encounter tables until sites are built (milestone 4). Its Charmed and Concealed abilities wait for stage 3.
- Whether the shield takes durability damage before the armor is each character's standing choice, set at each round's declarations (as in Foundry's `shieldAbsorbs`, on by default). A ranged hit doesn't have to go to the shield.
- Stage 3 [Jon, 2026-10-24]:
  - A character acts in the slowest phase of what they declare (`combat_revised.md:69`). A caster who declares only a spell acts in its phase and can defend with the weapon but not attack with it on their turn. Declaring the attack too puts them in the weapon's phase, and the spell goes off then.
  - A Defend or Counterattack set to Always still asks while the character holds a spell with gestures, since yes loses the spell.
  - Healing a character at 0 health brings them to.
  - Turned minion heads leave the field for good. The nastier version, where they come back in a later fight or during downtime, is a candidate for later.
  - Concentration follows Foundry's slots: one free, two paid at 1 AP a round, and passive. A new effect takes the first open active slot. Each round's declarations place every held effect, and Imbue can't go passive.
  - Damage is magical by its type (`combat_revised.md:114-119`), so any fire, sacred, or other magical-type damage can kill Gisla at 0 health.
  - The prebuilt companions' details (Tallow's horns as crushing) are placeholders. Foundry's pure companion rules (`puca-rules.mjs`, `agathion-rules.mjs`, `companion-phase.mjs`) are vendored; its companion stat derivation (`companions.mjs`, `companionDerived`) reads Foundry actors, so its formulas get mirrored when companions advance (milestone 3).
  - A party down to only Hard to Kill characters at 0 health: the foe leaves them [Jon, 2026-10-24, the default until difficulty settings]. Everyone else dies as in a wipe; they wake alone at Exhausted 3.
- Settlements [Jon, 2026-10-24]: an evening at an inn can turn up a rumor of a site through a Presence trial; a city's library can be a source of occult writings; in a hamlet, a household taking the party in is a Good Night's Rest. - Recruits [Jon, 2026-10-24]: a level 1 recruit is free and brings their class's starting wealth; a higher-level recruit costs their XP in silver pennies (a level 3 Paladin, 300 sp). Towns offer recruits up to a couple of levels below the party, cities closer.
- The recruit's class [Jon, 2026-10-24]: a d6, 1–5 human and 6 demihuman (the settlement or region can shift it), then a d12 over the eleven human classes with Fighter on two faces, or a d7 over the seven demihumans (Cursed, Dwarf, Gray Elf, Sylvan Elf, Gnome, Halfling, Orc).
- A hired smith follows the Blacksmith Discipline's repair formula, (Trade die + Intelligence tier die) × 4 per kit; a Skilled smith averages 24 [Jon, 2026-10-24].
- Milestone 3, stage 4 (recruiting and the next generation), calls made while building (raised with Jon in chat):
  - A rolled-up character puts the 3 starting points into the attribute the class rolls its biggest dice for, and takes no swap or reroll.
  - Gear is bought for them from their starting wealth: a weapon by the stronger of Strength and Physique, a heater shield for martial classes that may carry one, the sturdiest armor their class may wear and their purse affords, a bow for Rangers and Sylvan Elves, and an Adventurer's Pack. What's left joins the party's purse.
  - Their level-1 mastery points go to what they carry, then to the styles, the entropic forms their class allows, and the skills the class leans toward; a higher-level recruit's points go the same way.
  - Spells known: up to two of the six the game has, in forms they've reached.
  - The party holds four [Jon, 2026-10-23]; recruits wait until there's room.
  - Arms and armor at the market: weapons up to 12 sp Serf, 80 Peasant, 600 Knight, more Burgher; shields Peasant. Plate is knight's armor [Jon, 2026-10-24]: heavy armor and the plate sets among the medium ones (breastplate, half-plate) are Knight; mail, scale, brigandine, and light armor are Peasant (the medium split is a guess).
  - Character building's automatic choices (starting points, gear, masteries) are placeholders until a building screen exists [Jon, 2026-10-24: fine for now].
  - The next generation starts with what its members bring; the fallen party's supplies are lost with it.
- Milestone 3, stage 3 (the town), calls made while building (raised with Jon in chat):
  - Any day the party doesn't travel counts as a day's rest for the Trauma Table, in camp or in town.
  - A settlement's healer treats a Trauma as a Skilled healer with a surgeon's chest (Dominance in a city's infirmary), for 8 sp plus the Trauma Kit (36 sp); a failure spends the kit.
  - Spare goods sell at half their price, as secondhand arms and armor do; pelts at their value.
  - An Open Wound bleeds 1 health per hour on the road; at 0 the character collapses and must be tended.
- Milestone 3, stage 1, calls made while building (raised with Jon in chat):
  - The pregens set out with an Adventurer's Pack apiece, paid from the party's coin.
  - Food, water, kits, and tools are the party's, not each character's; encumbrance waits.
  - The market's Social Class for each item is a first guess (`game/town.js`, SHOP), rolled once a day per settlement.
  - An inn night is Common lodging and a Common supper (3½ sp a head).
  - Without a kit, Triage stabilizes as the Combat chapter has it; with a Wound Kit it heals as the Healer discipline has it.

**Sites (`design/05-sites.md`) [Jon, 2026-10-24]:** all eight drafts stand. A site is a chain of areas drawn as the party goes, with fights on the combat grid; sizes as drafted; trials inside use the Even and Hard DCs by band (+2 in Deep country); the clock rolls every 3 exploration rounds and after each fight; the guardian's group is spread through the Occupied areas; cleared sites may refill after a month; no magic treasure until magic items exist. Lost places can be held by the Asura (the Cherub, the Agathodaimon) as one option among the rolls, not the rule.

- Milestone 4, stage 1, calls made while building sites (raised with Jon in chat) [N]:
  - Areas link in a chain as drawn; going back to a drawn area takes a round, and leaving takes a round per area back to the entrance.
  - A noticed trap can be stepped around for free, one at a time; an unnoticed one springs on the Scout, who leads.
  - Trap kinds: a spiked pit (puncturing, Restricted), swinging blades (cutting, Bleeding), a poisoned needle (piercing, Tainted), a falling weight (crushing, Impaired). The condition trial is Strength for Restricted and Endurance for the rest, against the trap's Detection DC.
  - A character brought to 0 health outside a fight (a trap, a floor) is down until rest brings them back; there's no dying timer outside a fight yet.
  - Obstacles: a climb (Strength and Athletics), a swim (Endurance and Athletics), a riddle (Intelligence and Lore), a collapse (Wisdom and Lore, standing in for Stone Lore). A failed unsound floor drops the one crossing for 1d6.
  - Occupied areas take a single creature kind or a minion group (cut to six heads) from the guardian's entourage, at even odds when both are left; residents brought by the clock are 1d3 of a single kind, else vermin.
  - Lairs aren't dark; the other types are, throughout.
  - A remains clue to "the contents of one undrawn area" means the next area entered holds no surprises: a trap there is already spotted.
  - Salvage from remains is a random armor set or shield at 1d10 × 10% of its Durability.
  - A Band I purse in remains is 1d6 sp, Band II 2d6, Band III 3d6.
  - Thieves' Picks and the Crowbar are on the market at Peasant. Hamon has neither, as his build episode chose.

- Milestone 4, stage 2, calls made while building leads (raised with Jon in chat) [N]:
  - Questioning a beaten guardian follows Interrogation as the rules write it: the creature rolls Charisma against the questioner's Presence Mastery DC (mastery level + Charisma tier), and a failure gives the clue. The design file had it the other way round (a Presence trial against Division + 1); the rules win. Once per site, after the heart is won. Anything with Intelligence 3 or more that isn't a beast can talk.
  - A fragment gets one reading in the field, when found; after that only a Sage can read it. A Sage is in any town or city and charges 8 sp a fragment, a skilled hireling's day; a Sage always reads it.
  - A lead whose tiles haven't been seen stops at the first unseen one, and carries on when the party gets there and finds it isn't Deep.
  - Searching for a hidden place is against the band's Even DC + 2 (Deep), and for a lost place the Hard DC + 2 [Jon, 2026-10-24]. At the Hard DC no Band I party could find anything: the pregens' best search roll is 6 against 8.
  - The searcher is the Scout; the Helper is anyone else with Alertness at Untrained or better (+2). A searching leg can't push past nightfall.
  - What a clue finds is placed on the square the party searched to.
  - An outlaws' hideout is held by the Bandit Leader's band at Band I, and from Band II by bandits or the Ranger Captain's outlaws, even or odd on a d6.
  - A cache's purse is (band)d6 sp.
  - A refilled site keeps its drawn map: traps and locks already dealt with stay that way; Occupied areas fill from the new guardian's group. Its hoard is 20 sp a point of XP (half). Rolled once each month the site stands empty.

**Creature tiers (a guess, 2026-10-24)**
Jon is still building monsters. His current guess at the party levels each creature Tier serves, used until the tables test it:

| Tier | Party levels |
|:---:|:---|
| 1 | 1–2 |
| 2 | 3–5 |
| 3 | 4–8 |
| 4 | 7–12 |
| 5 | 10–15 |
| 6 | 15–25 |
| 7 | 20+ |

## Open

- The chase, until it's tested.
- The map questions at the top of `design/04-the-map.md`: tiles, region size, hills, Deep country by tile, road and settlement density, spell sources, and river crossings.
- The hoard multiplier (40 sp per point of the guardian's XP value), waiting on play.
- The settlement questions at the top of `design/06-settlements.md`: recruit level, who's available, hiring a smith, rumors, libraries, and a hamlet's hospitality.
- **Difficulty settings** (later). Candidates so far: what a wipe means (everyone dies; everyone but the dynasty's main character survives; raiders rob and leave, beasts drag one off), whether healing means make saving the dying after a fight automatic, and how a fight ends when only a Hard to Kill character at 0 health is left against foes who can't kill her (the party falls; she survives alone; the foe leaves her with her Traumas).
- Metals, deferred: Jon is working on them in the main rules. Plate is the level-10 bar for now; better materials and craftsmanship belong past that. The five-metal ladder (Iron, Steel, Silver, Gold, Mithril) needs a purpose. Candidates so far: Durability grades on armor and shields, or the substrate for permanent enchantment (which waits on Mastery's magic items).
