import { RoomData } from "data/room/room";
import { offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { setMovementData } from "creeps/creep";
import { unpackPosition } from "utils/RoomPositionPacker";

export interface MineralMinerMemory extends CreepMemory {
  mineralPos?: number;
  mineralId?: Id<Mineral>;
}

export function mineralMiner(creep: Creep): void {
  const memory = creep.memory as MineralMinerMemory;
  const home = Game.rooms[creep.memory.home];
  if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
    return;
  }

  if (memory.mineralPos === undefined || memory.mineralId === undefined) {
    const basicRoomData = RoomData(home.name).basicRoomData.get();
    if (basicRoomData === null) {
      RoomData(home.name).basicRoomData.prepare();
      return;
    }
    if (basicRoomData.mineral === null) {
      return;
    }
    memory.mineralPos = basicRoomData.mineral.pos;
    memory.mineralId = basicRoomData.mineral.id;
  }

  const minerPos = offsetPositionByDirection(
    unpackPosition(memory.mineralPos),
    home.memory.genLayout.mineral.container
  );
  const mineral = Game.getObjectById(memory.mineralId);
  if (mineral === null) {
    return;
  }
  if (home.memory.genBuildings.containers[5].id === undefined) {
    return;
  }
  const container = Game.getObjectById(home.memory.genBuildings.containers[5].id);
  if (container === null || !(container instanceof StructureContainer)) {
    return;
  }
  setMovementData(creep, { pos: minerPos, range: 0, heavy: true });
  if (
    creep.pos.isEqualTo(minerPos) &&
    container.store.getFreeCapacity() >= creep.getActiveBodyparts(WORK) * HARVEST_MINERAL_POWER
  ) {
    creep.harvest(mineral);
  }
}
