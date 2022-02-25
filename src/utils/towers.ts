export function CalculateTowerDamage(tower: StructureTower, target: RoomPosition): number {
  if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < TOWER_ENERGY_COST) {
    return 0;
  }
  let range = tower.pos.getRangeTo(target);
  let amount = TOWER_POWER_ATTACK;
  if (range > TOWER_OPTIMAL_RANGE) {
    if (range > TOWER_FALLOFF_RANGE) {
      range = TOWER_FALLOFF_RANGE;
    }
    amount -= (amount * TOWER_FALLOFF * (range - TOWER_OPTIMAL_RANGE)) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
  }
  if (tower.effects !== undefined) {
    for (const effect of tower.effects) {
      if (effect.effect === PWR_OPERATE_TOWER || effect.effect === PWR_DISRUPT_TOWER) {
        amount *= POWER_INFO[effect.effect].effect[effect.level - 1];
      }
    }
  }
  amount = Math.floor(amount);
  return amount;
}

export function CalculateTowerHeal(tower: StructureTower, target: RoomPosition): number {
  if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < TOWER_ENERGY_COST) {
    return 0;
  }
  let range = tower.pos.getRangeTo(target);
  let amount = TOWER_POWER_HEAL;
  if (range > TOWER_OPTIMAL_RANGE) {
    if (range > TOWER_FALLOFF_RANGE) {
      range = TOWER_FALLOFF_RANGE;
    }
    amount -= (amount * TOWER_FALLOFF * (range - TOWER_OPTIMAL_RANGE)) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
  }
  if (tower.effects !== undefined) {
    for (const effect of tower.effects) {
      if (effect.effect === PWR_OPERATE_TOWER || effect.effect === PWR_DISRUPT_TOWER) {
        amount *= POWER_INFO[effect.effect].effect[effect.level - 1];
      }
    }
  }

  amount = Math.floor(amount);
  return amount;
}
