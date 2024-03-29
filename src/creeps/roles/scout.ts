import { PLAYER_USERNAME } from "utils/username";
import { isOwnedRoom } from "../../utils/RoomCalc";
import { setMovementData } from "creeps/creep";

export interface ScoutMemory extends CreepMemory {
  room?: string;
}

export function scout(creep: Creep): void {
  const memory = creep.memory as ScoutMemory;
  const home = Game.rooms[creep.memory.home];

  if (!isOwnedRoom(home)) {
    return;
  }

  // Remove signs from owned rooms
  if (
    creep.room.controller !== undefined &&
    (creep.room.controller.my ||
      (creep.room.controller.reservation !== undefined &&
        creep.room.controller.reservation.username === PLAYER_USERNAME)) &&
    creep.room.controller.sign !== undefined
  ) {
    setMovementData(creep, {
      pos: creep.room.controller.pos,
      range: 1
    });
    if (creep.pos.isNearTo(creep.room.controller)) {
      creep.signController(creep.room.controller, "");
    }
    return;
  }

  // Find rooms to scout
  if (creep.room.name === memory.room) {
    if (home.memory.scoutTargets !== undefined && home.memory.scoutTargets.length > 0) {
      home.memory.scoutTargets = home.memory.scoutTargets.filter(r => r !== memory.room);
    }
    memory.room = undefined;
  }

  if (memory.room === undefined) {
    if (home.memory.scoutTargets !== undefined && home.memory.scoutTargets.length > 0) {
      let closestRoom;
      let closestDistance = Infinity;
      for (const room of home.memory.scoutTargets) {
        const distance = Game.map.getRoomLinearDistance(creep.room.name, room);
        if (distance < closestDistance) {
          closestRoom = room;
          closestDistance = distance;
        }
      }

      if (closestRoom !== undefined) {
        memory.room = closestRoom;
      }
    }
  }

  // Move to target room
  if (memory.room !== undefined) {
    setMovementData(creep, {
      pos: new RoomPosition(25, 25, memory.room),
      range: 23
    });
  }
}
