import { Terminal } from "buildings";
import { setMovementData } from "creeps/creep";
import { RoomData } from "data/room/room";
import { offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { unpackPosition } from "utils/RoomPositionPacker";

export interface MineralHaulerMemory extends CreepMemory {
    gathering?: boolean;
    mineralPos?: number;
    mineralId?: Id<Mineral>;
}

export function mineralHauler(creep: Creep) {
    const memory = creep.memory as MineralHaulerMemory;
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

    memory.gathering = memory.gathering ?? true;
    if (memory.gathering && creep.store.getFreeCapacity() === 0) {
        memory.gathering = false;
    }
    if (!memory.gathering && creep.store.getUsedCapacity() === 0) {
        memory.gathering = true;
    }

    if (memory.gathering) {
        const minerPos = offsetPositionByDirection(
            unpackPosition(memory.mineralPos),
            home.memory.genLayout.mineral.container
        );

        setMovementData(creep, {
            pos: minerPos,
            range: 1
        });

        if (creep.pos.isNearTo(minerPos)) {
            if (home.memory.genBuildings.containers[5].id === undefined) {
                return;
            }
            const container = Game.getObjectById(home.memory.genBuildings.containers[5].id);
            if (container === null || !(container instanceof StructureContainer)) {
                return;
            }
            const mineral = Game.getObjectById(memory.mineralId);
            if (mineral === null) {
                return;
            }
            const resourceType = mineral.mineralType;
            if (
                container.store.getUsedCapacity(resourceType) >= creep.store.getFreeCapacity() ||
                (container.store.getUsedCapacity(resourceType) > 0 && mineral.mineralAmount === 0)
            ) {
                creep.withdraw(container, resourceType);
            }
        }
    } else {
        const target = Terminal(home);
        if (target !== null) {
            setMovementData(creep, {
                pos: target.pos,
                range: 1
            });

            if (creep.pos.isNearTo(target)) {
                const mineral = Game.getObjectById(memory.mineralId);
                if (mineral === null) {
                    return;
                }
                const resourceType = mineral.mineralType;
                creep.transfer(target, resourceType);
            }
        }
    }
}
