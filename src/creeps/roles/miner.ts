import { setMovementData } from "creeps/creep";
import { offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { unpackPosition } from "utils/RoomPositionPacker";

export interface MinerMemory extends CreepMemory {
    source: number;
    atPos?: boolean;
}

export function miner(creep: Creep) {
    const memory = creep.memory as MinerMemory;
    const home = Game.rooms[creep.memory.home];
    if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
        return;
    }
    const sourceData = home.memory.genLayout!.sources[memory.source];
    const basicSourceData = home.memory.basicRoomData.sources[memory.source];
    if (sourceData === undefined || basicSourceData === undefined) {
        return;
    }

    if (memory.atPos === undefined) {
        const minerPos = offsetPositionByDirection(unpackPosition(basicSourceData.pos), sourceData.container);
        setMovementData(creep, { pos: minerPos, range: 0, heavy: true });
        if (creep.pos.isEqualTo(minerPos)) {
            memory.atPos = true;
        }
    }

    if (memory.atPos) {
        const source = Game.getObjectById(basicSourceData.id);
        if (source === null) {
            return;
        }
        if (
            creep.getActiveBodyparts(CARRY) > 0 &&
            home.memory.genBuildings.containers[memory.source].id !== undefined
        ) {
            const container = Game.getObjectById(home.memory.genBuildings.containers[memory.source].id!);
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
                    const link = Game.getObjectById(home.memory.genBuildings.links[3 + memory.source].id!);
                    if (link !== null && link instanceof StructureLink) {
                        if (
                            link.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                            creep.store.getUsedCapacity(RESOURCE_ENERGY) >=
                                50 - creep.getActiveBodyparts(WORK) * HARVEST_POWER
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
