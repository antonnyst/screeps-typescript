import { RoomData } from "data/room/room";
import { offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { setMovementData } from "creeps/creep";
import { unpackPosition } from "utils/RoomPositionPacker";

export interface HaulerMemory extends CreepMemory {
  source: number;
  gathering?: boolean;
  sourcePos?: number;
}

export function hauler(creep: Creep): void {
  const memory = creep.memory as HaulerMemory;
  const home = Game.rooms[creep.memory.home];
  if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
    return;
  }
  const sourceData = home.memory.genLayout.sources[memory.source];
  if (memory.sourcePos === undefined) {
    const basicRoomData = RoomData(home.name).basicRoomData.get();
    if (basicRoomData === null) {
      RoomData(home.name).basicRoomData.prepare();
      return;
    }
    if (basicRoomData.sources[memory.source] === undefined) {
      return;
    }
    memory.sourcePos = basicRoomData.sources[memory.source].pos;
  }

  memory.gathering = memory.gathering ?? true;

  if (memory.gathering && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    memory.gathering = false;
  }
  if (!memory.gathering && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    memory.gathering = true;
  }

  if (memory.gathering) {
    const minerPos: RoomPosition = offsetPositionByDirection(unpackPosition(memory.sourcePos), sourceData.container);
    setMovementData(creep, { pos: minerPos, range: 1 });
    if (creep.pos.isNearTo(minerPos)) {
      if (home.memory.genBuildings.containers[memory.source + 3].id !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const container = Game.getObjectById(home.memory.genBuildings.containers[memory.source + 3].id!);
        if (container instanceof StructureContainer) {
          if (container.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
            creep.withdraw(container, RESOURCE_ENERGY);
          }
        }
      }
    }
  } else {
    // TODO: Add target locking
    let target: StructureContainer | StructureStorage | null = null;
    if (home.memory.genBuildings.containers[2].id !== undefined) {
      const container = Game.getObjectById(home.memory.genBuildings.containers[2].id);
      if (
        container instanceof StructureContainer &&
        container.store.getFreeCapacity(RESOURCE_ENERGY) > creep.store.getUsedCapacity(RESOURCE_ENERGY)
      ) {
        target = container;
      }
    }

    if (target === null && home.memory.genBuildings.storage.id !== undefined) {
      const storage = Game.getObjectById(home.memory.genBuildings.storage.id);
      if (
        storage instanceof StructureStorage &&
        storage.store.getFreeCapacity(RESOURCE_ENERGY) >= creep.store.getUsedCapacity(RESOURCE_ENERGY)
      ) {
        target = storage;
      }
    }

    if (target != null) {
      setMovementData(creep, {
        pos: target.pos,
        range: 1
      });
      if (creep.pos.isNearTo(target.pos)) {
        creep.transfer(target, RESOURCE_ENERGY);
      }
    }
  }
}
