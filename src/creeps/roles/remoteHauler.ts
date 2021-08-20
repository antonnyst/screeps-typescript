import { onEdge, setMovementData } from "creeps/creep";
import { offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { unpackPosition } from "utils/RoomPositionPacker";

export interface RemoteHaulerMemory extends CreepMemory {
    room: string;
    source: number;
    working?: boolean;
}

export function remoteHauler(creep: Creep) {
    const memory = creep.memory as RemoteHaulerMemory;
    const home = Game.rooms[creep.memory.home];
    const sourceData = home.memory.remoteData?.data[memory.room].sources[memory.source];
    if (sourceData === undefined) {
        return;
    }
    const containerPos = offsetPositionByDirection(unpackPosition(sourceData.pos), sourceData.container);

    if (creep.memory.working === undefined) {
        creep.memory.working = false;
    }

    if (creep.memory.working === false && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
    }

    if (creep.memory.working === true && creep.store.getUsedCapacity() === 0) {
        creep.memory.working = false;
        if (creep.ticksToLive !== undefined && creep.ticksToLive < sourceData.dist * 2) {
            //we do not have enough time to live
            //so we should recycle ourself!
            creep.memory.role = "garbage";
            return;
        }
    }

    if (creep.memory.working === false) {
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
                container != null &&
                container.store.getUsedCapacity() > container.store.getUsedCapacity(RESOURCE_ENERGY)
            ) {
                creep.withdraw(
                    container,
                    _.filter(Object.keys(container.store), (s) => s !== "energy")[0] as ResourceConstant
                );
            } else if (
                container !== undefined &&
                container.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getFreeCapacity()
            ) {
                creep.withdraw(container, RESOURCE_ENERGY);
            }
        }
    } else {
        let target: AnyStoreStructure | null = null;
        if (creep.memory.target !== undefined) {
            target = Game.getObjectById(creep.memory.target);
        }

        if (target === null && Memory.rooms[creep.memory.home].genBuildings?.storage?.id !== undefined) {
            const storage = Game.getObjectById(Memory.rooms[creep.memory.home].genBuildings!.storage.id!);
            if (storage instanceof StructureStorage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                target = storage;
            }
        }

        if (target === null && Memory.rooms[creep.memory.home].genBuildings?.containers[0].id !== undefined) {
            const container = Game.getObjectById(Memory.rooms[creep.memory.home].genBuildings!.containers[0].id!);
            if (container instanceof StructureContainer && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                target = container;
            }
        }

        if (target === null) {
            const targets = Game.rooms[creep.memory.home].find(FIND_MY_STRUCTURES, {
                filter: (s) =>
                    (s.structureType === STRUCTURE_EXTENSION ||
                        s.structureType === STRUCTURE_SPAWN ||
                        s.structureType === STRUCTURE_TOWER) &&
                    (s.store.getFreeCapacity(RESOURCE_ENERGY) as number) > 0
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
            creep.memory.target = target.id;
            if (creep.pos.isNearTo(target.pos)) {
                if (
                    ((target instanceof StructureExtension ||
                        target instanceof StructureSpawn ||
                        target instanceof StructureTower) &&
                        target.store.getFreeCapacity(Object.keys(creep.store)[0] as ResourceConstant) === 0) ||
                    ((target instanceof StructureContainer || target instanceof StructureStorage) &&
                        target.store.getFreeCapacity(Object.keys(creep.store)[0] as ResourceConstant) === 0)
                ) {
                    creep.memory.target = undefined;
                } else {
                    creep.transfer(target, Object.keys(creep.store)[0] as ResourceConstant);
                }
            }
        } else if (!onEdge(creep)) {
            const cpos = new RoomPosition(
                home.memory.genLayout!.prefabs[0].x,
                home.memory.genLayout!.prefabs[0].y,
                home.name
            );
            setMovementData(creep, {
                pos: cpos,
                range: 1
            });
        }
    }
}
