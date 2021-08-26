import { Building } from "buildings";
import { setMovementData } from "creeps/creep";
import { BuildingData, GenBuildingsData } from "managers/roomManager/layoutHandler";
import { unpackPosition } from "utils/RoomPositionPacker";

export interface QuickFillerMemory extends CreepMemory {
    pos?: number;
    containerIndex: number;
}

export function quickFiller(creep: Creep): void {
    const memory = creep.memory as QuickFillerMemory;
    const home = Game.rooms[creep.memory.home];
    if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
        return;
    }

    if (memory.pos !== undefined) {
        setMovementData(creep, {
            pos: unpackPosition(memory.pos),
            range: 0
        });
        if (unpackPosition(memory.pos).isEqualTo(creep.pos)) {
            memory.pos = undefined;
        }
    } else {
        const targets: (StructureExtension | StructureSpawn | StructureContainer)[] = GetEnergyBuildings(
            home.memory.genBuildings,
            creep
        );

        if (targets.length > 0) {
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.transfer(targets[0], RESOURCE_ENERGY);
            } else {
                let withdrawn = false;
                if (Memory.rooms[memory.home].genBuildings!.links[2].id !== undefined) {
                    const link = Game.getObjectById(Memory.rooms[memory.home].genBuildings!.links[2].id!);
                    if (link !== null && link instanceof StructureLink) {
                        if (
                            link.store.getUsedCapacity(RESOURCE_ENERGY) >=
                            targets[0].store.getFreeCapacity(RESOURCE_ENERGY)
                        ) {
                            creep.withdraw(link, RESOURCE_ENERGY);
                            withdrawn = true;
                        }
                    }
                }
                if (!withdrawn && targets[0].structureType !== STRUCTURE_CONTAINER) {
                    const container = Building(home.memory.genBuildings.containers[memory.containerIndex]);
                    if (container !== null && container instanceof StructureContainer) {
                        if (
                            container.store.getUsedCapacity(RESOURCE_ENERGY) >=
                            targets[0].store.getFreeCapacity(RESOURCE_ENERGY)
                        ) {
                            creep.withdraw(container, RESOURCE_ENERGY);
                        }
                    }
                }
            }
        } else if (
            creep.ticksToLive !== undefined &&
            creep.ticksToLive < 10 &&
            creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        ) {
            const link = Game.getObjectById(Memory.rooms[memory.home].genBuildings!.links[2].id!);
            if (link !== null && link instanceof StructureLink) {
                if (link.store.getFreeCapacity(RESOURCE_ENERGY) >= creep.store.getUsedCapacity(RESOURCE_ENERGY)) {
                    creep.transfer(link, RESOURCE_ENERGY);
                }
            }
        } else if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            const link = Game.getObjectById(Memory.rooms[memory.home].genBuildings!.links[2].id!);
            if (link !== null && link instanceof StructureLink) {
                if (link.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
                    creep.withdraw(link, RESOURCE_ENERGY);
                }
            }
        }
    }
}

function GetEnergyBuildings(
    buildings: GenBuildingsData,
    creep: Creep
): (StructureExtension | StructureSpawn | StructureContainer)[] {
    const structures: (StructureExtension | StructureSpawn | StructureContainer)[] = [];
    for (const building of buildings.spawns) {
        if (building.id !== undefined) {
            const object = Game.getObjectById(building.id);
            if (
                object instanceof StructureSpawn &&
                creep.pos.isNearTo(object.pos) &&
                object.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            ) {
                structures.push(object);
            }
        }
    }
    for (const building of buildings.extensions) {
        if (building.id !== undefined) {
            const object = Game.getObjectById(building.id);
            if (
                (object instanceof StructureExtension || object instanceof StructureSpawn) &&
                creep.pos.isNearTo(object.pos) &&
                object.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            ) {
                structures.push(object);
            }
        }
    }
    const memory = creep.memory as QuickFillerMemory;
    const object = Building(buildings.containers[memory.containerIndex]);
    if (object !== null && object instanceof StructureContainer) {
        if (object.store.getFreeCapacity(RESOURCE_ENERGY) > CONTAINER_CAPACITY * 0.25) {
            structures.push(object);
        }
    }
    return structures;
}
