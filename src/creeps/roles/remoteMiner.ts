import { setMovementData } from "creeps/creep";
import { offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { unpackPosition } from "utils/RoomPositionPacker";

export interface RemoteMinerMemory extends CreepMemory {
    room: string;
    source: number;
}

export function remoteMiner(creep: Creep) {
    const memory = creep.memory as RemoteMinerMemory;
    const home = Game.rooms[creep.memory.home];
    if (home.memory.remoteData?.data[memory.room] === undefined) {
        return;
    }
    const sourceData = home.memory.remoteData?.data[memory.room].sources[memory.source];
    if (sourceData === undefined) {
        return;
    }
    const containerPos = offsetPositionByDirection(unpackPosition(sourceData.pos), sourceData.container);

    setMovementData(creep, {
        pos: containerPos,
        range: 0,
        heavy: true
    });

    if (creep.pos.isEqualTo(containerPos)) {
        const source: Source | null = Game.getObjectById(sourceData.id);
        if (source === null) {
            console.log("invalid source");
            return;
        }

        const container: StructureContainer = _.filter(
            containerPos.lookFor(LOOK_STRUCTURES),
            (s: Structure) => s.structureType === STRUCTURE_CONTAINER
        )[0] as StructureContainer;

        if (
            container === undefined ||
            creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 ||
            container.store.getFreeCapacity(RESOURCE_ENERGY) >= creep.getActiveBodyparts(WORK) * 5
        ) {
            creep.harvest(source);
        }
        if (creep.getActiveBodyparts(CARRY) > 0 && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            if (container !== undefined && container.hits < container.hitsMax) {
                creep.repair(container);
                if (creep.store.getUsedCapacity(RESOURCE_ENERGY) < 20) {
                    creep.withdraw(container, RESOURCE_ENERGY);
                }
            }
            if (container === undefined) {
                containerPos.createConstructionSite(STRUCTURE_CONTAINER);

                const site = _.filter(
                    containerPos.lookFor(LOOK_CONSTRUCTION_SITES),
                    (s: Structure) => s.structureType === STRUCTURE_CONTAINER
                )[0];
                if (site !== undefined) {
                    creep.build(site);
                }
            }
        }
    }
}
