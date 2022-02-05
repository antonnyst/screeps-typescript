import { packPosition, unpackPosition } from "utils/RoomPositionPacker";

declare global {
    interface CreepMemory {
        home: RoomName;
    }
}

type RoomName = string;

interface MovementArguments {
    pos: RoomPosition | number;
    range: number;
    flee?: boolean;
    heavy?: boolean;
}

/**
 * Set movement data for the movementManager
 * @param creep The creep to be moved
 * @param args Arguments for movement
 */
export function setMovementData(creep: Creep, args: MovementArguments): void {
    const pos = args.pos instanceof RoomPosition ? packPosition(args.pos) : args.pos;

    if (creep.memory.movementData === undefined) {
        creep.memory.movementData = {
            targetPos: pos,
            range: args.range,
            flee: args?.flee || false,
            heavy: args?.heavy || false
        };
    } else if (
        creep.memory.movementData.targetPos !== pos ||
        creep.memory.movementData.range !== args.range ||
        creep.memory.movementData.flee !== (args?.flee || false) ||
        creep.memory.movementData.heavy !== (args?.heavy || false)
    ) {
        creep.memory.movementData = {
            targetPos: args.pos instanceof RoomPosition ? packPosition(args.pos) : args.pos,
            range: args.range,
            flee: args?.flee || false,
            heavy: args?.heavy || false,
            _path: undefined,
            _pathName: undefined
        };
    }
}

/**
 * Removes movementData for the movementManager
 * @param creep The creep to not move
 */
export function cancelMovementData(creep: Creep): void {
    creep.memory.movementData = undefined;
}

interface GetEnergyMemory extends CreepMemory {
    getEnergyTarget?: Id<Structure | Resource | Tombstone | Ruin | Source>;
}

/**
 * Gets energy from the creeps home room
 * @param creep The creep that should get energy
 */
export function getEnergy(creep: Creep): void {
    const memory = creep.memory as GetEnergyMemory;
    const home = Game.rooms[creep.memory.home];

    if (creep.room.name !== memory.home) {
        setMovementData(creep, { pos: new RoomPosition(25, 25, memory.home), range: 24 });
        return;
    }

    let target: Structure | Resource | Tombstone | Ruin | Source | null = null;

    if (memory.getEnergyTarget !== undefined) {
        target = Game.getObjectById(memory.getEnergyTarget);
    }

    if (target === null) {
        target = getEnergyTarget(creep);
    }

    if (target !== null) {
        memory.getEnergyTarget = target.id;
        setMovementData(creep, {
            pos: target.pos,
            range: 1
        });

        if (target instanceof Structure) {
            if (target instanceof StructureLink) {
                if (target.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                    memory.getEnergyTarget = undefined;
                }
            }
            if (target instanceof StructureContainer || target instanceof StructureStorage) {
                if (target.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                    memory.getEnergyTarget = undefined;
                }
            }
        }

        if (creep.pos.isNearTo(target.pos)) {
            if (target instanceof Resource) {
                creep.pickup(target);
                memory.getEnergyTarget = undefined;
            } else if (target instanceof Source) {
                creep.harvest(target);
                memory.getEnergyTarget = undefined;
            } else if (target instanceof Ruin || target instanceof Tombstone || target instanceof Structure) {
                creep.withdraw(target, RESOURCE_ENERGY);
                memory.getEnergyTarget = undefined;
            }
        }
    }
}

function getEnergyTarget(creep: Creep): Structure | Resource | Tombstone | Ruin | Source | null {
    const memory = creep.memory;
    const home = Game.rooms[creep.memory.home];

    const requiredAmount = Math.min(creep.store.getFreeCapacity(RESOURCE_ENERGY), 100);

    // TODO: Add target caching
    const targets = ([] as (Structure | Resource | Tombstone | Ruin)[]).concat(
        home.find(FIND_RUINS, {
            filter: (r) => r.store.getUsedCapacity(RESOURCE_ENERGY) >= requiredAmount
        }),
        home.find(FIND_TOMBSTONES, {
            filter: (tb) => tb.store.getUsedCapacity(RESOURCE_ENERGY) >= requiredAmount
        }),
        home.find(FIND_DROPPED_RESOURCES, {
            filter: (dr) => dr.resourceType === RESOURCE_ENERGY && dr.amount >= requiredAmount
        }),
        home.find(FIND_STRUCTURES, {
            filter: (s) => {
                if (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) {
                    if (s.store.getUsedCapacity(RESOURCE_ENERGY) >= requiredAmount) {
                        return true;
                    } else {
                        return false;
                    }
                }
                if (s.structureType === STRUCTURE_LINK) {
                    if (home.controller && home.controller.level >= 7) {
                        if (
                            Memory.rooms[memory.home].genBuildings !== undefined &&
                            s.pos.isEqualTo(unpackPosition(Memory.rooms[memory.home].genBuildings!.links[2].pos))
                        ) {
                            return false;
                        }
                    }
                    if (s.pos.isEqualTo(unpackPosition(Memory.rooms[memory.home].genBuildings!.links[0].pos))) {
                        if (s.store.getUsedCapacity(RESOURCE_ENERGY) >= requiredAmount) {
                            return true;
                        } else {
                            return false;
                        }
                    }
                    return false;
                } else {
                    return false;
                }
            }
        })
    );

    if (targets.length > 0) {
        targets.sort((a, b) => creep.pos.getRangeTo(a.pos) - creep.pos.getRangeTo(b.pos));
        return targets[0];
    } else {
        if (creep.getActiveBodyparts(WORK) > 0) {
            return creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        } else {
            return null;
        }
    }
}

export function onEdge(pos: RoomPosition | Creep): boolean {
    if (pos instanceof Creep) {
        pos = pos.pos;
    }
    if (pos.x === 0 || pos.x === 49 || pos.y === 0 || pos.y === 49) {
        return true;
    }
    return false;
}
