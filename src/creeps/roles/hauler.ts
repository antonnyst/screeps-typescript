import { setMovementData } from "creeps/creep";
import { offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { unpackPosition } from "utils/RoomPositionPacker";

export interface HaulerMemory extends CreepMemory {
    source: number;
    gathering?: boolean;
}

export function hauler(creep: Creep) {
    const memory = creep.memory as HaulerMemory;
    const home = Game.rooms[creep.memory.home];
    if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
        return;
    }
    const sourceData = home.memory.genLayout!.sources[memory.source];
    const basicSourceData = home.memory.basicRoomData.sources[memory.source];
    if (sourceData === undefined || basicSourceData === undefined) {
        return;
    }

    memory.gathering = memory.gathering ?? true;

    if (memory.gathering && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        memory.gathering = false;
    }
    if (!memory.gathering && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        memory.gathering = true;
    }

    if (memory.gathering) {
        const minerPos: RoomPosition = offsetPositionByDirection(
            unpackPosition(basicSourceData.pos),
            sourceData.container
        );
        setMovementData(creep, { pos: minerPos, range: 1 });
        if (creep.pos.isNearTo(minerPos)) {
            if (home.memory.genBuildings.containers[memory.source + 3].id !== undefined) {
                const container = Game.getObjectById(home.memory.genBuildings.containers[memory.source + 3].id!);
                if (container instanceof StructureContainer) {
                    if (
                        container.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getFreeCapacity(RESOURCE_ENERGY)
                    ) {
                        creep.withdraw(container, RESOURCE_ENERGY);
                    }
                }
            }
        }
    } else {
        // TODO: Add target locking
        let target: StructureContainer | StructureStorage | null = null;
        if (home.memory.genBuildings.containers[2].id !== undefined) {
            const container = Game.getObjectById(home.memory.genBuildings.containers[2].id!);
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
