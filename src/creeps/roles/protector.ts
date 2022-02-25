import { RoomData } from "data/room/room";
import { baseCenter } from "utils/baseCenter";
import { isOwnedRoom } from "../../utils/RoomCalc";
import { setMovementData } from "creeps/creep";

export interface ProtectorMemory extends CreepMemory {
  room?: string;
}

export function protector(creep: Creep): void {
  const memory = creep.memory as ProtectorMemory;
  const home = Game.rooms[creep.memory.home];

  if (memory.room === undefined) {
    memory.room = home.name;
  }

  const hostiles: Creep[] = creep.room.find(FIND_HOSTILE_CREEPS);
  const cores: StructureInvaderCore[] = creep.room.find(FIND_HOSTILE_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_INVADER_CORE
  });

  if (hostiles.length === 0 && cores.length === 0 && creep.room.name === memory.room) {
    let foundRoom = false;
    if (isOwnedRoom(home) && home.memory.remotes !== undefined) {
      for (const remote of home.memory.remotes) {
        if (
          (RoomData(remote).hostiles.get() ?? []).length > 0 ||
          (Game.rooms[remote] !== undefined && Game.rooms[remote].find(FIND_HOSTILE_STRUCTURES).length > 0)
        ) {
          memory.room = remote;
          foundRoom = true;
          break;
        }
      }
    }
    if (!foundRoom) {
      memory.room = home.name;
    }
  } else if (hostiles.length === 0 && cores.length === 0 && creep.room.name !== memory.room) {
    setMovementData(creep, {
      pos: new RoomPosition(25, 25, memory.room),
      range: 23
    });
  }

  if (hostiles.length > 0) {
    const hostile: Creep | null = creep.pos.findClosestByRange(hostiles);
    if (hostile != null) {
      creep.rangedAttack(hostile);
      setMovementData(creep, {
        pos: hostile.pos,
        range: 1
      });
      if (creep.pos.isNearTo(hostile.pos)) {
        creep.attack(hostile);
      } else {
        if (creep.getActiveBodyparts(HEAL) > 0) {
          creep.heal(creep);
        }
      }
    }
  } else if (cores.length > 0) {
    const hostile: StructureInvaderCore | null = creep.pos.findClosestByRange(cores);
    if (hostile != null) {
      creep.rangedAttack(hostile);
      setMovementData(creep, {
        pos: hostile.pos,
        range: 1
      });
      if (creep.pos.isNearTo(hostile.pos)) {
        creep.attack(hostile);
      }
    }
  } else if (creep.room.name === memory.home && memory.room === memory.home) {
    const cpos = baseCenter(home);
    if (creep.pos.getRangeTo(cpos) === 1) {
      setMovementData(creep, {
        pos: cpos,
        range: 2,
        flee: true
      });
    } else {
      setMovementData(creep, {
        pos: cpos,
        range: 3
      });
    }
  }
}
