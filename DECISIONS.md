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
- Whether the shield takes durability damage before the armor is each character's standing choice, set at each round's declarations (as in Foundry's `shieldAbsorbs`, on by default). A ranged hit doesn't have to go to the shield.

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
- The site questions at the top of `design/05-sites.md`: areas instead of grid maps, site sizes, default DCs by band, the clock inside, the guardian's group spread through the site, cleared sites refilling, magic treasure, and lost-place guardians.
- The settlement questions at the top of `design/06-settlements.md`: recruit level, who's available, hiring a smith, rumors, libraries, and a hamlet's hospitality.
- **Difficulty settings** (later). Candidates so far: what a wipe means (everyone dies; everyone but the dynasty's main character survives; raiders rob and leave, beasts drag one off), and whether healing means make saving the dying after a fight automatic.
- Metals, deferred: Jon is working on them in the main rules. Plate is the level-10 bar for now; better materials and craftsmanship belong past that. The five-metal ladder (Iron, Steel, Silver, Gold, Mithril) needs a purpose. Candidates so far: Durability grades on armor and shields, or the substrate for permanent enchantment (which waits on Mastery's magic items).
