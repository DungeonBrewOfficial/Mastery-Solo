/**
 * EXTRACTED by tools/sync-foundry.mjs from Foundry module/helpers/combat.mjs (resolveDamage). Do not edit.
 */
import { damageInteractsWithArmor } from "../module/config.mjs";

export function resolveDamage({
  attackTotal,
  damageType,
  armorResistance,
  durabilityCurrent,
  healthCurrent,
  activeDefense,
  defenseTotal,
  // Legacy alias for calls that still pass hpCurrent — accept and use if given.
  hpCurrent,
  // Force armor bypass regardless of damage type — used by maneuvers
  // that explicitly bypass armor (Coup de Grace, Horn Thrust, Finding
  // the Gap, Rupture partial). When true, damage goes direct to Health.
  forceBypassArmor = false,
  // No-damage attack — the attack rolls, target defends normally,
  // hit/miss is determined for on-hit gates and trials, but no
  // durability or health damage is applied. Used by Disarm, Driving
  // Blow, and any future "attack that resolves for hit-detection but
  // deals no damage" maneuver.
  noDamage = false,
  // Immunity gate. When the target is immune to this damage type via
  // any source (species classification, active Cursed hallmark, etc.),
  // the caller looks up the source label via
  // passive-modifiers.mjs::getDamageImmunitySource and passes it here.
  // Truthy value → resolveDamage short-circuits: zero damage lands,
  // no durability lost, no health lost. The returned shape carries
  // `immune: true` and `immunitySource` so the resolution card renderer
  // can name the blocker. resolveDamage stays pure (doesn't do actor
  // lookups) — callers own the source-check.
  immunitySource = null,
  // Spell ward pool standing against this damage type (spell phase 5,
  // 2026-09-26). "The pool absorbs incoming damage of the targeted type
  // before it reaches physical armor or health"; "Magical protection
  // applies before armor. Any damage remaining after protection follows
  // the normal rules." Absorbs what gets past defense, before resistance.
  // The caller drains the pool from `wardAbsorbed` (applyDamageToActor).
  wardPool = 0
}) {
  const attack = Math.max(0, Number(attackTotal) || 0);
  const armor = Math.max(0, Number(armorResistance) || 0);
  const dur = Math.max(0, Number(durabilityCurrent) || 0);
  const defTotal = Math.max(0, Number(defenseTotal) || 0);
  const _healthCurrent = Number.isFinite(healthCurrent) ? healthCurrent : hpCurrent;

  // Immunity short-circuit — checked BEFORE defense, before armor,
  // before any damage math. Immune is immune: zero damage lands,
  // regardless of attack total or defense state. The chat card
  // renderer names the source.
  if (immunitySource) {
    return {
      effectiveIncoming: Math.max(0, Number(attackTotal) || 0),
      afterResistance: 0,
      absorbed: false,
      durabilityDamage: 0,
      healthDamage: 0,
      hpDamage: 0,
      armorBroken: false,
      defended: false,
      bypassArmor: false,
      damageType,
      immune: true,
      immunitySource
    };
  }

  const bypassArmor = forceBypassArmor || !damageInteractsWithArmor(damageType);

  let effectiveIncoming;
  let defended = false;

  if (activeDefense) {
    if (defTotal >= attack) {
      return {
        effectiveIncoming: 0,
        afterResistance: 0,
        absorbed: false,
        durabilityDamage: 0,
        healthDamage: 0,
        hpDamage: 0,
        armorBroken: false,
        defended: true,
        bypassArmor,
        damageType
      };
    }
    effectiveIncoming = attack - defTotal;
  } else {
    effectiveIncoming = attack;
  }

  // No-damage attack — the attack landed (not defended) but the
  // maneuver's rules skip damage application. Return the "hit for
  // zero damage" shape so on-hit gates fire but no HP/durability is
  // lost. Used by Disarm, Driving Blow, and future maneuvers that
  // resolve for hit-detection without dealing damage.
  if (noDamage) {
    // "Hit" = the attack would have dealt damage (Jon 2026-09-25: there is
    // no hit / miss — an effect "on a hit" needs damage; an in-lieu-of-
    // damage attack needs damage it WOULD have dealt after defense and
    // resistance).
    const wouldDealDamage = (activeDefense ? effectiveIncoming : effectiveIncoming - armor) > 0;
    return {
      effectiveIncoming,
      wouldDealDamage,
      afterResistance: 0,
      absorbed: false,
      durabilityDamage: 0,
      healthDamage: 0,
      hpDamage: 0,
      armorBroken: false,
      defended,
      bypassArmor,
      damageType,
      noDamage: true
    };
  }

  let wardAbsorbed = 0;
  if ((Number(wardPool) || 0) > 0 && effectiveIncoming > 0) {
    wardAbsorbed = Math.min(Number(wardPool), effectiveIncoming);
    effectiveIncoming -= wardAbsorbed;
  }

  // Energy magic path — armor DURABILITY POOL is skipped, but
  // resistance still reduces damage before it lands on Health.
  // Jon 2026-09-19: the whole point of Elemental Resistance: Fire
  // (Athletics ability) and future enchanted-armor magic resistance
  // is to protect against damage that would otherwise bypass the
  // armor pool entirely. `armor` here is the effectiveResistance
  // for this damage type — composed from all sources at prep time.
  //
  // Active-defense double-count guard: same as the mundane path.
  // If activeDefense is true, buildDefenseInputs already folded
  // armorResistance into defTotal, so subtracting `armor` again
  // here would double-count. Passive / Take Hit path applies
  // resistance directly.
  if (bypassArmor) {
    const afterResistance = activeDefense
      ? Math.max(0, effectiveIncoming)
      : Math.max(0, effectiveIncoming - armor);
    return {
      effectiveIncoming,
      afterResistance,
      absorbed: false,
      durabilityDamage: 0,
      healthDamage: afterResistance,
      hpDamage: afterResistance,
      armorBroken: false,
      defended,
      bypassArmor: true,
      damageType,
      wardAbsorbed
    };
  }

  // Mundane / Material Magic path — resistance reduces, then durability, then Health.
  //
  // IMPORTANT (bug fix 2026-09-12): armor resistance is ALREADY baked into the
  // defense roll's total via buildDefenseInputs (which folds armorResistance
  // into the mechanics.bonus of the defense roll). If active defense was
  // used, subtracting `armor` here again would double-count the resistance
  // and understate incoming damage.
  //
  //   Active defense case:   afterResistance = effectiveIncoming (armor already counted in defTotal)
  //   Passive / Take Hit:    afterResistance = effectiveIncoming - armor (armor applies here)
  const afterResistance = activeDefense
    ? Math.max(0, effectiveIncoming)
    : Math.max(0, effectiveIncoming - armor);
  if (afterResistance <= 0) {
    return {
      effectiveIncoming,
      afterResistance: 0,
      absorbed: true,
      durabilityDamage: 0,
      healthDamage: 0,
      hpDamage: 0,
      armorBroken: false,
      defended,
      bypassArmor: false,
      damageType,
      wardAbsorbed
    };
  }

  const durabilityDamage = Math.min(afterResistance, dur);
  const healthDamage = afterResistance - durabilityDamage;
  const armorBroken = dur > 0 && durabilityDamage >= dur;

  return {
    effectiveIncoming,
    afterResistance,
    absorbed: false,
    durabilityDamage,
    healthDamage,
    // Legacy alias so existing callers can still read `hpDamage`.
    hpDamage: healthDamage,
    armorBroken,
    defended,
    bypassArmor: false,
    damageType,
    wardAbsorbed
  };
}
