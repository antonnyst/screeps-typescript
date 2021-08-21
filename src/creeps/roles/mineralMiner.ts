import { setMovementData } from "creeps/creep";
import { offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { unpackPosition } from "utils/RoomPositionPacker";

export function mineralMiner(creep: Creep) {
    const memory = creep.memory;
    const home = Game.rooms[creep.memory.home];
    if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
        return;
    }

    const minerPos = offsetPositionByDirection(
        unpackPosition(home.memory.basicRoomData.mineral!.pos),
        home.memory.genLayout.mineral.container
    );
    const mineral = Game.getObjectById(home.memory.basicRoomData.mineral!.id);
    if (mineral === null) {
        return;
    }
    if (home.memory.genBuildings.containers[3].id === undefined) {
        return;
    }
    const container = Game.getObjectById(home.memory.genBuildings.containers[3].id);
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
