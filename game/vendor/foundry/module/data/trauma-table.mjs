/**
 * TRAUMA TABLE — generated from combat_revised.md › Trauma Table by
 * tools/build-trauma-table.mjs. Do not edit by hand; edit the source and
 * re-run the builder. Word for word.
 */
export const TRAUMA_INTRO = "**Trauma settings (optional).** The GM chooses how often Traumas occur. Each setting includes those above it.\n\n- **Realistic:** a Trauma occurs when a character takes health damage while at 0 health and fighting on (see *Fighting On*). This is the default rule.\n- **Brutal:** as Realistic, and a character also suffers a Trauma on reaching 0 health (in addition to the Injury), and on rolling a natural minimum on a trial to resist damage.\n- **Deadly:** as Brutal, and whenever a character takes health damage from a hit whose dice explode, they make an Endurance trial (Straightforward, 4) or suffer a Trauma.\n\nThe Trauma and Insanity settings are chosen separately; a table can run Brutal Traumas with Realistic Insanity, or any other combination.\n\nRoll 1d100 for each Trauma. Each Trauma has a tier:\n\n- **Minor:** heals within days, with rest or a single treatment.\n- **Severe:** heals only over weeks of rest or repeated tending; some must be treated first (set, reset, or tended).\n- **Grievous:** heals only with magic, while Damage Age still reaches it (Magic Mastery, Restoring Traumas). After that, it is permanent.\n\nDays' rest means full days of downtime with no travel, combat, or work.\n\nHealer treatments use *Treat Trauma* (Skill Mastery, Trade, Healer Discipline), rolled against the Trauma's tier: Minor 5, Severe 7, Grievous 9.";
export const TRAUMA_TABLE = [
 {
  "lo": 1,
  "hi": 1,
  "name": "Lose your left eye",
  "text": "Penalty -1 on Perception trials that rely on sight and on ranged attack rolls. If you have no eyes left, you are Blinded.",
  "tier": "Grievous",
  "recovery": "None",
  "none": false
 },
 {
  "lo": 2,
  "hi": 2,
  "name": "Lose your right eye",
  "text": "As left eye.",
  "tier": "Grievous",
  "recovery": "None",
  "none": false
 },
 {
  "lo": 3,
  "hi": 5,
  "name": "Close Call!",
  "text": "No Trauma.",
  "tier": "",
  "recovery": "",
  "none": true
 },
 {
  "lo": 6,
  "hi": 6,
  "name": "Lose your left hand",
  "text": "You cannot hold anything with two hands, and you can hold only one object at a time. A hook or iron hand can lessen the effect.",
  "tier": "Grievous",
  "recovery": "None",
  "none": false
 },
 {
  "lo": 7,
  "hi": 7,
  "name": "Lose your right hand",
  "text": "As left hand.",
  "tier": "Grievous",
  "recovery": "None",
  "none": false
 },
 {
  "lo": 8,
  "hi": 10,
  "name": "Close Call!",
  "text": "No Trauma.",
  "tier": "",
  "recovery": "",
  "none": true
 },
 {
  "lo": 11,
  "hi": 11,
  "name": "Lose your left foot",
  "text": "Movement halved, and you need a cane, crutch, or prosthesis to move. When you move more than once in a round, make a Physique trial (Straightforward, 4) or fall Prone. Penalty -2 on trials to keep your balance. After a year with a prosthesis, or after gaining 5 character levels, you move normally.",
  "tier": "Grievous",
  "recovery": "None",
  "none": false
 },
 {
  "lo": 12,
  "hi": 12,
  "name": "Lose your right foot",
  "text": "As left foot.",
  "tier": "Grievous",
  "recovery": "None",
  "none": false
 },
 {
  "lo": 13,
  "hi": 15,
  "name": "Close Call!",
  "text": "No Trauma.",
  "tier": "",
  "recovery": "",
  "none": true
 },
 {
  "lo": 16,
  "hi": 16,
  "name": "Punctured Lung",
  "text": "You have 1 AP per round. If both lungs are punctured, you are suffocating: advance Exhausted by 1 tier at the end of each of your turns.",
  "tier": "Severe",
  "recovery": "Tend (Healer) + 30 days' rest",
  "none": false
 },
 {
  "lo": 17,
  "hi": 18,
  "name": "Lose a finger",
  "text": "Penalty -1 on trials using fine tools with that hand (does not stack). Roll 1d10 from the left little finger to find which. If a hand loses all its fingers, treat it as a lost hand.",
  "tier": "Grievous",
  "recovery": "None",
  "none": false
 },
 {
  "lo": 19,
  "hi": 20,
  "name": "Close Call!",
  "text": "No Trauma.",
  "tier": "",
  "recovery": "",
  "none": true
 },
 {
  "lo": 21,
  "hi": 21,
  "name": "Lose your left ear",
  "text": "Penalty -1 on Perception trials that rely on hearing. Bonus +1 on Presence (Intimidation) trials. If you have no ears left, you are Deafened.",
  "tier": "Grievous",
  "recovery": "None",
  "none": false
 },
 {
  "lo": 22,
  "hi": 22,
  "name": "Lose your right ear",
  "text": "As left ear.",
  "tier": "Grievous",
  "recovery": "None",
  "none": false
 },
 {
  "lo": 23,
  "hi": 23,
  "name": "Lose your nose",
  "text": "Penalty -2 on Charisma trials and on Perception trials that rely on smell. Bonus +2 on Presence (Intimidation) trials.",
  "tier": "Grievous",
  "recovery": "None",
  "none": false
 },
 {
  "lo": 24,
  "hi": 25,
  "name": "Close Call!",
  "text": "No Trauma.",
  "tier": "",
  "recovery": "",
  "none": true
 },
 {
  "lo": 26,
  "hi": 26,
  "name": "Blurred Vision",
  "text": "Penalty -1 on Perception trials that rely on sight and on ranged attack rolls.",
  "tier": "Minor",
  "recovery": "3 days' rest",
  "none": false
 },
 {
  "lo": 27,
  "hi": 27,
  "name": "Break your left arm",
  "text": "You cannot hold anything with two hands, and you can hold only one object at a time.",
  "tier": "Severe",
  "recovery": "Set (Healer) + 30 days' rest",
  "none": false
 },
 {
  "lo": 28,
  "hi": 28,
  "name": "Break your right arm",
  "text": "As left arm.",
  "tier": "Severe",
  "recovery": "Set (Healer) + 30 days' rest",
  "none": false
 },
 {
  "lo": 29,
  "hi": 30,
  "name": "Close Call!",
  "text": "No Trauma.",
  "tier": "",
  "recovery": "",
  "none": true
 },
 {
  "lo": 31,
  "hi": 31,
  "name": "Break your left leg",
  "text": "Movement halved, and you need a cane or crutch to move. When you move more than once in a round, you fall Prone. Penalty -1 on trials to keep your balance.",
  "tier": "Severe",
  "recovery": "Set (Healer) + 30 days' rest",
  "none": false
 },
 {
  "lo": 32,
  "hi": 32,
  "name": "Break your right leg",
  "text": "As left leg.",
  "tier": "Severe",
  "recovery": "Set (Healer) + 30 days' rest",
  "none": false
 },
 {
  "lo": 33,
  "hi": 33,
  "name": "Ringing Ears",
  "text": "Penalty -1 on Perception trials that rely on hearing.",
  "tier": "Minor",
  "recovery": "3 days' rest",
  "none": false
 },
 {
  "lo": 34,
  "hi": 35,
  "name": "Close Call!",
  "text": "No Trauma.",
  "tier": "",
  "recovery": "",
  "none": true
 },
 {
  "lo": 36,
  "hi": 37,
  "name": "Limp",
  "text": "Movement reduced by 1 (5 ft). When you move more than once in a round, make a Physique trial (Easy, 3) or fall Prone.",
  "tier": "Minor",
  "recovery": "10 days' rest",
  "none": false
 },
 {
  "lo": 38,
  "hi": 38,
  "name": "Teeth Knocked Out",
  "text": "Penalty -1 on Charisma trials. Spells with verbal components require a miscast trial. A prosthesis removes the effect.",
  "tier": "Grievous",
  "recovery": "Prosthesis",
  "none": false
 },
 {
  "lo": 39,
  "hi": 40,
  "name": "Close Call!",
  "text": "No Trauma.",
  "tier": "",
  "recovery": "",
  "none": true
 },
 {
  "lo": 41,
  "hi": 41,
  "name": "Cracked Sternum",
  "text": "You have 1 AP per round. Whenever you spend AP to attack or cast a spell, make an Endurance trial (Straightforward, 4); on failure, the AP is spent with no effect.",
  "tier": "Severe",
  "recovery": "10 days' rest",
  "none": false
 },
 {
  "lo": 42,
  "hi": 43,
  "name": "Skull Fracture",
  "text": "Whenever you spend AP to attack or cast a spell, make an Endurance trial (Straightforward, 4); on failure, the AP is spent with no effect.",
  "tier": "Severe",
  "recovery": "30 days' rest",
  "none": false
 },
 {
  "lo": 44,
  "hi": 45,
  "name": "Close Call!",
  "text": "No Trauma.",
  "tier": "",
  "recovery": "",
  "none": true
 },
 {
  "lo": 46,
  "hi": 47,
  "name": "Left Leg Bruised to the Bone",
  "text": "Penalty -1 on Strength and Physique trials that use your legs.",
  "tier": "Minor",
  "recovery": "3 days' rest",
  "none": false
 },
 {
  "lo": 48,
  "hi": 49,
  "name": "Right Leg Bruised to the Bone",
  "text": "As left leg.",
  "tier": "Minor",
  "recovery": "3 days' rest",
  "none": false
 },
 {
  "lo": 50,
  "hi": 50,
  "name": "Left Arm Bruised to the Bone",
  "text": "Penalty -1 on Strength and Physique trials that use your arms.",
  "tier": "Minor",
  "recovery": "3 days' rest",
  "none": false
 },
 {
  "lo": 51,
  "hi": 51,
  "name": "Right Arm Bruised to the Bone",
  "text": "As left arm.",
  "tier": "Minor",
  "recovery": "3 days' rest",
  "none": false
 },
 {
  "lo": 52,
  "hi": 53,
  "name": "Close Call!",
  "text": "No Trauma.",
  "tier": "",
  "recovery": "",
  "none": true
 },
 {
  "lo": 54,
  "hi": 56,
  "name": "Left Shoulder Dislocated",
  "text": "You cannot hold anything with two hands, and you can hold only one object at a time.",
  "tier": "Minor",
  "recovery": "Reset (Healer) + 3 days' rest",
  "none": false
 },
 {
  "lo": 57,
  "hi": 59,
  "name": "Right Shoulder Dislocated",
  "text": "As left shoulder.",
  "tier": "Minor",
  "recovery": "Reset (Healer) + 3 days' rest",
  "none": false
 },
 {
  "lo": 60,
  "hi": 61,
  "name": "Close Call!",
  "text": "No Trauma.",
  "tier": "",
  "recovery": "",
  "none": true
 },
 {
  "lo": 62,
  "hi": 64,
  "name": "Broken Ribs",
  "text": "Whenever you spend AP to attack or cast a spell, make an Endurance trial (Straightforward, 4); on failure, the AP is spent with no effect.",
  "tier": "Severe",
  "recovery": "10 days' rest",
  "none": false
 },
 {
  "lo": 65,
  "hi": 66,
  "name": "Festering Wound",
  "text": "The wound turns. Advance Infected by 1 tier (interval 24 hours; Endurance DC equal to the inflicting creature's ability DC, Division + 1; for other sources, the GM sets it, default Tricky 5). While the wound remains, a successful trial holds the condition instead of reducing it. While you are Diseased, your maximum health drops by 1 every 24 hours; at 0, you die.",
  "tier": "Severe",
  "recovery": "Tend daily (Healer), 10 successes",
  "none": false
 },
 {
  "lo": 67,
  "hi": 70,
  "name": "Close Call!",
  "text": "No Trauma.",
  "tier": "",
  "recovery": "",
  "none": true
 },
 {
  "lo": 71,
  "hi": 73,
  "name": "Open Wound",
  "text": "You lose 1 health every hour until the bleeding is stopped (Healer, one exploration round).",
  "tier": "Minor",
  "recovery": "Stop the bleeding (Healer)",
  "none": false
 },
 {
  "lo": 74,
  "hi": 76,
  "name": "Internal Injury",
  "text": "Whenever you spend AP to attack or cast a spell, make an Endurance trial (Straightforward, 4); on failure, the AP is spent with no effect.",
  "tier": "Severe",
  "recovery": "Tend daily (Healer), 10 successes",
  "none": false
 },
 {
  "lo": 77,
  "hi": 80,
  "name": "Close Call!",
  "text": "No Trauma.",
  "tier": "",
  "recovery": "",
  "none": true
 },
 {
  "lo": 81,
  "hi": 82,
  "name": "Horrible Scar",
  "text": "Penalty -2 on Charisma trials. Bonus +2 on Presence (Intimidation) trials. While Damage Age still reaches the wound, a successful Healer treatment (T3) reduces it to a Minor Scar.",
  "tier": "Grievous",
  "recovery": "Healer, same day only",
  "none": false
 },
 {
  "lo": 83,
  "hi": 85,
  "name": "Painful Scar",
  "text": "In rain, sleet, hail, or snow, whenever you spend AP to attack or cast a spell, make an Endurance trial (Straightforward, 4); on failure, the AP is spent with no effect. While Damage Age still reaches the wound, a successful Healer treatment (T3) reduces it to a Minor Scar.",
  "tier": "Grievous",
  "recovery": "Healer, same day only",
  "none": false
 },
 {
  "lo": 86,
  "hi": 99,
  "name": "Minor Scar",
  "text": "No mechanical effect.",
  "tier": "",
  "recovery": "",
  "none": false
 },
 {
  "lo": 100,
  "hi": 100,
  "name": "Broken Back",
  "text": "You lose the use of your legs and cannot walk.",
  "tier": "Grievous",
  "recovery": "None",
  "none": false
 }
];
