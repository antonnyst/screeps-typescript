import { onEdge, setMovementData } from "creeps/creep";
import { baseCenter } from "utils/baseCenter";
import { offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { unpackPosition } from "utils/RoomPositionPacker";

export interface RemoteHaulerMemory extends CreepMemory {
  room: string;
  source: number;
  working?: boolean;
  target?: Id<AnyStoreStructure>;
}

export function remoteHauler(creep: Creep): void {
  const memory = creep.memory as RemoteHaulerMemory;
  const home = Game.rooms[creep.memory.home];
  if (home.memory.remoteData?.data[memory.room] === undefined) {
    return;
  }
  const sourceData = home.memory.remoteData?.data[memory.room].sources[memory.source];
  if (sourceData === undefined) {
    return;
  }
  const containerPos = offsetPositionByDirection(unpackPosition(sourceData.pos), sourceData.container);

  if (memory.working === undefined) {
    memory.working = false;
  }

  if (memory.working === false && creep.store.getFreeCapacity() === 0) {
    memory.working = true;
  }

  if (memory.working === true && creep.store.getUsedCapacity() === 0) {
    memory.working = false;
    if (creep.ticksToLive !== undefined && creep.ticksToLive < sourceData.dist * 2) {
      // we do not have enough time to live
      // so we should recycle ourself!
      creep.memory.role = "garbage";
      return;
    }
  }

  if (memory.working === false) {
    setMovementData(creep, {
      pos: containerPos,
      range: 1
    });
    if (creep.pos.isNearTo(containerPos)) {
      let container: StructureContainer | null = null;

      if (container === null) {
        container = _.filter(
          containerPos.lookFor(LOOK_STRUCTURES),
          (s: Structure) => s.structureType === STRUCTURE_CONTAINER
        )[0] as StructureContainer;
      }

      if (
        container !== null &&
        container !== undefined &&
        container.store.getUsedCapacity() > container.store.getUsedCapacity(RESOURCE_ENERGY)
      ) {
        creep.withdraw(container, _.filter(Object.keys(container.store), s => s !== "energy")[0] as ResourceConstant);
      } else if (
        container !== null &&
        container !== undefined &&
        container.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getFreeCapacity()
      ) {
        creep.withdraw(container, RESOURCE_ENERGY);
      } else {
        const dropped = containerPos.findInRange(FIND_DROPPED_RESOURCES, 0);
        if (
          dropped.length > 0 &&
          (dropped[0].resourceType !== RESOURCE_ENERGY || dropped[0].amount >= creep.store.getFreeCapacity())
        ) {
          creep.pickup(dropped[0]);
        }
      }
    }
  } else {
    let target: AnyStoreStructure | null = null;
    if (memory.target !== undefined) {
      target = Game.getObjectById(memory.target);
    }

    if (target === null && Memory.rooms[memory.home].genBuildings?.storage?.id !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const storage = Game.getObjectById(Memory.rooms[memory.home].genBuildings!.storage.id!);
      if (storage instanceof StructureStorage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        target = storage;
      }
    }

    if (target === null && Memory.rooms[memory.home].genBuildings?.containers[2].id !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const container = Game.getObjectById(Memory.rooms[memory.home].genBuildings!.containers[2].id!);
      if (container instanceof StructureContainer && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        target = container;
      }
    }

    if (target === null) {
      const targets = Game.rooms[memory.home].find(FIND_MY_STRUCTURES, {
        filter: s =>
          (s.structureType === STRUCTURE_EXTENSION ||
            s.structureType === STRUCTURE_SPAWN ||
            s.structureType === STRUCTURE_TOWER) &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      });
      if (targets.length > 0) {
        target = targets[0] as AnyStoreStructure;
      }
    }

    if (target !== null) {
      setMovementData(creep, {
        pos: target.pos,
        range: 1
      });
      memory.target = target.id;
      if (creep.pos.isNearTo(target.pos)) {
        if (
          ((target instanceof StructureExtension ||
            target instanceof StructureSpawn ||
            target instanceof StructureTower) &&
            target.store.getFreeCapacity(Object.keys(creep.store)[0] as ResourceConstant) === 0) ||
          ((target instanceof StructureContainer || target instanceof StructureStorage) &&
            target.store.getFreeCapacity(Object.keys(creep.store)[0] as ResourceConstant) === 0)
        ) {
          memory.target = undefined;
        } else {
          creep.transfer(target, Object.keys(creep.store)[0] as ResourceConstant);
        }
      }
    } else if (!onEdge(creep)) {
      const cpos = baseCenter(home);
      setMovementData(creep, {
        pos: cpos,
        range: 1
      });
    }
  }
}
