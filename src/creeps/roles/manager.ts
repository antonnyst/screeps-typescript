import { Building, PowerSpawn, Storage, Terminal } from "buildings";
import { RESOURCE_LIMITS, RESOURCE_TYPE } from "config/constants";

export interface ManagerMemory extends CreepMemory {
  target?: Id<AnyStoreStructure>;
}

export function manager(creep: Creep): void {
  const memory = creep.memory as ManagerMemory;
  const home = Game.rooms[creep.memory.home];
  if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
    return;
  }

  if (creep.store.getUsedCapacity() > 0) {
    if (memory.target !== undefined) {
      const target = Game.getObjectById(memory.target);
      if (target !== null) {
        creep.transfer(target, Object.keys(creep.store)[0] as ResourceConstant);
      }
      memory.target = undefined;
    } else {
      const storage = Storage(home);
      if (storage !== null) {
        creep.transfer(storage, Object.keys(creep.store)[0] as ResourceConstant);
      }
    }
  } else {
    const storage = Storage(home);
    if (storage === null) {
      return;
    }
    const link = Building(home.memory.genBuildings.links[1]) as StructureLink | null;

    if (link !== null && home.memory.linkStatus !== undefined) {
      if (home.memory.linkStatus === "fill" && link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        // Fill the link
        const storageEnergy = storage.store.getUsedCapacity(RESOURCE_ENERGY);
        const fillNeeded = link.store.getFreeCapacity(RESOURCE_ENERGY);
        const possibleAmount = Math.min(fillNeeded, storageEnergy, creep.store.getCapacity());
        if (possibleAmount > 0) {
          creep.withdraw(storage, RESOURCE_ENERGY, possibleAmount);
          memory.target = link.id;
          return;
        }
      }
      if (home.memory.linkStatus === "empty" && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        // Empty the link
        const freeStorage = storage.store.getFreeCapacity(RESOURCE_ENERGY);
        const emptyNeeded = link.store.getUsedCapacity(RESOURCE_ENERGY);
        const possibleAmount = Math.min(freeStorage, emptyNeeded, creep.store.getCapacity());
        if (possibleAmount > 0) {
          creep.withdraw(link, RESOURCE_ENERGY, possibleAmount);
          memory.target = storage.id;
          return;
        }
      }
    }

    const terminal = Terminal(home);

    if (terminal !== null) {
      for (const resource of RESOURCES_ALL) {
        const amount = terminal.store.getUsedCapacity(resource);
        let minAmount = 0;
        let maxAmount = Infinity;
        const resourceType = RESOURCE_TYPE[resource];
        if (resourceType !== undefined) {
          minAmount = RESOURCE_LIMITS[resourceType].terminal.min;
          maxAmount = RESOURCE_LIMITS[resourceType].terminal.max;
        }
        if (amount < minAmount) {
          // Fill the terminal
          const storageAmount = storage.store.getUsedCapacity(resource);
          const targetAmount = minAmount - amount;
          const possibleAmount = Math.min(targetAmount, storageAmount, creep.store.getCapacity());
          if (possibleAmount > 0) {
            creep.withdraw(storage, resource, possibleAmount);
            memory.target = terminal.id;
            return;
          }
        } else if (amount > maxAmount) {
          // Empty the terminal
          const freeCapacity = storage.store.getFreeCapacity(resource);
          const targetAmount = amount - maxAmount;
          const possibleAmount = Math.min(targetAmount, freeCapacity, creep.store.getCapacity());
          if (possibleAmount > 0) {
            creep.withdraw(terminal, resource, possibleAmount);
            memory.target = storage.id;
            return;
          }
        }
      }
    }

    const spawn = Building(home.memory.genBuildings.spawns[0]) as StructureSpawn | null;

    if (spawn !== null) {
      if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        const storageAmount = storage.store.getUsedCapacity(RESOURCE_ENERGY);
        const fillNeeded = spawn.store.getFreeCapacity(RESOURCE_ENERGY);
        const possibleAmount = Math.min(fillNeeded, storageAmount, creep.store.getCapacity());
        if (possibleAmount > 0) {
          creep.withdraw(storage, RESOURCE_ENERGY, possibleAmount);
          memory.target = spawn.id;
          return;
        }
      }
    }

    const powerspawn = PowerSpawn(home);

    if (powerspawn !== null) {
      if (powerspawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        const storageAmount = storage.store.getUsedCapacity(RESOURCE_ENERGY);
        const fillNeeded = powerspawn.store.getFreeCapacity(RESOURCE_ENERGY);
        const possibleAmount = Math.min(fillNeeded, storageAmount, creep.store.getCapacity());
        if (possibleAmount > 0) {
          creep.withdraw(storage, RESOURCE_ENERGY, possibleAmount);
          memory.target = powerspawn.id;
          return;
        }
      }
    }
  }
}
