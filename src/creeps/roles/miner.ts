import { RoomData } from "data/room/room";
import { offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { setMovementData } from "creeps/creep";
import { unpackPosition } from "utils/RoomPositionPacker";

export interface MinerMemory extends CreepMemory {
  source: number;
  atPos?: boolean;
  sourcePos?: number;
  sourceId?: Id<Source>;
}

export function miner(creep: Creep): void {
  const memory = creep.memory as MinerMemory;
  const home = Game.rooms[creep.memory.home];
  if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
    return;
  }
  const sourceData = home.memory.genLayout.sources[memory.source];
  if (memory.sourcePos === undefined || memory.sourceId === undefined) {
    const basicRoomData = RoomData(home.name).basicRoomData.get();
    if (basicRoomData === null) {
      RoomData(home.name).basicRoomData.prepare();
      return;
    }
    if (basicRoomData.sources[memory.source] === undefined) {
      return;
    }
    memory.sourcePos = basicRoomData.sources[memory.source].pos;
    memory.sourceId = basicRoomData.sources[memory.source].id;
  }

  if (memory.atPos === undefined) {
    const minerPos = offsetPositionByDirection(unpackPosition(memory.sourcePos), sourceData.container);
    setMovementData(creep, { pos: minerPos, range: 0, heavy: true });
    if (creep.pos.isEqualTo(minerPos)) {
      memory.atPos = true;
    }
  }

  if (memory.atPos) {
    const source = Game.getObjectById(memory.sourceId);
    if (source === null) {
      return;
    }
    if (
      creep.getActiveBodyparts(CARRY) > 0 &&
      home.memory.genBuildings.containers[memory.source + 3].id !== undefined
    ) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const container = Game.getObjectById(home.memory.genBuildings.containers[memory.source + 3].id!);
      if (container instanceof StructureContainer) {
        if (container.hits < container.hitsMax) {
          creep.repair(container);
        }
        if (
          creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 25 &&
          container.store.getUsedCapacity(RESOURCE_ENERGY) > 100
        ) {
          creep.withdraw(container, RESOURCE_ENERGY);
        }
        if (
          creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 ||
          container.store.getFreeCapacity(RESOURCE_ENERGY) >= creep.getActiveBodyparts(WORK) * HARVEST_POWER
        ) {
          creep.harvest(source);
        }
        if (
          creep.room.controller &&
          creep.room.controller.level > 5 &&
          home.memory.genBuildings.links[3 + memory.source].id !== undefined
        ) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const link = Game.getObjectById(home.memory.genBuildings.links[3 + memory.source].id!);
          if (link !== null && link instanceof StructureLink) {
            if (
              link.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
              creep.store.getFreeCapacity(RESOURCE_ENERGY) < creep.getActiveBodyparts(WORK) * HARVEST_POWER
            ) {
              creep.transfer(link, RESOURCE_ENERGY);
            }
          }
        }
      } else {
        creep.harvest(source);
      }
    } else {
      creep.harvest(source);
    }
  }
}
