import { Spawns } from "buildings";
import { getEnergy, setMovementData } from "../creep";

export interface FootMemory extends CreepMemory {
    energy?: boolean;
}

export function foot(creep: Creep): void {
    const memory = creep.memory as FootMemory;
    const home = Game.rooms[creep.memory.home];

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
        const targets = Spawns(home);
        if (targets !== null && targets[0] !== undefined) {
            setMovementData(creep, {
                pos: targets[0].pos,
                range: 1
            });
            if (creep.pos.isNearTo(targets[0])) {
                creep.transfer(targets[0], RESOURCE_ENERGY);
            }
        }
    }
}
