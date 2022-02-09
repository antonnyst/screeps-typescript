import { unpackPosition } from "../../utils/RoomPositionPacker";
import { getEnergy, setMovementData } from "../creep";

export interface UpgraderMemory extends CreepMemory {
    energy?: boolean;
}

export function upgrader(creep: Creep): void {
    const memory = creep.memory as UpgraderMemory;
    const home = Game.rooms[creep.memory.home];
    const controller = home.controller;
    if (controller === undefined) {
        return;
    }

    if (controller.level >= 7 && home.memory.genLayout !== undefined && home.memory.genBuildings !== undefined) {
        const containerPos = unpackPosition(home.memory.genLayout.controller);
        setMovementData(creep, { pos: containerPos, range: 1 });
        if (creep.pos.isNearTo(containerPos)) {
            if (
                creep.store.getUsedCapacity(RESOURCE_ENERGY) <=
                creep.getActiveBodyparts(WORK) * UPGRADE_CONTROLLER_POWER
            ) {
                if (creep.room.memory.genBuildings?.links[0].id !== undefined) {
                    const link = Game.getObjectById(creep.room.memory.genBuildings!.links[0].id);
                    if (link !== null && link instanceof StructureLink) {
                        creep.withdraw(link, RESOURCE_ENERGY);
                    }
                }
            }
            creep.upgradeController(controller);
        }
        return;
    }

    if (memory.energy === undefined) {
        memory.energy = false;
    }
    if (memory.energy === false && creep.store.getFreeCapacity() === 0) {
        memory.energy = true;
    }
    if (memory.energy === true && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        memory.energy = false;
    }

    if (memory.energy === false) {
        getEnergy(creep);
    } else {
        setMovementData(creep, { pos: controller.pos, range: 3 });
        if (creep.pos.inRangeTo(controller.pos, 3)) {
            creep.upgradeController(controller);
        }
    }
}
