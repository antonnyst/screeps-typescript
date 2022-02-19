import { PUSH_GCL_ENERGY_NEEDED } from "config/constants";
import { isOwnedRoom } from "../../utils/ownedRoom";
import { getEnergy, setMovementData } from "../creep";

export interface WorkerMemory extends CreepMemory {
    energy?: boolean;
    workerTarget?: Id<Structure | ConstructionSite>;
}

const builderPriority: BuildableStructureConstant[] = [
    STRUCTURE_SPAWN,
    STRUCTURE_TOWER,
    STRUCTURE_CONTAINER,
    STRUCTURE_EXTENSION
];

export function worker(creep: Creep): void {
    const memory = creep.memory as WorkerMemory;
    const home = Game.rooms[creep.memory.home];
    const controller = home.controller;
    if (controller === undefined || home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
        return;
    }

    if (memory.energy === undefined) {
        memory.energy = false;
    }
    if (memory.energy === false && creep.store.getFreeCapacity() === 0) {
        memory.energy = true;
        memory.workerTarget = undefined;
    }
    if (memory.energy === true && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        memory.energy = false;
    }

    if (memory.energy === false) {
        getEnergy(creep);
    } else {
        const target = getTarget(creep);
        if (target !== null) {
            if (target.pos.roomName !== creep.room.name) {
                setMovementData(creep, {
                    pos: new RoomPosition(25, 25, target.pos.roomName),
                    range: 23
                });
            } else {
                setMovementData(creep, {
                    pos: target.pos,
                    range: 3
                });
            }
            if (creep.pos.inRangeTo(target.pos, 3)) {
                if (target instanceof Structure) {
                    creep.repair(target);
                } else {
                    creep.build(target);
                }
            }
        } else if (
            (home.controller !== undefined &&
                (home.controller.level < 7 || home.controller.ticksToDowngrade < 40000)) ||
            (isOwnedRoom(home) &&
                home.memory.resources !== undefined &&
                home.memory.resources.total.energy > PUSH_GCL_ENERGY_NEEDED)
        ) {
            setMovementData(creep, { pos: controller.pos, range: 3 });
            if (creep.pos.inRangeTo(controller.pos, 3)) {
                creep.upgradeController(controller);
            }
        }
    }
}

function getTarget(creep: Creep): ConstructionSite | Structure | null {
    const memory = creep.memory as WorkerMemory;
    const home = Game.rooms[creep.memory.home];

    if (!isOwnedRoom(home)) {
        return null;
    }

    let target: ConstructionSite | Structure | null = null;

    if (memory.workerTarget !== undefined) {
        target = Game.getObjectById(memory.workerTarget);
    }

    if (target === null) {
        const targets = getTargets(home);
        if (targets.length > 0) {
            target = _.min(targets, (t) => {
                let range = getRange(creep.pos, t.pos);
                let priorityMultiplier = 0;
                if (t instanceof ConstructionSite) {
                    if (builderPriority.includes(t.structureType)) {
                        priorityMultiplier = builderPriority.findIndex((v) => t.structureType === v) + 1;
                    } else {
                        priorityMultiplier = builderPriority.length;
                    }
                } else {
                    priorityMultiplier = 1;
                }
                return range * priorityMultiplier;
            });
        }
    }

    if (target !== null) {
        if (target instanceof Structure) {
            if (target.hits === target.hitsMax || (target instanceof StructureRampart && Game.time % 10 === 0)) {
                target = null;
            }
        }
    }

    if (target !== null) {
        memory.workerTarget = target.id;
    } else {
        memory.workerTarget = undefined;
    }
    return target;
}

function getRange(pos1: RoomPosition, pos2: RoomPosition): number {
    if (pos1.roomName === pos2.roomName) {
        return pos1.getRangeTo(pos2);
    } else {
        return Game.map.getRoomLinearDistance(pos1.roomName, pos2.roomName) * 50;
    }
}

function getTargets(room: OwnedRoom): (ConstructionSite | Structure)[] {
    if (room.memory.repair !== undefined) {
        if (Object.keys(room.memory.repair).length > 0) {
            const targets: Structure[] = [];
            for (const key in room.memory.repair) {
                const object = Game.getObjectById(room.memory.repair[key].id);
                if (object !== null) {
                    targets.push(object);
                }
            }
            return targets;
        }
    }

    if (room.memory.placedCS !== undefined) {
        const targets: ConstructionSite[] = [];
        for (const site of room.memory.placedCS) {
            const object = Game.getObjectById(site.id);
            if (object !== null) {
                targets.push(object);
            }
        }

        return targets;
    }

    return [];
}
