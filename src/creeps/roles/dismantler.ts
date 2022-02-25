import { setMovementData } from "../creep";

export interface DismantlerMemory extends CreepMemory {
  room: string;
  targets?: Id<AnyStructure>[];
}

export function dismantler(creep: Creep): void {
  const memory = creep.memory as DismantlerMemory;

  if (memory.targets === undefined) {
    memory.targets = [];
  }

  if (creep.room.name === memory.room) {
    if (memory.targets.length > 0) {
      const target = Game.getObjectById(memory.targets[0]);
      if (target !== null) {
        setMovementData(creep, {
          pos: target.pos,
          range: 1
        });
        if (creep.pos.isNearTo(target)) {
          creep.dismantle(target);
        }
      } else {
        memory.targets.shift();
      }
    }
  } else {
    setMovementData(creep, {
      pos: new RoomPosition(25, 25, memory.room),
      range: 23
    });
  }
}
