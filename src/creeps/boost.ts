import { setMovementData } from "./creep";

declare global {
  interface CreepMemory {
    boost?: Partial<Record<MineralBoostConstant, number>>;
  }
}

export function boost(creep: Creep): void {
  const home = Game.rooms[creep.memory.home];
  if (creep.memory.boost && Object.keys(creep.memory.boost).length > 0) {
    const pair = Object.entries(creep.memory.boost)[0];
    const resource = pair[0] as MineralBoostConstant;
    const amount = pair[1];

    const labs = home.find(FIND_MY_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_LAB &&
        s.mineralType === resource &&
        s.store.getUsedCapacity(resource) >= LAB_BOOST_MINERAL * amount
    });
    const lab = creep.pos.findClosestByRange(labs) as StructureLab | null;
    if (lab !== null) {
      setMovementData(creep, {
        pos: lab.pos,
        range: 1
      });
      if (creep.pos.isNearTo(lab)) {
        lab.boostCreep(creep, amount);
        delete creep.memory.boost[resource];
      }
    }
  }
  if (creep.memory.boost && Object.keys(creep.memory.boost).length === 0) {
    delete creep.memory.boost;
  }
}

/*
Memory.rooms.E2N47.spawnQueue.push({pattern: "t5m17h13r15",energy: 12900,memory: {role: "swarmling",boost: {"LO": 13,"GHO2": 5},room: "E2N48"}});
*/
