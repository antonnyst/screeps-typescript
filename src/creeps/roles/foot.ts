import { getEnergy, setMovementData } from "../creep";
import { Spawns } from "buildings";

export interface FootMemory extends CreepMemory {
  energy?: boolean;
}

export function foot(creep: Creep): void {
  const memory = creep.memory as FootMemory;
  const home = Game.rooms[creep.memory.home];

  if (memory.energy === undefined) {
    memory.energy = false;
  }
  if (memory.energy === false && creep.store.getFreeCapacity() === 0) {
    memory.energy = true;
  }
  if (memory.energy === true && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    memory.energy = false;
  }

  if (memory.energy === false) {
    getEnergy(creep);
  } else {
    const targets = Spawns(home);
    if (targets !== null) {
      if (targets.length === 0) {
        if (home.controller && home.controller.level < 2) {
          setMovementData(creep, {
            pos: home.controller.pos,
            range: 3
          });
          if (creep.pos.inRangeTo(home.controller, 3)) {
            creep.upgradeController(home.controller);
          }
        } else {
          const ramparts = home.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_RAMPART && s.hits < 5000
          });
          if (ramparts.length > 0) {
            setMovementData(creep, {
              pos: ramparts[0].pos,
              range: 3
            });
            if (creep.pos.inRangeTo(ramparts[0].pos, 3)) {
              creep.repair(ramparts[0]);
            }
          } else {
            const constructionSites = home.find(FIND_MY_CONSTRUCTION_SITES);
            if (constructionSites.length > 0) {
              setMovementData(creep, {
                pos: constructionSites[0].pos,
                range: 3
              });
              if (creep.pos.inRangeTo(constructionSites[0].pos, 3)) {
                creep.build(constructionSites[0]);
              }
            }
          }
        }
      } else if (targets[0] !== undefined) {
        setMovementData(creep, {
          pos: targets[0].pos,
          range: 1
        });
        if (creep.pos.isNearTo(targets[0])) {
          creep.transfer(targets[0], RESOURCE_ENERGY);
        }
      }
    } else {
      const spawns = home.find(FIND_MY_SPAWNS);
      if (spawns.length > 0) {
        setMovementData(creep, {
          pos: spawns[0].pos,
          range: 1
        });
        if (creep.pos.isNearTo(spawns[0])) {
          creep.transfer(spawns[0], RESOURCE_ENERGY);
        }
      }
    }
  }
}
