import { setMovementData } from "../creep";

export interface SwarmlingMemory extends CreepMemory {
  room: string;
}

export function swarmling(creep: Creep): void {
  const memory = creep.memory as SwarmlingMemory;

  if (creep.getActiveBodyparts(HEAL) > 0) {
    creep.heal(creep);
  }

  const hostiles = creep.room.find(FIND_HOSTILE_CREEPS, {
    filter: c => c.getActiveBodyparts(ATTACK) || c.getActiveBodyparts(RANGED_ATTACK) || c.getActiveBodyparts(HEAL)
  });
  if (hostiles.length > 0) {
    const closestHostile = creep.pos.findClosestByRange(hostiles);
    if (closestHostile !== null) {
      if (closestHostile.pos.getRangeTo(creep) < 3) {
        setMovementData(creep, {
          pos: closestHostile.pos,
          range: 5,
          flee: true
        });
      } else {
        setMovementData(creep, {
          pos: closestHostile.pos,
          range: 3
        });
      }
      if (closestHostile.pos.getRangeTo(creep) <= 3) {
        creep.rangedAttack(closestHostile);
      }
      return;
    }
  }
  if (creep.room.name !== memory.room) {
    setMovementData(creep, {
      pos: new RoomPosition(25, 25, memory.room),
      range: 23
    });
    return;
  }

  const hostileCloseStructures = creep.pos.findInRange(FIND_HOSTILE_STRUCTURES, 3);
  const hostileCloseCreeps = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3);
  if (hostileCloseCreeps.length + hostileCloseStructures.length >= 4) {
    creep.rangedMassAttack();
  }

  const hostileTowers = creep.room.find(FIND_HOSTILE_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_TOWER
  });
  if (hostileTowers.length > 0) {
    const closestHostile = creep.pos.findClosestByRange(hostileTowers);
    if (closestHostile !== null) {
      setMovementData(creep, {
        pos: closestHostile.pos,
        range: 3
      });
      if (closestHostile.pos.getRangeTo(creep) <= 3) {
        creep.rangedAttack(closestHostile);
      }
      return;
    }
  }

  const spawns = creep.room.find(FIND_HOSTILE_SPAWNS);
  if (spawns.length > 0) {
    setMovementData(creep, {
      pos: spawns[0].pos,
      range: 3
    });
    if (spawns[0].pos.getRangeTo(creep) <= 3) {
      creep.rangedAttack(spawns[0]);
    } else {
      const closestHostile = creep.pos.findClosestByRange(creep.room.find(FIND_HOSTILE_CREEPS));
      if (closestHostile !== null) {
        if (creep.pos.getRangeTo(closestHostile) <= 3) {
          creep.rangedAttack(closestHostile);
        }
      }
    }
    return;
  }

  const allHostiles = creep.room.find(FIND_HOSTILE_CREEPS);
  if (allHostiles.length > 0) {
    const closestHostile = creep.pos.findClosestByRange(allHostiles);
    if (closestHostile !== null) {
      if (closestHostile.pos.getRangeTo(creep) < 3) {
        setMovementData(creep, {
          pos: closestHostile.pos,
          range: 5,
          flee: true
        });
      } else {
        setMovementData(creep, {
          pos: closestHostile.pos,
          range: 3
        });
      }
      if (closestHostile.pos.getRangeTo(creep) <= 3) {
        creep.rangedAttack(closestHostile);
      }
      return;
    }
  }

  const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES, {
    filter: s => s.structureType !== STRUCTURE_CONTROLLER
  });
  if (hostileStructures.length > 0) {
    const closestHostile = creep.pos.findClosestByRange(hostileStructures);
    if (closestHostile !== null) {
      setMovementData(creep, {
        pos: closestHostile.pos,
        range: 3
      });
      if (closestHostile.pos.getRangeTo(creep) <= 3) {
        creep.rangedAttack(closestHostile);
      }
      return;
    }
  }
  setMovementData(creep, {
    pos: new RoomPosition(25, 25, creep.room.name),
    range: 5
  });
}
