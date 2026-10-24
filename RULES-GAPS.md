# Rules gaps found while building

Places where Mastery's own text is missing something, contradicts itself, or reads differently from how Jon rules it. This is a record for Jon to fix in the rules; each one is also raised in chat when found. File and line numbers are in the `mastery` repository as of 2026-10-24.

**Status, 2026-10-24:** gaps 1–7 are closed in the rules text (`mastery` commit 68ef36b). Mark Quarry now grants Invigorated against its target, and the game follows. The game reads creatures from the Foundry pack, which picks up the new wording once the Foundry repository carries it.

| # | Where | What the text says | The gap | How the game handles it now |
|:-:|:---|:---|:---|:---|
| 1 | `Creatures - Mortal Folk.md:407`, Mark Quarry | "All allied hunters and beasts within 60 feet advance Inspired by 1 tier against that target only." | Inspired Tiers 1 and 2 only help mental rolls and trials; only Tier 3 touches attacks. Against one target, the buff does almost nothing for two rounds. Likely written before Inspired changed. | Tier 3 gives Superiority on attacks against the marked target; Tiers 1–2 do nothing in a fight. |
| 2 | `Creatures - Fae.md:237`, Root Snare | "The target must succeed on a STR trial [6] or advance Restricted by 1 tier…" | No range. | 30 feet, like the Monstrous Widow's Web [Jon, for now]. |
| 3 | `Skill Mastery.md:509`, Avoid Death | "…as a reaction you can roll your Endurance tier die and restore that amount of health." | "Reaction" implies an AP cost; Jon intends a free choice. The companion version (`animal_companion_advancement.md:196`) says "(Passive)" instead. | Free; automatic by default, or Ask on the Reactions page. |
| 4 | `Creatures - Mortal Folk.md:425`, Footsoldier | "1d2 (Hornbow, Fast, Projectile) Piercing" | No range; the equipment entry gives Range (150/300/450). | The range is taken from the weapon's equipment entry. |
| 5 | `conditions_revised.md`, Stacking | "Tiers that no source holds deteriorate 1 tier per round, at the end of the turn of the creature or effect that last advanced the condition." | Read literally, a condition advanced on a turn ends at the end of that same turn. Jon: it means the advancer's next turn. | Wears off at the end of the advancer's next turn. |
| 6 | `combat_revised.md`, Startle and Ambush, Results | "A creature affected by the Impaired condition progresses to previous Tier at the start of each combat round…" | Reads as all Impaired. Jon: only Impaired from Startle works this way, and only it opens Opportunist and Backstab. | Startle's tiers ease at the start of each round; other Impaired wears off like any condition. |
| 7 | `Creatures - Mortal Folk.md:366` and `:405`, Pinning Shot | Woodsman STR trial [4]; Ranger Captain STR trial [5]. | Possibly intended (rank), possibly drift. Worth a glance. | Each creature uses its own number. |
